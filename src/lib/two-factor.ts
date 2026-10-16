import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { Secret, TOTP } from "otpauth";
import QRCode from "qrcode";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { decrypt, encrypt, sha256 } from "@/lib/crypto";

const PERIOD = 30;

function totp(secretBase32: string, label: string) {
  return new TOTP({ issuer: "Apex CRM", label, algorithm: "SHA1", digits: 6, period: PERIOD, secret: Secret.fromBase32(secretBase32) });
}

/** A new secret for setup: stored encrypted, not active until a first code proves the app has it. */
export async function startSetup(userId: string, email: string) {
  const secret = new Secret({ size: 20 }).base32;
  await db.update(users).set({ totpSecret: encrypt(secret), totpEnabledAt: null }).where(eq(users.id, userId));
  const uri = totp(secret, email).toString();
  const svg = await QRCode.toString(uri, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  // Grouped in fours so it can be typed into an app by hand.
  return { svg, secret: secret.replace(/(.{4})/g, "$1 ").trim() };
}

/** Normalises "123 456" / "123-456" to "123456"; recovery codes keep their letters. */
export const cleanCode = (code: string) => code.replace(/[\s-]/g, "").toLowerCase();

/**
 * Checks a 6-digit code (±1 step for clock drift) and refuses one already used, so a code
 * seen over someone's shoulder cannot be replayed within its 30 seconds.
 */
export async function verifyTotp(user: { id: string; email: string; totpSecret: string | null; totpLastStep: number | null }, code: string) {
  if (!user.totpSecret || !/^\d{6}$/.test(code)) return false;
  const delta = totp(decrypt(user.totpSecret), user.email).validate({ token: code, window: 1 });
  if (delta === null) return false;
  const step = Math.floor(Date.now() / 1000 / PERIOD) + delta;
  if (user.totpLastStep !== null && step <= user.totpLastStep) return false;
  await db.update(users).set({ totpLastStep: step }).where(eq(users.id, user.id));
  return true;
}

/** Ten one-time recovery codes like "k7rp-4xq2"; only their hashes are stored. */
export function newRecoveryCodes() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const codes = Array.from({ length: 10 }, () => {
    const b = randomBytes(8);
    const s = Array.from(b, (x) => alphabet[x % alphabet.length]).join("");
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
  return { codes, hashes: codes.map((c) => sha256(cleanCode(c))) };
}

/** Uses up a recovery code if it is one of the user's unused ones. */
export async function redeemRecoveryCode(user: { id: string; recoveryCodes: string[] }, code: string) {
  const hash = sha256(cleanCode(code));
  if (!user.recoveryCodes.includes(hash)) return false;
  await db
    .update(users)
    .set({ recoveryCodes: user.recoveryCodes.filter((h) => h !== hash) })
    .where(eq(users.id, user.id));
  return true;
}
