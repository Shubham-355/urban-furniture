import { Router } from 'express';
import { badRequest } from '../lib/errors';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireBackOffice } from '../middleware/auth';
import { upload } from '../middleware/upload';

export const uploadsRouter = Router();

uploadsRouter.post(
  '/',
  requireAuth,
  requireBackOffice,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('Choose an image to upload');
    // Files are served statically from /uploads.
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  }),
);
