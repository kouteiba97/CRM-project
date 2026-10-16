import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { memberships, users, workspaces } from "@/db/schema";

export type Session = {
  userId: string;
  workspaceId: string;
  user: typeof users.$inferSelect;
  workspace: typeof workspaces.$inferSelect;
};

/**
 * The signed-in user and their workspace. The Data Access Layer check: every page, layout and
 * Server Action goes through here, so a missing or stale session always ends at the login page
 * (the proxy's cookie check is only the optimistic first pass).
 */
export const getSession = cache(async (): Promise<Session> => {
  const authed = await auth();
  const id = authed?.user?.id;
  const row = id
    ? (
        await db
          .select({ user: users, workspace: workspaces })
          .from(users)
          .innerJoin(memberships, eq(memberships.userId, users.id))
          .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
          .where(eq(users.id, id))
          .limit(1)
      )[0]
    : undefined;
  if (!row) redirect(`/${await getLocale()}/login`);
  return { userId: row.user.id, workspaceId: row.workspace.id, user: row.user, workspace: row.workspace };
});
