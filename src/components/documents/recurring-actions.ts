"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { invoices, recurringInvoices } from "@/db/schema";
import { getSession } from "@/lib/session";

const scheduleSchema = z
  .object({
    interval: z.enum(["monthly", "quarterly", "yearly"]),
    nextDate: z.iso.date(),
    endDate: z.union([z.iso.date(), z.literal("")]).transform((v) => v || null),
    autoSend: z.boolean(),
  })
  .refine((v) => !v.endDate || v.endDate >= v.nextDate, { path: ["endDate"], message: "before_start" });

export type RecurringResult = { ok: true } | { ok: false; errors: Record<string, string> };

/** "Repeat": a schedule that copies this invoice every month / quarter / year. */
export async function createRecurring(invoiceId: string, input: Record<string, unknown>): Promise<RecurringResult> {
  const { workspaceId, userId } = await getSession();
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message === "before_start" ? "before_start" : "invalid"])) };
  }
  const [inv] = await db
    .select({ id: invoices.id, clientId: invoices.clientId, state: invoices.state })
    .from(invoices)
    .where(and(eq(invoices.id, z.uuid().parse(invoiceId)), eq(invoices.workspaceId, workspaceId)));
  if (!inv || inv.state === "void") return { ok: false, errors: { form: "invalid" } };
  await db.insert(recurringInvoices).values({
    workspaceId,
    createdBy: userId,
    sourceInvoiceId: inv.id,
    clientId: inv.clientId,
    ...parsed.data,
  });
  revalidatePath("/[locale]/invoices", "layout");
  return { ok: true };
}

export async function setRecurringActive(id: string, active: boolean) {
  const { workspaceId } = await getSession();
  await db
    .update(recurringInvoices)
    .set({ active })
    .where(and(eq(recurringInvoices.id, z.uuid().parse(id)), eq(recurringInvoices.workspaceId, workspaceId)));
  revalidatePath("/[locale]/invoices", "layout");
  return { ok: true };
}

export async function deleteRecurring(id: string) {
  const { workspaceId } = await getSession();
  await db
    .delete(recurringInvoices)
    .where(and(eq(recurringInvoices.id, z.uuid().parse(id)), eq(recurringInvoices.workspaceId, workspaceId)));
  revalidatePath("/[locale]/invoices", "layout");
  return { ok: true };
}
