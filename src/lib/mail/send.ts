import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

export type Mail = { to: string; subject: string; html: string; text: string };
export type CapturedMail = Mail & { id: number; at: string };

/**
 * Outgoing email. With SMTP_HOST set, mail goes out through that server (Gmail with an app
 * password, Resend, Brevo, Mailgun… all speak SMTP). Without it, development keeps every
 * message in a local outbox, readable at /api/dev/mail; production refuses to pretend.
 */
export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST);
}

let transporter: Transporter | null = null;
function smtp() {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transporter;
}

// Survives dev hot reloads; never used in production.
const store = globalThis as unknown as { __devOutbox?: CapturedMail[]; __devOutboxId?: number };

export function devOutbox(): CapturedMail[] {
  return (store.__devOutbox ??= []);
}

export async function sendMail(mail: Mail) {
  if (mailConfigured()) {
    await smtp().sendMail({
      from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    return;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Email is not configured: set SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM.");
  }
  const outbox = devOutbox();
  store.__devOutboxId = (store.__devOutboxId ?? 0) + 1;
  outbox.unshift({ ...mail, id: store.__devOutboxId, at: new Date().toISOString() });
  outbox.length = Math.min(outbox.length, 50);
  console.info(`[dev mail] to ${mail.to}: ${mail.subject}\n${mail.text}`);
}
