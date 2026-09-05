import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../lib/errors';
import { listQuerySchema, listResponse, paginate, serialize } from '../lib/http';
import { nextNumber } from '../lib/sequence';
import { computeDocumentTotals } from '../domain/totals';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireBackOffice } from '../middleware/auth';
import { purchaseOrderSchema } from '../validation/documents';
import { assertContact } from './contacts';
import { assertAnalyticType } from './budgets';

export const purchaseOrdersRouter = Router();

purchaseOrdersRouter.use(requireAuth, requireBackOffice);

const INCLUDE = {
  vendor: { select: { id: true, name: true, email: true, type: true } },
  lines: {
    include: {
      product: { select: { id: true, name: true, cost: true, salesPrice: true } },
      analytic: { select: { id: true, name: true, type: true } },
    },
    orderBy: { sequence: 'asc' as const },
  },
  bills: { select: { id: true, number: true, status: true } },
} as const;

purchaseOrdersRouter.get(
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
              { vendor: { name: { contains: query.search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        ...paginate(query),
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    res.json(listResponse(items, total, query));
  }),
);

purchaseOrdersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: Number(req.params.id) },
      include: INCLUDE,
    });
    if (!order) throw notFound('Purchase order not found');
    res.json(serialize(order));
  }),
);

/** Line totals and the footer total are always recomputed on the server. */
async function buildLines(lines: { productId: number; analyticId?: number | null; quantity: number; unitPrice: number }[]) {
  for (const line of lines) {
    if (line.analyticId) await assertAnalyticType(line.analyticId, 'EXPENSE');
  }
  const computed = computeDocumentTotals(lines);
  return {
    total: computed.total,
    data: lines.map((line, index) => ({
      sequence: index + 1,
      productId: line.productId,
      analyticId: line.analyticId ?? null,
      quantity: computed.lines[index].quantity,
      unitPrice: computed.lines[index].unitPrice,
      total: computed.lines[index].total,
    })),
  };
}

purchaseOrdersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = purchaseOrderSchema.parse(req.body);
    await assertContact(input.vendorId, 'VENDOR');
    const { total, data } = await buildLines(input.lines);

    const order = await prisma.$transaction(async (tx) => {
      const number = await nextNumber(tx, 'PURCHASE_ORDER', input.date);
      return tx.purchaseOrder.create({
        data: {
          number,
          vendorId: input.vendorId,
          date: input.date,
          status: 'DRAFT',
          total,
          lines: { create: data },
        },
        include: INCLUDE,
      });
    });

    res.status(201).json(serialize(order));
  }),
);

purchaseOrdersRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const input = purchaseOrderSchema.parse(req.body);
    const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!existing) throw notFound('Purchase order not found');
    if (existing.status !== 'DRAFT') throw badRequest('Only a draft purchase order can be edited');

    await assertContact(input.vendorId, 'VENDOR');
    const { total, data } = await buildLines(input.lines);

    const order = await prisma.$transaction(async (tx) => {
      await tx.purchaseOrderLine.deleteMany({ where: { orderId: id } });
      return tx.purchaseOrder.update({
        where: { id },
        data: {
          vendorId: input.vendorId,
          date: input.date,
          total,
          lines: { create: data },
        },
        include: INCLUDE,
      });
    });

    res.json(serialize(order));
  }),
);

/** Confirming a purchase order deliberately creates no journal entry. */
purchaseOrdersRouter.post(
  '/:id/confirm',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!existing) throw notFound('Purchase order not found');
    if (existing.status !== 'DRAFT') throw badRequest('This purchase order is already confirmed');

    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CONFIRMED' },
      include: INCLUDE,
    });
    res.json(serialize(order));
  }),
);

purchaseOrdersRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { bills: true },
    });
    if (!existing) throw notFound('Purchase order not found');
    if (existing.bills.some((bill) => bill.status !== 'CANCELLED')) {
      throw badRequest('Cancel the vendor bill created from this order first');
    }

    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: INCLUDE,
    });
    res.json(serialize(order));
  }),
);

/** Copies vendor, products, quantities, prices and analytics onto a new bill. */
purchaseOrdersRouter.post(
  '/:id/create-bill',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!order) throw notFound('Purchase order not found');
    if (order.status !== 'CONFIRMED') {
      throw badRequest('Confirm the purchase order before creating a bill');
    }

    const bill = await prisma.$transaction(async (tx) => {
      const purchaseExpense = await tx.account.findFirst({
        where: { name: 'Purchase Expense A/c' },
      });
      const fallback = await tx.account.findFirst({ where: { type: 'EXPENSE' } });
      const accountId = purchaseExpense?.id ?? fallback?.id;
      if (!accountId) throw badRequest('No expense account exists. Run the seed first.');

      const billDate = new Date();
      const number = await nextNumber(tx, 'VENDOR_BILL', billDate);
      const created = await tx.vendorBill.create({
        data: {
          number,
          vendorId: order.vendorId,
          billDate,
          dueDate: null,
          status: 'DRAFT',
          total: order.total,
          purchaseOrderId: order.id,
          lines: {
            create: order.lines.map((line, index) => ({
              sequence: index + 1,
              productId: line.productId,
              accountId,
              analyticId: line.analyticId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              total: line.total,
            })),
          },
        },
      });

      await tx.purchaseOrder.update({ where: { id: order.id }, data: { status: 'BILLED' } });
      return created;
    });

    res.status(201).json(serialize({ id: bill.id, number: bill.number }));
  }),
);
