/** Display helpers. Money is always shown as `Rs. 1,00,000.00` (Indian grouping). */

export function formatMoney(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 'Rs. 0.00';
  const negative = amount < 0;
  const [whole, fraction] = Math.abs(amount).toFixed(2).split('.');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return `${negative ? '-' : ''}Rs. ${grouped}.${fraction}`;
}

/** Short form for chart axes: 1,25,000 becomes "1.25L". */
export function formatCompactINR(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs >= 10000000) return `${sign}${(abs / 10000000).toFixed(abs % 10000000 === 0 ? 0 : 1)}Cr`;
  if (abs >= 100000) return `${sign}${(abs / 100000).toFixed(abs % 100000 === 0 ? 0 : 1)}L`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k`;
  return `${sign}${abs}`;
}

export function formatNumber(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

export function formatPercent(value: number | null | undefined): string {
  return `${Number(value ?? 0).toFixed(2).replace(/\.00$/, '')}%`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Value for an `<input type="date">`. */
export function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function today(): string {
  return toDateInput(new Date());
}

/** Turn an enum value such as OTHER_EXPENSE into "Other Expense". */
export function titleCase(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Absolute URL for an uploaded image. */
export function imageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : url;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
