import "server-only";
import { and, eq, gte, isNotNull, isNull, lt, lte, or } from "drizzle-orm";
import { db } from "@/db/client";
import { authTokens, clients, followUps, invoiceBalances, invoices, invites, notifications, rateLimits } from "@/db/schema";
import { runAutomaticReminders } from "@/lib/invoice-reminders";
import { notifyUsers, notifyWorkspace } from "@/lib/notifications";
import { runRecurringInvoices } from "@/lib/recurring";

/** Follow-ups due today: a nudge to whoever owns each one. */
async function followUpNudges(now: Date) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86_400_000);
  const rows = await db
    .select({ id: followUps.id, workspaceId: followUps.workspaceId, ownerId: followUps.ownerId, subject: followUps.subject })
    .from(followUps)
    .where(and(eq(followUps.status, "open"), gte(followUps.dueAt, start), lt(followUps.dueAt, end), isNotNull(followUps.ownerId)));
  for (const f of rows) {
    await notifyUsers(f.workspaceId, [f.ownerId!], { kind: "follow_up_due", payload: { subject: f.subject }, href: "/follow-ups" });
  }
  return rows.length;
}

/** Invoices that became overdue today: admins and the client's owner hear about it once. */
async function overdueNudges(now: Date) {
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
  const rows = await db
    .select({ id: invoices.id, workspaceId: invoices.workspaceId, number: invoices.number, ownerId: clients.ownerId, client: clients.name })
    .from(invoices)
    .innerJoin(invoiceBalances, eq(invoiceBalances.invoiceId, invoices.id))
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoices.dueDate, yesterday), eq(invoiceBalances.displayStatus, "overdue")));
  for (const r of rows) {
    const n = { kind: "invoice_overdue" as const, payload: { number: r.number, client: r.client }, href: `/invoices/${r.id}` };
    await notifyWorkspace(r.workspaceId, { ...n, minRole: "admin", alsoUserIds: [r.ownerId] });
  }
  return rows.length;
}

/** Housekeeping: used/expired links, old counters, old read notifications. */
async function cleanup(now: Date) {
  const day = 86_400_000;
  await db.delete(authTokens).where(or(lt(authTokens.expiresAt, new Date(now.getTime() - 7 * day)), and(isNotNull(authTokens.usedAt), lt(authTokens.usedAt, new Date(now.getTime() - 7 * day)))));
  await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(now.getTime() - day)));
  await db.delete(notifications).where(and(isNotNull(notifications.readAt), lt(notifications.createdAt, new Date(now.getTime() - 90 * day))));
  await db.delete(invites).where(and(isNull(invites.acceptedAt), lte(invites.expiresAt, new Date(now.getTime() - 30 * day))));
}

/**
 * Everything the daily cron does, in order; each part keeps going if another fails.
 * `onlyWorkspace` (development/tests only) limits the invoice parts to one workspace.
 */
export async function runDaily(now = new Date(), onlyWorkspace?: string) {
  const out: Record<string, unknown> = {};
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      out[name] = await fn();
    } catch (error) {
      console.error(`[cron] ${name} failed`, error);
      out[name] = { error: String(error) };
    }
  };
  await step("recurring", () => runRecurringInvoices(now, onlyWorkspace));
  await step("reminders", () => runAutomaticReminders(now, onlyWorkspace));
  if (onlyWorkspace) return out;
  await step("followUps", () => followUpNudges(now));
  await step("overdue", () => overdueNudges(now));
  await step("cleanup", () => cleanup(now));
  return out;
}
