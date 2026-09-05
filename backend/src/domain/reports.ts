import { round2, sum, toPaise, type Numeric } from '../lib/money';

/**
 * Report maths. Every figure is derived from posted journal items only, grouped
 * by the type of the Chart of Account they touch.
 */

export type AccountTypeName =
  | 'ASSET'
  | 'LIABILITY'
  | 'BANK'
  | 'CAPITAL'
  | 'CASH'
  | 'INCOME'
  | 'EXPENSE'
  | 'OTHER_EXPENSE';

export interface PostedItem {
  accountId: number;
  accountName: string;
  accountType: AccountTypeName;
  debit: Numeric;
  credit: Numeric;
}

export interface AccountBalance {
  accountId: number;
  accountName: string;
  accountType: AccountTypeName;
  debit: number;
  credit: number;
  /** Signed by the natural side of the account type. */
  balance: number;
}

const DEBIT_NORMAL: AccountTypeName[] = ['ASSET', 'BANK', 'CASH', 'EXPENSE', 'OTHER_EXPENSE'];

export function isDebitNormal(type: AccountTypeName): boolean {
  return DEBIT_NORMAL.includes(type);
}

/** Collapse posted items into one balance row per account. */
export function balancesByAccount(items: PostedItem[]): AccountBalance[] {
  const map = new Map<number, AccountBalance>();
  for (const item of items) {
    const existing = map.get(item.accountId);
    if (existing) {
      existing.debit = round2(existing.debit + round2(item.debit));
      existing.credit = round2(existing.credit + round2(item.credit));
    } else {
      map.set(item.accountId, {
        accountId: item.accountId,
        accountName: item.accountName,
        accountType: item.accountType,
        debit: round2(item.debit),
        credit: round2(item.credit),
        balance: 0,
      });
    }
  }
  const rows = [...map.values()];
  for (const row of rows) {
    row.balance = isDebitNormal(row.accountType)
      ? round2(row.debit - row.credit)
      : round2(row.credit - row.debit);
  }
  return rows.sort((a, b) => a.accountName.localeCompare(b.accountName));
}

function section(rows: AccountBalance[], types: AccountTypeName[]): AccountBalance[] {
  return rows.filter((r) => types.includes(r.accountType));
}

// ------------------------------------------------------------------- P & L

export interface ProfitAndLossReport {
  income: { accounts: AccountBalance[]; total: number };
  expenses: {
    purchase: { accounts: AccountBalance[]; total: number };
    other: { accounts: AccountBalance[]; total: number };
    total: number;
  };
  netIncome: number;
}

/**
 * Income  = credits - debits of INCOME accounts
 * Expense = debits - credits of EXPENSE / OTHER_EXPENSE accounts
 * Net income = total income - total expenses
 */
export function buildProfitAndLoss(items: PostedItem[]): ProfitAndLossReport {
  const rows = balancesByAccount(items);
  const income = section(rows, ['INCOME']);
  const purchase = section(rows, ['EXPENSE']);
  const other = section(rows, ['OTHER_EXPENSE']);

  const incomeTotal = sum(income.map((r) => r.balance));
  const purchaseTotal = sum(purchase.map((r) => r.balance));
  const otherTotal = sum(other.map((r) => r.balance));
  const expenseTotal = round2(purchaseTotal + otherTotal);

  return {
    income: { accounts: income, total: incomeTotal },
    expenses: {
      purchase: { accounts: purchase, total: purchaseTotal },
      other: { accounts: other, total: otherTotal },
      total: expenseTotal,
    },
    netIncome: round2(incomeTotal - expenseTotal),
  };
}

// ------------------------------------------------------------- balance sheet

export interface BalanceSheetReport {
  assets: { accounts: AccountBalance[]; total: number };
  liabilities: { accounts: AccountBalance[]; total: number };
  capital: { accounts: AccountBalance[]; netIncome: number; total: number };
  totalAssets: number;
  totalLiabilitiesAndCapital: number;
  balanced: boolean;
  difference: number;
}

/**
 * Assets      = BANK + CASH + ASSET accounts (debit normal)
 * Liabilities = LIABILITY accounts (credit normal)
 * Capital     = CAPITAL accounts + retained earnings (net income to date)
 *
 * Because every posted entry is balanced, Assets always equals
 * Liabilities + Capital. The caller asserts on `balanced`.
 */
export function buildBalanceSheet(items: PostedItem[]): BalanceSheetReport {
  const rows = balancesByAccount(items);
  const assets = section(rows, ['BANK', 'CASH', 'ASSET']);
  const liabilities = section(rows, ['LIABILITY']);
  const capitalAccounts = section(rows, ['CAPITAL']);

  const { netIncome } = buildProfitAndLoss(items);

  const totalAssets = sum(assets.map((r) => r.balance));
  const totalLiabilities = sum(liabilities.map((r) => r.balance));
  const capitalTotal = round2(sum(capitalAccounts.map((r) => r.balance)) + netIncome);
  const totalLiabilitiesAndCapital = round2(totalLiabilities + capitalTotal);

  return {
    assets: { accounts: assets, total: totalAssets },
    liabilities: { accounts: liabilities, total: totalLiabilities },
    capital: { accounts: capitalAccounts, netIncome, total: capitalTotal },
    totalAssets,
    totalLiabilitiesAndCapital,
    balanced: toPaise(totalAssets) === toPaise(totalLiabilitiesAndCapital),
    difference: round2(totalAssets - totalLiabilitiesAndCapital),
  };
}
