import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { db } from "@/db/client";
import { invites, memberships, users } from "@/db/schema";
import { formatter, type Locale } from "@/lib/format";
import { can } from "@/lib/roles";
import type { Session } from "@/lib/session";
import { TeamClient } from "./TeamClient";

/** Settings › Team: members with their roles, and pending invitations. */
export async function TeamPanel({ session }: { session: Session }) {
  const f = formatter((await getLocale()) as Locale);
  const members = await db
    .select({ userId: users.id, name: users.name, email: users.email, role: memberships.role, since: memberships.createdAt })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.workspaceId, session.workspaceId))
    .orderBy(asc(memberships.createdAt));
  const pending = can(session.role, "admin")
    ? await db
        .select({ i: invites, expired: sql<boolean>`${invites.expiresAt} < now()` })
        .from(invites)
        .where(and(eq(invites.workspaceId, session.workspaceId), isNull(invites.acceptedAt), isNull(invites.revokedAt)))
        .orderBy(desc(invites.createdAt))
    : [];

  return (
    <TeamClient
      myId={session.userId}
      myRole={session.role}
      members={members.map((m) => ({ ...m, since: f.date(m.since) }))}
      invites={pending.map(({ i, expired }) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        expires: f.date(i.expiresAt),
        expired,
      }))}
    />
  );
}
