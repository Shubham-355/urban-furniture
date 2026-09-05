import type { Tx } from '../lib/prisma';
import { badRequest } from '../lib/errors';
import { nextNumber } from '../lib/sequence';
import { amountDue } from '../domain/totals';
import { round2, toPaise } from '../lib/money';
import { buildPaymentEntry } from '../domain/journal';
import { journalIdByType, postEntry, systemAccountId } from './accounting';

/**
 * Recording a payment. Shared by Purchase > Payment, Sales > Receipt and the
 * contact portal so all three go through exactly the same accounting.
 */

export interface RecordPaymentInput {
  type: 'SEND' | 'RECEIVE';
  partnerId: number;
  amount: number;
  date: Date;
  via: 'BANK' | 'CASH';
  note?: string | null;
  billId?: number | null;
  invoiceId?: number | null;
}

export async function recordPayment(tx: Tx, input: RecordPaymentInput) {
  const amount = round2(input.amount);
  if (toPaise(amount) <= 0) throw badRequest('Amount must be greater than zero');

  // --- validate against the document being settled ------------------------
  if (input.billId) {
    const bill = await tx.vendorBill.findUnique({ where: { id: input.billId } });
    if (!bill) throw badRequest('The vendor bill no longer exists');
    if (bill.status !== 'CONFIRMED') {
      throw badRequest('Only a confirmed vendor bill can be paid');
    }
    const due = amountDue(bill.total as never, bill.paidCash as never, bill.paidBank as never);
    if (toPaise(amount) > toPaise(due)) {
      throw badRequest(`Amount cannot exceed the amount due of ${due.toFixed(2)}`);
    }
    if (bill.vendorId !== input.partnerId) {
      throw badRequest('The payment partner does not match the vendor on the bill');
    }
  }

  if (input.invoiceId) {
    const invoice = await tx.customerInvoice.findUnique({ where: { id: input.invoiceId } });
    if (!invoice) throw badRequest('The customer invoice no longer exists');
    if (invoice.status !== 'CONFIRMED') {
      throw badRequest('Only a confirmed customer invoice can be paid');
    }
    const due = amountDue(
      invoice.total as never,
      invoice.paidCash as never,
      invoice.paidBank as never,
    );
    if (toPaise(amount) > toPaise(due)) {
      throw badRequest(`Amount cannot exceed the amount due of ${due.toFixed(2)}`);
    }
    if (invoice.customerId !== input.partnerId) {
      throw badRequest('The payment partner does not match the customer on the invoice');
    }
  }

  // --- journal entry -------------------------------------------------------
  const [liquidityAccountId, debtorsAccountId, creditorsAccountId] = await Promise.all([
    systemAccountId(tx, input.via === 'BANK' ? 'bank' : 'cash'),
    systemAccountId(tx, 'debtors'),
    systemAccountId(tx, 'creditors'),
  ]);

  const items = buildPaymentEntry({
    type: input.type,
    partnerId: input.partnerId,
    amount,
    liquidityAccountId,
    debtorsAccountId,
    creditorsAccountId,
  });

  const number = await nextNumber(tx, 'PAYMENT', input.date);
  const journalId = await journalIdByType(tx, input.via);

  const entry = await postEntry(tx, {
    date: input.date,
    journalId,
    reference: number,
    partnerId: input.partnerId,
    items,
    sourceType: 'PAYMENT',
    number,
  });

  const payment = await tx.payment.create({
    data: {
      number,
      type: input.type,
      partnerId: input.partnerId,
      amount,
      date: input.date,
      via: input.via,
      note: input.note ?? null,
      billId: input.billId ?? null,
      invoiceId: input.invoiceId ?? null,
      journalEntryId: entry.id,
    },
  });

  await tx.journalEntry.update({ where: { id: entry.id }, data: { sourceId: payment.id } });

  // --- roll the paid amounts forward on the document -----------------------
  if (input.billId) {
    const bill = await tx.vendorBill.findUniqueOrThrow({ where: { id: input.billId } });
    const paidCash = round2(
      Number(bill.paidCash) + (input.via === 'CASH' ? amount : 0),
    );
    const paidBank = round2(
      Number(bill.paidBank) + (input.via === 'BANK' ? amount : 0),
    );
    const due = amountDue(bill.total as never, paidCash, paidBank);
    await tx.vendorBill.update({
      where: { id: bill.id },
      data: { paidCash, paidBank, status: toPaise(due) === 0 ? 'PAID' : bill.status },
    });
  }

  if (input.invoiceId) {
    const invoice = await tx.customerInvoice.findUniqueOrThrow({ where: { id: input.invoiceId } });
    const paidCash = round2(
      Number(invoice.paidCash) + (input.via === 'CASH' ? amount : 0),
    );
    const paidBank = round2(
      Number(invoice.paidBank) + (input.via === 'BANK' ? amount : 0),
    );
    const due = amountDue(invoice.total as never, paidCash, paidBank);
    await tx.customerInvoice.update({
      where: { id: invoice.id },
      data: { paidCash, paidBank, status: toPaise(due) === 0 ? 'PAID' : invoice.status },
    });
  }

  return payment;
}
