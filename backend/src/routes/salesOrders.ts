import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../lib/errors';
import { listQuerySchema, listResponse, paginate, serialize } from '../lib/http';
import { nextNumber } from '../lib/sequence';
import { computeDocumentTotals } from '../domain/totals';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireBackOffice } from '../middleware/auth';
import { salesOrderSchema } from '../validation/documents';
import { assertContact } from './contacts';
import { assertAnalyticType } from './budgets';

export const salesOrdersRouter = Router();

salesOrdersRouter.use(requireAuth, requireBackOffice);

const INCLUDE = {
  customer: { select: { id: true, name: true, email: true, type: true } },
  lines: {
    include: {
      product: { select: { id: true, name: true, salesPrice: true } },
      analytic: { select: { id: true, name: true, type: true } },
    },
    orderBy: { sequence: 'asc' as const },
  },
  invoices: { select: { id: true, number: true, status: true } },
} as const;

async function buildLines(
  lines: {
    productId: number;
    analyticId?: number | null;
    quantity: number;
    unitPrice: number;
    taxPercent: number;
  }[],
) {
  for (const line of lines) {
    if (line.analyticId) await assertAnalyticType(line.analyticId, 'INCOME');
  }
  const computed = computeDocumentTotals(lines);
  return {
    subtotal: computed.subtotal,
    taxTotal: computed.taxTotal,
    total: computed.total,
    data: lines.map((line, index) => ({
      sequence: index + 1,
      productId: line.productId,
      analyticId: line.analyticId ?? null,
      quantity: computed.lines[index].quantity,
      unitPrice: computed.lines[index].unitPrice,
      taxPercent: computed.lines[index].taxPercent,
      taxAmount: computed.lines[index].taxAmount,
      total: computed.lines[index].total,
    })),
  };
}

salesOrdersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const where = {
      ...(query.archived === 'all' ? {} : { isArchived: query.archived === 'true' }),
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.search
        ? {
            OR: [
              { number: { contains: query.search, mode: 'insensitive' as const } },
              { customer: { name: { contains: query.search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        ...paginate(query),
      }),
      prisma.salesOrder.count({ where }),
    ]);

    res.json(listResponse(items, total, query));
  }),
);

salesOrdersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await prisma.salesOrder.findUnique({
      where: { id: Number(req.params.id) },
      include: INCLUDE,
    });
    if (!order) throw notFound('Sales order not found');
    res.json(serialize(order));
  }),
);

salesOrdersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = salesOrderSchema.parse(req.body);
    await assertContact(input.customerId, 'CUSTOMER');
    const { subtotal, taxTotal, total, data } = await buildLines(input.lines);

    const order = await prisma.$transaction(async (tx) => {
      const number = await nextNumber(tx, 'SALES_ORDER', input.date);
      return tx.salesOrder.create({
        data: {
          number,
          customerId: input.customerId,
          date: input.date,
          status: 'DRAFT',
          subtotal,
          taxTotal,
          total,
          lines: { create: data },
        },
        include: INCLUDE,
      });
    });

    res.status(201).json(serialize(order));
  }),
);

salesOrdersRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const input = salesOrderSchema.parse(req.body);
    const existing = await prisma.salesOrder.findUnique({ where: { id } });
    if (!existing) throw notFound('Sales order not found');
    if (existing.status !== 'DRAFT') throw badRequest('Only a draft sales order can be edited');

    await assertContact(input.customerId, 'CUSTOMER');
    const { subtotal, taxTotal, total, data } = await buildLines(input.lines);

    const order = await prisma.$transaction(async (tx) => {
      await tx.salesOrderLine.deleteMany({ where: { orderId: id } });
      return tx.salesOrder.update({
        where: { id },
        data: {
          customerId: input.customerId,
          date: input.date,
          subtotal,
          taxTotal,
          total,
          lines: { create: data },
        },
        include: INCLUDE,
      });
    });

    res.json(serialize(order));
  }),
);

/** Like a purchase order, confirming a sales order creates no journal entry. */
salesOrdersRouter.post(
  '/:id/confirm',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.salesOrder.findUnique({ where: { id } });
    if (!existing) throw notFound('Sales order not found');
    if (existing.status !== 'DRAFT') throw badRequest('This sales order is already confirmed');

    const order = await prisma.salesOrder.update({
      where: { id },
      data: { status: 'CONFIRMED' },
      include: INCLUDE,
    });
    res.json(serialize(order));
  }),
);

salesOrdersRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.salesOrder.findUnique({
      where: { id },
      include: { invoices: true },
    });
    if (!existing) throw notFound('Sales order not found');
    if (existing.invoices.some((invoice) => invoice.status !== 'CANCELLED')) {
      throw badRequest('Cancel the invoice created from this order first');
    }

    const order = await prisma.salesOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: INCLUDE,
    });
    res.json(serialize(order));
  }),
);

salesOrdersRouter.post(
  '/:id/create-invoice',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const order = await prisma.salesOrder.findUnique({ where: { id }, include: { lines: true } });
    if (!order) throw notFound('Sales order not found');
    if (order.status !== 'CONFIRMED') {
      throw badRequest('Confirm the sales order before creating an invoice');
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const salesIncome = await tx.account.findFirst({ where: { name: 'Sales Income A/c' } });
      const fallback = await tx.account.findFirst({ where: { type: 'INCOME' } });
      const accountId = salesIncome?.id ?? fallback?.id;
      if (!accountId) throw badRequest('No income account exists. Run the seed first.');

      const invoiceDate = new Date();
      const number = await nextNumber(tx, 'CUSTOMER_INVOICE', invoiceDate);
      const created = await tx.customerInvoice.create({
        data: {
          number,
          customerId: order.customerId,
          invoiceDate,
          dueDate: null,
          status: 'DRAFT',
          subtotal: order.subtotal,
          taxTotal: order.taxTotal,
          total: order.total,
          salesOrderId: order.id,
          lines: {
            create: order.lines.map((line, index) => ({
              sequence: index + 1,
              productId: line.productId,
              accountId,
              analyticId: line.analyticId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              taxPercent: line.taxPercent,
              taxAmount: line.taxAmount,
              total: line.total,
            })),
          },
        },
      });

      await tx.salesOrder.update({ where: { id: order.id }, data: { status: 'INVOICED' } });
      return created;
    });

    res.status(201).json(serialize({ id: invoice.id, number: invoice.number }));
  }),
);
