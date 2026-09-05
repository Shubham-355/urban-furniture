import { Router } from 'express';
import type { ContactType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../lib/errors';
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
import { contactSchema } from '../validation/masters';
import { assertCredentialsAvailable, hashPassword } from './auth';
import { ROLE_LABELS, sendCredentialsEmail } from '../services/userMail';

export const contactsRouter = Router();

contactsRouter.use(requireAuth, requireBackOffice);

const SELECT = {
  id: true,
  name: true,
  type: true,
  email: true,
  mobile: true,
  street: true,
  city: true,
  state: true,
  country: true,
  pincode: true,
  imageUrl: true,
  isArchived: true,
  portalUser: { select: { id: true, loginId: true, email: true } },
} as const;

contactsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    // `portal=none` powers the Create User picker: a contact can only ever have
    // one portal login, so the ones that already have it are not offered.
    const portal = String(req.query.portal ?? '');
    const where = {
      ...archivedFilter(query),
      ...(portal === 'none' ? { portalUser: { is: null } } : {}),
      // `status` doubles as the Customer / Vendor filter used by the pickers.
      ...(query.status === 'CUSTOMER'
        ? { type: { in: ['CUSTOMER', 'BOTH'] as ContactType[] } }
        : query.status === 'VENDOR'
          ? { type: { in: ['VENDOR', 'BOTH'] as ContactType[] } }
          : query.status
            ? { type: query.status as 'CUSTOMER' | 'VENDOR' | 'BOTH' }
            : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { mobile: { contains: query.search, mode: 'insensitive' as const } },
              { city: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        select: SELECT,
        orderBy: orderBy(query, ['name', 'email', 'type', 'createdAt'], 'name'),
        ...paginate(query),
      }),
      prisma.contact.count({ where }),
    ]);

    res.json(listResponse(items, total, query));
  }),
);

contactsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const contact = await prisma.contact.findUnique({
      where: { id: Number(req.params.id) },
      select: SELECT,
    });
    if (!contact) throw notFound('Contact not found');
    res.json(serialize(contact));
  }),
);

contactsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = contactSchema.parse(req.body);
    const { portalUser, ...data } = input;

    if (portalUser) {
      await assertCredentialsAvailable(portalUser.loginId, data.email);
    }

    const contact = await prisma.$transaction(async (tx) => {
      const created = await tx.contact.create({ data });
      if (portalUser) {
        // "Contact users can be created when creating Contact Master data."
        await tx.user.create({
          data: {
            name: created.name,
            loginId: portalUser.loginId,
            email: created.email,
            passwordHash: await hashPassword(portalUser.password),
            role: 'CONTACT',
            contactId: created.id,
          },
        });
      }
      return tx.contact.findUniqueOrThrow({ where: { id: created.id }, select: SELECT });
    });

    const mail = portalUser
      ? await sendCredentialsEmail({
          name: contact.name,
          email: contact.email,
          loginId: portalUser.loginId,
          password: portalUser.password,
          roleLabel: ROLE_LABELS.CONTACT,
        })
      : undefined;

    res.status(201).json(serialize({ ...contact, mail }));
  }),
);

contactsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const input = contactSchema.parse(req.body);
    const { portalUser, ...data } = input;

    const existing = await prisma.contact.findUnique({
      where: { id },
      include: { portalUser: true },
    });
    if (!existing) throw notFound('Contact not found');

    if (portalUser && !existing.portalUser) {
      await assertCredentialsAvailable(portalUser.loginId, data.email);
    }

    // Renaming a contact or changing its email has to follow through to the
    // portal login, otherwise that user signs in against a stale address and
    // password resets go to the wrong mailbox.
    if (existing.portalUser && existing.portalUser.email !== data.email) {
      await assertCredentialsAvailable(
        existing.portalUser.loginId,
        data.email,
        existing.portalUser.id,
      );
    }

    const contact = await prisma.$transaction(async (tx) => {
      await tx.contact.update({ where: { id }, data });

      if (portalUser && !existing.portalUser) {
        await tx.user.create({
          data: {
            name: data.name,
            loginId: portalUser.loginId,
            email: data.email,
            passwordHash: await hashPassword(portalUser.password),
            role: 'CONTACT',
            contactId: id,
          },
        });
      } else if (existing.portalUser) {
        await tx.user.update({
          where: { id: existing.portalUser.id },
          data: { name: data.name, email: data.email },
        });
      }

      return tx.contact.findUniqueOrThrow({ where: { id }, select: SELECT });
    });

    const mail =
      portalUser && !existing.portalUser
        ? await sendCredentialsEmail({
            name: contact.name,
            email: contact.email,
            loginId: portalUser.loginId,
            password: portalUser.password,
            roleLabel: ROLE_LABELS.CONTACT,
          })
        : undefined;

    res.json(serialize({ ...contact, mail }));
  }),
);

// Archiving master data is an Admin-only right.
contactsRouter.post(
  '/:id/archive',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const contact = await prisma.contact.update({
      where: { id: Number(req.params.id) },
      data: { isArchived: true },
      select: SELECT,
    });
    res.json(serialize(contact));
  }),
);

contactsRouter.post(
  '/:id/restore',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const contact = await prisma.contact.update({
      where: { id: Number(req.params.id) },
      data: { isArchived: false },
      select: SELECT,
    });
    res.json(serialize(contact));
  }),
);

/** Documents belonging to a contact - used by the Contact form and the portal. */
contactsRouter.get(
  '/:id/documents',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const contact = await prisma.contact.findUnique({ where: { id } });
    if (!contact) throw notFound('Contact not found');

    const [invoices, bills] = await Promise.all([
      prisma.customerInvoice.findMany({
        where: { customerId: id, isArchived: false },
        orderBy: { invoiceDate: 'desc' },
      }),
      prisma.vendorBill.findMany({
        where: { vendorId: id, isArchived: false },
        orderBy: { billDate: 'desc' },
      }),
    ]);

    res.json(serialize({ invoices, bills }));
  }),
);

/** Guard used by document routes: a contact must exist and not be archived. */
export async function assertContact(id: number, role: 'CUSTOMER' | 'VENDOR'): Promise<void> {
  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact || contact.isArchived) throw badRequest('Select a valid contact');
  const allowed = role === 'CUSTOMER' ? ['CUSTOMER', 'BOTH'] : ['VENDOR', 'BOTH'];
  if (!allowed.includes(contact.type)) {
    throw badRequest(
      role === 'CUSTOMER'
        ? 'The selected contact is not a customer'
        : 'The selected contact is not a vendor',
    );
  }
}
