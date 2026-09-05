import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { forbidden, unauthorized } from '../lib/errors';

export type Role = 'ADMIN' | 'ACCOUNTANT' | 'CONTACT';

export interface AuthUser {
  id: number;
  loginId: string;
  name: string;
  email: string;
  role: Role;
  contactId: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

function readToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const cookie = (req as Request & { cookies?: Record<string, string> }).cookies?.token;
  return cookie ?? null;
}

/** Populates req.user, rejecting anything without a valid token. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readToken(req);
  if (!token) return next(unauthorized());
  try {
    req.user = jwt.verify(token, env.jwtSecret) as AuthUser;
    next();
  } catch {
    next(unauthorized('Session expired, please sign in again'));
  }
}

/** Role gate. Every route in the app sits behind one of these. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}

/** Admin and Accountant share the back office; only Admin may archive or manage users. */
export const requireBackOffice = requireRole('ADMIN', 'ACCOUNTANT');
export const requireAdmin = requireRole('ADMIN');

/** Portal users may only ever touch rows belonging to their own contact. */
export function ownContactId(req: Request): number {
  if (!req.user?.contactId) {
    throw forbidden('This portal user is not linked to a contact');
  }
  return req.user.contactId;
}
