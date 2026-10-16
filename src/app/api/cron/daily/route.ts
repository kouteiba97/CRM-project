import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runDaily } from "@/lib/daily";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * The daily job (vercel.json › crons): recurring invoices, payment reminders, follow-up and
 * overdue notifications, cleanup. Vercel calls it with `Authorization: Bearer $CRON_SECRET`;
 * without the right secret nothing runs. In development it also runs without a secret.
 */
function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ ok: false }, { status: 401 });
  // Tests limit the run to their own workspace; production always runs everything.
  const only = process.env.NODE_ENV !== "production" ? new URL(req.url).searchParams.get("workspace") ?? undefined : undefined;
  const result = await runDaily(new Date(), only);
  console.info("[cron] daily", JSON.stringify(result));
  return NextResponse.json({ ok: true, ...result });
}
