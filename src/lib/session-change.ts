import "server-only";
import { eq, sql } from "drizzle-orm";
import { refreshSession } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { sessionProof } from "@/lib/session-proof";

/**
 * Signs out every other session of this user: bumps the version every session token must
 * match, then re-issues the current cookie with the new version (and the proof it may).
 * Only call from a route handler — see app/api/account/*.
 */
export async function bumpAndKeepCurrent(userId: string, set: Partial<typeof users.$inferInsert> = {}) {
  const [row] = await db
    .update(users)
    .set({ ...set, sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, userId))
    .returning({ sv: users.sessionVersion });
  if (row) await refreshSession({ svProof: sessionProof(userId, row.sv) } as never);
}
