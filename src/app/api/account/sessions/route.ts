import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { bumpAndKeepCurrent } from "@/lib/session-change";
import { sameOrigin } from "@/lib/session-proof";
import { getSession } from "@/lib/session";

/** Settings › Security: every other browser and phone is signed out; this one stays. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false }, { status: 403 });
  const { user } = await getSession();
  await bumpAndKeepCurrent(user.id);
  await audit("auth.sessions_revoked", { actorId: user.id });
  return NextResponse.json({ ok: true });
}
