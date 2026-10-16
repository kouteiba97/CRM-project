import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
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

/** Notifies the workspace's members (optionally only admins/owners, and not the actor). */
export async function notifyWorkspace(
  workspaceId: string,
  n: Input & { exceptUserId?: string; minRole?: Role },
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
  const targets = rows.filter((r) => !n.minRole || can(r.role, n.minRole)).map((r) => r.userId);
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
