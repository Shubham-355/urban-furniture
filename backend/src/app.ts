import path from 'path';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import { uploadRoot } from './middleware/upload';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { contactsRouter } from './routes/contacts';
import { productCategoriesRouter, productsRouter } from './routes/products';
import { accountsRouter, journalsRouter } from './routes/accounts';
import { analyticsRouter } from './routes/analytics';
import { journalEntriesRouter } from './routes/journalEntries';
import { budgetsRouter } from './routes/budgets';
import { purchaseOrdersRouter } from './routes/purchaseOrders';
import { vendorBillsRouter } from './routes/vendorBills';
import { salesOrdersRouter } from './routes/salesOrders';
import { customerInvoicesRouter } from './routes/customerInvoices';
import { paymentsRouter } from './routes/payments';
import { dashboardRouter, reportsRouter } from './routes/reports';
import { portalRouter } from './routes/portal';
import { uploadsRouter } from './routes/uploads';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use('/uploads', express.static(uploadRoot));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'urban-furniture-accounting' });
  });

  const api = express.Router();
  api.use('/auth', authRouter);
  api.use('/users', usersRouter);
  api.use('/contacts', contactsRouter);
  api.use('/products', productsRouter);
  api.use('/product-categories', productCategoriesRouter);
  api.use('/accounts', accountsRouter);
  api.use('/journals', journalsRouter);
  api.use('/journal-entries', journalEntriesRouter);
  api.use('/analytics', analyticsRouter);
  api.use('/budgets', budgetsRouter);
  api.use('/purchase-orders', purchaseOrdersRouter);
  api.use('/vendor-bills', vendorBillsRouter);
  api.use('/sales-orders', salesOrdersRouter);
  api.use('/customer-invoices', customerInvoicesRouter);
  api.use('/payments', paymentsRouter);
  api.use('/reports', reportsRouter);
  api.use('/dashboard', dashboardRouter);
  api.use('/portal', portalRouter);
  api.use('/uploads', uploadsRouter);

  app.use('/api/v1', api);

  // In production the built client is served by the same process.
  const clientDist = path.resolve(process.cwd(), '..', 'frontend', 'dist');
  if (env.nodeEnv === 'production') {
    app.use(express.static(clientDist));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
