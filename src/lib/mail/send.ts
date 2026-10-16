import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

export type Attachment = { filename: string; content: Buffer; contentType: string };
export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Replies go to this person (the colleague who sent the invoice), not to the no-reply sender. */
  replyTo?: string;
  /** Shown as the sender name, e.g. the company: "Apex Tech <no-reply@…>". */
  fromName?: string;
  attachments?: Attachment[];
};
export type CapturedMail = Omit<Mail, "attachments"> & {
  id: number;
  at: string;
  attachments: { filename: string; size: number }[];
};

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
    const from = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? "";
    const address = from.match(/<([^>]+)>/)?.[1] ?? from;
    await smtp().sendMail({
      from: mail.fromName ? { name: mail.fromName, address } : from,
      to: mail.to,
      replyTo: mail.replyTo,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: mail.attachments,
    });
    return;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Email is not configured: set SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM.");
  }
  const outbox = devOutbox();
  store.__devOutboxId = (store.__devOutboxId ?? 0) + 1;
  const { attachments, ...rest } = mail;
  outbox.unshift({
    ...rest,
    id: store.__devOutboxId,
    at: new Date().toISOString(),
    attachments: (attachments ?? []).map((a) => ({ filename: a.filename, size: a.content.length })),
  });
  outbox.length = Math.min(outbox.length, 50);
  console.info(`[dev mail] to ${mail.to}: ${mail.subject}\n${mail.text}`);
}
