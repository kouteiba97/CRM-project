import "server-only";
import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { loadDocView } from "@/components/documents/doc-view-data";
import { db } from "@/db/client";
import { activities, clients, invoiceBalances, invoices, workspaces } from "@/db/schema";
import { documentPdf } from "@/lib/document-pdf";
import { formatter } from "@/lib/format";
import { sendMail } from "@/lib/mail/send";
import { documentMail } from "@/lib/mail/templates";
import { notifyWorkspace } from "@/lib/notifications";
import { reminderSchedule } from "@/lib/reminders";

export type ReminderOutcome = "sent" | "no_email" | "failed";

/**
 * Emails a payment reminder for one invoice — in the client's document language, with the PDF
 * — and logs it on the invoice (which is what the reminder schedule counts).
 * `actorId` null means the daily automatic run.
 */
export async function sendReminder(workspaceId: string, invoiceId: string, actorId: string | null): Promise<ReminderOutcome> {
  const view = await loadDocView(workspaceId, "invoice", invoiceId);
  if (!view?.invoice) return "failed";
  const [client] = await db
    .select({ email: clients.email, name: clients.name, id: clients.id })
    .from(clients)
    .where(eq(clients.id, view.invoice.doc.clientId));
  const log = (auto: boolean, to: string) =>
    db.insert(activities).values({
      workspaceId,
      actorId,
      kind: "invoice_reminder",
      entityType: "invoice",
      entityId: invoiceId,
      clientId: client?.id ?? null,
      payload: { number: view.data.number, ...(to ? { to } : {}), ...(auto ? { auto: 1 } : {}) },
    });
  if (!client?.email) {
    // Nothing to email: a manual reminder is still logged (e.g. a phone call), an automatic one is not.
    if (actorId) await log(false, "");
    return "no_email";
  }
  const t = await getTranslations({ locale: view.language, namespace: "email" });
  const f = formatter(view.language);
  try {
    const pdf = await documentPdf(workspaceId, "invoice", invoiceId, view.language, view.data.number);
    await sendMail(
      documentMail({
        to: client.email,
        subject: t("reminder_subject", { number: view.data.number, company: view.workspace.name }),
        message: t("reminder_body", {
          client: client.name,
          number: view.data.number,
          amount: f.money(view.invoice.balanceMinor, view.data.currency),
          date: f.date(view.invoice.doc.dueDate),
          company: view.workspace.name,
        }),
        locale: view.language,
        company: view.workspace.name,
        replyTo: process.env.MAIL_FROM?.match(/<([^>]+)>/)?.[1] ?? process.env.SMTP_USER ?? client.email,
        attachment: pdf,
      }),
    );
  } catch (error) {
    console.error("reminder failed", invoiceId, error);
    return "failed";
  }
  await log(!actorId, client.email);
  if (!actorId) {
    await notifyWorkspace(workspaceId, {
      kind: "reminder_sent",
      payload: { number: view.data.number, client: client.name },
      href: `/invoices/${invoiceId}`,
      minRole: "admin",
    });
  }
  return "sent";
}

/**
 * The daily automatic run: every unpaid invoice whose client accepts reminders and has an
 * email gets at most one reminder per run, when a step of its schedule (due date, +3, +7, +14)
 * has come and was not sent yet.
 */
export async function runAutomaticReminders(now = new Date(), onlyWorkspace?: string) {
  const unpaid = await db
    .select({ id: invoices.id, workspaceId: invoices.workspaceId, dueDate: invoices.dueDate })
    .from(invoices)
    .innerJoin(invoiceBalances, eq(invoiceBalances.invoiceId, invoices.id))
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .innerJoin(workspaces, eq(workspaces.id, invoices.workspaceId))
    .where(
      and(
        inArray(invoiceBalances.displayStatus, ["sent", "viewed", "partially_paid", "overdue"]),
        eq(clients.remindersEnabled, true),
        isNotNull(clients.email),
        isNull(clients.archivedAt),
        onlyWorkspace ? eq(invoices.workspaceId, onlyWorkspace) : undefined,
      ),
    )
    .orderBy(asc(invoices.dueDate));
  const results = { checked: unpaid.length, sent: 0, failed: 0 };
  for (const inv of unpaid) {
    const sent = await db
      .select({ at: activities.occurredAt })
      .from(activities)
      .where(and(eq(activities.entityType, "invoice"), eq(activities.entityId, inv.id), eq(activities.kind, "invoice_reminder")));
    const due = reminderSchedule(inv.dueDate, sent.map((s) => s.at), now).some((s) => s.state === "due");
    if (!due) continue;
    const outcome = await sendReminder(inv.workspaceId, inv.id, null);
    if (outcome === "sent") results.sent++;
    else if (outcome === "failed") results.failed++;
  }
  return results;
}
