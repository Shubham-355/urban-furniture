import crypto from 'crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { badRequest, conflict, unauthorized } from '../lib/errors';
import { serialize } from '../lib/http';
import { sendMail } from '../lib/mailer';
import { asyncHandler } from '../middleware/error';
import { requireAuth, signToken, type AuthUser } from '../middleware/auth';
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from '../validation/auth';

export const authRouter = Router();

const SALT_ROUNDS = 10;

function toAuthUser(user: {
  id: number;
  name: string;
  loginId: string;
  email: string;
  role: string;
  contactId: number | null;
}): AuthUser {
  return {
    id: user.id,
    name: user.name,
    loginId: user.loginId,
    email: user.email,
    role: user.role as AuthUser['role'],
    contactId: user.contactId,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/** Guard the two uniqueness rules before touching the database. */
export async function assertCredentialsAvailable(
  loginId: string,
  email: string,
  ignoreUserId?: number,
): Promise<void> {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ loginId }, { email }],
      ...(ignoreUserId ? { NOT: { id: ignoreUserId } } : {}),
    },
    select: { loginId: true, email: true },
  });
  if (!existing) return;
  if (existing.loginId === loginId) throw conflict('This Login Id is already taken');
  throw conflict('This email address is already registered');
}

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findFirst({
      where: { loginId: input.loginId, isArchived: false },
    });
    // Identical message for both failure modes so the form cannot be used to
    // discover which login ids exist.
    if (!user) throw unauthorized('Invalid Login Id or Password');
    const matches = await bcrypt.compare(input.password, user.passwordHash);
    if (!matches) throw unauthorized('Invalid Login Id or Password');

    const authUser = toAuthUser(user);
    const token = signToken(authUser);
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.nodeEnv === 'production',
      maxAge: 12 * 60 * 60 * 1000,
    });
    res.json({ token, user: authUser });
  }),
);

authRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const input = signupSchema.parse(req.body);
    await assertCredentialsAvailable(input.loginId, input.email);

    // Public sign up always creates an Invoicing User (Accountant).
    const user = await prisma.user.create({
      data: {
        name: input.name,
        loginId: input.loginId,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        role: 'ACCOUNTANT',
      },
    });

    const authUser = toAuthUser(user);
    res.status(201).json({ token: signToken(authUser), user: authUser });
  }),
);

authRouter.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const { identifier } = forgotPasswordSchema.parse(req.body);
    const user = await prisma.user.findFirst({
      where: {
        isArchived: false,
        OR: [{ loginId: identifier }, { email: identifier.toLowerCase() }],
      },
    });

    // Always answer the same way, so the form cannot enumerate accounts.
    const response = {
      message: 'If that account exists, a password reset link has been sent to its email address.',
    };
    if (!user) {
      res.json(response);
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + env.passwordResetTtlMinutes * 60 * 1000),
      },
    });

    const link = `${env.appUrl}/reset-password?token=${token}`;
    const mail = await sendMail({
      to: user.email,
      subject: 'Reset your Urban Furniture password',
      text: `Hello ${user.name},\n\nUse the link below to set a new password. It expires in ${env.passwordResetTtlMinutes} minutes.\n\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
      html: `<p>Hello ${user.name},</p><p>Use the link below to set a new password. It expires in ${env.passwordResetTtlMinutes} minutes.</p><p><a href="${link}">Reset my password</a></p><p>If you did not ask for this, you can ignore this email.</p>`,
    });

    res.json({
      ...response,
      // When the mail could not go out the link is returned instead, so the
      // flow stays usable in a development checkout.
      ...(mail.delivered ? {} : { resetLink: link, note: mail.reason }),
    });
  }),
);

authRouter.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const input = resetPasswordSchema.parse(req.body);
    const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex');
    const reset = await prisma.passwordReset.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      throw badRequest('This reset link is invalid or has expired');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash: await hashPassword(input.password) },
      }),
      prisma.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
    ]);

    res.json({ message: 'Your password has been reset. Please sign in.' });
  }),
);

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Signed out' });
});

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { contact: { select: { id: true, name: true, email: true, imageUrl: true } } },
    });
    if (!user) throw unauthorized();
    res.json(
      serialize({
        id: user.id,
        name: user.name,
        loginId: user.loginId,
        email: user.email,
        role: user.role,
        contactId: user.contactId,
        contact: user.contact,
      }),
    );
  }),
);
