import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
  return transporter;
}

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}

export interface MailResult {
  delivered: boolean;
  messageId?: string;
  reason?: string;
}

/**
 * Send a mail. Without SMTP credentials configured (the usual case in a dev
 * checkout) the message is logged instead of sent, and the caller is told so
 * rather than being shown a false success.
 */
export async function sendMail(input: MailInput): Promise<MailResult> {
  if (!env.smtp.user || !env.smtp.pass) {
    console.info(
      `[mail] SMTP not configured - would send "${input.subject}" to ${input.to}` +
        (input.attachments?.length ? ` with ${input.attachments.length} attachment(s)` : ''),
    );
    return {
      delivered: false,
      reason: 'SMTP is not configured. Set SMTP_USER and SMTP_PASS in .env to send real email.',
    };
  }

  try {
    const info = await getTransporter().sendMail({
      from: env.smtp.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments,
    });

    return { delivered: true, messageId: info.messageId };
  } catch (error) {
    // A mail server being unreachable or refusing the login must not take the
    // whole request down with it: the account, invoice or reset still stands,
    // and the caller reports plainly that the message did not go out.
    console.error('[mail] send failed:', error instanceof Error ? error.message : error);
    return { delivered: false, reason: describeMailFailure(error) };
  }
}

/** Turn an SMTP failure into something the person reading the toast can act on. */
function describeMailFailure(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  const message = error instanceof Error ? error.message : String(error);

  if (code === 'EAUTH') {
    return `The mail server rejected the SMTP_USER and SMTP_PASS in .env (${message}).`;
  }
  if (code === 'ECONNECTION' || code === 'ESOCKET' || code === 'ETIMEDOUT' || code === 'EDNS') {
    return `Could not reach the mail server ${env.smtp.host}:${env.smtp.port} (${message}).`;
  }
  return `The email could not be sent (${message}).`;
}
