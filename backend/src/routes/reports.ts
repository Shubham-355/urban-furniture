import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { endOfDay, listQuerySchema, serialize, startOfDay } from '../lib/http';
import {
  balancesByAccount,
  buildBalanceSheet,
  buildProfitAndLoss,
  type AccountTypeName,
  type PostedItem,
} from '../domain/reports';
import { round2, sum } from '../lib/money';
import { amountDue } from '../domain/totals';
import { footerNote, header, keyValues, renderPdf, table, totalsBlock } from '../lib/pdf';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireBackOffice } from '../middleware/auth';
import { computeBudgetAchievement } from '../services/budgets';

export const reportsRouter = Router();

reportsRouter.use(requireAuth, requireBackOffice);

/** Default period is the current financial year (1 April - 31 March in India). */
function currentFinancialYear(today = new Date()): { from: Date; to: Date } {
  const year = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return { from: new Date(year, 3, 1), to: new Date(year + 1, 2, 31) };
}

const periodSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  asOf: z.string().optional(),
});

function resolvePeriod(query: unknown): { from: Date; to: Date } {
  const input = periodSchema.parse(query);
  const fallback = currentFinancialYear();
  const to = input.to ?? input.asOf;
  return {
    from: input.from ? startOfDay(input.from) : startOfDay(fallback.from),
    to: to ? endOfDay(to) : endOfDay(fallback.to),
  };
}

/** Posted journal items in a period, with the account they touch. */
async function postedItems(from: Date, to: Date): Promise<PostedItem[]> {
  const items = await prisma.journalItem.findMany({
    where: { entry: { status: 'POSTED', date: { gte: from, lte: to } } },
    include: { account: { select: { id: true, name: true, type: true } } },
  });

  return items.map((item) => ({
    accountId: item.accountId,
    accountName: item.account.name,
    accountType: item.account.type,
    debit: Number(item.debit),
    credit: Number(item.credit),
  }));
}

const formatDate = (date: Date) => date.toLocaleDateString('en-IN');

// -------------------------------------------------------------- profit & loss

reportsRouter.get(
  '/profit-loss',
  asyncHandler(async (req, res) => {
    const period = resolvePeriod(req.query);
    const report = buildProfitAndLoss(await postedItems(period.from, period.to));
    res.json(serialize({ period, ...report }));
  }),
);

