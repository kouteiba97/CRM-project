import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, count, eq, gt, isNull, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db/client";
import { authTokenKind, authTokens, memberships, users, workspaces } from "@/db/schema";
import type { Locale } from "@/lib/format";

type TokenKind = (typeof authTokenKind.enumValues)[number];

export const TOKEN_TTL_MS: Record<TokenKind, number> = {
  reset_password: 60 * 60 * 1000,
  verify_email: 7 * 24 * 60 * 60 * 1000,
};
/** Reset emails per account per 15 minutes; more are silently dropped. */
export const RESET_LIMIT = 3;

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(8).max(200);

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function findUserByEmail(email: string) {
  return db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.trim().toLowerCase()))
    .limit(1)
    .then((r) => r[0]);
}

/** Issues a one-time token and retires any earlier unused token of the same kind. */
export async function issueToken(userId: string, kind: TokenKind) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await db.batch([
    db
      .update(authTokens)
      .set({ usedAt: now })
      .where(and(eq(authTokens.userId, userId), eq(authTokens.kind, kind), isNull(authTokens.usedAt))),
    db.insert(authTokens).values({
      userId,
      kind,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + TOKEN_TTL_MS[kind]),
    }),
  ]);
  return token;
}

/** How many tokens of this kind were issued to the user in the last 15 minutes. */
export async function recentTokens(userId: string, kind: TokenKind) {
  const [row] = await db
    .select({ n: count() })
    .from(authTokens)
    .where(
      and(
        eq(authTokens.userId, userId),
        eq(authTokens.kind, kind),
        gt(authTokens.createdAt, new Date(Date.now() - 15 * 60 * 1000)),
      ),
    );
  return row?.n ?? 0;
}

const live = (token: string, kind: TokenKind) =>
  and(
    eq(authTokens.tokenHash, hashToken(token)),
    eq(authTokens.kind, kind),
    isNull(authTokens.usedAt),
    gt(authTokens.expiresAt, new Date()),
  );

/** Whether a token is still usable, without using it (to show the form or the expired state). */
export async function peekToken(token: string, kind: TokenKind) {
  if (!token) return null;
  const [row] = await db
    .select({ userId: authTokens.userId })
    .from(authTokens)
    .where(live(token, kind))
    .limit(1);
  return row?.userId ?? null;
}

/** Uses a token exactly once: the conditional update is atomic, so two clicks cannot both win. */
export async function consumeToken(token: string, kind: TokenKind) {
  if (!token) return null;
  const [row] = await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(live(token, kind))
    .returning({ userId: authTokens.userId });
  return row?.userId ?? null;
}

/** Absolute links for emails: APP_URL in production, else the host this request came to. */
export async function appUrl() {
  const configured = process.env.APP_URL ?? process.env.AUTH_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** A new user who owns a new workspace, written in one batch so a half-made account cannot exist. */
export async function createAccount(input: {
  name: string;
  email: string;
  passwordHash: string | null;
  workspaceName: string;
  locale: Locale;
  verified: boolean;
}) {
  const userId = randomUUID();
  const workspaceId = randomUUID();
  await db.batch([
    db.insert(workspaces).values({
      id: workspaceId,
      name: input.workspaceName,
      defaultLocale: input.locale,
      defaultDocumentLanguage: input.locale,
    }),
    db.insert(users).values({
      id: userId,
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash,
      locale: input.locale,
      emailVerifiedAt: input.verified ? new Date() : null,
    }),
    db.insert(memberships).values({ workspaceId, userId, role: "owner" }),
  ]);
  return { userId, workspaceId };
}

/** The link in the confirmation email: marks the address as confirmed. */
export async function confirmEmail(token: string) {
  const userId = await consumeToken(token, "verify_email");
  if (!userId) return false;
  await db
    .update(users)
    .set({ emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())` })
    .where(eq(users.id, userId));
  return true;
}
