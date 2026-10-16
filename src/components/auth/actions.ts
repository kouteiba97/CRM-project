"use server";

import bcrypt from "bcryptjs";
import { and, eq, isNull, sql } from "drizzle-orm";
import { AuthError } from "next-auth";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { auth, clearFailures, signIn, signOut } from "@/auth";
import { audit } from "@/lib/audit";
import { clientIp, hit, LIMITS } from "@/lib/rate-limit";
import { db } from "@/db/client";
import { authTokens, users } from "@/db/schema";
import {
  appUrl,
  consumeToken,
  createAccount,
  emailSchema,
  findUserByEmail,
  issueToken,
  passwordSchema,
  RESET_LIMIT,
  recentTokens,
} from "@/lib/accounts";
import { safeCallback } from "@/lib/auth-redirect";
import type { Locale } from "@/lib/format";
import { sendMail } from "@/lib/mail/send";
import { resetPasswordMail, verifyEmailMail } from "@/lib/mail/templates";
import { getSession } from "@/lib/session";

const locale = async () => (await getLocale()) as Locale;
const str = (form: FormData, key: string) => String(form.get(key) ?? "");

/** Signs in with a password; Next's success redirect is thrown and must propagate. */
async function passwordSignIn(email: string, password: string, redirectTo: string, code?: string) {
  await signIn("credentials", { email, password, redirectTo, ...(code ? { code } : {}) });
}

// ── Sign in / out ─────────────────────────────────────────────────────────────────────────
export type LoginState = {
  error: "invalid" | "too_many" | "missing" | "2fa_invalid" | null;
  /** True once the password was right and the account wants a second step. */
  needsCode: boolean;
  email: string;
};

export async function login(prev: LoginState, form: FormData): Promise<LoginState> {
  const email = str(form, "email").trim();
  const password = str(form, "password");
  const code = str(form, "code").trim();
  if (!email || !password) return { error: "missing", needsCode: false, email };
  try {
    await passwordSignIn(email, password, safeCallback(form.get("callbackUrl"), await locale()), code || undefined);
    return { error: null, needsCode: false, email };
  } catch (error) {
    if (error instanceof AuthError) {
      const c = "code" in error ? String(error.code) : "";
      if (c === "2fa_required") return { error: null, needsCode: true, email };
      if (c === "2fa_invalid") return { error: "2fa_invalid", needsCode: true, email };
      return { error: c === "too_many" ? "too_many" : "invalid", needsCode: prev.needsCode && c === "too_many", email };
    }
    throw error;
  }
}

export async function googleSignIn(form: FormData) {
  await signIn("google", { redirectTo: safeCallback(form.get("callbackUrl"), await locale()) });
}

export async function logout() {
  const session = await auth();
  if (session?.user?.id) await audit("auth.sign_out", { actorId: session.user.id });
  await signOut({ redirectTo: `/${await locale()}/login` });
}

// ── Sign up ───────────────────────────────────────────────────────────────────────────────
type SignupField = "name" | "email" | "password" | "company";
export type SignupState = {
  errors: Partial<Record<SignupField, "required" | "invalid" | "too_short" | "taken">>;
  values: { name: string; email: string; company: string };
  failed?: boolean;
  limited?: boolean;
};

const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: emailSchema,
  password: passwordSchema,
  company: z.string().trim().max(120),
});

