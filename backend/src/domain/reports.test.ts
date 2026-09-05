import { describe, expect, it } from 'vitest';
import { buildBalanceSheet, buildProfitAndLoss, type PostedItem } from './reports';
import { buildCustomerInvoiceEntry, buildPaymentEntry, buildVendorBillEntry } from './journal';

const ACCOUNTS = {
  bank: { id: 1, name: 'Bank A/c', type: 'BANK' as const },
  cash: { id: 2, name: 'Cash A/c', type: 'CASH' as const },
  debtors: { id: 3, name: 'Debtors A/c', type: 'ASSET' as const },
  creditors: { id: 4, name: 'Creditors A/c', type: 'LIABILITY' as const },
  salesIncome: { id: 5, name: 'Sales Income A/c', type: 'INCOME' as const },
  purchaseExpense: { id: 6, name: 'Purchase Expense A/c', type: 'EXPENSE' as const },
  otherExpense: { id: 7, name: 'Other Expense A/c', type: 'OTHER_EXPENSE' as const },
  capital: { id: 8, name: 'Capital A/c', type: 'CAPITAL' as const },
};

const byId = new Map(Object.values(ACCOUNTS).map((a) => [a.id, a]));

/** Turn draft journal items into the posted items the reports consume. */
function posted(items: { accountId: number; debit: number; credit: number }[]): PostedItem[] {
  return items.map((item) => {
    const account = byId.get(item.accountId)!;
    return {
      accountId: account.id,
      accountName: account.name,
      accountType: account.type,
      debit: item.debit,
      credit: item.credit,
    };
  });
}

/** The example figures from the spec: income 10,000, expense 6,000 + 1,000. */
const SPEC_EXAMPLE: PostedItem[] = posted([
  { accountId: ACCOUNTS.debtors.id, debit: 10000, credit: 0 },
  { accountId: ACCOUNTS.salesIncome.id, debit: 0, credit: 10000 },
  { accountId: ACCOUNTS.purchaseExpense.id, debit: 6000, credit: 0 },
  { accountId: ACCOUNTS.creditors.id, debit: 0, credit: 6000 },
  { accountId: ACCOUNTS.otherExpense.id, debit: 1000, credit: 0 },
  { accountId: ACCOUNTS.bank.id, debit: 0, credit: 1000 },
]);

describe('buildProfitAndLoss', () => {
  it('reproduces the worked example from the specification', () => {
    const report = buildProfitAndLoss(SPEC_EXAMPLE);
    expect(report.income.total).toBe(10000);
    expect(report.expenses.purchase.total).toBe(6000);
    expect(report.expenses.other.total).toBe(1000);
    expect(report.expenses.total).toBe(7000);
    expect(report.netIncome).toBe(3000);
  });

  it('nets a credit note off the income account', () => {
    const report = buildProfitAndLoss(
      posted([
        { accountId: ACCOUNTS.salesIncome.id, debit: 0, credit: 10000 },
        { accountId: ACCOUNTS.salesIncome.id, debit: 2000, credit: 0 },
        { accountId: ACCOUNTS.debtors.id, debit: 8000, credit: 0 },
      ]),
    );
    expect(report.income.total).toBe(8000);
    expect(report.netIncome).toBe(8000);
  });

  it('lists every account under its own heading', () => {
    const report = buildProfitAndLoss(SPEC_EXAMPLE);
    expect(report.income.accounts.map((a) => a.accountName)).toEqual(['Sales Income A/c']);
    expect(report.expenses.purchase.accounts.map((a) => a.accountName)).toEqual([
      'Purchase Expense A/c',
    ]);
    expect(report.expenses.other.accounts.map((a) => a.accountName)).toEqual(['Other Expense A/c']);
  });
});

describe('buildBalanceSheet', () => {
  it('splits assets, liabilities and capital by account type', () => {
    const report = buildBalanceSheet(SPEC_EXAMPLE);
    expect(report.assets.accounts.map((a) => a.accountName).sort()).toEqual([
      'Bank A/c',
      'Debtors A/c',
    ]);
    expect(report.liabilities.accounts.map((a) => a.accountName)).toEqual(['Creditors A/c']);
    expect(report.capital.netIncome).toBe(3000);
  });

  // Mandatory: assets must always equal liabilities plus capital.
  it('balances on the specification example', () => {
    const report = buildBalanceSheet(SPEC_EXAMPLE);
    expect(report.balanced).toBe(true);
    expect(report.totalAssets).toBe(report.totalLiabilitiesAndCapital);
    expect(report.difference).toBe(0);
  });

  it('balances across a full purchase and sales cycle', () => {
    // Opening capital, a vendor bill paid by bank, an invoice received in cash.
    const items = [
      ...posted([
        { accountId: ACCOUNTS.bank.id, debit: 100000, credit: 0 },
        { accountId: ACCOUNTS.capital.id, debit: 0, credit: 100000 },
      ]),
      ...posted(
        buildVendorBillEntry({
          partnerId: 1,
          creditorsAccountId: ACCOUNTS.creditors.id,
          lines: [{ accountId: ACCOUNTS.purchaseExpense.id, total: 6000 }],
        }).map((i) => ({ accountId: i.accountId, debit: i.debit, credit: i.credit })),
      ),
      ...posted(
        buildPaymentEntry({
          type: 'SEND',
          partnerId: 1,
          amount: 6000,
          liquidityAccountId: ACCOUNTS.bank.id,
          debtorsAccountId: ACCOUNTS.debtors.id,
          creditorsAccountId: ACCOUNTS.creditors.id,
        }).map((i) => ({ accountId: i.accountId, debit: i.debit, credit: i.credit })),
      ),
      ...posted(
        buildCustomerInvoiceEntry({
          partnerId: 2,
          debtorsAccountId: ACCOUNTS.debtors.id,
          taxAccountId: ACCOUNTS.creditors.id,
          lines: [{ accountId: ACCOUNTS.salesIncome.id, subtotal: 25000, taxAmount: 0 }],
        }).map((i) => ({ accountId: i.accountId, debit: i.debit, credit: i.credit })),
      ),
      ...posted(
        buildPaymentEntry({
          type: 'RECEIVE',
          partnerId: 2,
          amount: 25000,
          liquidityAccountId: ACCOUNTS.cash.id,
          debtorsAccountId: ACCOUNTS.debtors.id,
          creditorsAccountId: ACCOUNTS.creditors.id,
        }).map((i) => ({ accountId: i.accountId, debit: i.debit, credit: i.credit })),
      ),
    ];

    const pl = buildProfitAndLoss(items);
    expect(pl.income.total).toBe(25000);
    expect(pl.expenses.total).toBe(6000);
    expect(pl.netIncome).toBe(19000);

    const bs = buildBalanceSheet(items);
    // Bank 100000 - 6000, Cash 25000, Debtors 0
    expect(bs.totalAssets).toBe(119000);
    // Creditors 0, Capital 100000 + net income 19000
    expect(bs.totalLiabilitiesAndCapital).toBe(119000);
    expect(bs.balanced).toBe(true);
  });

  it('balances on an empty ledger', () => {
    const report = buildBalanceSheet([]);
    expect(report.totalAssets).toBe(0);
    expect(report.totalLiabilitiesAndCapital).toBe(0);
    expect(report.balanced).toBe(true);
  });
});
