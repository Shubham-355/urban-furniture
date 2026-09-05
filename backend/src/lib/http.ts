import { Prisma } from '@prisma/client';
import { z } from 'zod';

/**
 * Shared request/response plumbing: list query parsing and JSON serialisation.
 */

export const listQuerySchema = z.object({
  search: z.string().trim().optional().default(''),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(25),
  status: z.string().trim().optional(),
  archived: z
    .enum(['true', 'false', 'all'])
    .optional()
    .default('false'),
  sortBy: z.string().trim().optional(),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export function paginate(query: ListQuery) {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

/** Translate the `archived` filter into a Prisma where fragment. */
export function archivedFilter(query: ListQuery): { isArchived?: boolean } {
  if (query.archived === 'all') return {};
  return { isArchived: query.archived === 'true' };
}

export function orderBy(query: ListQuery, allowed: string[], fallback = 'createdAt') {
  const field = query.sortBy && allowed.includes(query.sortBy) ? query.sortBy : fallback;
  return { [field]: query.sortDir } as Record<string, 'asc' | 'desc'>;
}

/**
 * Prisma hands Decimal columns back as Decimal objects, which JSON.stringify
 * would turn into strings. The client works in numbers, so convert on the way
 * out - amounts are always 2 dp so a JS number is exact here.
 */
export function serialize<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (value instanceof Prisma.Decimal) return Number(value.toFixed(2)) as unknown as T;
  if (value instanceof Date) return value.toISOString() as unknown as T;
  if (Array.isArray(value)) return value.map(serialize) as unknown as T;
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = serialize(item);
    }
    return output as T;
  }
  return value;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export function listResponse<T>(items: T[], total: number, query: ListQuery): ListResponse<T> {
  return {
    items: serialize(items),
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

/** Parse a `YYYY-MM-DD` (or ISO) string into a date at the start of that day. */
export function startOfDay(value: string | Date): Date {
  const date = typeof value === 'string' ? new Date(value) : value;
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Parse a date and push it to the last millisecond of that day. */
export function endOfDay(value: string | Date): Date {
  const date = typeof value === 'string' ? new Date(value) : value;
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export const dateSchema = z
  .union([z.string(), z.date()])
  .transform((value) => (typeof value === 'string' ? new Date(value) : value))
  .refine((value) => !Number.isNaN(value.getTime()), { message: 'Invalid date' });

export const optionalDateSchema = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined || value === '') return null;
    const date = typeof value === 'string' ? new Date(value) : value;
    return Number.isNaN(date.getTime()) ? null : date;
  });

export const moneySchema = z.coerce.number().finite();
export const idSchema = z.coerce.number().int().positive();
