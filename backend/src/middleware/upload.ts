import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { env } from '../config/env';
import { badRequest } from '../lib/errors';

export const uploadRoot = path.resolve(process.cwd(), env.uploadDir);

if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extension}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.includes(file.mimetype)) {
      cb(badRequest('Only PNG, JPEG, WEBP or GIF images can be uploaded'));
      return;
    }
    cb(null, true);
  },
});
