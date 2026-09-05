import { round2, sum, toPaise, type Numeric } from '../lib/money';

/**
 * Budget achievement.
 *
 * An Income analytic line is achieved by confirmed customer invoice lines, an
 * Expense analytic line by confirmed vendor bill lines - in both cases only
 * documents dated inside the budget period count. The untaxed line amount is
 * used so the figure lines up with the Sales Income / Purchase Expense totals
 * on the Profit and Loss report.
 */

export interface AchievementSource {
  analyticId: number;
  /** Document date - bill date or invoice date. */
  date: Date;
  /** Untaxed line amount. */
  amount: Numeric;
  /** INCOME for customer invoices, EXPENSE for vendor bills. */
  kind: 'INCOME' | 'EXPENSE';
}

export interface BudgetLineInput {
  id: number;
  analyticId: number;
  analyticName?: string;
  analyticType: 'INCOME' | 'EXPENSE';
  committedAmount: Numeric;
}

export interface ComputedBudgetLine {
  id: number;
  analyticId: number;
  analyticName?: string;
  analyticType: 'INCOME' | 'EXPENSE';
  committedAmount: number;
  achievedAmount: number;
  achievedPercent: number;
  amountToAchieve: number;
}

export interface ComputedBudget {
  lines: ComputedBudgetLine[];
  totalCommitted: number;
  totalAchieved: number;
  totalToAchieve: number;
  achievedPercent: number;
}

/** Inclusive on both ends - the day boundaries are normalised by the caller. */
export function withinPeriod(date: Date, start: Date, end: Date): boolean {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

export function achievedPercent(achieved: Numeric, committed: Numeric): number {
  const committedPaise = toPaise(committed);
  if (committedPaise === 0) return 0;
  return round2((toPaise(achieved) * 100) / committedPaise);
}

/** Achieved amount for one budget line. */
export function computeAchieved(
  line: BudgetLineInput,
  sources: AchievementSource[],
  start: Date,
  end: Date,
): number {
  const matching = sources.filter(
    (s) =>
      s.analyticId === line.analyticId &&
      s.kind === line.analyticType &&
      withinPeriod(s.date, start, end),
  );
  return sum(matching.map((s) => s.amount));
}

/** Achieved / percent / amount-to-achieve for every line of a budget. */
export function computeBudget(
  lines: BudgetLineInput[],
  sources: AchievementSource[],
  start: Date,
  end: Date,
): ComputedBudget {
  const computed: ComputedBudgetLine[] = lines.map((line) => {
    const committedAmount = round2(line.committedAmount);
    const achievedAmount = computeAchieved(line, sources, start, end);
    return {
      id: line.id,
      analyticId: line.analyticId,
      analyticName: line.analyticName,
      analyticType: line.analyticType,
      committedAmount,
      achievedAmount,
      achievedPercent: achievedPercent(achievedAmount, committedAmount),
      amountToAchieve: round2(committedAmount - achievedAmount),
    };
  });

  const totalCommitted = sum(computed.map((l) => l.committedAmount));
  const totalAchieved = sum(computed.map((l) => l.achievedAmount));

  return {
    lines: computed,
    totalCommitted,
    totalAchieved,
    totalToAchieve: round2(totalCommitted - totalAchieved),
    achievedPercent: achievedPercent(totalAchieved, totalCommitted),
  };
}

/** Name used for the copy created by the Revise action. */
export function revisedName(name: string): string {
  return `${name} Revised`;
}
