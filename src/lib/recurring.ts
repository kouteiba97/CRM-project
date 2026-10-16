import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { loadDocView } from "@/components/documents/doc-view-data";
import { db } from "@/db/client";
import { activities, clients, invoices, lineItems, recurringInvoices, workspaces } from "@/db/schema";
import { nextNumber } from "@/lib/doc-numbers";
import { documentPdf } from "@/lib/document-pdf";
import { formatter } from "@/lib/format";
import { sendMail } from "@/lib/mail/send";
import { documentMail } from "@/lib/mail/templates";
import { notifyWorkspace } from "@/lib/notifications";
import { addDays, addInterval, daysBetween } from "@/lib/recurrence";

const isoToday = (now: Date) => now.toISOString().slice(0, 10);

/** One run of a schedule: copy the source invoice as a new one dated `nextDate`. */
async function generate(s: typeof recurringInvoices.$inferSelect) {
  const [src] = await db.select().from(invoices).where(eq(invoices.id, s.sourceInvoiceId));
  if (!src) return null;
  const lines = await db.select().from(lineItems).where(eq(lineItems.invoiceId, src.id)).orderBy(asc(lineItems.position));
  const id = randomUUID();
  const number = await nextNumber(s.workspaceId, "invoice");
  const termDays = Math.max(0, daysBetween(src.issueDate, src.dueDate));
  await db.batch([
    db.insert(invoices).values({
      id,
      workspaceId: s.workspaceId,
      createdBy: s.createdBy,
      number,
      clientId: src.clientId,
      projectId: src.projectId,
      issueDate: s.nextDate,
      dueDate: addDays(s.nextDate, termDays),
      currency: src.currency,
      language: src.language,
      discountPct: src.discountPct,
      notes: src.notes,
      terms: src.terms,
      subtotalMinor: src.subtotalMinor,
      discountMinor: src.discountMinor,
      taxMinor: src.taxMinor,
      totalMinor: src.totalMinor,
      state: "draft",
    }),
    ...(lines.length
      ? [
          db.insert(lineItems).values(
            lines.map((l) => ({
              workspaceId: s.workspaceId,
              createdBy: s.createdBy,
              invoiceId: id,
              position: l.position,
              title: l.title,
              detail: l.detail,
              quantity: l.quantity,
              unit: l.unit,
              unitPriceMinor: l.unitPriceMinor,
              taxRate: l.taxRate,
              amountMinor: l.amountMinor,
            })),
          ),
        ]
      : []),
    db.insert(activities).values({
      workspaceId: s.workspaceId,
      actorId: null,
      kind: "invoice_created",
      entityType: "invoice",
      entityId: id,
      clientId: src.clientId,
      payload: { number, recurring: 1 },
    }),
  ]);
  return { id, number, clientId: src.clientId };
}

/** Emails a just-generated invoice to the client and marks it sent (auto-send schedules). */
async function autoSend(workspaceId: string, invoiceId: string) {
  const view = await loadDocView(workspaceId, "invoice", invoiceId);
  const [client] = view ? await db.select().from(clients).where(eq(clients.id, view.invoice!.doc.clientId)) : [];
  if (!view?.invoice || !client?.email) return false;
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  const t = await getTranslations({ locale: view.language, namespace: "documents.send" });
  const tl = await getTranslations({ locale: view.language, namespace: "document" });
  const f = formatter(view.language);
  const from = ws?.name ?? "";
  const subject = t("defaultSubject", { doc: tl("invoice"), number: view.data.number, from });
  const message = t("defaultMessageInvoice", {
    client: client.name,
    number: view.data.number,
    amount: f.money(view.data.totalMinor, view.data.currency),
    date: f.date(view.invoice.doc.dueDate),
    from,
  });
  const pdf = await documentPdf(workspaceId, "invoice", invoiceId, view.language, view.data.number);
  await sendMail(
    documentMail({
      to: client.email,
      subject,
      message,
      locale: view.language,
      company: from,
      replyTo: process.env.MAIL_FROM?.match(/<([^>]+)>/)?.[1] ?? process.env.SMTP_USER ?? client.email,
      attachment: pdf,
    }),
  );
  await db.batch([
    db.update(invoices).set({ state: "sent", sentAt: new Date() }).where(eq(invoices.id, invoiceId)),
    db.insert(activities).values({
      workspaceId,
      actorId: null,
      kind: "invoice_sent",
      entityType: "invoice",
      entityId: invoiceId,
      clientId: client.id,
      payload: { number: view.data.number, to: client.email, auto: 1 },
    }),
  ]);
  return true;
}

/**
 * The daily run: every active schedule whose date has come creates one invoice (a missed day
 * catches up one interval per run), then moves on — or stops after its end date.
 */
export async function runRecurringInvoices(now = new Date(), onlyWorkspace?: string) {
  const today = isoToday(now);
  const due = await db
    .select()
    .from(recurringInvoices)
    .where(
      and(
        eq(recurringInvoices.active, true),
        lte(recurringInvoices.nextDate, today),
        onlyWorkspace ? eq(recurringInvoices.workspaceId, onlyWorkspace) : undefined,
      ),
    )
    .orderBy(asc(recurringInvoices.nextDate));
  const results = { created: 0, sent: 0, failed: 0 };
  for (const s of due) {
    if (s.endDate && s.nextDate > s.endDate) {
      await db.update(recurringInvoices).set({ active: false }).where(eq(recurringInvoices.id, s.id));
      continue;
    }
    try {
      const made = await generate(s);
      if (!made) {
        await db.update(recurringInvoices).set({ active: false }).where(eq(recurringInvoices.id, s.id));
        continue;
      }
      results.created++;
      const next = addInterval(s.nextDate, s.interval);
      await db
        .update(recurringInvoices)
        .set({
          nextDate: next,
          runs: sql`${recurringInvoices.runs} + 1`,
          lastInvoiceId: made.id,
          lastRunAt: new Date(),
          active: !s.endDate || next <= s.endDate,
        })
        .where(eq(recurringInvoices.id, s.id));
      let sent = false;
      if (s.autoSend) {
        try {
          sent = await autoSend(s.workspaceId, made.id);
          if (sent) results.sent++;
        } catch (error) {
          console.error("recurring auto-send failed", s.id, error);
          results.failed++;
        }
      }
      await notifyWorkspace(s.workspaceId, {
        kind: "recurring_created",
        payload: { number: made.number, sent: sent ? 1 : 0 },
        href: `/invoices/${made.id}`,
        minRole: "admin",
      });
    } catch (error) {
      console.error("recurring run failed", s.id, error);
      results.failed++;
    }
  }
  return results;
}
