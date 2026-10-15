"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { activities, clients, invoices, payments, paymentStatus } from "@/db/schema";
import { getSession } from "@/lib/session";

/**
 * Received / Pending / Failed / Refunded. Only Received counts toward the invoice balance (the
 * invoice_balances view), so marking a payment Failed or Refunded reopens the amount. Returns the previous
 * status for Undo.
 */
export async function setPaymentStatus(paymentId: string, status: string) {
  const { workspaceId, userId } = await getSession();
  const id = z.uuid().parse(paymentId);
  const next = z.enum(paymentStatus.enumValues).parse(status);
  const [p] = await db
    .select({ status: payments.status, invoiceId: payments.invoiceId, clientId: payments.clientId, number: invoices.number })
    .from(payments)
    .leftJoin(invoices, eq(invoices.id, payments.invoiceId))
    .where(and(eq(payments.id, id), eq(payments.workspaceId, workspaceId)));
  if (!p) throw new Error("Payment not found");
  await db.batch([
    db.update(payments).set({ status: next }).where(eq(payments.id, id)),
    db.insert(activities).values({
      workspaceId,
      actorId: userId,
      kind: "payment_status_changed",
      entityType: p.invoiceId ? "invoice" : "client",
      entityId: p.invoiceId ?? p.clientId,
      clientId: p.clientId,
      payload: { number: p.number ?? "", status: next },
    }),
  ]);
  revalidatePath("/[locale]", "layout");
  return { from: p.status };
}

/** DS › Payments › reminders: the automatic schedule is switched per client. */
export async function setClientReminders(clientId: string, enabled: boolean) {
  const { workspaceId } = await getSession();
  const id = z.uuid().parse(clientId);
  await db
    .update(clients)
    .set({ remindersEnabled: z.boolean().parse(enabled) })
    .where(and(eq(clients.id, id), eq(clients.workspaceId, workspaceId)));
  revalidatePath("/[locale]", "layout");
}
