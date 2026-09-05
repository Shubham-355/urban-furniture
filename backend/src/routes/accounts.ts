import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/errors';
import {
  archivedFilter,
  listQuerySchema,
  listResponse,
  orderBy,
  paginate,
  serialize,
} from '../lib/http';
import { asyncHandler } from '../middleware/error';
import { requireAdmin, requireAuth, requireBackOffice } from '../middleware/auth';
import { accountSchema, journalSchema } from '../validation/masters';

export const accountsRouter = Router();
export const journalsRouter = Router();

accountsRouter.use(requireAuth, requireBackOffice);
journalsRouter.use(requireAuth, requireBackOffice);

// ------------------------------------------------------------ chart of accounts

const BALANCE_SHEET_TYPES = ['ASSET', 'LIABILITY', 'BANK', 'CAPITAL', 'CASH'];

accountsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const where = {
      ...archivedFilter(query),
      // `status` carries either a single type or the report group it belongs to.
      ...(query.status === 'BALANCESHEET'
        ? { type: { in: BALANCE_SHEET_TYPES as never[] } }
        : query.status === 'PROFIT_AND_LOSS'
          ? { type: { notIn: BALANCE_SHEET_TYPES as never[] } }
          : query.status
            ? { type: query.status as never }
            : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.account.findMany({
        where,
        orderBy: orderBy(query, ['name', 'type', 'createdAt'], 'name'),
        ...paginate(query),
      }),
      prisma.account.count({ where }),
    ]);

    res.json(listResponse(items, total, query));
  }),
);

accountsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const account = await prisma.account.findUnique({ where: { id: Number(req.params.id) } });
    if (!account) throw notFound('Account not found');
    res.json(serialize(account));
  }),
);

accountsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = accountSchema.parse(req.body);
    const account = await prisma.account.create({ data: input });
    res.status(201).json(serialize(account));
  }),
);

accountsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const input = accountSchema.parse(req.body);
    const account = await prisma.account.update({
      where: { id: Number(req.params.id) },
      data: input,
    });
    res.json(serialize(account));
  }),
);

accountsRouter.post(
  '/:id/archive',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const account = await prisma.account.update({
      where: { id: Number(req.params.id) },
      data: { isArchived: true },
    });
    res.json(serialize(account));
  }),
);

accountsRouter.post(
  '/:id/restore',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const account = await prisma.account.update({
      where: { id: Number(req.params.id) },
      data: { isArchived: false },
    });
    res.json(serialize(account));
  }),
);

// --------------------------------------------------------------------- journals

const JOURNAL_SELECT = {
  id: true,
  name: true,
  type: true,
  defaultAccountId: true,
  defaultAccount: { select: { id: true, name: true, type: true } },
  isArchived: true,
} as const;

journalsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const where = {
      ...archivedFilter(query),
      ...(query.status ? { type: query.status as 'SALES' | 'PURCHASE' | 'BANK' | 'CASH' } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.journal.findMany({
        where,
        select: JOURNAL_SELECT,
        orderBy: orderBy(query, ['name', 'type', 'createdAt'], 'name'),
        ...paginate(query),
      }),
      prisma.journal.count({ where }),
    ]);

    res.json(listResponse(items, total, query));
  }),
);

journalsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const journal = await prisma.journal.findUnique({
      where: { id: Number(req.params.id) },
      select: JOURNAL_SELECT,
    });
    if (!journal) throw notFound('Journal not found');
    res.json(serialize(journal));
  }),
);

journalsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = journalSchema.parse(req.body);
    const journal = await prisma.journal.create({
      data: { ...input, defaultAccountId: input.defaultAccountId ?? null },
      select: JOURNAL_SELECT,
    });
    res.status(201).json(serialize(journal));
  }),
);

journalsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const input = journalSchema.parse(req.body);
    const journal = await prisma.journal.update({
      where: { id: Number(req.params.id) },
      data: { ...input, defaultAccountId: input.defaultAccountId ?? null },
      select: JOURNAL_SELECT,
    });
    res.json(serialize(journal));
  }),
);

journalsRouter.post(
  '/:id/archive',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const journal = await prisma.journal.update({
      where: { id: Number(req.params.id) },
      data: { isArchived: true },
      select: JOURNAL_SELECT,
    });
    res.json(serialize(journal));
  }),
);

journalsRouter.post(
  '/:id/restore',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const journal = await prisma.journal.update({
      where: { id: Number(req.params.id) },
      data: { isArchived: false },
      select: JOURNAL_SELECT,
    });
    res.json(serialize(journal));
  }),
);
