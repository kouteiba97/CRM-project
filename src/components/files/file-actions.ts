"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { files } from "@/db/schema";
import { audit } from "@/lib/audit";
import { can } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { deleteStoredFile } from "@/lib/storage";

/** Deletes a file for good: whoever uploaded it, or an owner/admin. */
export async function deleteFile(fileId: string) {
  const session = await getSession();
  const id = z.uuid().parse(fileId);
  const [file] = await db.select().from(files).where(and(eq(files.id, id), eq(files.workspaceId, session.workspaceId)));
  if (!file) return { ok: false as const };
  if (file.createdBy !== session.userId && !can(session.role, "admin")) return { ok: false as const };
  await db.delete(files).where(eq(files.id, id));
  await deleteStoredFile(file.storageKey).catch((error) => console.error("file delete (storage) failed", error));
  await audit("file.deleted", { workspaceId: session.workspaceId, actorId: session.userId, entityType: file.entityType, entityId: file.entityId, meta: { name: file.name } });
  revalidatePath("/[locale]", "layout");
  return { ok: true as const };
}
