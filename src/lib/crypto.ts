import "server-only";
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";

/**
 * Encryption for secrets stored in the database (TOTP secrets). Key: ENCRYPTION_KEY (32 bytes,
 * base64) — or, if unset, derived from AUTH_SECRET so development works out of the box.
 * Format: v1.<iv>.<tag>.<ciphertext>, all base64url, AES-256-GCM.
 */
function key() {
  const raw = process.env.ENCRYPTION_KEY;
  if (raw) {
    const k = Buffer.from(raw, "base64");
    if (k.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
    return k;
  }
  return Buffer.from(hkdfSync("sha256", process.env.AUTH_SECRET ?? "dev-secret", "apex-crm", "db-encryption", 32));
}

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decrypt(stored: string) {
  const [v, iv, tag, data] = stored.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unknown ciphertext format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
