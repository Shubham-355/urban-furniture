import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

/**
 * Environment files, least specific first: the repo root, then the backend's
 * own .env, then whatever the shell already exported.
 *
 * Two rules matter here. A key already present in the real environment always
 * wins, so a shell or CI value is never clobbered. And a key written as an
 * empty value - `SMTP_USER=` - is treated as "not configured" rather than as
 * the empty string, so a blank line in one file cannot mask a real value set
 * in the other.
 */
function loadEnvironment(): void {
  const shellProvided = new Set(Object.keys(process.env));
  const files = [
    path.resolve(process.cwd(), '..', '.env'),
    path.resolve(process.cwd(), '.env'),
  ];

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const parsed = dotenv.parse(fs.readFileSync(file));
    for (const [key, value] of Object.entries(parsed)) {
      if (shellProvided.has(key)) continue;
      if (value === '') continue;
      process.env[key] = value;
    }
  }
}

loadEnvironment();

function required(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable ${key}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required(
    'DATABASE_URL',
    'postgresql://urban:urban@localhost:5432/urbanfurniture?schema=public',
  ),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  appUrl: process.env.APP_URL ?? 'http://localhost:5173',
  jwtSecret: required('JWT_SECRET', 'change-me-in-production-urban-furniture'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  passwordResetTtlMinutes: Number(process.env.PASSWORD_RESET_TTL_MINUTES ?? 30),
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  smtp: {
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: (process.env.SMTP_SECURE ?? 'false') === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.MAIL_FROM ?? 'Urban Furniture <no-reply@urbanfurniture.local>',
  },
};

export const isProd = env.nodeEnv === 'production';
