"use server";

import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { activities, invoices, tasks, taskStatus, users } from "@/db/schema";
import { sendReminder } from "@/lib/invoice-reminders";
import { getSession } from "@/lib/session";
import { SIDEBAR_COOKIE, THEME_COOKIE } from "@/lib/theme";

const YEAR = 60 * 60 * 24 * 365;
const uuid = z.string().uuid();

/**
 * Optimistic task status change from the dashboard; the client reverts on failure.
 * Undo passes the task's previous status back, so "In review" stays "In review".
 */
export async function setTaskStatus(taskId: string, status: string) {
  const { workspaceId, userId } = await getSession();
  const id = uuid.parse(taskId);
  const next = z.enum(taskStatus.enumValues).parse(status);
  const done = next === "done";
  const [task] = await db
    .update(tasks)
    .set({ status: next, completedAt: done ? new Date() : null })
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, workspaceId)))
    .returning({ id: tasks.id, title: tasks.title, projectId: tasks.projectId });
  if (!task) throw new Error("Task not found");
  if (done) {
    await db.insert(activities).values({
      workspaceId,
      actorId: userId,
      kind: "task_completed",
      entityType: task.projectId ? "project" : "task",
      entityId: task.projectId ?? task.id,
      payload: { title: task.title },
    });
  }
  revalidatePath("/[locale]", "layout");
}

/**
 * Logs a payment reminder on the invoice's timeline. Sending the e-mail itself arrives with the
 * Invoices module (Send modal with recipient, subject and attached PDF).
 */
/** "Send reminder": emails the client (with the PDF) when they have an email, and logs it. */
export async function sendInvoiceReminder(invoiceId: string) {
  const { workspaceId, userId } = await getSession();
  const id = uuid.parse(invoiceId);
  const [inv] = await db
    .select({ id: invoices.id, number: invoices.number })
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.workspaceId, workspaceId)));
  if (!inv) throw new Error("Invoice not found");
  const outcome = await sendReminder(workspaceId, inv.id, userId);
  if (outcome === "failed") throw new Error("Reminder could not be sent");
  revalidatePath("/[locale]", "layout");
  return { number: inv.number, emailed: outcome === "sent" };
}

export async function saveLocale(locale: string) {
  const value = z.enum(["en", "fr", "ar"]).parse(locale);
  const { userId } = await getSession();
  await db.update(users).set({ locale: value }).where(eq(users.id, userId));
}

export async function saveTheme(theme: string) {
  const value = z.enum(["light", "dark", "system"]).parse(theme);
  (await cookies()).set(THEME_COOKIE, value, { path: "/", maxAge: YEAR, sameSite: "lax" });
  const { userId } = await getSession();
  await db.update(users).set({ theme: value }).where(eq(users.id, userId));
}

export async function saveSidebar(state: string) {
  const value = z.enum(["auto", "collapsed", "expanded"]).parse(state);
  (await cookies()).set(SIDEBAR_COOKIE, value, { path: "/", maxAge: YEAR, sameSite: "lax" });
  const { userId } = await getSession();
  await db.update(users).set({ sidebarCollapsed: value === "collapsed" }).where(eq(users.id, userId));
}
