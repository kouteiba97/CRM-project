import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { files } from "@/db/schema";
import { isUuid } from "@/db/queries/clients";
import { getSession } from "@/lib/session";
import { readStoredFile } from "@/lib/storage";

/**
 * Download an attached file — only for members of its workspace. Always as an attachment and
 * with nosniff, so a file can never run as a page of this site.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const { workspaceId } = await getSession();
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), eq(files.workspaceId, workspaceId), isNull(files.archivedAt)));
  if (!file) return new Response("Not found", { status: 404 });
  const body = await readStoredFile(file.storageKey);
  if (!body) return new Response("Not found", { status: 404 });
  const ascii = file.name.replace(/[^\x20-\x7e]+/g, "_").replace(/"/g, "'");
  const payload: BodyInit = Buffer.isBuffer(body) ? new Uint8Array(body) : (body as ReadableStream);
  return new Response(payload, {
    headers: {
      "content-type": file.contentType,
      "content-length": String(file.size),
      "content-disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
