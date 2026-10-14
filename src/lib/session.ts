import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { memberships, users, workspaces } from "@/db/schema";

export type Session = {
  userId: string;
  workspaceId: string;
  user: typeof users.$inferSelect;
  workspace: typeof workspaces.$inferSelect;
};

/**
 * Phase 1 dev session: resolves the seeded owner. Auth.js replaces this together with the
 * Login screen; every query is already scoped by `workspaceId`, so nothing else changes.
 */
export const getSession = cache(async (): Promise<Session> => {
  const email = process.env.DEV_USER_EMAIL ?? "owner@apex.test";
  const rows = await db
    .select({ user: users, workspace: workspaces })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(eq(users.email, email))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error(`No user ${email}. Run \`npm run db:seed\`.`);
  return { userId: row.user.id, workspaceId: row.workspace.id, user: row.user, workspace: row.workspace };
});
