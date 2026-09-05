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
import { analyticSchema } from '../validation/masters';
import { computeBudgetAchievement } from '../services/budgets';

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth, requireBackOffice);

analyticsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const where = {
      ...archivedFilter(query),
      ...(query.status ? { type: query.status as 'INCOME' | 'EXPENSE' } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.analyticAccount.findMany({
        where,
        orderBy: orderBy(query, ['name', 'type', 'createdAt'], 'name'),
        ...paginate(query),
      }),
      prisma.analyticAccount.count({ where }),
    ]);

    res.json(listResponse(items, total, query));
  }),
);

/**
 * The Analytic form shows every budget the account is used on, together with
 * the committed and achieved amounts for that budget line.
 */
analyticsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const analytic = await prisma.analyticAccount.findUnique({ where: { id } });
    if (!analytic) throw notFound('Analytic account not found');

    const budgets = await prisma.budget.findMany({
      where: { isArchived: false, lines: { some: { analyticId: id } } },
      include: {
        lines: { include: { analytic: { select: { id: true, name: true, type: true } } } },
        responsible: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    const usage = [];
    for (const budget of budgets) {
      const computed = await computeBudgetAchievement(budget);
      const line = computed.lines.find((l) => l.analyticId === id);
      usage.push({
        budgetId: budget.id,
        budgetName: budget.name,
        status: budget.status,
        startDate: budget.startDate,
        endDate: budget.endDate,
        committedAmount: line?.committedAmount ?? 0,
        achievedAmount: line?.achievedAmount ?? 0,
        achievedPercent: line?.achievedPercent ?? 0,
        amountToAchieve: line?.amountToAchieve ?? 0,
      });
    }

    res.json(serialize({ ...analytic, budgets: usage }));
  }),
);

analyticsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = analyticSchema.parse(req.body);
    const analytic = await prisma.analyticAccount.create({ data: input });
    res.status(201).json(serialize(analytic));
  }),
);

analyticsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const input = analyticSchema.parse(req.body);
    const analytic = await prisma.analyticAccount.update({
      where: { id: Number(req.params.id) },
      data: input,
    });
    res.json(serialize(analytic));
  }),
);

analyticsRouter.post(
  '/:id/archive',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const analytic = await prisma.analyticAccount.update({
      where: { id: Number(req.params.id) },
      data: { isArchived: true },
    });
    res.json(serialize(analytic));
  }),
);

analyticsRouter.post(
  '/:id/restore',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const analytic = await prisma.analyticAccount.update({
      where: { id: Number(req.params.id) },
      data: { isArchived: false },
    });
    res.json(serialize(analytic));
  }),
);
