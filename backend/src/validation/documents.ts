import { z } from 'zod';
import { dateSchema, moneySchema, optionalDateSchema } from '../lib/http';

const quantitySchema = moneySchema.gt(0, 'Quantity must be greater than zero');
const priceSchema = moneySchema.min(0, 'Unit price cannot be negative');

export const purchaseOrderLineSchema = z.object({
  productId: z.coerce.number().int().positive('Choose a product'),
  analyticId: z.coerce.number().int().positive().optional().nullable(),
  quantity: quantitySchema,
  unitPrice: priceSchema,
});

export const purchaseOrderSchema = z.object({
  vendorId: z.coerce.number().int().positive('Choose a vendor'),
  date: dateSchema,
  lines: z.array(purchaseOrderLineSchema).min(1, 'Add at least one line'),
});

export const vendorBillLineSchema = purchaseOrderLineSchema.extend({
  accountId: z.coerce.number().int().positive().optional().nullable(),
});

export const vendorBillSchema = z.object({
  vendorId: z.coerce.number().int().positive('Choose a vendor'),
  reference: z.string().trim().max(120).optional().nullable(),
  billDate: dateSchema,
  dueDate: optionalDateSchema,
  purchaseOrderId: z.coerce.number().int().positive().optional().nullable(),
  lines: z.array(vendorBillLineSchema).min(1, 'Add at least one line'),
});

export const salesOrderLineSchema = z.object({
  productId: z.coerce.number().int().positive('Choose a product'),
  analyticId: z.coerce.number().int().positive().optional().nullable(),
  quantity: quantitySchema,
  unitPrice: priceSchema,
  taxPercent: moneySchema.min(0).max(100).default(0),
});

export const salesOrderSchema = z.object({
  customerId: z.coerce.number().int().positive('Choose a customer'),
  date: dateSchema,
  lines: z.array(salesOrderLineSchema).min(1, 'Add at least one line'),
});

export const customerInvoiceLineSchema = salesOrderLineSchema.extend({
  accountId: z.coerce.number().int().positive().optional().nullable(),
});

export const customerInvoiceSchema = z.object({
  customerId: z.coerce.number().int().positive('Choose a customer'),
  reference: z.string().trim().max(120).optional().nullable(),
  invoiceDate: dateSchema,
  dueDate: optionalDateSchema,
  salesOrderId: z.coerce.number().int().positive().optional().nullable(),
  lines: z.array(customerInvoiceLineSchema).min(1, 'Add at least one line'),
});

export const paymentSchema = z
  .object({
    type: z.enum(['SEND', 'RECEIVE']),
    partnerId: z.coerce.number().int().positive('Choose a partner'),
    amount: moneySchema.gt(0, 'Amount must be greater than zero'),
    date: dateSchema,
    via: z.enum(['BANK', 'CASH']).default('BANK'),
    note: z.string().trim().max(300).optional().nullable(),
    billId: z.coerce.number().int().positive().optional().nullable(),
    invoiceId: z.coerce.number().int().positive().optional().nullable(),
  })
  .refine((data) => !(data.billId && data.invoiceId), {
    message: 'A payment can be linked to a bill or an invoice, not both',
    path: ['billId'],
  });

export const budgetLineSchema = z.object({
  analyticId: z.coerce.number().int().positive('Choose an analytic account'),
  committedAmount: moneySchema.min(0, 'Committed amount cannot be negative').default(0),
});

export const budgetSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Budget Name is required')
    .regex(/^[A-Za-z0-9 ]+$/, 'Budget Name may only contain letters, numbers and spaces'),
  startDate: dateSchema,
  endDate: dateSchema,
  responsibleId: z.coerce.number().int().positive().optional().nullable(),
  lines: z.array(budgetLineSchema).min(1, 'Add at least one budget line'),
}).refine((data) => data.endDate.getTime() >= data.startDate.getTime(), {
  message: 'End Date must be on or after Start Date',
  path: ['endDate'],
});
