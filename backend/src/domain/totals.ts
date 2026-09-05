import { multiply, percentOf, round2, sum, type Numeric } from '../lib/money';

/** A line as it arrives from the client, before the server recomputes it. */
export interface RawLine {
  quantity: Numeric;
  unitPrice: Numeric;
  taxPercent?: Numeric;
}

export interface ComputedLine {
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  /** quantity x unitPrice, before tax */
  subtotal: number;
  taxAmount: number;
  /** subtotal + taxAmount */
  total: number;
}

export interface DocumentTotals {
  lines: ComputedLine[];
  subtotal: number;
  taxTotal: number;
  total: number;
}

/**
 * Recompute a single line. Totals are never trusted from the client - the
 * server always derives them from quantity, unit price and tax percent.
 */
export function computeLine(line: RawLine): ComputedLine {
  const quantity = round2(line.quantity);
  const unitPrice = round2(line.unitPrice);
  const taxPercent = round2(line.taxPercent ?? 0);
  const subtotal = multiply(quantity, unitPrice);
  const taxAmount = percentOf(subtotal, taxPercent);
  return {
    quantity,
    unitPrice,
    taxPercent,
    subtotal,
    taxAmount,
    total: round2(sum([subtotal, taxAmount])),
  };
}

/** Recompute every line of a document plus its footer totals. */
export function computeDocumentTotals(lines: RawLine[]): DocumentTotals {
  const computed = lines.map(computeLine);
  return {
    lines: computed,
    subtotal: sum(computed.map((l) => l.subtotal)),
    taxTotal: sum(computed.map((l) => l.taxAmount)),
    total: sum(computed.map((l) => l.total)),
  };
}

/** Amount still owed on a bill or invoice. */
export function amountDue(total: Numeric, paidCash: Numeric, paidBank: Numeric): number {
  return round2(sum([total, -round2(paidCash), -round2(paidBank)]));
}
