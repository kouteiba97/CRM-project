import { loadDocView } from "@/components/documents/doc-view-data";
import { isUuid } from "@/db/queries/clients";
import { documentPdf } from "@/lib/document-pdf";
import { getSession } from "@/lib/session";

export const maxDuration = 60;

/** "Download PDF": the real file, generated on the server, for documents of your workspace. */
export async function GET(_req: Request, ctx: RouteContext<"/api/documents/[kind]/[id]/pdf">) {
  const { kind, id } = await ctx.params;
  if ((kind !== "invoice" && kind !== "quotation") || !isUuid(id)) return new Response("Not found", { status: 404 });
  const { workspaceId } = await getSession();
  const view = await loadDocView(workspaceId, kind, id);
  if (!view) return new Response("Not found", { status: 404 });
  try {
    const pdf = await documentPdf(workspaceId, kind, id, view.language, view.data.number);
    return new Response(new Uint8Array(pdf.content), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${pdf.filename}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("pdf failed", error);
    return new Response("The PDF could not be generated.", { status: 500 });
  }
}
