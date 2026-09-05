import { describe, expect, it } from 'vitest';
import {
  achievedPercent,
  computeAchieved,
  computeBudget,
  revisedName,
  withinPeriod,
  type AchievementSource,
  type BudgetLineInput,
} from './budget';

const FURNITURE: BudgetLineInput = {
  id: 1,
  analyticId: 10,
  analyticName: 'Furniture',
  analyticType: 'EXPENSE',
  committedAmount: 200000,
};

const PROJECT_ONE: BudgetLineInput = {
  id: 2,
  analyticId: 20,
  analyticName: 'Project 1',
  analyticType: 'INCOME',
  committedAmount: 100000,
};

const START = new Date(2026, 0, 1);
const END = new Date(2026, 11, 31, 23, 59, 59, 999);

const sources: AchievementSource[] = [
  // Wooden Chair x3 @ 2,000 booked against Furniture - the spec walkthrough.
  { analyticId: 10, date: new Date(2026, 0, 15), amount: 6000, kind: 'EXPENSE' },
  // Same analytic but outside the budget period.
  { analyticId: 10, date: new Date(2025, 11, 20), amount: 50000, kind: 'EXPENSE' },
  // Same analytic, wrong side of the ledger.
  { analyticId: 10, date: new Date(2026, 1, 3), amount: 9000, kind: 'INCOME' },
  // A different analytic.
  { analyticId: 99, date: new Date(2026, 1, 3), amount: 7000, kind: 'EXPENSE' },
  // Two income documents for Project 1.
  { analyticId: 20, date: new Date(2026, 2, 1), amount: 25000, kind: 'INCOME' },
  { analyticId: 20, date: new Date(2026, 5, 9), amount: 15000, kind: 'INCOME' },
];

describe('withinPeriod', () => {
  it('includes both ends of the period', () => {
    expect(withinPeriod(START, START, END)).toBe(true);
    expect(withinPeriod(END, START, END)).toBe(true);
    expect(withinPeriod(new Date(2025, 11, 31), START, END)).toBe(false);
    expect(withinPeriod(new Date(2027, 0, 1), START, END)).toBe(false);
  });
});

describe('computeAchieved', () => {
  it('counts only same-analytic documents of the matching type inside the period', () => {
    expect(computeAchieved(FURNITURE, sources, START, END)).toBe(6000);
  });

  it('adds up several documents for one analytic', () => {
    expect(computeAchieved(PROJECT_ONE, sources, START, END)).toBe(40000);
  });

  it('returns zero when nothing matches', () => {
    expect(computeAchieved({ ...FURNITURE, analyticId: 12345 }, sources, START, END)).toBe(0);
  });
});

describe('achievedPercent', () => {
  it('is achieved over committed as a percentage', () => {
    expect(achievedPercent(6000, 200000)).toBe(3);
    expect(achievedPercent(40000, 100000)).toBe(40);
  });

  it('is zero rather than infinite when nothing is committed', () => {
    expect(achievedPercent(500, 0)).toBe(0);
  });

  it('rounds to two decimals', () => {
    expect(achievedPercent(1, 3)).toBe(33.33);
  });
});

describe('computeBudget', () => {
  it('produces the achieved columns from the specification walkthrough', () => {
    const budget = computeBudget([FURNITURE], sources, START, END);
    expect(budget.lines).toHaveLength(1);
    expect(budget.lines[0]).toMatchObject({
      committedAmount: 200000,
      achievedAmount: 6000,
      achievedPercent: 3,
      amountToAchieve: 194000,
    });
  });

  it('totals every line of the budget', () => {
    const budget = computeBudget([FURNITURE, PROJECT_ONE], sources, START, END);
    expect(budget.totalCommitted).toBe(300000);
    expect(budget.totalAchieved).toBe(46000);
    expect(budget.totalToAchieve).toBe(254000);
    expect(budget.achievedPercent).toBe(15.33);
  });

  it('can over-achieve, leaving a negative amount to achieve', () => {
    const budget = computeBudget(
      [{ ...PROJECT_ONE, committedAmount: 30000 }],
      sources,
      START,
      END,
    );
    expect(budget.lines[0].achievedAmount).toBe(40000);
    expect(budget.lines[0].amountToAchieve).toBe(-10000);
    expect(budget.lines[0].achievedPercent).toBeCloseTo(133.33, 2);
  });
});

describe('revisedName', () => {
  it('appends Revised to the original name', () => {
    expect(revisedName('Furniture Jan 2026')).toBe('Furniture Jan 2026 Revised');
  });
});
