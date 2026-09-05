import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

export const prisma = new PrismaClient({
  log: env.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
});

/** The transactional client handed to helpers that run inside $transaction. */
export type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
