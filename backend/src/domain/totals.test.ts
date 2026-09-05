import { describe, expect, it } from 'vitest';
import { amountDue, computeDocumentTotals, computeLine } from './totals';
import { formatINR, round2, sum } from '../lib/money';

describe('computeLine', () => {
  it('multiplies quantity by unit price', () => {
    expect(computeLine({ quantity: 3, unitPrice: 2000 }).total).toBe(6000);
    expect(computeLine({ quantity: 5, unitPrice: 5000 }).total).toBe(25000);
  });

  it('applies the per line tax percentage', () => {
    const line = computeLine({ quantity: 1, unitPrice: 15000, taxPercent: 5 });
    expect(line.subtotal).toBe(15000);
    expect(line.taxAmount).toBe(750);
    expect(line.total).toBe(15750);
  });

  it('rounds to paise instead of drifting', () => {
    const line = computeLine({ quantity: 3, unitPrice: 33.33 });
    expect(line.total).toBe(99.99);
  });

  it('accepts string amounts coming from the database', () => {
    expect(computeLine({ quantity: '2', unitPrice: '1250.50' }).total).toBe(2501);
  });
});

describe('computeDocumentTotals', () => {
  it('sums the subtotal, tax and grand total', () => {
    const totals = computeDocumentTotals([
      { quantity: 3, unitPrice: 2000 },
      { quantity: 1, unitPrice: 15000, taxPercent: 5 },
    ]);
    expect(totals.subtotal).toBe(21000);
    expect(totals.taxTotal).toBe(750);
    expect(totals.total).toBe(21750);
  });

  it('returns zeros for a document with no lines', () => {
    expect(computeDocumentTotals([])).toMatchObject({ subtotal: 0, taxTotal: 0, total: 0 });
  });
});

describe('amountDue', () => {
  it('is the total less what has been paid by cash and bank', () => {
    expect(amountDue(6000, 0, 6000)).toBe(0);
    expect(amountDue(6000, 1000, 2000)).toBe(3000);
  });
});

describe('money helpers', () => {
  it('adds without floating point error', () => {
    expect(sum([0.1, 0.2])).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
  });

  it('formats amounts with Indian digit grouping', () => {
    expect(formatINR(100000)).toBe('Rs. 1,00,000.00');
    expect(formatINR(6000)).toBe('Rs. 6,000.00');
    expect(formatINR(12345678.5)).toBe('Rs. 1,23,45,678.50');
    expect(formatINR(-2500)).toBe('-Rs. 2,500.00');
    expect(formatINR(0)).toBe('Rs. 0.00');
  });
});
