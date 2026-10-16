"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { audit } from "@/lib/audit";
import type { Locale } from "@/lib/format";
import { sendMail } from "@/lib/mail/send";
import { securityNoticeMail } from "@/lib/mail/templates";
import { getSession } from "@/lib/session";
import { cleanCode, newRecoveryCodes, startSetup, redeemRecoveryCode, verifyTotp } from "@/lib/two-factor";

async function fresh(userId: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) throw new Error("User not found");
  return u;
}

async function notice(kind: "two_factor_on" | "two_factor_off") {
  const { user } = await getSession();
  try {
    await sendMail(await securityNoticeMail(user.email, user.name, (await getLocale()) as Locale, kind));
  } catch (error) {
    console.error("2fa notice failed", error);
  }
}

/** Step 1: a new secret (QR code + text) — nothing changes for sign-in yet. */
export async function beginTwoFactor() {
  const { user } = await getSession();
  if (user.totpEnabledAt) return { ok: false as const };
  return { ok: true as const, ...(await startSetup(user.id, user.email)) };
}

/** Step 2: the first code from the app turns it on and returns the one-time recovery codes. */
export async function confirmTwoFactor(code: string) {
  const { user } = await getSession();
  const u = await fresh(user.id);
  if (u.totpEnabledAt || !u.totpSecret) return { ok: false as const, error: "state" as const };
  if (!(await verifyTotp(u, cleanCode(code)))) return { ok: false as const, error: "code" as const };
  const { codes, hashes } = newRecoveryCodes();
  await db.update(users).set({ totpEnabledAt: new Date(), recoveryCodes: hashes }).where(eq(users.id, u.id));
  await audit("auth.2fa_enabled", { actorId: u.id });
  await notice("two_factor_on");
  revalidatePath("/[locale]/settings", "page");
  return { ok: true as const, codes };
}

export async function regenerateRecoveryCodes(code: string) {
  const { user } = await getSession();
  const u = await fresh(user.id);
  if (!u.totpEnabledAt || !(await verifyTotp(u, cleanCode(code)))) return { ok: false as const };
  const { codes, hashes } = newRecoveryCodes();
  await db.update(users).set({ recoveryCodes: hashes }).where(eq(users.id, u.id));
  return { ok: true as const, codes };
}

/** Turning it off needs the password (if any) and a code — a stolen session alone cannot. */
export async function disableTwoFactor(password: string, code: string) {
  const { user } = await getSession();
  const u = await fresh(user.id);
  if (!u.totpEnabledAt) return { ok: true as const };
  if (u.passwordHash && !(await bcrypt.compare(String(password), u.passwordHash))) {
    return { ok: false as const, error: "password" as const };
  }
  const clean = cleanCode(code);
  if (!(await verifyTotp(u, clean)) && !(await redeemRecoveryCode(u, clean))) return { ok: false as const, error: "code" as const };
  await db
    .update(users)
    .set({ totpSecret: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: [] })
    .where(eq(users.id, u.id));
  await audit("auth.2fa_disabled", { actorId: u.id });
  await notice("two_factor_off");
  revalidatePath("/[locale]/settings", "page");
  return { ok: true as const };
}
