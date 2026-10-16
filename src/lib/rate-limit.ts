import "server-only";
import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db/client";
import { rateLimits } from "@/db/schema";

// Per-IP limits are relaxed outside production: local tests all come from one address.
const IP_SCALE = process.env.NODE_ENV === "production" ? 1 : 50;

/** Limits used across the app: max events per window. */
export const LIMITS = {
  loginFailuresPerEmail: { max: 5, windowMs: 15 * 60_000 },
  loginAttemptsPerIp: { max: 30 * IP_SCALE, windowMs: 15 * 60_000 },
  resetEmailsPerIp: { max: 10 * IP_SCALE, windowMs: 60 * 60_000 },
  signupsPerIp: { max: 10 * IP_SCALE, windowMs: 60 * 60_000 },
  invitesPerWorkspace: { max: 50, windowMs: 24 * 60 * 60_000 },
  twoFactorFailures: { max: 5, windowMs: 15 * 60_000 },
} as const;
type Limit = { max: number; windowMs: number };

/** The caller's IP as seen by the host (Vercel sets x-forwarded-for / x-real-ip). */
export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Counts one event for `key` and returns the count inside the current window. One atomic
 * upsert, so concurrent requests on different instances cannot both slip under the limit.
 */
export async function hit(key: string, limit: Limit) {
  const seconds = Math.round(limit.windowMs / 1000);
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.windowStart} < now() - make_interval(secs => ${seconds}) then 1 else ${rateLimits.count} + 1 end`,
        windowStart: sql`case when ${rateLimits.windowStart} < now() - make_interval(secs => ${seconds}) then now() else ${rateLimits.windowStart} end`,
      },
    })
    .returning({ count: rateLimits.count });
  return row?.count ?? 1;
}

/** Whether `key` already reached its limit in the current window (does not count). */
export async function limited(key: string, limit: Limit) {
  const seconds = Math.round(limit.windowMs / 1000);
  const [row] = await db
    .select({ count: rateLimits.count })
    .from(rateLimits)
    .where(sql`${rateLimits.key} = ${key} and ${rateLimits.windowStart} >= now() - make_interval(secs => ${seconds})`);
  return (row?.count ?? 0) >= limit.max;
}

export async function clearLimit(key: string) {
  await db.delete(rateLimits).where(eq(rateLimits.key, key));
}
