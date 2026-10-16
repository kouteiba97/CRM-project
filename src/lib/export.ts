import "server-only";
import { eq, getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import * as schema from "@/db/schema";

// Never part of an export, whoever asks.
const SECRET_COLUMNS = new Set(["passwordHash", "tokenHash", "totpSecret", "recoveryCodes"]);

function strip<T extends Record<string, unknown>>(row: T) {
  return Object.fromEntries(Object.entries(row).filter(([k]) => !SECRET_COLUMNS.has(k)));
}

/** Every table that belongs to a workspace (has a workspace_id column), found from the schema. */
function workspaceTables() {
  return (Object.values(schema) as unknown[]).filter(
    (v): v is PgTable => is(v, PgTable) && "workspaceId" in getTableColumns(v as PgTable),
  );
}

/** All of a workspace's data as one JSON-ready object (for owners/admins: portability, backups). */
export async function exportWorkspace(workspaceId: string) {
  const [workspace] = await db.select().from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId));
  const data: Record<string, unknown[]> = {};
  for (const table of workspaceTables()) {
    const col = (getTableColumns(table) as Record<string, Parameters<typeof eq>[0]>).workspaceId!;
    const rows = await db.select().from(table).where(eq(col, workspaceId));
    data[getTableName(table)] = rows.map((r) => strip(r as Record<string, unknown>));
  }
  return { exportedAt: new Date().toISOString(), workspace, data };
}

/** What Apex CRM holds about one person (right of access): profile, memberships, security log. */
export async function exportUser(userId: string) {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  const memberships = await db
    .select({ workspace: schema.workspaces.name, role: schema.memberships.role, since: schema.memberships.createdAt })
    .from(schema.memberships)
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.memberships.workspaceId))
    .where(eq(schema.memberships.userId, userId));
  const security = await db
    .select()
    .from(schema.auditEvents)
    .where(eq(schema.auditEvents.actorId, userId));
  return {
    exportedAt: new Date().toISOString(),
    user: user ? { ...strip(user), twoFactorEnabled: Boolean((user as Record<string, unknown>).totpEnabledAt) } : null,
    memberships,
    securityEvents: security,
  };
}

export function jsonDownload(data: unknown, filename: string) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
