import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../lib/errors';
import { listQuerySchema, listResponse, paginate, serialize } from '../lib/http';
import { revisedName } from '../domain/budget';
import { asyncHandler } from '../middleware/error';
import { requireAdmin, requireAuth, requireBackOffice } from '../middleware/auth';
import { budgetSchema } from '../validation/documents';
import { computeBudgetAchievement, loadAchievedDocuments } from '../services/budgets';

export const budgetsRouter = Router();

budgetsRouter.use(requireAuth, requireBackOffice);

const INCLUDE = {
  responsible: { select: { id: true, name: true, email: true } },
  revisionOf: { select: { id: true, name: true, status: true } },
  revisedWith: { select: { id: true, name: true, status: true } },
  lines: {
    include: { analytic: { select: { id: true, name: true, type: true } } },
    orderBy: { id: 'asc' as const },
  },
} as const;

/**
 * Analytics on sales documents must be Income accounts and analytics on
 * purchase documents must be Expense accounts.
 */
export async function assertAnalyticType(
  analyticId: number,
  expected: 'INCOME' | 'EXPENSE',
): Promise<void> {
  const analytic = await prisma.analyticAccount.findUnique({ where: { id: analyticId } });
  if (!analytic || analytic.isArchived) throw badRequest('Select a valid analytic account');
  if (analytic.type !== expected) {
    throw badRequest(
      expected === 'INCOME'
        ? `"${analytic.name}" is an expense analytic and cannot be used on a sales document`
        : `"${analytic.name}" is an income analytic and cannot be used on a purchase document`,
    );
  }
}

type BudgetRow = Awaited<ReturnType<typeof loadBudget>>;

function loadBudget(id: number) {
  return prisma.budget.findUnique({ where: { id }, include: INCLUDE });
}

/** Attach achieved / percent / to-achieve to every line of a budget. */
async function withAchievement(budget: NonNullable<BudgetRow>) {
  const computed = await computeBudgetAchievement(budget);
  const byLine = new Map(computed.lines.map((line) => [line.id, line]));
  return {
    ...budget,
    lines: budget.lines.map((line) => ({
      ...line,
      achievedAmount: byLine.get(line.id)?.achievedAmount ?? 0,
      achievedPercent: byLine.get(line.id)?.achievedPercent ?? 0,
      amountToAchieve: byLine.get(line.id)?.amountToAchieve ?? 0,
    })),
    totalCommitted: computed.totalCommitted,
    totalAchieved: computed.totalAchieved,
    totalToAchieve: computed.totalToAchieve,
    achievedPercent: computed.achievedPercent,
  };
}

budgetsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const where = {
      ...(query.archived === 'all' ? {} : { isArchived: query.archived === 'true' }),
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.budget.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
        ...paginate(query),
      }),
      prisma.budget.count({ where }),
    ]);

    const items = [];
    for (const row of rows) items.push(await withAchievement(row));
    res.json(listResponse(items, total, query));
  }),
);

budgetsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const budget = await loadBudget(Number(req.params.id));
    if (!budget) throw notFound('Budget not found');
    res.json(serialize(await withAchievement(budget)));
  }),
);

budgetsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = budgetSchema.parse(req.body);
    const budget = await prisma.budget.create({
      data: {
        name: input.name,
        startDate: input.startDate,
        endDate: input.endDate,
        responsibleId: input.responsibleId ?? null,
        status: 'DRAFT',
        lines: {
          create: input.lines.map((line) => ({
            analyticId: line.analyticId,
            committedAmount: line.committedAmount,
          })),
        },
      },
      include: INCLUDE,
    });
    res.status(201).json(serialize(await withAchievement(budget)));
  }),
);

budgetsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const input = budgetSchema.parse(req.body);
    const existing = await prisma.budget.findUnique({ where: { id } });
    if (!existing) throw notFound('Budget not found');
    if (existing.status !== 'DRAFT') throw badRequest('Only a draft budget can be edited');

    const budget = await prisma.$transaction(async (tx) => {
      await tx.budgetLine.deleteMany({ where: { budgetId: id } });
      return tx.budget.update({
        where: { id },
        data: {
          name: input.name,
          startDate: input.startDate,
          endDate: input.endDate,
          responsibleId: input.responsibleId ?? null,
          lines: {
            create: input.lines.map((line) => ({
              analyticId: line.analyticId,
              committedAmount: line.committedAmount,
            })),
          },
        },
        include: INCLUDE,
      });
    });

    res.json(serialize(await withAchievement(budget)));
  }),
);

budgetsRouter.post(
  '/:id/confirm',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.budget.findUnique({ where: { id } });
    if (!existing) throw notFound('Budget not found');
    if (existing.status !== 'DRAFT') throw badRequest('Only a draft budget can be confirmed');

    const budget = await prisma.budget.update({
      where: { id },
      data: { status: 'CONFIRMED' },
      include: INCLUDE,
    });
    res.json(serialize(await withAchievement(budget)));
  }),
);

/**
 * Revise copies a confirmed budget into a new draft named "<name> Revised",
 * links the two together and moves the original to the Revised stage.
 */
budgetsRouter.post(
  '/:id/revise',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    const revision = await prisma.$transaction(async (tx) => {
      const original = await tx.budget.findUnique({ where: { id }, include: { lines: true } });
      if (!original) throw notFound('Budget not found');
      if (original.status !== 'CONFIRMED') {
        throw badRequest('Only a confirmed budget can be revised');
      }

      const created = await tx.budget.create({
        data: {
          name: revisedName(original.name),
          startDate: original.startDate,
          endDate: original.endDate,
          responsibleId: original.responsibleId,
          status: 'DRAFT',
          revisionOfId: original.id,
          lines: {
            create: original.lines.map((line) => ({
              analyticId: line.analyticId,
              committedAmount: line.committedAmount,
            })),
          },
        },
      });

      await tx.budget.update({ where: { id: original.id }, data: { status: 'REVISED' } });
      return tx.budget.findUniqueOrThrow({ where: { id: created.id }, include: INCLUDE });
    });

    res.status(201).json(serialize(await withAchievement(revision)));
  }),
);

budgetsRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const budget = await prisma.budget.update({
      where: { id: Number(req.params.id) },
      data: { status: 'CANCELLED' },
      include: INCLUDE,
    });
    res.json(serialize(await withAchievement(budget)));
  }),
);

budgetsRouter.post(
  '/:id/archive',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const budget = await prisma.budget.update({
      where: { id: Number(req.params.id) },
      data: { status: 'CANCELLED', isArchived: true },
      include: INCLUDE,
    });
    res.json(serialize(await withAchievement(budget)));
  }),
);

budgetsRouter.post(
  '/:id/restore',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const budget = await prisma.budget.update({
      where: { id: Number(req.params.id) },
      data: { isArchived: false, status: 'DRAFT' },
      include: INCLUDE,
    });
    res.json(serialize(await withAchievement(budget)));
  }),
);

/** Behind the Achieved Amount button: the documents that produced the figure. */
budgetsRouter.get(
  '/:id/lines/:lineId/achieved-documents',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const lineId = Number(req.params.lineId);

    const budget = await prisma.budget.findUnique({ where: { id }, include: INCLUDE });
    if (!budget) throw notFound('Budget not found');
    const line = budget.lines.find((l) => l.id === lineId);
    if (!line) throw notFound('Budget line not found');

    const documents = await loadAchievedDocuments(
      [line.analyticId],
      budget.startDate,
      budget.endDate,
    );
    const kind = line.analytic.type === 'INCOME' ? 'INVOICE' : 'BILL';

    res.json(
      serialize({
        budget: { id: budget.id, name: budget.name, startDate: budget.startDate, endDate: budget.endDate },
        analytic: line.analytic,
        documents: documents.filter((doc) => doc.kind === kind),
      }),
    );
  }),
);
