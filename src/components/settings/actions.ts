"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { memberships, users, workspaces } from "@/db/schema";
import { getSession } from "@/lib/session";
import { profileSchema, settingsErrors, workspaceSchema } from "./schema";

export type SettingsResult = { ok: true } | { ok: false; errors: Record<string, string> };

/** Workspace details are owner-only: they appear on every document the workspace issues. */
export async function updateWorkspace(input: Record<string, string>): Promise<SettingsResult> {
  const { workspaceId, userId } = await getSession();
  const [m] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)));
  if (m?.role !== "owner") return { ok: false, errors: { form: "ownerOnly" } };
  const parsed = workspaceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: settingsErrors(parsed.error) };
  await db.update(workspaces).set(parsed.data).where(eq(workspaces.id, workspaceId));
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

export async function updateProfile(input: Record<string, string>): Promise<SettingsResult> {
  const { userId } = await getSession();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: settingsErrors(parsed.error) };
  await db.update(users).set({ name: parsed.data.name }).where(eq(users.id, userId));
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}
