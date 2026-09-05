import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`Urban Furniture API listening on http://localhost:${env.port}/api/v1`);
});

async function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
