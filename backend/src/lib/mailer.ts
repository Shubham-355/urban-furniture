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
  previewUrl?: string;
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

  const info = await getTransporter().sendMail({
    from: env.smtp.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: input.attachments,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  return {
    delivered: true,
    messageId: info.messageId,
    previewUrl: previewUrl === false ? undefined : previewUrl,
  };
}
