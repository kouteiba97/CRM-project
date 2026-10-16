import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { documentSequences } from "@/db/schema";
import { documentNumber, type DocumentKind } from "@/lib/documents";

/** The next number of a document kind this year (INV-YYYY-NNNN, Q-YYYY-NNN): one atomic upsert. */
export async function nextNumber(workspaceId: string, kind: DocumentKind) {
  const year = new Date().getFullYear();
  const res = await db.execute<{ value: number }>(sql`
    insert into ${documentSequences} (workspace_id, kind, year, next_value)
    values (${workspaceId}, ${kind}, ${year}, 2)
    on conflict (workspace_id, kind, year)
    do update set next_value = ${documentSequences}.next_value + 1
    returning next_value - 1 as value`);
  return documentNumber(kind, year, Number(res.rows[0]!.value));
}
