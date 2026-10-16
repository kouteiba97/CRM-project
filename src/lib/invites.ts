import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { invites, users, workspaces } from "@/db/schema";
import { hashToken } from "@/lib/accounts";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function newInviteToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_TTL_MS) };
}

/** A pending (not accepted, not revoked, not expired) invite and its workspace, by token. */
export async function findInvite(token: string) {
  if (!token) return null;
  const [row] = await db
    .select({ invite: invites, workspace: workspaces.name, inviter: users.name })
    .from(invites)
    .innerJoin(workspaces, eq(workspaces.id, invites.workspaceId))
    .leftJoin(users, eq(users.id, invites.invitedBy))
    .where(
      and(
        eq(invites.tokenHash, hashToken(token)),
        isNull(invites.acceptedAt),
        isNull(invites.revokedAt),
        gt(invites.expiresAt, new Date()),
      ),
    );
  return row ?? null;
}
