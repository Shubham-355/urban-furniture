import { round2, sum, toPaise, type Numeric } from '../lib/money';

/**
 * The double entry engine.
 *
 * Everything in here is pure: it turns a business document into a balanced set
 * of journal items. Persistence happens in the route layer inside a Prisma
 * transaction so the document status change and its entry are atomic.
 */

export interface DraftItem {
  accountId: number;
  partnerId?: number | null;
  label?: string;
  debit: number;
  credit: number;
}

export interface BalanceCheck {
  totalDebit: number;
  totalCredit: number;
  difference: number;
  balanced: boolean;
}

/** Sum the debit and credit columns and report whether they match. */
export function checkBalance(items: { debit: Numeric; credit: Numeric }[]): BalanceCheck {
  const totalDebit = sum(items.map((i) => i.debit));
  const totalCredit = sum(items.map((i) => i.credit));
  return {
    totalDebit,
    totalCredit,
    difference: round2(totalDebit - totalCredit),
    balanced: toPaise(totalDebit) === toPaise(totalCredit),
  };
}

/** Total of an entry = sum of the debit column (equals the credit column). */
export function entryTotal(items: { debit: Numeric; credit: Numeric }[]): number {
  return checkBalance(items).totalDebit;
}

/** Merge items that hit the same account and partner so entries stay compact. */
export function mergeItems(items: DraftItem[]): DraftItem[] {
  const merged = new Map<string, DraftItem>();
  for (const item of items) {
    const key = `${item.accountId}|${item.partnerId ?? ''}|${item.label ?? ''}`;
    const existing = merged.get(key);
    if (existing) {
      existing.debit = round2(existing.debit + item.debit);
      existing.credit = round2(existing.credit + item.credit);
    } else {
      merged.set(key, { ...item });
    }
  }
  return [...merged.values()].filter((i) => toPaise(i.debit) !== 0 || toPaise(i.credit) !== 0);
}

// ------------------------------------------------------------------ vendor bill

export interface VendorBillEntryInput {
  partnerId: number;
  /** One entry per bill line: the expense account it was booked against. */
  lines: { accountId: number; total: Numeric }[];
  creditorsAccountId: number;
}

/**
 * Vendor bill confirmation:
 *   Debit  Purchase Expense A/c (or the account chosen on the line)  line total
 *   Credit Creditors A/c                                             bill total
 */
export function buildVendorBillEntry(input: VendorBillEntryInput): DraftItem[] {
  const debits: DraftItem[] = input.lines.map((line) => ({
    accountId: line.accountId,
    partnerId: input.partnerId,
    label: 'Vendor bill',
    debit: round2(line.total),
    credit: 0,
  }));
  const total = sum(input.lines.map((l) => l.total));
  const credit: DraftItem = {
    accountId: input.creditorsAccountId,
    partnerId: input.partnerId,
    label: 'Vendor bill',
    debit: 0,
    credit: total,
  };
  return mergeItems([...debits, credit]);
}

// -------------------------------------------------------------- customer invoice

export interface CustomerInvoiceEntryInput {
  partnerId: number;
  /** One entry per invoice line: income account, untaxed amount and its tax. */
  lines: { accountId: number; subtotal: Numeric; taxAmount: Numeric }[];
  debtorsAccountId: number;
  taxAccountId: number;
}

/**
 * Customer invoice confirmation:
 *   Debit  Debtors A/c        invoice total (incl. tax)
 *   Credit Sales Income A/c   untaxed line amounts
 *   Credit Tax Payable A/c    tax, when any line carries tax
 */
export function buildCustomerInvoiceEntry(input: CustomerInvoiceEntryInput): DraftItem[] {
  const subtotal = sum(input.lines.map((l) => l.subtotal));
  const taxTotal = sum(input.lines.map((l) => l.taxAmount));
  const total = round2(subtotal + taxTotal);

  const items: DraftItem[] = [
    {
      accountId: input.debtorsAccountId,
      partnerId: input.partnerId,
      label: 'Customer invoice',
      debit: total,
      credit: 0,
    },
    ...input.lines.map((line) => ({
      accountId: line.accountId,
      partnerId: input.partnerId,
      label: 'Customer invoice',
      debit: 0,
      credit: round2(line.subtotal),
    })),
  ];

  if (toPaise(taxTotal) !== 0) {
    items.push({
      accountId: input.taxAccountId,
      partnerId: input.partnerId,
      label: 'Tax on sales',
      debit: 0,
      credit: taxTotal,
    });
  }

  return mergeItems(items);
}

// ------------------------------------------------------------------- payments

export interface PaymentEntryInput {
  /** SEND pays a vendor bill, RECEIVE collects on a customer invoice. */
  type: 'SEND' | 'RECEIVE';
  partnerId: number;
  amount: Numeric;
  /** Bank A/c or Cash A/c, depending on "Payment Via". */
  liquidityAccountId: number;
  debtorsAccountId: number;
  creditorsAccountId: number;
}

/**
 * Payment confirmation:
 *   SEND     Debit Creditors A/c   Credit Bank/Cash A/c
 *   RECEIVE  Debit Bank/Cash A/c   Credit Debtors A/c
 */
export function buildPaymentEntry(input: PaymentEntryInput): DraftItem[] {
  const amount = round2(input.amount);
  if (input.type === 'SEND') {
    return [
      {
        accountId: input.creditorsAccountId,
        partnerId: input.partnerId,
        label: 'Bill payment',
        debit: amount,
        credit: 0,
      },
      {
        accountId: input.liquidityAccountId,
        partnerId: input.partnerId,
        label: 'Bill payment',
        debit: 0,
        credit: amount,
      },
    ];
  }
  return [
    {
      accountId: input.liquidityAccountId,
      partnerId: input.partnerId,
      label: 'Invoice receipt',
      debit: amount,
      credit: 0,
    },
    {
      accountId: input.debtorsAccountId,
      partnerId: input.partnerId,
      label: 'Invoice receipt',
      debit: 0,
      credit: amount,
    },
  ];
}
