import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/errors';
import { listQuerySchema, listResponse, paginate, serialize } from '../lib/http';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireBackOffice } from '../middleware/auth';
import { paymentSchema } from '../validation/documents';
import { recordPayment } from '../services/payments';

export const paymentsRouter = Router();

paymentsRouter.use(requireAuth, requireBackOffice);

const INCLUDE = {
  partner: { select: { id: true, name: true, email: true } },
  bill: { select: { id: true, number: true, status: true } },
  invoice: { select: { id: true, number: true, status: true } },
  journalEntry: { select: { id: true, number: true, status: true } },
} as const;

paymentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const where = {
      ...(query.archived === 'all' ? {} : { isArchived: query.archived === 'true' }),
      ...(query.status ? { type: query.status as 'SEND' | 'RECEIVE' } : {}),
      ...(query.search
        ? {
            OR: [
              { number: { contains: query.search, mode: 'insensitive' as const } },
              { note: { contains: query.search, mode: 'insensitive' as const } },
              { partner: { name: { contains: query.search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        ...paginate(query),
      }),
      prisma.payment.count({ where }),
    ]);

    res.json(listResponse(items, total, query));
  }),
);

paymentsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findUnique({
      where: { id: Number(req.params.id) },
      include: INCLUDE,
    });
    if (!payment) throw notFound('Payment not found');
    res.json(serialize(payment));
  }),
);

/** Confirming a payment posts its journal entry and settles the document. */
paymentsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = paymentSchema.parse(req.body);

    const payment = await prisma.$transaction(async (tx) => {
      const created = await recordPayment(tx, {
        type: input.type,
        partnerId: input.partnerId,
        amount: input.amount,
        date: input.date,
        via: input.via,
        note: input.note ?? null,
        billId: input.billId ?? null,
        invoiceId: input.invoiceId ?? null,
      });
      return tx.payment.findUniqueOrThrow({ where: { id: created.id }, include: INCLUDE });
    });

    res.status(201).json(serialize(payment));
  }),
);
