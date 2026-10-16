import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { clients, files, projects } from "@/db/schema";
import { isUuid } from "@/db/queries/clients";
import { audit } from "@/lib/audit";
import { sameOriginForm } from "@/lib/session-proof";
import { getSession } from "@/lib/session";
import { ALLOWED_TYPES, MAX_FILE_BYTES, putFile, sniffType } from "@/lib/storage";

export const maxDuration = 60;

const ENTITY = { client: clients, project: projects } as const;

/** Upload one file to a client or project of the active workspace. */
export async function POST(req: Request) {
  if (!sameOriginForm(req)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const session = await getSession();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const entityType = String(form?.get("entityType") ?? "");
  const entityId = String(form?.get("entityId") ?? "");
  if (!(file instanceof File) || !(entityType in ENTITY) || !isUuid(entityId)) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_FILE_BYTES) return NextResponse.json({ ok: false, error: "size" }, { status: 400 });

  const table = ENTITY[entityType as keyof typeof ENTITY];
  const [owner] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, entityId), eq(table.workspaceId, session.workspaceId)));
  if (!owner) return NextResponse.json({ ok: false, error: "invalid" }, { status: 404 });

  const content = Buffer.from(await file.arrayBuffer());
  const type = sniffType(content.subarray(0, 4096), file.type);
  if (!type || !(type in ALLOWED_TYPES)) return NextResponse.json({ ok: false, error: "type" }, { status: 400 });

  let storageKey: string;
  try {
    storageKey = await putFile(session.workspaceId, content, type);
  } catch (error) {
    console.error("upload failed", error);
    return NextResponse.json({ ok: false, error: "storage" }, { status: 500 });
  }
  const name = file.name.replace(/[\\/\0\r\n]+/g, "_").slice(0, 200) || "file";
  const [row] = await db
    .insert(files)
    .values({ workspaceId: session.workspaceId, createdBy: session.userId, entityType, entityId, name, size: file.size, contentType: type, storageKey })
    .returning({ id: files.id });
  await audit("file.uploaded", { workspaceId: session.workspaceId, actorId: session.userId, entityType, entityId, meta: { name, size: file.size } });
  revalidatePath("/[locale]", "layout");
  return NextResponse.json({ ok: true, id: row!.id });
}
