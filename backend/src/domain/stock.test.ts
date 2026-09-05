import { describe, expect, it } from 'vitest';
import { buildStockReport, isStocked, type StockMovement, type StockProduct } from './stock';

const PRODUCTS: StockProduct[] = [
  {
    productId: 1,
    productName: 'Wooden Chair',
    productType: 'GOODS',
    categoryName: 'Chairs',
    cost: 2000,
  },
  {
    productId: 2,
    productName: 'Office Chair',
    productType: 'GOODS',
    categoryName: 'Chairs',
    cost: 3500,
  },
  {
    productId: 3,
    productName: 'Assembly Service',
    productType: 'SERVICE',
    categoryName: null,
    cost: 500,
  },
  {
    productId: 4,
    productName: 'Dining Set',
    productType: 'COMBO',
    categoryName: 'Tables',
    cost: 12000,
  },
];

/** The spec walkthrough: 3 chairs bought at 2,000, 5 office chairs sold. */
const MOVEMENTS: StockMovement[] = [
  { productId: 1, direction: 'IN', quantity: 3, value: 6000, opening: false },
  { productId: 2, direction: 'IN', quantity: 8, value: 28000, opening: true },
  { productId: 2, direction: 'OUT', quantity: 5, value: 25000, opening: false },
  // A service line on a bill has no stock effect.
  { productId: 3, direction: 'IN', quantity: 2, value: 1000, opening: false },
];

describe('isStocked', () => {
  it('tracks goods and combos but not services', () => {
    expect(isStocked('GOODS')).toBe(true);
    expect(isStocked('COMBO')).toBe(true);
    expect(isStocked('SERVICE')).toBe(false);
  });
});

describe('buildStockReport', () => {
  const report = buildStockReport(PRODUCTS, MOVEMENTS);
  const row = (name: string) => report.rows.find((r) => r.productName === name)!;

  it('leaves services out of the report entirely', () => {
    expect(report.rows.map((r) => r.productName)).not.toContain('Assembly Service');
  });

  it('lists stocked products with no movement at zero', () => {
    expect(row('Dining Set').closingQty).toBe(0);
    expect(row('Dining Set').stockValue).toBe(0);
  });

  it('counts purchases in and sales out inside the period', () => {
    expect(row('Wooden Chair').inQty).toBe(3);
    expect(row('Wooden Chair').inValue).toBe(6000);
    expect(row('Office Chair').outQty).toBe(5);
    expect(row('Office Chair').outValue).toBe(25000);
  });

  it('keeps movements before the period in the opening quantity', () => {
    expect(row('Office Chair').openingQty).toBe(8);
    expect(row('Office Chair').inQty).toBe(0);
  });

  it('reconciles: opening + in - out = closing, for every row', () => {
    for (const entry of report.rows) {
      expect(entry.closingQty).toBe(entry.openingQty + entry.inQty - entry.outQty);
    }
    expect(row('Office Chair').closingQty).toBe(3);
    expect(row('Wooden Chair').closingQty).toBe(3);
  });

  it('values what is on hand at the product cost', () => {
    expect(row('Wooden Chair').stockValue).toBe(6000);
    expect(row('Office Chair').stockValue).toBe(10500);
    expect(report.totals.stockValue).toBe(16500);
  });

  it('sorts rows by product name', () => {
    expect(report.rows.map((r) => r.productName)).toEqual([
      'Dining Set',
      'Office Chair',
      'Wooden Chair',
    ]);
  });

  it('totals the columns', () => {
    expect(report.totals.inQty).toBe(3);
    expect(report.totals.outQty).toBe(5);
    expect(report.totals.inValue).toBe(6000);
    expect(report.totals.outValue).toBe(25000);
    expect(report.totals.closingQty).toBe(6);
  });

  it('handles fractional quantities without floating point drift', () => {
    const fractional = buildStockReport(
      [{ ...PRODUCTS[0], cost: 10.1 }],
      [
        { productId: 1, direction: 'IN', quantity: 0.3, value: 3.03, opening: false },
        { productId: 1, direction: 'IN', quantity: 0.1, value: 1.01, opening: false },
        { productId: 1, direction: 'OUT', quantity: 0.2, value: 2.02, opening: false },
      ],
    );
    expect(fractional.rows[0].closingQty).toBe(0.2);
    expect(fractional.rows[0].stockValue).toBe(2.02);
  });

  it('reports an empty ledger as all zeroes', () => {
    const empty = buildStockReport(PRODUCTS, []);
    expect(empty.totals.closingQty).toBe(0);
    expect(empty.totals.stockValue).toBe(0);
    expect(empty.rows).toHaveLength(3);
  });
});
