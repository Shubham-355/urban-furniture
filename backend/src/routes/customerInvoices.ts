import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../lib/errors';
import { listQuerySchema, listResponse, paginate, serialize } from '../lib/http';
import { nextNumber } from '../lib/sequence';
import { amountDue, computeDocumentTotals } from '../domain/totals';
import { buildCustomerInvoiceEntry } from '../domain/journal';
import { formatINR } from '../lib/money';
import { footerNote, header, keyValues, renderPdf, table, totalsBlock } from '../lib/pdf';
import { sendMail } from '../lib/mailer';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireBackOffice } from '../middleware/auth';
import { customerInvoiceSchema } from '../validation/documents';
import { assertContact } from './contacts';
import { assertAnalyticType } from './budgets';
import {
  cancelEntriesForSource,
  journalIdByType,
  postEntry,
  systemAccountId,
} from '../services/accounting';

export const customerInvoicesRouter = Router();

customerInvoicesRouter.use(requireAuth, requireBackOffice);

export const INVOICE_INCLUDE = {
  customer: { select: { id: true, name: true, email: true, city: true, state: true } },
  salesOrder: { select: { id: true, number: true } },
  journalEntry: { select: { id: true, number: true, status: true } },
  lines: {
    include: {
      product: { select: { id: true, name: true, salesPrice: true } },
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

type InvoiceWithLines = {
  total: unknown;
  paidCash: unknown;
  paidBank: unknown;
  lines: { analyticId: number | null }[];
};

export function decorateInvoice<T extends InvoiceWithLines>(invoice: T) {
  return {
    ...invoice,
    amountDue: amountDue(
      invoice.total as never,
      invoice.paidCash as never,
      invoice.paidBank as never,
    ),
    analyticIds: [...new Set(invoice.lines.map((l) => l.analyticId).filter(Boolean))] as number[],
  };
}

async function buildLines(
  lines: {
    productId: number;
    accountId?: number | null;
    analyticId?: number | null;
    quantity: number;
    unitPrice: number;
    taxPercent: number;
  }[],
) {
  const defaultAccountId = await systemAccountId(prisma, 'salesIncome');
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
      // Chart of Accounts defaults to Sales Income A/c.
      accountId: line.accountId ?? defaultAccountId,
      analyticId: line.analyticId ?? null,
      quantity: computed.lines[index].quantity,
      unitPrice: computed.lines[index].unitPrice,
      taxPercent: computed.lines[index].taxPercent,
      taxAmount: computed.lines[index].taxAmount,
      total: computed.lines[index].total,
    })),
  };
}

customerInvoicesRouter.get(
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
              { customer: { name: { contains: query.search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.customerInvoice.findMany({
        where,
        include: INVOICE_INCLUDE,
        orderBy: [{ invoiceDate: 'desc' }, { id: 'desc' }],
        ...paginate(query),
      }),
      prisma.customerInvoice.count({ where }),
    ]);

    res.json(listResponse(items.map(decorateInvoice), total, query));
  }),
);

customerInvoicesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const invoice = await prisma.customerInvoice.findUnique({
      where: { id: Number(req.params.id) },
      include: INVOICE_INCLUDE,
    });
    if (!invoice) throw notFound('Customer invoice not found');
    res.json(serialize(decorateInvoice(invoice)));
  }),
);

customerInvoicesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = customerInvoiceSchema.parse(req.body);
    await assertContact(input.customerId, 'CUSTOMER');
    const { subtotal, taxTotal, total, data } = await buildLines(input.lines);

    const invoice = await prisma.$transaction(async (tx) => {
      const number = await nextNumber(tx, 'CUSTOMER_INVOICE', input.invoiceDate);
      return tx.customerInvoice.create({
        data: {
          number,
          customerId: input.customerId,
          reference: input.reference ?? null,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate ?? null,
          status: 'DRAFT',
          subtotal,
          taxTotal,
          total,
          salesOrderId: input.salesOrderId ?? null,
          lines: { create: data },
        },
        include: INVOICE_INCLUDE,
      });
    });

    res.status(201).json(serialize(decorateInvoice(invoice)));
  }),
);

customerInvoicesRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const input = customerInvoiceSchema.parse(req.body);
    const existing = await prisma.customerInvoice.findUnique({ where: { id } });
    if (!existing) throw notFound('Customer invoice not found');
    if (existing.status !== 'DRAFT') {
      throw badRequest('A confirmed invoice cannot be edited. Reset it to draft first.');
    }

    await assertContact(input.customerId, 'CUSTOMER');
    const { subtotal, taxTotal, total, data } = await buildLines(input.lines);

    const invoice = await prisma.$transaction(async (tx) => {
      await tx.customerInvoiceLine.deleteMany({ where: { invoiceId: id } });
      return tx.customerInvoice.update({
        where: { id },
        data: {
          customerId: input.customerId,
          reference: input.reference ?? null,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate ?? null,
          subtotal,
          taxTotal,
          total,
          lines: { create: data },
        },
        include: INVOICE_INCLUDE,
      });
    });

    res.json(serialize(decorateInvoice(invoice)));
  }),
);

/**
 * Confirm posts the sales entry:
 *   Debit  Debtors A/c        invoice total
 *   Credit Sales Income A/c   untaxed line amounts (per line account)
 *   Credit Tax Payable A/c    tax, when any line carries tax
 */
customerInvoicesRouter.post(
  '/:id/confirm',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    const invoice = await prisma.$transaction(async (tx) => {
      const existing = await tx.customerInvoice.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!existing) throw notFound('Customer invoice not found');
      if (existing.status !== 'DRAFT') throw badRequest('This invoice is already confirmed');
      if (existing.lines.length === 0) throw badRequest('Add at least one line before confirming');

      const [debtorsAccountId, taxAccountId] = await Promise.all([
        systemAccountId(tx, 'debtors'),
        systemAccountId(tx, 'taxPayable'),
      ]);

      const items = buildCustomerInvoiceEntry({
        partnerId: existing.customerId,
        debtorsAccountId,
        taxAccountId,
        lines: existing.lines.map((line) => ({
          accountId: line.accountId,
          subtotal: Number(line.total) - Number(line.taxAmount),
          taxAmount: line.taxAmount as never,
        })),
      });

      const entry = await postEntry(tx, {
        date: existing.invoiceDate,
        journalId: await journalIdByType(tx, 'SALES'),
        reference: existing.reference ?? existing.number,
        partnerId: existing.customerId,
        items,
        sourceType: 'CUSTOMER_INVOICE',
        sourceId: existing.id,
        number: existing.number,
      });

      return tx.customerInvoice.update({
        where: { id },
        data: { status: 'CONFIRMED', journalEntryId: entry.id },
        include: INVOICE_INCLUDE,
      });
    });

    res.json(serialize(decorateInvoice(invoice)));
  }),
);

customerInvoicesRouter.post(
  '/:id/reset-draft',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    const invoice = await prisma.$transaction(async (tx) => {
      const existing = await tx.customerInvoice.findUnique({
        where: { id },
        include: { payments: true },
      });
      if (!existing) throw notFound('Customer invoice not found');
      if (existing.status === 'DRAFT') throw badRequest('This invoice is already a draft');
      if (existing.payments.length > 0) {
        throw badRequest('Payments have been received against this invoice, so it cannot be reset');
      }

      await cancelEntriesForSource(tx, 'CUSTOMER_INVOICE', id);
      return tx.customerInvoice.update({
        where: { id },
        data: { status: 'DRAFT', journalEntryId: null },
        include: INVOICE_INCLUDE,
      });
    });

    res.json(serialize(decorateInvoice(invoice)));
  }),
);

customerInvoicesRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    const invoice = await prisma.$transaction(async (tx) => {
      const existing = await tx.customerInvoice.findUnique({
        where: { id },
        include: { payments: true },
      });
      if (!existing) throw notFound('Customer invoice not found');
      if (existing.payments.length > 0) {
        throw badRequest('Payments have been received against this invoice, so it cannot be cancelled');
      }
      await cancelEntriesForSource(tx, 'CUSTOMER_INVOICE', id);
      return tx.customerInvoice.update({
        where: { id },
        data: { status: 'CANCELLED', journalEntryId: null },
        include: INVOICE_INCLUDE,
      });
    });

    res.json(serialize(decorateInvoice(invoice)));
  }),
);

// ------------------------------------------------------------------- printing

export async function invoicePdf(id: number) {
  const invoice = await prisma.customerInvoice.findUnique({
    where: { id },
    include: INVOICE_INCLUDE,
  });
  if (!invoice) throw notFound('Customer invoice not found');
  const due = amountDue(
    invoice.total as never,
    invoice.paidCash as never,
    invoice.paidBank as never,
  );

  const buffer = await renderPdf((doc) => {
    header(doc, `Customer Invoice ${invoice.number}`, invoice.customer.name);
    keyValues(doc, [
      ['Customer', invoice.customer.name],
      ['Status', invoice.status],
      ['Invoice Reference', invoice.reference ?? '-'],
      ['Invoice Date', invoice.invoiceDate.toLocaleDateString('en-IN')],
      ['Due Date', invoice.dueDate ? invoice.dueDate.toLocaleDateString('en-IN') : '-'],
      ['Source SO', invoice.salesOrder?.number ?? '-'],
    ]);
    table(
      doc,
      [
        { label: 'Sr.', width: 26 },
        { label: 'Product', width: 116 },
        { label: 'Account', width: 96 },
        { label: 'Analytic', width: 80 },
        { label: 'Qty', width: 34, align: 'right' },
        { label: 'Unit Price', width: 72, money: true },
        { label: 'Tax %', width: 40, align: 'right' },
        { label: 'Total', width: 76, money: true },
      ],
      invoice.lines.map((line, index) => [
        index + 1,
        line.product.name,
        line.account.name,
        line.analytic?.name ?? '-',
        Number(line.quantity),
        Number(line.unitPrice),
        Number(line.taxPercent),
        Number(line.total),
      ]),
    );
    totalsBlock(doc, [
      ['Subtotal', Number(invoice.subtotal)],
      ['Tax', Number(invoice.taxTotal)],
      ['Total', Number(invoice.total)],
      ['Paid Via Cash', Number(invoice.paidCash)],
      ['Paid Via Bank', Number(invoice.paidBank)],
      ['Amount Due', due],
    ]);
    footerNote(doc, 'Urban Furniture Accounting System - generated document.');
  });

  return { buffer, filename: `${invoice.number.replace(/\//g, '-')}.pdf`, invoice, due };
}

customerInvoicesRouter.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    const { buffer, filename } = await invoicePdf(Number(req.params.id));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }),
);

customerInvoicesRouter.post(
  '/:id/send',
  asyncHandler(async (req, res) => {
    const { buffer, filename, invoice, due } = await invoicePdf(Number(req.params.id));

    const result = await sendMail({
      to: invoice.customer.email,
      subject: `Invoice ${invoice.number} from Urban Furniture`,
      text: `Hello ${invoice.customer.name},\n\nPlease find attached invoice ${invoice.number} for ${formatINR(invoice.total as never)}. Amount due: ${formatINR(due)}.\n\nThank you for your business.\nUrban Furniture`,
      attachments: [{ filename, content: buffer, contentType: 'application/pdf' }],
    });

    res.json({
      message: result.delivered
        ? `Invoice ${invoice.number} emailed to ${invoice.customer.email}`
        : `Invoice ${invoice.number} could not be emailed. ${result.reason ?? ''}`.trim(),
      ...result,
    });
  }),
);
