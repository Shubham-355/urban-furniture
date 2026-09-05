import { z } from 'zod';

/**
 * Credential rules from the spec, enforced here on the server and mirrored by
 * the same rules on the client:
 *   1. Login id is unique and 6-12 characters.
 *   2. Email must not already exist in the database.
 *   3. Password is longer than 8 characters and contains at least one
 *      lowercase letter, one uppercase letter and one special character.
 *      Password and Re-Enter Password must match.
 */

export const loginIdSchema = z
  .string()
  .trim()
  .min(6, 'Login Id must be between 6 and 12 characters')
  .max(12, 'Login Id must be between 6 and 12 characters');

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address');

export const passwordSchema = z
  .string()
  .min(9, 'Password must be more than 8 characters')
  .refine((value) => /[a-z]/.test(value), 'Password must contain a lowercase letter')
  .refine((value) => /[A-Z]/.test(value), 'Password must contain an uppercase letter')
  .refine(
    (value) => /[^A-Za-z0-9]/.test(value),
    'Password must contain a special character',
  );

const withConfirmation = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object(shape)
    .refine(
      (data) => (data as { password: string; confirmPassword: string }).password ===
        (data as { password: string; confirmPassword: string }).confirmPassword,
      { message: 'Password and Re-Enter Password do not match', path: ['confirmPassword'] },
    );

export const loginSchema = z.object({
  loginId: z.string().trim().min(1, 'Enter your Login Id'),
  password: z.string().min(1, 'Enter your password'),
});

export const signupSchema = withConfirmation({
  name: z.string().trim().min(2, 'Enter your name'),
  loginId: loginIdSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
});

export const createUserSchema = withConfirmation({
  name: z.string().trim().min(2, 'Enter a name'),
  loginId: loginIdSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  role: z.enum(['ADMIN', 'ACCOUNTANT', 'CONTACT']),
  contactId: z.coerce.number().int().positive().optional().nullable(),
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your Login Id or email address'),
});

export const resetPasswordSchema = withConfirmation({
  token: z.string().min(10, 'Reset link is invalid'),
  password: passwordSchema,
  confirmPassword: z.string(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
