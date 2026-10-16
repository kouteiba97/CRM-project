"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { markRead } from "@/lib/notifications";
import { getSession } from "@/lib/session";

/** The bell: mark one notification (when opened) or all of them as read. */
export async function markNotificationsRead(ids: string[] | "all") {
  const { userId, workspaceId } = await getSession();
  await markRead(userId, ids === "all" ? "all" : z.array(z.uuid()).max(50).parse(ids), workspaceId);
  revalidatePath("/[locale]", "layout");
}
