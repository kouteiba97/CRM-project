import "server-only";
import { getTranslations } from "next-intl/server";
import { dirOf, type Locale } from "@/lib/format";
import type { Mail } from "./send";

// Email clients ignore CSS variables and stylesheets: these mirror the light-theme tokens
// (--text-primary, --text-secondary, --accent-primary, --surface-sunken) as inline values.
const C = { text: "#13303a", muted: "#4b6670", accent: "#1f7a6d", sunken: "#f3f7f8", border: "#d9e4e7" };

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(
  locale: Locale,
  opts: { heading: string; body: string[]; cta?: string; url?: string; footer?: string },
) {
  const dir = dirOf(locale);
  const align = dir === "rtl" ? "right" : "left";
  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:24px 12px;background:${C.sunken};font-family:system-ui,-apple-system,'Segoe UI',Tahoma,Arial,sans-serif;color:${C.text}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid ${C.border};border-radius:12px">
<tr><td dir="${dir}" style="padding:32px 28px;text-align:${align}">
<p style="margin:0 0 24px;font-weight:600;font-size:15px">Apex CRM</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:28px">${esc(opts.heading)}</h1>
${opts.body.map((p) => `<p style="margin:0 0 16px;font-size:14px;line-height:22px">${esc(p)}</p>`).join("\n")}
${
  opts.cta && opts.url
    ? `<p style="margin:24px 0"><a href="${esc(opts.url)}" style="display:inline-block;background:${C.accent};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px">${esc(opts.cta)}</a></p>
<p style="margin:0;font-size:12px;line-height:18px;color:${C.muted}">${esc(opts.footer ?? "")}<br><span dir="ltr" style="word-break:break-all">${esc(opts.url)}</span></p>`
    : ""
}
</td></tr></table>
</td></tr></table>
</body></html>`;
  const cta = opts.cta && opts.url ? ["", `${opts.cta}: ${opts.url}`] : [];
  const text = [opts.heading, "", ...opts.body, ...cta].join("\n");
  return { html, text };
}

export async function resetPasswordMail(to: string, name: string, locale: Locale, url: string): Promise<Mail> {
  const t = await getTranslations({ locale, namespace: "email" });
  return {
    to,
    subject: t("reset_subject"),
    ...layout(locale, {
      heading: t("reset_heading"),
      body: [t("greeting", { name }), t("reset_body"), t("reset_ignore")],
      cta: t("reset_cta"),
      url,
      footer: t("link_fallback"),
    }),
  };
}

export async function verifyEmailMail(to: string, name: string, locale: Locale, url: string): Promise<Mail> {
  const t = await getTranslations({ locale, namespace: "email" });
  return {
    to,
    subject: t("verify_subject"),
    ...layout(locale, {
      heading: t("verify_heading"),
      body: [t("greeting", { name }), t("verify_body")],
      cta: t("verify_cta"),
      url,
      footer: t("link_fallback"),
    }),
  };
}

/** Security notice to the account's address; no link, so it cannot be used for phishing look-alikes. */
export async function securityNoticeMail(
  to: string,
  name: string,
  locale: Locale,
  kind: "password_changed" | "email_changed" | "two_factor_on" | "two_factor_off",
  vars: Record<string, string> = {},
): Promise<Mail> {
  const t = await getTranslations({ locale, namespace: "email" });
  return {
    to,
    subject: t(`notice_${kind}_subject`),
    ...layout(locale, {
      heading: t(`notice_${kind}_subject`),
      body: [t("greeting", { name }), t(`notice_${kind}_body`, vars), t("notice_not_you")],
    }),
  };
}

export async function changeEmailMail(to: string, name: string, locale: Locale, url: string): Promise<Mail> {
  const t = await getTranslations({ locale, namespace: "email" });
  return {
    to,
    subject: t("change_subject"),
    ...layout(locale, {
      heading: t("change_subject"),
      body: [t("greeting", { name }), t("change_body")],
      cta: t("change_cta"),
      url,
      footer: t("link_fallback"),
    }),
  };
}

export async function inviteMail(
  to: string,
  locale: Locale,
  vars: { inviter: string; workspace: string },
  url: string,
): Promise<Mail> {
  const t = await getTranslations({ locale, namespace: "email" });
  return {
    to,
    subject: t("invite_subject", vars),
    ...layout(locale, {
      heading: t("invite_subject", vars),
      body: [t("invite_body", vars), t("invite_expiry")],
      cta: t("invite_cta"),
      url,
      footer: t("link_fallback"),
    }),
  };
}

/**
 * An invoice or quotation sent to a client: the sender's own subject and message (plain text,
 * escaped, line breaks kept), from the company's name, with the PDF attached.
 */
export function documentMail(opts: {
  to: string;
  subject: string;
  message: string;
  locale: Locale;
  company: string;
  replyTo: string;
  attachment: { filename: string; content: Buffer };
}): Mail {
  const dir = dirOf(opts.locale);
  const body = esc(opts.message).replace(/\n/g, "<br>");
  return {
    to: opts.to,
    subject: opts.subject,
    fromName: opts.company,
    replyTo: opts.replyTo,
    text: opts.message,
    html: `<!doctype html><html lang="${opts.locale}" dir="${dir}"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px 12px;font-family:system-ui,-apple-system,'Segoe UI',Tahoma,Arial,sans-serif;color:${C.text};font-size:14px;line-height:22px">
<div dir="${dir}" style="max-width:560px">${body}</div>
<p style="margin-top:24px;font-size:12px;color:${C.muted}">📎 <span dir="ltr">${esc(opts.attachment.filename)}</span></p>
</body></html>`,
    attachments: [{ ...opts.attachment, contentType: "application/pdf" }],
  };
}
