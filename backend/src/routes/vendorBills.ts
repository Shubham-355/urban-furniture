import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../lib/errors';
import { listQuerySchema, listResponse, paginate, serialize } from '../lib/http';
import { nextNumber } from '../lib/sequence';
import { amountDue, computeDocumentTotals } from '../domain/totals';
import { buildVendorBillEntry } from '../domain/journal';
import { formatINR } from '../lib/money';
import { footerNote, header, keyValues, renderPdf, table, totalsBlock } from '../lib/pdf';
import { sendMail } from '../lib/mailer';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireBackOffice } from '../middleware/auth';
import { vendorBillSchema } from '../validation/documents';
import { assertContact } from './contacts';
import { assertAnalyticType } from './budgets';
import {
  cancelEntriesForSource,
  draftEntriesForSource,
  journalIdByType,
  postEntry,
  systemAccountId,
} from '../services/accounting';

export const vendorBillsRouter = Router();

vendorBillsRouter.use(requireAuth, requireBackOffice);

const INCLUDE = {
  vendor: { select: { id: true, name: true, email: true, city: true, state: true } },
  purchaseOrder: { select: { id: true, number: true } },
  journalEntry: { select: { id: true, number: true, status: true } },
  lines: {
    include: {
      product: { select: { id: true, name: true, cost: true } },
      account: { select: { id: true, name: true, type: true } },
      analytic: { select: { id: true, name: true, type: true } },
    },
    orderBy: { sequence: 'asc' as const },
  },
  payments: {
    select: { id: true, number: true, amount: true, via: true, date: true },
    orderBy: { id: 'asc' as const },
  },
} as const;

type BillWithLines = {
  total: unknown;
  paidCash: unknown;
  paidBank: unknown;
  lines: { analyticId: number | null }[];
};

/** Add the derived Amount Due and the analytics the Budget smart button uses. */
function decorate<T extends BillWithLines>(bill: T) {
  return {
    ...bill,
    amountDue: amountDue(bill.total as never, bill.paidCash as never, bill.paidBank as never),
    analyticIds: [...new Set(bill.lines.map((l) => l.analyticId).filter(Boolean))] as number[],
  };
}

async function buildLines(
  lines: {
    productId: number;
    accountId?: number | null;
    analyticId?: number | null;
    quantity: number;
    unitPrice: number;
  }[],
) {
  const defaultAccountId = await systemAccountId(prisma, 'purchaseExpense');
  for (const line of lines) {
    if (line.analyticId) await assertAnalyticType(line.analyticId, 'EXPENSE');
  }
  const computed = computeDocumentTotals(lines);
  return {
    total: computed.total,
    data: lines.map((line, index) => ({
      sequence: index + 1,
      productId: line.productId,
      // Chart of Account defaults to Purchase Expense A/c.
      accountId: line.accountId ?? defaultAccountId,
      analyticId: line.analyticId ?? null,
      quantity: computed.lines[index].quantity,
      unitPrice: computed.lines[index].unitPrice,
      total: computed.lines[index].total,
    })),
  };
}

vendorBillsRouter.get(
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
              { reference: { contains: query.search, mode: 'insensitive' as const } },
              { vendor: { name: { contains: query.search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.vendorBill.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ billDate: 'desc' }, { id: 'desc' }],
        ...paginate(query),
      }),
      prisma.vendorBill.count({ where }),
    ]);

    res.json(listResponse(items.map(decorate), total, query));
  }),
);

vendorBillsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const bill = await prisma.vendorBill.findUnique({
      where: { id: Number(req.params.id) },
      include: INCLUDE,
    });
    if (!bill) throw notFound('Vendor bill not found');
    res.json(serialize(decorate(bill)));
  }),
);

vendorBillsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = vendorBillSchema.parse(req.body);
    await assertContact(input.vendorId, 'VENDOR');
    const { total, data } = await buildLines(input.lines);

    const bill = await prisma.$transaction(async (tx) => {
      const number = await nextNumber(tx, 'VENDOR_BILL', input.billDate);
      return tx.vendorBill.create({
        data: {
          number,
          vendorId: input.vendorId,
          reference: input.reference ?? null,
          billDate: input.billDate,
          dueDate: input.dueDate ?? null,
          status: 'DRAFT',
          total,
          purchaseOrderId: input.purchaseOrderId ?? null,
          lines: { create: data },
        },
        include: INCLUDE,
      });
    });

    res.status(201).json(serialize(decorate(bill)));
  }),
);

vendorBillsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const input = vendorBillSchema.parse(req.body);
    const existing = await prisma.vendorBill.findUnique({ where: { id } });
    if (!existing) throw notFound('Vendor bill not found');
    if (existing.status !== 'DRAFT') {
      throw badRequest('A confirmed bill cannot be edited. Reset it to draft first.');
    }

    await assertContact(input.vendorId, 'VENDOR');
    const { total, data } = await buildLines(input.lines);

    const bill = await prisma.$transaction(async (tx) => {
      await tx.vendorBillLine.deleteMany({ where: { billId: id } });
      return tx.vendorBill.update({
        where: { id },
        data: {
          vendorId: input.vendorId,
          reference: input.reference ?? null,
          billDate: input.billDate,
          dueDate: input.dueDate ?? null,
          total,
          lines: { create: data },
        },
        include: INCLUDE,
      });
    });

    res.json(serialize(decorate(bill)));
  }),
);

/**
 * Confirm posts the purchase entry:
 *   Debit  the account on each line (Purchase Expense A/c by default)
 *   Credit Creditors A/c with the bill total
 */
vendorBillsRouter.post(
  '/:id/confirm',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    const bill = await prisma.$transaction(async (tx) => {
      const existing = await tx.vendorBill.findUnique({ where: { id }, include: { lines: true } });
      if (!existing) throw notFound('Vendor bill not found');
      if (existing.status !== 'DRAFT') throw badRequest('This bill is already confirmed');
      if (existing.lines.length === 0) throw badRequest('Add at least one line before confirming');

      const creditorsAccountId = await systemAccountId(tx, 'creditors');
      const items = buildVendorBillEntry({
        partnerId: existing.vendorId,
        creditorsAccountId,
        lines: existing.lines.map((line) => ({
          accountId: line.accountId,
          total: line.total as never,
        })),
      });

      const entry = await postEntry(tx, {
        date: existing.billDate,
        journalId: await journalIdByType(tx, 'PURCHASE'),
        reference: existing.reference ?? existing.number,
        partnerId: existing.vendorId,
        items,
        sourceType: 'VENDOR_BILL',
        sourceId: existing.id,
        // System entries carry the source document number.
        number: existing.number,
      });

      return tx.vendorBill.update({
        where: { id },
        data: { status: 'CONFIRMED', journalEntryId: entry.id },
        include: INCLUDE,
      });
    });

    res.json(serialize(decorate(bill)));
  }),
);

/** Reset to Draft cancels the generated entry; paid bills must be kept intact. */
vendorBillsRouter.post(
  '/:id/reset-draft',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    const bill = await prisma.$transaction(async (tx) => {
      const existing = await tx.vendorBill.findUnique({ where: { id }, include: { payments: true } });
      if (!existing) throw notFound('Vendor bill not found');
      if (existing.status === 'DRAFT') throw badRequest('This bill is already a draft');
      if (existing.payments.length > 0) {
        throw badRequest('Payments have been recorded against this bill, so it cannot be reset');
      }

      // The entry follows the bill back to draft and is rewritten on the next
      // confirm, so the bill keeps one journal entry for its whole life.
      await draftEntriesForSource(tx, 'VENDOR_BILL', id);
      return tx.vendorBill.update({
        where: { id },
        data: { status: 'DRAFT' },
        include: INCLUDE,
      });
    });

    res.json(serialize(decorate(bill)));
  }),
);

vendorBillsRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    const bill = await prisma.$transaction(async (tx) => {
      const existing = await tx.vendorBill.findUnique({ where: { id }, include: { payments: true } });
      if (!existing) throw notFound('Vendor bill not found');
      if (existing.payments.length > 0) {
        throw badRequest('Payments have been recorded against this bill, so it cannot be cancelled');
      }
      await cancelEntriesForSource(tx, 'VENDOR_BILL', id);
      return tx.vendorBill.update({
        where: { id },
        data: { status: 'CANCELLED', journalEntryId: null },
        include: INCLUDE,
      });
    });

    res.json(serialize(decorate(bill)));
  }),
);

// ------------------------------------------------------------------- printing

async function billPdf(id: number): Promise<{ buffer: Buffer; filename: string; bill: NonNullable<Awaited<ReturnType<typeof loadBill>>> }> {
  const bill = await loadBill(id);
  if (!bill) throw notFound('Vendor bill not found');
  const due = amountDue(bill.total as never, bill.paidCash as never, bill.paidBank as never);

  const buffer = await renderPdf((doc) => {
    header(doc, `Vendor Bill ${bill.number}`, bill.vendor.name);
    keyValues(doc, [
      ['Vendor', bill.vendor.name],
      ['Status', bill.status],
      ['Bill Reference', bill.reference ?? '-'],
      ['Bill Date', bill.billDate.toLocaleDateString('en-IN')],
      ['Due Date', bill.dueDate ? bill.dueDate.toLocaleDateString('en-IN') : '-'],
      ['Source PO', bill.purchaseOrder?.number ?? '-'],
    ]);
    table(
      doc,
      [
        { label: 'Sr.', width: 30 },
        { label: 'Product', width: 130 },
        { label: 'Account', width: 105 },
        { label: 'Analytic', width: 90 },
        { label: 'Qty', width: 40, align: 'right' },
        { label: 'Unit Price', width: 80, money: true },
        { label: 'Total', width: 80, money: true },
      ],
      bill.lines.map((line, index) => [
        index + 1,
        line.product.name,
        line.account.name,
        line.analytic?.name ?? '-',
        Number(line.quantity),
        Number(line.unitPrice),
        Number(line.total),
      ]),
    );
    totalsBlock(doc, [
      ['Total', Number(bill.total)],
      ['Paid Via Cash', Number(bill.paidCash)],
      ['Paid Via Bank', Number(bill.paidBank)],
      ['Amount Due', due],
    ]);
    footerNote(doc, 'Urban Furniture Accounting System - generated document.');
  });

  return { buffer, filename: `${bill.number.replace(/\//g, '-')}.pdf`, bill };
}

function loadBill(id: number) {
  return prisma.vendorBill.findUnique({ where: { id }, include: INCLUDE });
}

vendorBillsRouter.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    const { buffer, filename } = await billPdf(Number(req.params.id));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }),
);

vendorBillsRouter.post(
  '/:id/send',
  asyncHandler(async (req, res) => {
    const { buffer, filename, bill } = await billPdf(Number(req.params.id));
    const due = amountDue(bill.total as never, bill.paidCash as never, bill.paidBank as never);

    const result = await sendMail({
      to: bill.vendor.email,
      subject: `Vendor Bill ${bill.number} from Urban Furniture`,
      text: `Hello ${bill.vendor.name},\n\nPlease find attached vendor bill ${bill.number} for ${formatINR(bill.total as never)}. Amount due: ${formatINR(due)}.\n\nUrban Furniture`,
      attachments: [{ filename, content: buffer, contentType: 'application/pdf' }],
    });

    res.json({
      message: result.delivered
        ? `Bill ${bill.number} emailed to ${bill.vendor.email}`
        : `Bill ${bill.number} could not be emailed. ${result.reason ?? ''}`.trim(),
      ...result,
    });
  }),
);
