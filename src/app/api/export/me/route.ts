import { audit } from "@/lib/audit";
import { exportUser, jsonDownload } from "@/lib/export";
import { getSession } from "@/lib/session";

/** Settings › Data: everything stored about the signed-in person, as JSON. */
export async function GET() {
  const { userId } = await getSession();
  await audit("account.data_exported", { actorId: userId });
  return jsonDownload(await exportUser(userId), `apex-crm-my-data-${new Date().toISOString().slice(0, 10)}.json`);
}
