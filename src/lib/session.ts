import "server-only";
import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { memberships, users, workspaces } from "@/db/schema";
import { ACTIVE_WORKSPACE_COOKIE, can, type Role } from "@/lib/roles";

export type Session = {
  userId: string;
  workspaceId: string;
  role: Role;
  user: typeof users.$inferSelect;
  workspace: typeof workspaces.$inferSelect;
  /** Every workspace the user belongs to (for the switcher). */
  workspaces: { id: string; name: string; role: Role }[];
};

/**
 * A cookie for a user that no longer exists or was signed out remotely: clearing it needs a
 * route handler (rendering cannot set cookies), otherwise the proxy and this check would loop.
 */
async function endSessionUrl() {
  return `/api/session/end?locale=${await getLocale()}`;
}

/**
 * The signed-in user, their active workspace and their role in it. The Data Access Layer check:
 * every page, layout and Server Action goes through here, so a missing or stale session always
 * ends at the login page (the proxy's cookie check is only the optimistic first pass).
 */
export const getSession = cache(async (): Promise<Session> => {
  const authed = await auth();
  const id = authed?.user?.id;
  if (!id) redirect(`/${await getLocale()}/login`);
  const rows = await db
    .select({ user: users, workspace: workspaces, role: memberships.role })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(eq(users.id, id))
    .orderBy(asc(memberships.createdAt));
  if (!rows.length) redirect(await endSessionUrl());
  const user = rows[0]!.user;
  // Password changed (or account re-secured) since this session was signed: sign it out.
  if (user.sessionVersion !== (authed?.sessionVersion ?? 0)) redirect(await endSessionUrl());

  const wanted = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const active = rows.find((r) => r.workspace.id === wanted) ?? rows[0]!;
  return {
    userId: user.id,
    workspaceId: active.workspace.id,
    role: active.role,
    user,
    workspace: active.workspace,
    workspaces: rows.map((r) => ({ id: r.workspace.id, name: r.workspace.name, role: r.role })),
  };
});

/** For actions only some roles may take; throws so the client shows its failure state. */
export async function requireRole(min: Role) {
  const session = await getSession();
  if (!can(session.role, min)) throw new Error("Forbidden");
  return session;
}
