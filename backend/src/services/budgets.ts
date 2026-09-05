import { prisma } from '../lib/prisma';
import { endOfDay, startOfDay } from '../lib/http';
import {
  computeBudget,
  type AchievementSource,
  type ComputedBudget,
  type BudgetLineInput,
} from '../domain/budget';

/**
 * Bridges the pure budget maths in `domain/budget` to the database.
 *
 * Only confirmed documents contribute: a vendor bill or customer invoice counts
 * once it has been confirmed (and it keeps counting once it is fully paid).
 */

export const ACHIEVING_STATUSES = ['CONFIRMED', 'PAID'] as const;

export interface AchievedDocument {
  kind: 'INVOICE' | 'BILL';
  id: number;
  number: string;
  date: Date;
  partner: string;
  analyticId: number;
  analyticName: string;
  status: string;
  amount: number;
}

/** Confirmed invoice / bill lines that feed the achieved columns. */
export async function loadAchievedDocuments(
  analyticIds: number[],
  start: Date,
  end: Date,
): Promise<AchievedDocument[]> {
  if (analyticIds.length === 0) return [];
  const from = startOfDay(start);
  const to = endOfDay(end);

  const [invoiceLines, billLines] = await Promise.all([
    prisma.customerInvoiceLine.findMany({
      where: {
        analyticId: { in: analyticIds },
        invoice: {
          status: { in: [...ACHIEVING_STATUSES] },
          isArchived: false,
          invoiceDate: { gte: from, lte: to },
        },
      },
      include: {
        analytic: { select: { id: true, name: true } },
        invoice: {
          select: {
            id: true,
            number: true,
            invoiceDate: true,
            status: true,
            customer: { select: { name: true } },
          },
        },
      },
    }),
    prisma.vendorBillLine.findMany({
      where: {
        analyticId: { in: analyticIds },
        bill: {
          status: { in: [...ACHIEVING_STATUSES] },
          isArchived: false,
          billDate: { gte: from, lte: to },
        },
      },
      include: {
        analytic: { select: { id: true, name: true } },
        bill: {
          select: {
            id: true,
            number: true,
            billDate: true,
            status: true,
            vendor: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const documents: AchievedDocument[] = [];

  for (const line of invoiceLines) {
    // The untaxed amount is what reaches the Sales Income account, so it is
    // also what counts towards an income budget.
    const untaxed = Number(line.quantity) * Number(line.unitPrice);
    documents.push({
      kind: 'INVOICE',
      id: line.invoice.id,
      number: line.invoice.number,
      date: line.invoice.invoiceDate,
      partner: line.invoice.customer.name,
      analyticId: line.analyticId!,
      analyticName: line.analytic?.name ?? '',
      status: line.invoice.status,
      amount: Math.round(untaxed * 100) / 100,
    });
  }

  for (const line of billLines) {
    documents.push({
      kind: 'BILL',
      id: line.bill.id,
      number: line.bill.number,
      date: line.bill.billDate,
      partner: line.bill.vendor.name,
      analyticId: line.analyticId!,
      analyticName: line.analytic?.name ?? '',
      status: line.bill.status,
      amount: Number(line.total),
    });
  }

  return documents.sort((a, b) => b.date.getTime() - a.date.getTime());
}

function toSources(documents: AchievedDocument[]): AchievementSource[] {
  return documents.map((doc) => ({
    analyticId: doc.analyticId,
    date: doc.date,
    amount: doc.amount,
    kind: doc.kind === 'INVOICE' ? 'INCOME' : 'EXPENSE',
  }));
}

export interface BudgetRecord {
  id: number;
  startDate: Date;
  endDate: Date;
  lines: {
    id: number;
    analyticId: number;
    committedAmount: unknown;
    analytic: { id: number; name: string; type: 'INCOME' | 'EXPENSE' };
  }[];
}

/** Achieved / percent / to-achieve for one budget. */
export async function computeBudgetAchievement(budget: BudgetRecord): Promise<ComputedBudget> {
  const analyticIds = budget.lines.map((line) => line.analyticId);
  const documents = await loadAchievedDocuments(analyticIds, budget.startDate, budget.endDate);
  const lines: BudgetLineInput[] = budget.lines.map((line) => ({
    id: line.id,
    analyticId: line.analyticId,
    analyticName: line.analytic.name,
    analyticType: line.analytic.type,
    committedAmount: line.committedAmount as never,
  }));
  return computeBudget(
    lines,
    toSources(documents),
    startOfDay(budget.startDate),
    endOfDay(budget.endDate),
  );
}

/** Same computation for a list of budgets, used by the Budget Report. */
export async function computeBudgetAchievements(
  budgets: BudgetRecord[],
): Promise<Map<number, ComputedBudget>> {
  const result = new Map<number, ComputedBudget>();
  for (const budget of budgets) {
    result.set(budget.id, await computeBudgetAchievement(budget));
  }
  return result;
}
