// Email sending through SMTP (any provider works: Gmail/Workspace, Brevo, Amazon SES, Mailgun…).
// Without SMTP_HOST:
//   - in development and tests emails are "simulated": they are not sent, but they are recorded;
//   - in production sending fails with a clear error (nothing is marked as sent).

import nodemailer, { type Transporter } from 'nodemailer';
import { environment } from '~config/environment';
import { logger } from '~config/logger';

export type EmailMode = 'smtp' | 'simulated' | 'disabled';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  /** Replies to this email (e.g. the salesperson's email). */
  replyTo?: string;
  /** One-click unsubscribe link (RFC 8058): Gmail and Outlook show "Unsubscribe". */
  unsubscribeUrl?: string;
}

export interface SendResult {
  status: 'SENT' | 'SIMULATED';
  providerId: string | null;
}

/** Mail server error (rejected the recipient, bad credentials, no connection…). */
export class EmailSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailSendError';
  }
}

export function emailMode(): EmailMode {
  if (environment.email.host) return 'smtp';
  return environment.nodeEnv === 'production' ? 'disabled' : 'simulated';
}

let transport: Transporter | null = null;

function getTransport(): Transporter {
  if (transport) return transport;
  const c = environment.email;
  transport = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    ...(c.user ? { auth: { user: c.user, pass: c.pass } } : {}),
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  return transport;
}

function sender(): string {
  const c = environment.email;
  return c.sender ?? (c.user ? `${environment.companyName} <${c.user}>` : `${environment.companyName} <no-responder@localhost>`);
}

export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
  const mode = emailMode();
  if (mode === 'disabled') {
    throw new EmailSendError('El envío de correo no está configurado en el servidor (falta SMTP_HOST).');
  }
  if (mode === 'simulated') {
    logger.info({ to: email.to, subject: email.subject }, 'Simulated email (no SMTP_HOST): it was not sent');
    return { status: 'SIMULATED', providerId: null };
  }
  try {
    const info = await getTransport().sendMail({
      from: sender(),
      to: email.to,
      subject: email.subject,
      text: email.text,
      ...(email.replyTo ? { replyTo: email.replyTo } : {}),
      ...(email.unsubscribeUrl
        ? { headers: { 'List-Unsubscribe': `<${email.unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }
        : {}),
    });
    if (info.rejected?.length) throw new EmailSendError(`El servidor de correo rechazó a ${email.to}.`);
    return { status: 'SENT', providerId: info.messageId ?? null };
  } catch (err) {
    if (err instanceof EmailSendError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ to: email.to, err: msg }, 'The email could not be sent');
    throw new EmailSendError(`El servidor de correo no aceptó el mensaje: ${msg}`);
  }
}

/** Tests only: forgets the transport so it picks up the new configuration. */
export function _resetTransport(): void {
  transport = null;
}
