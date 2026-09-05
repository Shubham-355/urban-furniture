import { round2, sum, type Numeric } from '../lib/money';

/**
 * Stock maths.
 *
 * There is no separate inventory ledger: quantities are derived from the same
 * confirmed documents the accounts are, so the stock report can never drift
 * away from the books. Goods come in on a vendor bill line and go out on a
 * customer invoice line.
 */

export type StockProductType = 'GOODS' | 'SERVICE' | 'COMBO';

/** A service is consumed as it is sold, so it carries no stock. */
export function isStocked(type: StockProductType): boolean {
  return type !== 'SERVICE';
}

export interface StockProduct {
  productId: number;
  productName: string;
  productType: StockProductType;
  categoryName: string | null;
  /** Purchase price from the product master, used to value what is on hand. */
  cost: Numeric;
}

export interface StockMovement {
  productId: number;
  direction: 'IN' | 'OUT';
  quantity: Numeric;
  /** Untaxed line amount, so purchase and sales values stay comparable. */
  value: Numeric;
  /** True when the document is dated before the start of the period. */
  opening: boolean;
}

export interface StockRow {
  productId: number;
  productName: string;
  productType: StockProductType;
  categoryName: string | null;
  openingQty: number;
  inQty: number;
  inValue: number;
  outQty: number;
  outValue: number;
  closingQty: number;
  unitCost: number;
  stockValue: number;
}

export interface StockReport {
  rows: StockRow[];
  totals: {
    openingQty: number;
    inQty: number;
    inValue: number;
    outQty: number;
    outValue: number;
    closingQty: number;
    stockValue: number;
  };
}

/**
 * Opening quantity is everything moved before the period, In and Out are the
 * movements inside it, and Closing is the three added up - the same shape as a
 * ledger account, so a row always reconciles: opening + in - out = closing.
 *
 * Products with no movement at all are still listed, because "we hold none of
 * this" is an answer the report has to be able to give.
 */
export function buildStockReport(
  products: StockProduct[],
  movements: StockMovement[],
): StockReport {
  const rows = new Map<number, StockRow>();

  for (const product of products) {
    if (!isStocked(product.productType)) continue;
    rows.set(product.productId, {
      productId: product.productId,
      productName: product.productName,
      productType: product.productType,
      categoryName: product.categoryName,
      openingQty: 0,
      inQty: 0,
      inValue: 0,
      outQty: 0,
      outValue: 0,
      closingQty: 0,
      unitCost: round2(product.cost),
      stockValue: 0,
    });
  }

  for (const movement of movements) {
    const row = rows.get(movement.productId);
    // A movement against a service, or against a product that is no longer
    // listed, has nothing to report against.
    if (!row) continue;

    const quantity = round2(movement.quantity);
    const signed = movement.direction === 'IN' ? quantity : -quantity;

    if (movement.opening) {
      row.openingQty = round2(row.openingQty + signed);
      continue;
    }

    if (movement.direction === 'IN') {
      row.inQty = round2(row.inQty + quantity);
      row.inValue = round2(row.inValue + round2(movement.value));
    } else {
      row.outQty = round2(row.outQty + quantity);
      row.outValue = round2(row.outValue + round2(movement.value));
    }
  }

  const list = [...rows.values()];
  for (const row of list) {
    row.closingQty = round2(row.openingQty + row.inQty - row.outQty);
    row.stockValue = round2(row.closingQty * row.unitCost);
  }
  list.sort((a, b) => a.productName.localeCompare(b.productName));

  return {
    rows: list,
    totals: {
      openingQty: round2(sum(list.map((r) => r.openingQty))),
      inQty: round2(sum(list.map((r) => r.inQty))),
      inValue: sum(list.map((r) => r.inValue)),
      outQty: round2(sum(list.map((r) => r.outQty))),
      outValue: sum(list.map((r) => r.outValue)),
      closingQty: round2(sum(list.map((r) => r.closingQty))),
      stockValue: sum(list.map((r) => r.stockValue)),
    },
  };
}