export async function signup(_prev: SignupState, form: FormData): Promise<SignupState> {
  const values = { name: str(form, "name").trim(), email: str(form, "email").trim(), company: str(form, "company").trim() };
  const password = str(form, "password");
  const errors: SignupState["errors"] = {};
  if (!values.name) errors.name = "required";
  if (!values.email) errors.email = "required";
  else if (!emailSchema.safeParse(values.email).success) errors.email = "invalid";
  if (!password) errors.password = "required";
  else if (password.length < 8) errors.password = "too_short";
  const parsed = signupSchema.safeParse({ ...values, password });
  if (Object.keys(errors).length || !parsed.success) return { errors: { ...errors }, values };

  const { name, email, company } = parsed.data;
  if (await findUserByEmail(email)) return { errors: { email: "taken" }, values };

  if ((await hit(`signup-ip:${await clientIp()}`, LIMITS.signupsPerIp)) > LIMITS.signupsPerIp.max) {
    return { errors: {}, values, limited: true };
  }
  const lang = await locale();
  let userId: string;
  try {
    ({ userId } = await createAccount({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      workspaceName: company || name,
      locale: lang,
      verified: false,
    }));
  } catch (error) {
    // Lost a race on the unique email with another sign-up.
    if (await findUserByEmail(email)) return { errors: { email: "taken" }, values };
    console.error("signup failed", error);
    return { errors: {}, values, failed: true };
  }
  await audit("account.created", { actorId: userId, meta: { method: "password" } });
  await sendVerification(userId, email, name, lang);
  await passwordSignIn(email, password, `/${lang}`);
  return { errors: {}, values };
}

async function sendVerification(userId: string, email: string, name: string, lang: Locale) {
  try {
    const token = await issueToken(userId, "verify_email");
    const url = `${await appUrl()}/${lang}/verify-email?token=${token}`;
    await sendMail(await verifyEmailMail(email, name, lang, url));
  } catch (error) {
    // The account works without confirmation; the banner offers to resend.
    console.error("verification email failed", error);
  }
}

/** "Resend the link" from the banner in the app. */
export async function resendVerification(): Promise<{ ok: boolean }> {
  const { user } = await getSession();
  if (user.emailVerifiedAt) return { ok: true };
  if ((await recentTokens(user.id, "verify_email")) >= RESET_LIMIT) return { ok: false };
  await sendVerification(user.id, user.email, user.name, await locale());
  return { ok: true };
}

// ── Forgot / reset password ──────────────────────────────────────────────────────────────
export type ForgotState = { sent: boolean; email: string; error: "invalid" | "mail" | null };

/**
 * Always answers "if an account exists, we sent a link" so the form cannot be used to find
 * out who has an account. At most RESET_LIMIT emails per account per 15 minutes.
 */
export async function forgotPassword(_prev: ForgotState, form: FormData): Promise<ForgotState> {
  const raw = str(form, "email").trim();
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) return { sent: false, email: raw, error: "invalid" };
  const email = parsed.data;
  const user = await findUserByEmail(email);
  // Over either limit, nothing is sent but the answer stays the same.
  const ipOk =
    (await hit(`reset-ip:${await clientIp()}`, LIMITS.resetEmailsPerIp)) <= LIMITS.resetEmailsPerIp.max;
  if (user && ipOk && (await recentTokens(user.id, "reset_password")) < RESET_LIMIT) {
    const lang = await locale();
    try {
      const token = await issueToken(user.id, "reset_password");
      const url = `${await appUrl()}/${lang}/reset-password?token=${token}`;
      await sendMail(await resetPasswordMail(user.email, user.name, lang, url));
    } catch (error) {
      console.error("reset email failed", error);
      return { sent: false, email: raw, error: "mail" };
    }
  }
  return { sent: true, email: raw, error: null };
}

export type ResetState = { error: "too_short" | "mismatch" | "expired" | null };

export async function resetPassword(_prev: ResetState, form: FormData): Promise<ResetState> {
  const password = str(form, "password");
  if (!passwordSchema.safeParse(password).success) return { error: "too_short" };
  if (password !== str(form, "confirm")) return { error: "mismatch" };

  const userId = await consumeToken(str(form, "token"), "reset_password");
  if (!userId) return { error: "expired" };
  const [user] = await db
    .update(users)
    .set({
      passwordHash: await bcrypt.hash(password, 12),
      // Signs out every other session, including whoever may have had the old password.
      sessionVersion: sql`${users.sessionVersion} + 1`,
      // Clicking the emailed link proves the address.
      emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())`,
    })
    .where(eq(users.id, userId))
    .returning({ email: users.email });
  if (!user) return { error: "expired" };
  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(authTokens.userId, userId), isNull(authTokens.usedAt)));
  await clearFailures(user.email);
  await audit("auth.password_reset", { actorId: userId });
  await passwordSignIn(user.email, password, `/${await locale()}`);
  return { error: null };
}
