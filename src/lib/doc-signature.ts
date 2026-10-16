import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived signed links to the print view of one document, so the PDF renderer (which has
 * no session) can open exactly that page and nothing else.
 */
const sign = (payload: string) =>
  createHmac("sha256", process.env.AUTH_SECRET ?? "dev-secret").update(`print:${payload}`).digest("hex");

export function printQuery(workspaceId: string, kind: string, id: string, ttlMs = 5 * 60_000) {
  const exp = Date.now() + ttlMs;
  const sig = sign(`${workspaceId}:${kind}:${id}:${exp}`);
  return new URLSearchParams({ ws: workspaceId, exp: String(exp), sig }).toString();
}

export function verifyPrint(kind: string, id: string, q: { ws?: unknown; exp?: unknown; sig?: unknown }) {
  const ws = typeof q.ws === "string" ? q.ws : "";
  const exp = Number(q.exp);
  const sig = typeof q.sig === "string" ? q.sig : "";
  if (!ws || !Number.isFinite(exp) || exp < Date.now() || !sig) return null;
  const expected = Buffer.from(sign(`${ws}:${kind}:${id}:${exp}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return ws;
}
