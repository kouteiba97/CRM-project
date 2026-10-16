import "server-only";
import { headers } from "next/headers";
import { db } from "@/db/client";
import { auditEvents } from "@/db/schema";
import { clientIp } from "@/lib/rate-limit";

export type AuditAction =
  | "auth.sign_in"
  | "auth.sign_in_failed"
  | "auth.sign_out"
  | "auth.password_changed"
  | "auth.password_reset"
  | "auth.email_change_requested"
  | "auth.email_changed"
  | "auth.sessions_revoked"
  | "auth.2fa_enabled"
  | "auth.2fa_disabled"
  | "auth.2fa_recovery_used"
  | "account.created"
  | "account.deleted"
  | "account.data_exported"
  | "team.invited"
  | "team.invite_revoked"
  | "team.joined"
  | "team.role_changed"
  | "team.removed"
  | "team.left"
  | "workspace.updated"
  | "workspace.data_exported"
  | "clients.archived"
  | "clients.exported"
  | "clients.imported"
  | "invoice.voided"
  | "invoice.emailed"
  | "file.uploaded"
  | "file.deleted"
  | "expense.deleted";

type Meta = Record<string, string | number | boolean | null>;

/**
 * Records a security-relevant event. Never throws: an audit failure must not break the action
 * it describes, so it is logged to the server console instead.
 */
export async function audit(
  action: AuditAction,
  opts: { workspaceId?: string | null; actorId?: string | null; entityType?: string; entityId?: string; meta?: Meta } = {},
) {
  try {
    const h = await headers();
    await db.insert(auditEvents).values({
      action,
      workspaceId: opts.workspaceId ?? null,
      actorId: opts.actorId ?? null,
      entityType: opts.entityType,
      entityId: opts.entityId,
      meta: opts.meta ?? {},
      ip: await clientIp(),
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    });
  } catch (error) {
    console.error("audit failed", action, error);
  }
}
