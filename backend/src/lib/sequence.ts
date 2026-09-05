import type { Tx } from './prisma';

/**
 * Document numbering. Every sequence is "+1 of the last one" and is never
 * editable by the user. Sequences that carry a year restart each year, and the
 * year always comes from the document date.
 */

export type SequenceKey =
  | 'PURCHASE_ORDER'
  | 'SALES_ORDER'
  | 'VENDOR_BILL'
  | 'CUSTOMER_INVOICE'
  | 'PAYMENT'
  | 'JOURNAL_ENTRY';

interface SequenceFormat {
  /** Sequences without a year share a single counter under year 0. */
  yearly: boolean;
  format: (value: number, year: number) => string;
}

const pad = (value: number, width: number) => String(value).padStart(width, '0');

const FORMATS: Record<SequenceKey, SequenceFormat> = {
  PURCHASE_ORDER: { yearly: false, format: (n) => `P${pad(n, 5)}` },
  SALES_ORDER: { yearly: false, format: (n) => `S${pad(n, 5)}` },
  VENDOR_BILL: { yearly: true, format: (n, y) => `Bill/${y}/${pad(n, 4)}` },
  CUSTOMER_INVOICE: { yearly: true, format: (n, y) => `INV/${y}/${pad(n, 4)}` },
  PAYMENT: { yearly: true, format: (n, y) => `PAY/${y}/${pad(n, 4)}` },
  JOURNAL_ENTRY: { yearly: true, format: (n, y) => `JE/${y}/${pad(n, 4)}` },
};

/**
 * Reserve the next number for a sequence. Must run inside the same transaction
 * as the document it numbers so a rolled back document does not burn a number.
 */
export async function nextNumber(tx: Tx, key: SequenceKey, date: Date): Promise<string> {
  const config = FORMATS[key];
  const year = config.yearly ? date.getFullYear() : 0;

  const sequence = await tx.sequence.upsert({
    where: { key_year: { key, year } },
    create: { key, year, next: 2 },
    update: { next: { increment: 1 } },
    select: { next: true },
  });

  // upsert returns the row after the update, so the number we just claimed is next-1
  const claimed = sequence.next - 1;
  return config.format(claimed, year);
}
