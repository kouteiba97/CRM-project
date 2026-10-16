import "server-only";
import { and, count, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { memberships, notifications } from "@/db/schema";
import { can, type Role } from "@/lib/roles";

export type NotificationKind =
  | "member_joined"
  | "task_assigned"
  | "payment_received"
  | "invoice_overdue"
  | "follow_up_due"
  | "reminder_sent"
  | "recurring_created";

type Input = { kind: NotificationKind; payload?: Record<string, string | number>; href?: string };

/** Notifies specific people. Never throws: a notification must not break the action behind it. */
export async function notifyUsers(workspaceId: string, userIds: string[], n: Input) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;
  try {
    await db
      .insert(notifications)
      .values(ids.map((userId) => ({ workspaceId, userId, kind: n.kind, payload: n.payload ?? {}, href: n.href })));
  } catch (error) {
    console.error("notify failed", n.kind, error);
  }
}

/**
 * Notifies the workspace's members (optionally only admins/owners), plus `alsoUserIds` (e.g. a
 * client's owner) — each person once, and never the actor (`exceptUserId`).
 */
export async function notifyWorkspace(
  workspaceId: string,
  n: Input & { exceptUserId?: string; minRole?: Role; alsoUserIds?: (string | null | undefined)[] },
) {
  const rows = await db
    .select({ userId: memberships.userId, role: memberships.role })
    .from(memberships)
    .where(
      and(
        eq(memberships.workspaceId, workspaceId),
        n.exceptUserId ? ne(memberships.userId, n.exceptUserId) : undefined,
      ),
    );
  const members = new Set(rows.map((r) => r.userId));
  const targets = [
    ...rows.filter((r) => !n.minRole || can(r.role, n.minRole)).map((r) => r.userId),
    ...(n.alsoUserIds ?? []).filter((id): id is string => Boolean(id && members.has(id))),
  ];
  await notifyUsers(workspaceId, targets, n);
}

export async function markRead(userId: string, ids: string[] | "all", workspaceId: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.workspaceId, workspaceId),
        ids === "all" ? undefined : inArray(notifications.id, ids),
      ),
    );
}

/** The bell: newest notifications of this user in this workspace, and how many are unread. */
export async function getNotifications(userId: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.workspaceId, workspaceId)))
    .orderBy(desc(notifications.createdAt))
    .limit(15);
  const [unread] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.workspaceId, workspaceId), isNull(notifications.readAt)));
  return { rows, unread: unread?.n ?? 0 };
}