reportsRouter.get(
  '/profit-loss/pdf',
  asyncHandler(async (req, res) => {
    const period = resolvePeriod(req.query);
    const report = buildProfitAndLoss(await postedItems(period.from, period.to));

    const buffer = await renderPdf((doc) => {
      header(
        doc,
        'Profit and Loss',
        `${formatDate(period.from)} to ${formatDate(period.to)}`,
      );
      table(
        doc,
        [
          { label: 'Income', width: 380 },
          { label: 'Amount', width: 135, money: true },
        ],
        [
          ...report.income.accounts.map((a) => [a.accountName, a.balance]),
          ['Total Income', report.income.total],
        ],
      );
      table(
        doc,
        [
          { label: 'Expenses', width: 380 },
          { label: 'Amount', width: 135, money: true },
        ],
        [
          ...report.expenses.purchase.accounts.map((a) => [a.accountName, a.balance]),
          ...report.expenses.other.accounts.map((a) => [a.accountName, a.balance]),
          ['Total Expenses', report.expenses.total],
        ],
      );
      totalsBlock(doc, [
        ['Total Income', report.income.total],
        ['Total Expenses', report.expenses.total],
        ['Net Income', report.netIncome],
      ]);
      footerNote(doc, 'Figures are derived from posted journal entries only.');
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="profit-and-loss.pdf"');
    res.send(buffer);
  }),
);

// --------------------------------------------------------------- balance sheet

/**
 * The balance sheet is cumulative: it reports everything posted up to the end
 * of the period, which is what makes Assets = Liabilities + Capital hold
 * exactly (retained earnings carry every prior year's result).
 */
async function balanceSheetFor(query: unknown) {
  const period = resolvePeriod(query);
  const items = await postedItems(new Date(0), period.to);
  return { period, report: buildBalanceSheet(items) };
}

reportsRouter.get(
  '/balance-sheet',
  asyncHandler(async (req, res) => {
    const { period, report } = await balanceSheetFor(req.query);
    if (!report.balanced) {
      console.error(
        `[balance-sheet] out of balance by ${report.difference} as of ${period.to.toISOString()}`,
      );
    }
    res.json(serialize({ period, ...report }));
  }),
);

reportsRouter.get(
  '/balance-sheet/pdf',
  asyncHandler(async (req, res) => {
    const { period, report } = await balanceSheetFor(req.query);

    const buffer = await renderPdf((doc) => {
      header(doc, 'Balance Sheet', `As of ${formatDate(period.to)}`);
      table(
        doc,
        [
          { label: 'Assets', width: 380 },
          { label: 'Amount', width: 135, money: true },
        ],
        [
          ...report.assets.accounts.map((a) => [a.accountName, a.balance]),
          ['Total Asset', report.assets.total],
        ],
      );
      table(
        doc,
        [
          { label: 'Liabilities and Capital', width: 380 },
          { label: 'Amount', width: 135, money: true },
        ],
        [
          ...report.liabilities.accounts.map((a) => [a.accountName, a.balance]),
          ...report.capital.accounts.map((a) => [a.accountName, a.balance]),
          ['Net Income', report.capital.netIncome],
          ['Total Liability and Capital', report.totalLiabilitiesAndCapital],
        ],
      );
      totalsBlock(doc, [
        ['Total Asset', report.totalAssets],
        ['Total Liability and Capital', report.totalLiabilitiesAndCapital],
      ]);
      if (!report.balanced) {
        footerNote(
          doc,
          `Warning: the balance sheet does not balance. Difference ${report.difference.toFixed(2)}.`,
        );
      } else {
        footerNote(doc, 'Total Assets equals Total Liabilities and Capital.');
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="balance-sheet.pdf"');
    res.send(buffer);
  }),
);

// ---------------------------------------------------------------- budget report

const BUDGET_INCLUDE = {
  responsible: { select: { id: true, name: true } },
  lines: {
    include: { analytic: { select: { id: true, name: true, type: true } } },
    orderBy: { id: 'asc' as const },
  },
} as const;

async function budgetRows(query: unknown) {
  const list = listQuerySchema.parse(query);
  const budgets = await prisma.budget.findMany({
    where: {
      isArchived: false,
      // A cancelled budget is not being pursued, so it stays out of the report
      // unless it is asked for by name.
      ...(list.status
        ? { status: list.status as never }
        : { status: { not: 'CANCELLED' as const } }),
      ...(list.search ? { name: { contains: list.search, mode: 'insensitive' as const } } : {}),
    },
    include: BUDGET_INCLUDE,
    orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
  });

  const rows = [];
  for (const budget of budgets) {
    const computed = await computeBudgetAchievement(budget);
    rows.push({
      id: budget.id,
      name: budget.name,
      startDate: budget.startDate,
      endDate: budget.endDate,
      status: budget.status,
      responsible: budget.responsible,
      committed: computed.totalCommitted,
      achieved: computed.totalAchieved,
      balance: computed.totalToAchieve,
      achievedPercent: computed.achievedPercent,
    });
  }
  return rows;
}

reportsRouter.get(
  '/budget',
  asyncHandler(async (req, res) => {
    res.json(serialize({ items: await budgetRows(req.query) }));
  }),
);

reportsRouter.get(
  '/budget/pdf',
  asyncHandler(async (req, res) => {
    const rows = await budgetRows(req.query);

    const buffer = await renderPdf((doc) => {
      header(doc, 'Budget Report', `${rows.length} budget(s)`);
      table(
        doc,
        [
          { label: 'Budget', width: 150 },
          { label: 'Start Date', width: 70 },
          { label: 'End Date', width: 70 },
          { label: 'Status', width: 65 },
          { label: 'Committed', width: 80, money: true },
          { label: 'Achieved', width: 80, money: true },
        ],
        rows.map((row) => [
          row.name,
          formatDate(row.startDate),
          formatDate(row.endDate),
          row.status,
          row.committed,
          row.achieved,
        ]),
      );
      footerNote(doc, 'Achieved amounts come from confirmed invoices and bills inside each budget period.');
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="budget-report.pdf"');
    res.send(buffer);
  }),
);

// ------------------------------------------------------------ budget analytic

/** Target of the Budget smart button on a bill or invoice. */
reportsRouter.get(
  '/budget-analytic/:analyticId',
  asyncHandler(async (req, res) => {
    const analyticId = Number(req.params.analyticId);
    const analytic = await prisma.analyticAccount.findUnique({ where: { id: analyticId } });
    if (!analytic) {
      res.status(404).json({ message: 'Analytic account not found' });
      return;
    }

    const budgets = await prisma.budget.findMany({
      where: { isArchived: false, lines: { some: { analyticId } } },
      include: BUDGET_INCLUDE,
      orderBy: { startDate: 'desc' },
    });

    const rows = [];
    for (const budget of budgets) {
      const computed = await computeBudgetAchievement(budget);
      const line = computed.lines.find((l) => l.analyticId === analyticId);
      rows.push({
        id: budget.id,
        name: budget.name,
        status: budget.status,
        startDate: budget.startDate,
        endDate: budget.endDate,
        committed: line?.committedAmount ?? 0,
        achieved: line?.achievedAmount ?? 0,
        achievedPercent: line?.achievedPercent ?? 0,
        balance: line?.amountToAchieve ?? 0,
      });
    }

    res.json(serialize({ analytic, items: rows }));
  }),
);

// ------------------------------------------------------------------ dashboard

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth, requireBackOffice);

dashboardRouter.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    const [
      purchaseAll,
      purchaseConfirmed,
      purchaseDraft,
      salesAll,
      salesConfirmed,
      salesDraft,
      budgets,
    ] = await Promise.all([
      prisma.purchaseOrder.count({ where: { isArchived: false } }),
      prisma.purchaseOrder.count({ where: { isArchived: false, status: { in: ['CONFIRMED', 'BILLED'] } } }),
      prisma.purchaseOrder.count({ where: { isArchived: false, status: 'DRAFT' } }),
      prisma.salesOrder.count({ where: { isArchived: false } }),
      prisma.salesOrder.count({ where: { isArchived: false, status: { in: ['CONFIRMED', 'INVOICED'] } } }),
      prisma.salesOrder.count({ where: { isArchived: false, status: 'DRAFT' } }),
      // "Total confirmed budgets": a revised budget has been superseded by its
      // revision, and a cancelled one is not being pursued, so neither counts.
      prisma.budget.findMany({
        where: { isArchived: false, status: 'CONFIRMED' },
        include: BUDGET_INCLUDE,
      }),
    ]);

    let achieved = 0;
    let committed = 0;
    const budgetProgress = [];
    for (const budget of budgets) {
      const computed = await computeBudgetAchievement(budget);
      if (computed.totalCommitted > 0) committed += 1;
      if (computed.totalAchieved >= computed.totalCommitted && computed.totalCommitted > 0) {
        achieved += 1;
      }
      budgetProgress.push({
        id: budget.id,
        name: budget.name,
        committed: computed.totalCommitted,
        achieved: computed.totalAchieved,
        percent: computed.achievedPercent,
      });
    }
    budgetProgress.sort((a, b) => b.percent - a.percent);

    // --- money on the books -------------------------------------------------
    const year = currentFinancialYear();
    const [periodItems, allItems] = await Promise.all([
      postedItems(startOfDay(year.from), endOfDay(year.to)),
      postedItems(new Date(0), endOfDay(year.to)),
    ]);

    const profitAndLoss = buildProfitAndLoss(periodItems);
    const balances = balancesByAccount(allItems);
    const totalOf = (types: AccountTypeName[]) =>
      sum(balances.filter((row) => types.includes(row.accountType)).map((row) => row.balance));
    const namedBalance = (name: string) =>
      balances.find((row) => row.accountName === name)?.balance ?? 0;

    // --- income vs expense, month by month ---------------------------------
    const monthly = await monthlyIncomeAndExpense(year);

    // --- what still needs collecting or paying ------------------------------
    const [openInvoices, openBills] = await Promise.all([
      prisma.customerInvoice.findMany({
        where: { isArchived: false, status: 'CONFIRMED' },
        include: { customer: { select: { name: true } } },
        orderBy: [{ dueDate: 'asc' }, { invoiceDate: 'asc' }],
      }),
      prisma.vendorBill.findMany({
        where: { isArchived: false, status: 'CONFIRMED' },
        include: { vendor: { select: { name: true } } },
        orderBy: [{ dueDate: 'asc' }, { billDate: 'asc' }],
      }),
    ]);

    const today = endOfDay(new Date());
    const isOverdue = (dueDate: Date | null) => Boolean(dueDate && dueDate < today);

    const receivableRows = openInvoices.map((invoice) => ({
      kind: 'INVOICE' as const,
      id: invoice.id,
      number: invoice.number,
      partner: invoice.customer.name,
      date: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      amountDue: amountDue(invoice.total, invoice.paidCash, invoice.paidBank),
      overdue: isOverdue(invoice.dueDate),
    }));

    const payableRows = openBills.map((bill) => ({
      kind: 'BILL' as const,
      id: bill.id,
      number: bill.number,
      partner: bill.vendor.name,
      date: bill.billDate,
      dueDate: bill.dueDate,
      amountDue: amountDue(bill.total, bill.paidCash, bill.paidBank),
      overdue: isOverdue(bill.dueDate),
    }));

    // --- the latest documents to touch the ledger ---------------------------
    const recentEntries = await prisma.journalEntry.findMany({
      where: { status: 'POSTED' },
      include: {
        journal: { select: { name: true } },
        partner: { select: { name: true } },
        items: { select: { debit: true } },
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: 6,
    });

    res.json(
      serialize({
        purchase: { all: purchaseAll, confirmed: purchaseConfirmed, draft: purchaseDraft },
        sales: { all: salesAll, confirmed: salesConfirmed, draft: salesDraft },
        budgets: { achieved, budget: budgets.length, committed },
        budgetProgress: budgetProgress.slice(0, 4),
        period: year,
        financials: {
          income: profitAndLoss.income.total,
          expenses: profitAndLoss.expenses.total,
          netIncome: profitAndLoss.netIncome,
          bank: namedBalance('Bank A/c') || totalOf(['BANK']),
          cash: namedBalance('Cash A/c') || totalOf(['CASH']),
          liquidity: totalOf(['BANK', 'CASH']),
          receivable: sum(receivableRows.map((row) => row.amountDue)),
          payable: sum(payableRows.map((row) => row.amountDue)),
        },
        monthly,
        receivables: {
          rows: receivableRows.slice(0, 5),
          overdueCount: receivableRows.filter((row) => row.overdue).length,
        },
        payables: {
          rows: payableRows.slice(0, 5),
          overdueCount: payableRows.filter((row) => row.overdue).length,
        },
        recentEntries: recentEntries.map((entry) => ({
          id: entry.id,
          number: entry.number,
          date: entry.date,
          journal: entry.journal.name,
          partner: entry.partner?.name ?? null,
          total: sum(entry.items.map((item) => item.debit)),
        })),
      }),
    );
  }),
);

/**
 * Income and expense per month across the financial year, for the dashboard
 * chart. Both series come off the same posted items, so they share one scale.
 */
async function monthlyIncomeAndExpense(period: { from: Date; to: Date }) {
  const items = await prisma.journalItem.findMany({
    where: {
      entry: { status: 'POSTED', date: { gte: startOfDay(period.from), lte: endOfDay(period.to) } },
      account: { type: { in: ['INCOME', 'EXPENSE', 'OTHER_EXPENSE'] } },
    },
    select: {
      debit: true,
      credit: true,
      account: { select: { type: true } },
      entry: { select: { date: true } },
    },
  });

  const buckets = new Map<string, { label: string; income: number; expense: number }>();
  const cursor = new Date(period.from);
  while (cursor <= period.to) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
    buckets.set(key, {
      label: cursor.toLocaleDateString('en-IN', { month: 'short' }),
      income: 0,
      expense: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const item of items) {
    const date = item.entry.date;
    const bucket = buckets.get(`${date.getFullYear()}-${date.getMonth()}`);
    if (!bucket) continue;
    const debit = Number(item.debit);
    const credit = Number(item.credit);
    if (item.account.type === 'INCOME') bucket.income = round2(bucket.income + credit - debit);
    else bucket.expense = round2(bucket.expense + debit - credit);
  }

  return [...buckets.values()];
}
