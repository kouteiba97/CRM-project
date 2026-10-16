"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { clients, expenseCategory, expenses, projects } from "@/db/schema";
import { parseAmount } from "@/components/leads/schema";
import { audit } from "@/lib/audit";
import { getSession } from "@/lib/session";

const expenseSchema = z.object({
  spentOn: z.iso.date(),
  category: z.enum(expenseCategory.enumValues),
  vendor: z.string().trim().max(120).transform((v) => v || null),
  description: z.string().trim().min(1, "required").max(300, "tooLong"),
  amount: z.string().transform((v, ctx) => {
    const minor = parseAmount(v);
    if (minor === null || minor <= 0) {
      ctx.addIssue({ code: "custom", message: "amount" });
      return z.NEVER;
    }
    return minor;
  }),
  currency: z.string().regex(/^[A-Z]{3}$/),
  projectId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
  clientId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
});

export type ExpenseResult = { ok: true } | { ok: false; errors: Record<string, string> };

/** Creates (id null) or updates an expense; project / client must belong to the workspace. */
export async function saveExpense(id: string | null, input: Record<string, string>): Promise<ExpenseResult> {
  const { workspaceId, userId } = await getSession();
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message === "required" || i.message === "amount" || i.message === "tooLong" ? i.message : "invalid"])) };
  }
  const v = parsed.data;
  const [project] = v.projectId
    ? await db.select({ id: projects.id, clientId: projects.clientId }).from(projects).where(and(eq(projects.id, v.projectId), eq(projects.workspaceId, workspaceId)))
    : [];
  const [client] = v.clientId
    ? await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, v.clientId), eq(clients.workspaceId, workspaceId)))
    : [];
  const values = {
    spentOn: v.spentOn,
    category: v.category,
    vendor: v.vendor,
    description: v.description,
    amountMinor: v.amount,
    currency: v.currency,
    projectId: project?.id ?? null,
    clientId: client?.id ?? project?.clientId ?? null,
  };
  if (id === null) {
    await db.insert(expenses).values({ ...values, workspaceId, createdBy: userId });
  } else {
    await db
      .update(expenses)
      .set(values)
      .where(and(eq(expenses.id, z.uuid().parse(id)), eq(expenses.workspaceId, workspaceId)));
  }
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

export async function deleteExpense(id: string) {
  const { workspaceId, userId } = await getSession();
  const [row] = await db
    .delete(expenses)
    .where(and(eq(expenses.id, z.uuid().parse(id)), eq(expenses.workspaceId, workspaceId)))
    .returning({ description: expenses.description, amountMinor: expenses.amountMinor, currency: expenses.currency });
  if (row) await audit("expense.deleted", { workspaceId, actorId: userId, entityType: "expense", entityId: id, meta: { ...row } });
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}
