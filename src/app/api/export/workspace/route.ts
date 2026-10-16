import { audit } from "@/lib/audit";
import { exportWorkspace, jsonDownload } from "@/lib/export";
import { can } from "@/lib/roles";
import { getSession } from "@/lib/session";

/** Settings › Data: the whole active workspace as JSON (owners and admins). */
export async function GET() {
  const session = await getSession();
  if (!can(session.role, "admin")) return new Response("Forbidden", { status: 403 });
  await audit("workspace.data_exported", { workspaceId: session.workspaceId, actorId: session.userId });
  const slug = session.workspace.name.replace(/[^\w-]+/g, "-").slice(0, 40) || "workspace";
  return jsonDownload(
    await exportWorkspace(session.workspaceId),
    `apex-crm-${slug}-${new Date().toISOString().slice(0, 10)}.json`,
  );
}
