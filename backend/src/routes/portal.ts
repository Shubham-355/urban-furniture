import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { badRequest, forbidden, notFound } from '../lib/errors';
import { dateSchema, moneySchema, serialize } from '../lib/http';
import { amountDue } from '../domain/totals';
import { asyncHandler } from '../middleware/error';
import { ownContactId, requireAuth, requireRole } from '../middleware/auth';
import { recordPayment } from '../services/payments';

/**
 * The contact portal. A CONTACT user only ever sees rows where the partner is
 * their own contact - every query below is scoped by `ownContactId`.
 */
export const portalRouter = Router();

portalRouter.use(requireAuth, requireRole('CONTACT'));

portalRouter.get(
  '/documents',
  asyncHandler(async (req, res) => {
    const contactId = ownContactId(req);

    const [contact, invoices, bills] = await Promise.all([
      prisma.contact.findUnique({
        where: { id: contactId },
        select: { id: true, name: true, email: true, mobile: true, imageUrl: true, type: true },
      }),
      prisma.customerInvoice.findMany({
        where: { customerId: contactId, isArchived: false, status: { not: 'DRAFT' } },
        orderBy: [{ invoiceDate: 'desc' }, { id: 'desc' }],
      }),
      prisma.vendorBill.findMany({
        where: { vendorId: contactId, isArchived: false, status: { not: 'DRAFT' } },
        orderBy: [{ billDate: 'desc' }, { id: 'desc' }],
      }),
    ]);

    if (!contact) throw notFound('Contact not found');

    const decorate = <T extends { total: unknown; paidCash: unknown; paidBank: unknown; status: string }>(
      row: T,
      date: Date,
      dueDate: Date | null,
    ) => {
      const due = amountDue(row.total as never, row.paidCash as never, row.paidBank as never);
      return {
        ...row,
        date,
        dueDate,
        amountDue: due,
        paymentStatus: row.status === 'PAID' || due === 0 ? 'Paid' : 'Unpaid',
      };
    };

    res.json(
      serialize({
        contact,
        invoices: invoices.map((invoice) =>
          decorate(invoice, invoice.invoiceDate, invoice.dueDate),
        ),
        bills: bills.map((bill) => decorate(bill, bill.billDate, bill.dueDate)),
      }),
    );
  }),
);

const portalPaymentSchema = z.object({
  documentType: z.enum(['INVOICE', 'BILL']),
  documentId: z.coerce.number().int().positive(),
  amount: moneySchema.gt(0, 'Amount must be greater than zero'),
  date: dateSchema,
  via: z.enum(['BANK', 'CASH']).default('BANK'),
  note: z.string().trim().max(300).optional().nullable(),
});

/** Paying a due from the portal goes through exactly the same posting logic. */
portalRouter.post(
  '/payments',
  asyncHandler(async (req, res) => {
    const contactId = ownContactId(req);
    const input = portalPaymentSchema.parse(req.body);

    const payment = await prisma.$transaction(async (tx) => {
      if (input.documentType === 'INVOICE') {
        const invoice = await tx.customerInvoice.findUnique({ where: { id: input.documentId } });
        if (!invoice) throw notFound('Invoice not found');
        if (invoice.customerId !== contactId) throw forbidden('This invoice is not yours');
        return recordPayment(tx, {
          type: 'RECEIVE',
          partnerId: contactId,
          amount: input.amount,
          date: input.date,
          via: input.via,
          note: input.note ?? 'Paid from the contact portal',
          invoiceId: invoice.id,
        });
      }

      const bill = await tx.vendorBill.findUnique({ where: { id: input.documentId } });
      if (!bill) throw notFound('Bill not found');
      if (bill.vendorId !== contactId) throw forbidden('This bill is not yours');
      return recordPayment(tx, {
        type: 'SEND',
        partnerId: contactId,
        amount: input.amount,
        date: input.date,
        via: input.via,
        note: input.note ?? 'Paid from the contact portal',
        billId: bill.id,
      });
    });

    res.status(201).json(serialize(payment));
  }),
);

/** PDF of one of the contact's own documents. */
portalRouter.get(
  '/documents/:type/:id/pdf',
  asyncHandler(async (req, res) => {
    const contactId = ownContactId(req);
    const id = Number(req.params.id);
    const type = req.params.type.toUpperCase();

    if (type === 'INVOICE') {
      const invoice = await prisma.customerInvoice.findUnique({ where: { id } });
      if (!invoice) throw notFound('Invoice not found');
      if (invoice.customerId !== contactId) throw forbidden('This invoice is not yours');
      const { invoicePdf } = await import('./customerInvoices');
      const { buffer, filename } = await invoicePdf(id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
      return;
    }

    if (type === 'BILL') {
      const bill = await prisma.vendorBill.findUnique({ where: { id } });
      if (!bill) throw notFound('Bill not found');
      if (bill.vendorId !== contactId) throw forbidden('This bill is not yours');
      const { buffer, filename } = await portalBillPdf(id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
      return;
    }

    throw badRequest('Unknown document type');
  }),
);

/** Small local copy of the bill PDF so the portal does not import back office routes. */
async function portalBillPdf(id: number) {
  const { renderPdf, header, keyValues, table, totalsBlock, footerNote } = await import('../lib/pdf');
  const bill = await prisma.vendorBill.findUniqueOrThrow({
    where: { id },
    include: {
      vendor: { select: { name: true } },
      lines: { include: { product: { select: { name: true } } }, orderBy: { sequence: 'asc' } },
    },
  });
  const due = amountDue(bill.total as never, bill.paidCash as never, bill.paidBank as never);

  const buffer = await renderPdf((doc) => {
    header(doc, `Vendor Bill ${bill.number}`, bill.vendor.name);
    keyValues(doc, [
      ['Status', bill.status],
      ['Bill Date', bill.billDate.toLocaleDateString('en-IN')],
      ['Reference', bill.reference ?? '-'],
      ['Due Date', bill.dueDate ? bill.dueDate.toLocaleDateString('en-IN') : '-'],
    ]);
    table(
      doc,
      [
        { label: 'Sr.', width: 40 },
        { label: 'Product', width: 215 },
        { label: 'Qty', width: 60, align: 'right' },
        { label: 'Unit Price', width: 100, money: true },
        { label: 'Total', width: 100, money: true },
      ],
      bill.lines.map((line, index) => [
        index + 1,
        line.product.name,
        Number(line.quantity),
        Number(line.unitPrice),
        Number(line.total),
      ]),
    );
    totalsBlock(doc, [
      ['Total', Number(bill.total)],
      ['Amount Due', due],
    ]);
    footerNote(doc, 'Urban Furniture Accounting System - contact portal copy.');
  });

  return { buffer, filename: `${bill.number.replace(/\//g, '-')}.pdf` };
}
