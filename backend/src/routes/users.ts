import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../lib/errors';
import { archivedFilter, listQuerySchema, listResponse, orderBy, paginate, serialize } from '../lib/http';
import { asyncHandler } from '../middleware/error';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { createUserSchema } from '../validation/auth';
import { assertCredentialsAvailable, hashPassword } from './auth';
import { ROLE_LABELS, sendCredentialsEmail } from '../services/userMail';

export const usersRouter = Router();

usersRouter.use(requireAuth, requireAdmin);

const SELECT = {
  id: true,
  name: true,
  loginId: true,
  email: true,
  role: true,
  isArchived: true,
  contactId: true,
  contact: { select: { id: true, name: true } },
  createdAt: true,
} as const;

usersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const where = {
      ...archivedFilter(query),
      ...(query.status ? { role: query.status as 'ADMIN' | 'ACCOUNTANT' | 'CONTACT' } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { loginId: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: SELECT,
        orderBy: orderBy(query, ['name', 'loginId', 'email', 'role', 'createdAt']),
        ...paginate(query),
      }),
      prisma.user.count({ where }),
    ]);

    res.json(listResponse(items, total, query));
  }),
);

usersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: Number(req.params.id) },
      select: SELECT,
    });
    if (!user) throw notFound('User not found');
    res.json(serialize(user));
  }),
);

usersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createUserSchema.parse(req.body);
    await assertCredentialsAvailable(input.loginId, input.email);

    if (input.role === 'CONTACT' && !input.contactId) {
      throw badRequest('A portal user must be linked to a contact');
    }
    if (input.contactId) {
      const contact = await prisma.contact.findUnique({ where: { id: input.contactId } });
      if (!contact) throw badRequest('The selected contact does not exist');
      const taken = await prisma.user.findUnique({ where: { contactId: input.contactId } });
      if (taken) {
        throw badRequest(
          `${contact.name} already signs in as "${taken.loginId}". A contact can only have one portal login.`,
        );
      }
    }

    const user = await prisma.user.create({
      data: {
        name: input.name,
        loginId: input.loginId,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        role: input.role,
        contactId: input.role === 'CONTACT' ? input.contactId ?? null : null,
      },
      select: SELECT,
    });

    // The administrator picks the password, so the new user is told what it is.
    const mail = await sendCredentialsEmail({
      name: user.name,
      email: user.email,
      loginId: user.loginId,
      password: input.password,
      roleLabel: ROLE_LABELS[user.role] ?? 'a user',
    });

    res.status(201).json(serialize({ ...user, mail }));
  }),
);

usersRouter.post(
  '/:id/archive',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user!.id) throw badRequest('You cannot archive your own account');
    const user = await prisma.user.update({
      where: { id },
      data: { isArchived: true },
      select: SELECT,
    });
    res.json(serialize(user));
  }),
);

usersRouter.post(
  '/:id/restore',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: { isArchived: false },
      select: SELECT,
    });
    res.json(serialize(user));
  }),
);
