"use server";

import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { activities, clients, contacts } from "@/db/schema";
import { audit } from "@/lib/audit";
import { IMPORT_FIELDS, rowToClient, type Mapping } from "@/lib/import";
import { getSession } from "@/lib/session";

const MAX_ROWS = 2000;
const CHUNK = 100;

export type ImportResult = {
  created: number;
  skipped: { row: number; reason: "no_name" | "bad_email" | "duplicate" }[];
};

/**
 * Imports parsed rows (already read in the browser) as clients of the active workspace. Rows
 * are re-validated here; a client with the same name or email as an existing one (or an
 * earlier row) is skipped, so running the same file twice adds nothing.
 */
export async function importClients(rows: string[][], mapping: Mapping): Promise<ImportResult> {
  const { workspaceId, userId } = await getSession();
  const data = z.array(z.array(z.string().max(5000)).max(60)).max(MAX_ROWS).parse(rows);
  const map = z
    .partialRecord(z.enum(IMPORT_FIELDS), z.number().int().min(0).max(59))
    .parse(mapping) as Mapping;

  const existing = await db
    .select({ name: clients.name, email: clients.email })
    .from(clients)
    .where(and(eq(clients.workspaceId, workspaceId), isNull(clients.archivedAt)));
  const names = new Set(existing.map((c) => c.name.trim().toLowerCase()));
  const emails = new Set(existing.flatMap((c) => (c.email ? [c.email.toLowerCase()] : [])));

  const skipped: ImportResult["skipped"] = [];
  const ready: { id: string; c: NonNullable<ReturnType<typeof rowToClient> & { ok: true }>["client"] }[] = [];
  data.forEach((row, i) => {
    const res = rowToClient(row, map);
    if (!res.ok) return skipped.push({ row: i + 1, reason: res.reason });
    const key = res.client.name.toLowerCase();
    if (names.has(key) || (res.client.email && emails.has(res.client.email))) return skipped.push({ row: i + 1, reason: "duplicate" });
    names.add(key);
    if (res.client.email) emails.add(res.client.email);
    ready.push({ id: randomUUID(), c: res.client });
  });

  const base = { workspaceId, createdBy: userId };
  for (let i = 0; i < ready.length; i += CHUNK) {
    const part = ready.slice(i, i + CHUNK);
    const withContact = part.filter((r) => r.c.contactFirstName);
    await db.batch([
      db.insert(clients).values(
        part.map(({ id, c }) => ({
          ...base,
          id,
          name: c.name,
          status: c.status,
          email: c.email,
          phone: c.phone,
          website: c.website,
          city: c.city,
          country: c.country,
          tags: c.tags,
          notes: c.notes,
          ownerId: userId,
        })),
      ),
      ...(withContact.length
        ? [
            db.insert(contacts).values(
              withContact.map(({ id, c }) => ({
                ...base,
                clientId: id,
                firstName: c.contactFirstName!,
                lastName: c.contactLastName,
                isPrimary: true,
              })),
            ),
          ]
        : []),
      db.insert(activities).values(
        part.map(({ id, c }) => ({
          workspaceId,
          actorId: userId,
          kind: "client_created",
          entityType: "client",
          entityId: id,
          clientId: id,
          payload: { name: c.name, imported: 1 },
        })),
      ),
    ]);
  }
  await audit("clients.imported", { workspaceId, actorId: userId, meta: { created: ready.length, skipped: skipped.length } });
  revalidatePath("/[locale]", "layout");
  return { created: ready.length, skipped };
}
