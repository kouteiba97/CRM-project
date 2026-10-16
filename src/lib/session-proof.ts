import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Proof that the server itself moved this user to session version `sv`. Only a session
 * update carrying it may adopt the new version: Auth.js also accepts session updates from the
 * browser (POST /api/auth/session), and a device that was just signed out must not be able
 * to sign itself back in that way.
 */
export function sessionProof(userId: string, sv: number) {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "dev-secret").update(`sv:${userId}:${sv}`).digest("hex");
}

export function validProof(userId: string, sv: number, proof: unknown) {
  if (typeof proof !== "string") return false;
  const expected = Buffer.from(sessionProof(userId, sv));
  const given = Buffer.from(proof);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * Route handlers that change the session take JSON from our own pages only: cross-site forms
 * cannot send JSON without a CORS preflight, and the Origin must match the host.
 */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host && (req.headers.get("content-type") ?? "").includes("application/json");
  } catch {
    return false;
  }
}

/** Uploads (multipart) cannot be JSON: the Origin must still be this site. */
export function sameOriginForm(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
