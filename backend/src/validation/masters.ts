import { z } from 'zod';
import { moneySchema } from '../lib/http';
import { emailSchema, loginIdSchema, passwordSchema } from './auth';

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Contact Name is required'),
  type: z.enum(['CUSTOMER', 'VENDOR', 'BOTH']).default('CUSTOMER'),
  email: emailSchema,
  mobile: z.string().trim().max(20).optional().nullable(),
  street: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  pincode: z.string().trim().max(12).optional().nullable(),
  imageUrl: z.string().trim().max(300).optional().nullable(),
  /** Optional portal login created together with the contact. */
  portalUser: z
    .object({
      loginId: loginIdSchema,
      password: passwordSchema,
    })
    .optional()
    .nullable(),
});

export const productCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required'),
});

export const productSchema = z.object({
  name: z.string().trim().min(2, 'Product Name is required'),
  type: z.enum(['GOODS', 'SERVICE', 'COMBO']).default('GOODS'),
  categoryId: z.coerce.number().int().positive().optional().nullable(),
  /** Lets the dropdown create a category on the fly. */
  categoryName: z.string().trim().min(1).optional().nullable(),
  salesPrice: moneySchema.min(0, 'Sales Price cannot be negative').default(0),
  cost: moneySchema.min(0, 'Cost cannot be negative').default(0),
  imageUrl: z.string().trim().max(300).optional().nullable(),
});

export const accountSchema = z.object({
  name: z.string().trim().min(2, 'Account Name is required'),
  type: z.enum([
    'ASSET',
    'LIABILITY',
    'BANK',
    'CAPITAL',
    'CASH',
    'INCOME',
    'EXPENSE',
    'OTHER_EXPENSE',
  ]),
});

export const journalSchema = z.object({
  name: z.string().trim().min(2, 'Journal Name is required'),
  type: z.enum(['SALES', 'PURCHASE', 'BANK', 'CASH']),
  defaultAccountId: z.coerce.number().int().positive().optional().nullable(),
});

export const analyticSchema = z.object({
  name: z.string().trim().min(2, 'Analytic Account name is required'),
  type: z.enum(['INCOME', 'EXPENSE']),
});
