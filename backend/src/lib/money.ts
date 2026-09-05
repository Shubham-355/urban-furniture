/**
 * Money helpers.
 *
 * Amounts live in the database as Decimal(14,2). Inside the application we work
 * with integer paise wherever arithmetic happens, so no floating point error can
 * creep into a total, and convert back to a 2 dp number at the edges.
 */

export type Numeric = number | string | { toString(): string };

/** Convert any incoming numeric representation to integer paise. */
export function toPaise(value: Numeric | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const raw = typeof value === 'number' ? value.toFixed(6) : String(value);
  const trimmed = raw.trim();
  if (trimmed === '') return 0;
  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [whole, fraction = ''] = unsigned.split('.');
  const wholePart = whole === '' ? 0 : Number(whole);
  if (!Number.isFinite(wholePart)) return 0;
  const paddedFraction = `${fraction}000`.slice(0, 3);
  const hundredths = Number(paddedFraction.slice(0, 2));
  const thousandth = Number(paddedFraction.slice(2, 3));
  let paise = wholePart * 100 + hundredths;
  if (thousandth >= 5) paise += 1; // round half up on the third decimal
  return negative ? -paise : paise;
}

/** Convert integer paise back to a rupee amount rounded to 2 dp. */
export function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}

/** Round any numeric value to a 2 dp rupee amount. */
export function round2(value: Numeric | null | undefined): number {
  return fromPaise(toPaise(value));
}

/** Sum a list of numeric values without floating point drift. */
export function sum(values: Numeric[]): number {
  return fromPaise(values.reduce<number>((acc, value) => acc + toPaise(value), 0));
}

/** Multiply a quantity by a unit price and round to 2 dp. */
export function multiply(quantity: Numeric, unitPrice: Numeric): number {
  const q = toPaise(quantity); // quantity also carries 2 dp
  const p = toPaise(unitPrice);
  // q and p are both hundredths, so their product is in 1/10000 of a rupee;
  // divide by 100 to land back on paise.
  return fromPaise(Math.round((q * p) / 100));
}

/** Apply a percentage to an amount, rounded to 2 dp. */
export function percentOf(amount: Numeric, percent: Numeric): number {
  const a = toPaise(amount);
  const p = toPaise(percent);
  return fromPaise(Math.round((a * p) / 10000));
}

export function isZero(value: Numeric | null | undefined): boolean {
  return toPaise(value) === 0;
}

export function equals(a: Numeric | null | undefined, b: Numeric | null | undefined): boolean {
  return toPaise(a) === toPaise(b);
}

/**
 * Format an amount using the Indian digit grouping, e.g. `Rs. 1,00,000.00`.
 * The UI does its own formatting; this is used for PDFs and emails.
 */
export function formatINR(value: Numeric | null | undefined): string {
  const amount = round2(value);
  const negative = amount < 0;
  const [whole, fraction] = Math.abs(amount).toFixed(2).split('.');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest
    ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`
    : last3;
  return `${negative ? '-' : ''}Rs. ${grouped}.${fraction}`;
}
