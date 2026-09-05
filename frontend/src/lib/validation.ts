import { z } from 'zod';

/**
 * Client side mirror of the server credential rules, so the forms can show the
 * same messages without a round trip. The server always re-validates.
 */

export const loginIdSchema = z
  .string()
  .trim()
  .min(6, 'Login Id must be between 6 and 12 characters')
  .max(12, 'Login Id must be between 6 and 12 characters');

export const emailSchema = z.string().trim().email('Enter a valid email address');

export const passwordSchema = z
  .string()
  .min(9, 'Password must be more than 8 characters')
  .refine((value) => /[a-z]/.test(value), 'Password must contain a lowercase letter')
  .refine((value) => /[A-Z]/.test(value), 'Password must contain an uppercase letter')
  .refine((value) => /[^A-Za-z0-9]/.test(value), 'Password must contain a special character');

const matchPasswords = (data: { password: string; confirmPassword: string }) =>
  data.password === data.confirmPassword;
const mismatch = {
  message: 'Password and Re-Enter Password do not match',
  path: ['confirmPassword'],
};

export const loginSchema = z.object({
  loginId: z.string().trim().min(1, 'Enter your Login Id'),
  password: z.string().min(1, 'Enter your password'),
});

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your name'),
    loginId: loginIdSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(matchPasswords, mismatch);

export const createUserSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter a name'),
    email: emailSchema,
    loginId: loginIdSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    role: z.enum(['ADMIN', 'ACCOUNTANT', 'CONTACT']),
    contactId: z.number().int().positive().nullable().optional(),
  })
  .refine(matchPasswords, mismatch)
  .refine((data) => data.role !== 'CONTACT' || !!data.contactId, {
    message: 'Choose the contact this portal user belongs to',
    path: ['contactId'],
  });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(matchPasswords, mismatch);

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Contact Name is required'),
  email: emailSchema,
  type: z.enum(['CUSTOMER', 'VENDOR', 'BOTH']),
});

export const productSchema = z.object({
  name: z.string().trim().min(2, 'Product Name is required'),
  salesPrice: z.number().min(0, 'Sales Price cannot be negative'),
  cost: z.number().min(0, 'Cost cannot be negative'),
});

export const budgetSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Budget Name is required')
    .regex(/^[A-Za-z0-9 ]+$/, 'Budget Name may only contain letters, numbers and spaces'),
  startDate: z.string().min(1, 'Start Date is required'),
  endDate: z.string().min(1, 'End Date is required'),
});

/** Flatten a Zod failure into `{ field: message }` for the forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const output: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!output[key]) output[key] = issue.message;
  }
  return output;
}

/** Validate and return either the parsed value or the field errors. */
export function validate<T>(
  schema: z.ZodType<T>,
  value: unknown,
): { ok: true; data: T } | { ok: false; errors: Record<string, string> } {
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, errors: fieldErrors(result.error) };
}
