import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

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
    host: process.env.SMTP_HOST ?? 'smtp.ethereal.email',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: (process.env.SMTP_SECURE ?? 'false') === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.MAIL_FROM ?? 'Urban Furniture <no-reply@urbanfurniture.local>',
  },
};

export const isProd = env.nodeEnv === 'production';
