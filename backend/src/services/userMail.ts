import { env } from '../config/env';
import { sendMail, type MailResult } from '../lib/mailer';

/**
 * Welcome mail sent when an administrator creates a login.
 *
 * The password is included because the administrator chooses it on the user's
 * behalf and the person has no other way to learn it. It is sent once, at
 * creation, and never stored in readable form - only a bcrypt hash is kept.
 */
export async function sendCredentialsEmail(input: {
  name: string;
  email: string;
  loginId: string;
  password: string;
  roleLabel: string;
}): Promise<MailResult> {
  const signInUrl = `${env.appUrl}/login`;

  const text = [
    `Hello ${input.name},`,
    '',
    `An account has been created for you on the Urban Furniture Accounting System as ${input.roleLabel}.`,
    '',
    `Login Id: ${input.loginId}`,
    `Password: ${input.password}`,
    '',
    `Sign in here: ${signInUrl}`,
    '',
    'Please change your password after your first sign in, using Forgot Password on the sign in screen.',
    '',
    'Urban Furniture',
  ].join('\n');

  const html = `
    <p>Hello ${input.name},</p>
    <p>An account has been created for you on the <strong>Urban Furniture Accounting System</strong>
       as ${input.roleLabel}.</p>
    <table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
      <tr><td style="color:#64748b">Login Id</td><td><strong>${input.loginId}</strong></td></tr>
      <tr><td style="color:#64748b">Password</td><td><strong>${input.password}</strong></td></tr>
    </table>
    <p><a href="${signInUrl}">Sign in to Urban Furniture</a></p>
    <p style="color:#64748b;font-size:13px">Please change your password after your first sign in,
       using Forgot Password on the sign in screen.</p>
  `;

  return sendMail({
    to: input.email,
    subject: 'Your Urban Furniture account',
    text,
    html,
  });
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'an Administrator',
  ACCOUNTANT: 'an Invoicing User',
  CONTACT: 'a portal user',
};
