"use server";

import bcrypt from "bcryptjs";
import { and, count, eq, inArray, ne } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { signOut } from "@/auth";
import { db } from "@/db/client";
import { memberships, users, workspaces } from "@/db/schema";
import { appUrl, emailSchema, findUserByEmail, issueToken } from "@/lib/accounts";
import { audit } from "@/lib/audit";
import type { Locale } from "@/lib/format";
import { sendMail } from "@/lib/mail/send";
import { changeEmailMail, resetPasswordMail } from "@/lib/mail/templates";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/roles";
import { getSession } from "@/lib/session";

const locale = async () => (await getLocale()) as Locale;

// ── Password ─────────────────────────────────────────────────────────────────────────────
// Changing the password and signing out other devices live in route handlers
// (app/api/account/*): they rewrite the session cookie, which a Server Action would follow
// with a re-render that still sees the old cookie.

/** Accounts created with Google have no password: email a link to set one (proves the inbox). */
export async function sendSetPasswordLink(): Promise<{ ok: boolean }> {
  const { user } = await getSession();
  const lang = await locale();
  try {
    const token = await issueToken(user.id, "reset_password");
    await sendMail(await resetPasswordMail(user.email, user.name, lang, `${await appUrl()}/${lang}/reset-password?token=${token}`));
    return { ok: true };
  } catch (error) {
    console.error("set-password email failed", error);
    return { ok: false };
  }
}

// ── Email ────────────────────────────────────────────────────────────────────────────────
export type EmailResult =
  | { ok: true; email: string }
  | { ok: false; error: "invalid" | "taken" | "same" | "current_wrong" | "no_password" | "mail" };

/**
 * Starts an email change: the new address must click a link before anything changes, and the
 * current password is required so an unattended session cannot redirect the account.
 */
export async function requestEmailChange(nextEmail: string, password: string): Promise<EmailResult> {
  const { user } = await getSession();
  const parsed = emailSchema.safeParse(nextEmail);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const email = parsed.data;
  if (email === user.email.toLowerCase()) return { ok: false, error: "same" };
  if (!user.passwordHash) return { ok: false, error: "no_password" };
  if (!(await bcrypt.compare(String(password), user.passwordHash))) return { ok: false, error: "current_wrong" };
  if (await findUserByEmail(email)) return { ok: false, error: "taken" };
  const lang = await locale();
  try {
    const token = await issueToken(user.id, "change_email", { email });
    await sendMail(await changeEmailMail(email, user.name, lang, `${await appUrl()}/${lang}/confirm-email?token=${token}`));
  } catch (error) {
    console.error("change-email mail failed", error);
    return { ok: false, error: "mail" };
  }
  await audit("auth.email_change_requested", { actorId: user.id, meta: { to: email } });
  return { ok: true, email };
}

// ── Workspace switcher ───────────────────────────────────────────────────────────────────
export async function switchWorkspace(workspaceId: string) {
  const session = await getSession();
  if (!session.workspaces.some((w) => w.id === workspaceId)) throw new Error("Not a member");
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { ok: true };
}

// ── Delete account ───────────────────────────────────────────────────────────────────────
export type DeleteResult =
  | { ok: true }
  | { ok: false; error: "confirm" | "current_wrong" | "transfer_first"; workspace?: string };

/**
 * Deletes the account. Workspaces where the user is the only member are deleted with all their
 * data; a shared workspace must first get another owner, so it is never left without one.
 */
export async function deleteAccount(confirmEmail: string, password: string): Promise<DeleteResult> {
  const { user } = await getSession();
  if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) return { ok: false, error: "confirm" };
  if (user.passwordHash && !(await bcrypt.compare(String(password), user.passwordHash))) {
    return { ok: false, error: "current_wrong" };
  }
  const mine = await db
    .select({ workspaceId: memberships.workspaceId, role: memberships.role, name: workspaces.name })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(eq(memberships.userId, user.id));
  const soleMember: string[] = [];
  for (const m of mine) {
    const [others] = await db
      .select({ n: count() })
      .from(memberships)
      .where(and(eq(memberships.workspaceId, m.workspaceId), ne(memberships.userId, user.id)));
    if (!others?.n) {
      soleMember.push(m.workspaceId);
      continue;
    }
    if (m.role === "owner") {
      const [owners] = await db
        .select({ n: count() })
        .from(memberships)
        .where(
          and(
            eq(memberships.workspaceId, m.workspaceId),
            ne(memberships.userId, user.id),
            eq(memberships.role, "owner"),
          ),
        );
      if (!owners?.n) return { ok: false, error: "transfer_first", workspace: m.name };
    }
  }
  await audit("account.deleted", { actorId: null, meta: { userId: user.id, workspacesDeleted: soleMember.length } });
  if (soleMember.length) await db.delete(workspaces).where(inArray(workspaces.id, soleMember));
  await db.delete(users).where(eq(users.id, user.id));
  await signOut({ redirectTo: `/${await locale()}/login?deleted=1` });
  return { ok: true };
}
