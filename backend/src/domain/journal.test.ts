import { describe, expect, it } from 'vitest';
import {
  buildCustomerInvoiceEntry,
  buildPaymentEntry,
  buildVendorBillEntry,
  checkBalance,
  entryTotal,
  mergeItems,
} from './journal';

const ACCOUNTS = {
  bank: 1,
  cash: 2,
  debtors: 3,
  creditors: 4,
  salesIncome: 5,
  purchaseExpense: 6,
  taxPayable: 7,
};

describe('checkBalance', () => {
  it('accepts an entry whose debit and credit columns match', () => {
    const balance = checkBalance([
      { debit: 6000, credit: 0 },
      { debit: 0, credit: 6000 },
    ]);
    expect(balance.balanced).toBe(true);
    expect(balance.totalDebit).toBe(6000);
    expect(balance.totalCredit).toBe(6000);
    expect(balance.difference).toBe(0);
  });

  it('rejects an unbalanced entry and reports the difference', () => {
    const balance = checkBalance([
      { debit: 6000, credit: 0 },
      { debit: 0, credit: 5500 },
    ]);
    expect(balance.balanced).toBe(false);
    expect(balance.difference).toBe(500);
  });

  it('stays exact where floating point would drift', () => {
    const balance = checkBalance([
      { debit: 0.1, credit: 0 },
      { debit: 0.2, credit: 0 },
      { debit: 0, credit: 0.3 },
    ]);
    expect(balance.balanced).toBe(true);
    expect(balance.totalDebit).toBe(0.3);
  });
});

describe('buildVendorBillEntry', () => {
  it('debits the expense account and credits creditors with the bill total', () => {
    const items = buildVendorBillEntry({
      partnerId: 11,
      creditorsAccountId: ACCOUNTS.creditors,
      lines: [{ accountId: ACCOUNTS.purchaseExpense, total: 6000 }],
    });

    expect(checkBalance(items).balanced).toBe(true);
    expect(entryTotal(items)).toBe(6000);

    const debit = items.find((i) => i.accountId === ACCOUNTS.purchaseExpense);
    const credit = items.find((i) => i.accountId === ACCOUNTS.creditors);
    expect(debit).toMatchObject({ debit: 6000, credit: 0, partnerId: 11 });
    expect(credit).toMatchObject({ debit: 0, credit: 6000, partnerId: 11 });
  });

  it('keeps one debit per account and a single creditors line', () => {
    const items = buildVendorBillEntry({
      partnerId: 11,
      creditorsAccountId: ACCOUNTS.creditors,
      lines: [
        { accountId: ACCOUNTS.purchaseExpense, total: 6000 },
        { accountId: ACCOUNTS.purchaseExpense, total: 4000 },
        { accountId: 8, total: 1000 },
      ],
    });

    expect(items).toHaveLength(3);
    expect(items.find((i) => i.accountId === ACCOUNTS.purchaseExpense)?.debit).toBe(10000);
    expect(items.find((i) => i.accountId === ACCOUNTS.creditors)?.credit).toBe(11000);
    expect(checkBalance(items).balanced).toBe(true);
  });
});

describe('buildCustomerInvoiceEntry', () => {
  it('debits debtors with the total and credits the income account', () => {
    const items = buildCustomerInvoiceEntry({
      partnerId: 22,
      debtorsAccountId: ACCOUNTS.debtors,
      taxAccountId: ACCOUNTS.taxPayable,
      lines: [{ accountId: ACCOUNTS.salesIncome, subtotal: 25000, taxAmount: 0 }],
    });

    expect(checkBalance(items).balanced).toBe(true);
    expect(items.find((i) => i.accountId === ACCOUNTS.debtors)?.debit).toBe(25000);
    expect(items.find((i) => i.accountId === ACCOUNTS.salesIncome)?.credit).toBe(25000);
    expect(items.find((i) => i.accountId === ACCOUNTS.taxPayable)).toBeUndefined();
  });

  it('credits tax payable when a line carries tax', () => {
    const items = buildCustomerInvoiceEntry({
      partnerId: 22,
      debtorsAccountId: ACCOUNTS.debtors,
      taxAccountId: ACCOUNTS.taxPayable,
      lines: [{ accountId: ACCOUNTS.salesIncome, subtotal: 15000, taxAmount: 750 }],
    });

    expect(checkBalance(items).balanced).toBe(true);
    expect(items.find((i) => i.accountId === ACCOUNTS.debtors)?.debit).toBe(15750);
    expect(items.find((i) => i.accountId === ACCOUNTS.salesIncome)?.credit).toBe(15000);
    expect(items.find((i) => i.accountId === ACCOUNTS.taxPayable)?.credit).toBe(750);
  });
});

describe('buildPaymentEntry', () => {
  it('debits creditors and credits the bank when paying a vendor', () => {
    const items = buildPaymentEntry({
      type: 'SEND',
      partnerId: 11,
      amount: 6000,
      liquidityAccountId: ACCOUNTS.bank,
      debtorsAccountId: ACCOUNTS.debtors,
      creditorsAccountId: ACCOUNTS.creditors,
    });

    expect(checkBalance(items).balanced).toBe(true);
    expect(items[0]).toMatchObject({ accountId: ACCOUNTS.creditors, debit: 6000 });
    expect(items[1]).toMatchObject({ accountId: ACCOUNTS.bank, credit: 6000 });
  });

  it('debits cash and credits debtors when receiving from a customer', () => {
    const items = buildPaymentEntry({
      type: 'RECEIVE',
      partnerId: 22,
      amount: 25000,
      liquidityAccountId: ACCOUNTS.cash,
      debtorsAccountId: ACCOUNTS.debtors,
      creditorsAccountId: ACCOUNTS.creditors,
    });

    expect(checkBalance(items).balanced).toBe(true);
    expect(items[0]).toMatchObject({ accountId: ACCOUNTS.cash, debit: 25000 });
    expect(items[1]).toMatchObject({ accountId: ACCOUNTS.debtors, credit: 25000 });
  });
});

describe('mergeItems', () => {
  it('drops lines that carry neither a debit nor a credit', () => {
    const items = mergeItems([
      { accountId: 1, debit: 0, credit: 0 },
      { accountId: 2, debit: 100, credit: 0 },
      { accountId: 3, debit: 0, credit: 100 },
    ]);
    expect(items).toHaveLength(2);
  });
});
