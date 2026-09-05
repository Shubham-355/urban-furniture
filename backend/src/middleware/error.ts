import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { HttpError } from '../lib/errors';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ message: 'Endpoint not found' });
}

/** Single place where every failure is turned into a clean JSON response. */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      message: error.issues[0]?.message ?? 'Validation failed',
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message, details: error.details });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = (error.meta?.target as string[] | undefined)?.join(', ') ?? 'value';
      res.status(409).json({ message: `A record with this ${target} already exists` });
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json({ message: 'Record not found' });
      return;
    }
    if (error.code === 'P2003') {
      res.status(409).json({
        message: 'This record is used by other documents and cannot be removed. Archive it instead.',
      });
      return;
    }
  }

  console.error('[error]', error);
  res.status(500).json({ message: 'Something went wrong on the server' });
}

/** Wrap an async handler so rejected promises reach the error handler. */
export function asyncHandler<T extends Request = Request>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req as T, res, next).catch(next);
  };
}
