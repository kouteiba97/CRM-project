"use server";

import bcrypt from "bcryptjs";
import { and, count, eq, isNull, ne } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { signIn } from "@/auth";
import { db } from "@/db/client";
import { invites, memberships, users } from "@/db/schema";
import { appUrl, createInvitedUser, emailSchema, findUserByEmail, passwordSchema } from "@/lib/accounts";
import { audit } from "@/lib/audit";
import type { Locale } from "@/lib/format";
import { findInvite, newInviteToken } from "@/lib/invites";
import { sendMail } from "@/lib/mail/send";
import { inviteMail } from "@/lib/mail/templates";
import { notifyWorkspace } from "@/lib/notifications";
import { hit, LIMITS } from "@/lib/rate-limit";
import { ACTIVE_WORKSPACE_COOKIE, type Role } from "@/lib/roles";
import { getSession, requireRole } from "@/lib/session";

const roleSchema = z.enum(["owner", "admin", "member"]);
const locale = async () => (await getLocale()) as Locale;

async function setActive(workspaceId: string) {
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** Only owners hand out (or take away) ownership; admins manage admins and members. */
function mayAssign(actor: Role, role: Role) {
  return actor === "owner" || (actor === "admin" && role !== "owner");
}

async function ownerCount(workspaceId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(memberships)
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.role, "owner")));
  return row?.n ?? 0;
}

async function sendInvite(inviteId: string, email: string, token: string) {
  const session = await getSession();
  const lang = await locale();
  await sendMail(
    await inviteMail(
      email,
      lang,
      { inviter: session.user.name, workspace: session.workspace.name },
      `${await appUrl()}/${lang}/invite?token=${token}`,
    ),
  );
  return inviteId;
}

// ── Invitations ──────────────────────────────────────────────────────────────────────────
export type InviteResult = { ok: true } | { ok: false; error: "invalid" | "member" | "role" | "limit" | "mail" };

export async function inviteMember(rawEmail: string, rawRole: string): Promise<InviteResult> {
  const session = await requireRole("admin");
  const email = emailSchema.safeParse(rawEmail);
  const role = roleSchema.safeParse(rawRole);
  if (!email.success) return { ok: false, error: "invalid" };
  if (!role.success || !mayAssign(session.role, role.data)) return { ok: false, error: "role" };
  if ((await hit(`invite:${session.workspaceId}`, LIMITS.invitesPerWorkspace)) > LIMITS.invitesPerWorkspace.max) {
    return { ok: false, error: "limit" };
  }
  const existing = await findUserByEmail(email.data);
  if (existing) {
    const [m] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.workspaceId, session.workspaceId), eq(memberships.userId, existing.id)));
    if (m) return { ok: false, error: "member" };
  }
  // A new invitation to the same address replaces the previous one.
  await db
    .update(invites)
    .set({ revokedAt: new Date() })
    .where(and(eq(invites.workspaceId, session.workspaceId), eq(invites.email, email.data), isNull(invites.acceptedAt), isNull(invites.revokedAt)));
  const { token, tokenHash, expiresAt } = newInviteToken();
  const [row] = await db
    .insert(invites)
    .values({ workspaceId: session.workspaceId, email: email.data, role: role.data, tokenHash, expiresAt, invitedBy: session.userId })
    .returning({ id: invites.id });
  try {
    await sendInvite(row!.id, email.data, token);
  } catch (error) {
    console.error("invite email failed", error);
    await db.update(invites).set({ revokedAt: new Date() }).where(eq(invites.id, row!.id));
    return { ok: false, error: "mail" };
  }
  await audit("team.invited", { workspaceId: session.workspaceId, actorId: session.userId, meta: { email: email.data, role: role.data } });
  revalidatePath("/[locale]/settings", "page");
  return { ok: true };
}

/** Sends a fresh link (the old one stops working) and restarts the 7 days. */
export async function resendInvite(inviteId: string): Promise<InviteResult> {
  const session = await requireRole("admin");
  const [inv] = await db
    .select()
    .from(invites)
    .where(and(eq(invites.id, z.uuid().parse(inviteId)), eq(invites.workspaceId, session.workspaceId), isNull(invites.acceptedAt), isNull(invites.revokedAt)));
  if (!inv) return { ok: false, error: "invalid" };
  const { token, tokenHash, expiresAt } = newInviteToken();
  await db.update(invites).set({ tokenHash, expiresAt }).where(eq(invites.id, inv.id));
  try {
    await sendInvite(inv.id, inv.email, token);
  } catch (error) {
    console.error("invite email failed", error);
    return { ok: false, error: "mail" };
  }
  revalidatePath("/[locale]/settings", "page");
  return { ok: true };
}

export async function revokeInvite(inviteId: string) {
  const session = await requireRole("admin");
  await db
    .update(invites)
    .set({ revokedAt: new Date() })
    .where(and(eq(invites.id, z.uuid().parse(inviteId)), eq(invites.workspaceId, session.workspaceId)));
  await audit("team.invite_revoked", { workspaceId: session.workspaceId, actorId: session.userId, entityId: inviteId });
  revalidatePath("/[locale]/settings", "page");
  return { ok: true };
}

// ── Members ──────────────────────────────────────────────────────────────────────────────
export type MemberResult = { ok: true } | { ok: false; error: "forbidden" | "last_owner" | "self" };

export async function changeRole(userId: string, rawRole: string): Promise<MemberResult> {
  const session = await requireRole("admin");
  const role = roleSchema.parse(rawRole);
  const [target] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.workspaceId, session.workspaceId), eq(memberships.userId, z.uuid().parse(userId))));
  if (!target) return { ok: false, error: "forbidden" };
  if (!mayAssign(session.role, role) || !mayAssign(session.role, target.role)) return { ok: false, error: "forbidden" };
  if (target.role === "owner" && role !== "owner" && (await ownerCount(session.workspaceId)) <= 1) {
    return { ok: false, error: "last_owner" };
  }
  await db
    .update(memberships)
    .set({ role })
    .where(and(eq(memberships.workspaceId, session.workspaceId), eq(memberships.userId, userId)));
  await audit("team.role_changed", { workspaceId: session.workspaceId, actorId: session.userId, entityId: userId, meta: { from: target.role, to: role } });
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

export async function removeMember(userId: string): Promise<MemberResult> {
  const session = await requireRole("admin");
  const id = z.uuid().parse(userId);
  if (id === session.userId) return { ok: false, error: "self" };
  const [target] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.workspaceId, session.workspaceId), eq(memberships.userId, id)));
  if (!target || !mayAssign(session.role, target.role)) return { ok: false, error: "forbidden" };
  await db.delete(memberships).where(and(eq(memberships.workspaceId, session.workspaceId), eq(memberships.userId, id)));
  await audit("team.removed", { workspaceId: session.workspaceId, actorId: session.userId, entityId: id });
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

export async function leaveWorkspace(): Promise<MemberResult> {
  const session = await getSession();
  const [others] = await db
    .select({ n: count() })
    .from(memberships)
    .where(and(eq(memberships.workspaceId, session.workspaceId), ne(memberships.userId, session.userId)));
  // Your own workspace with nobody else in it is deleted with your account, not left.
  if (!others?.n) return { ok: false, error: "self" };
  if (session.role === "owner" && (await ownerCount(session.workspaceId)) <= 1) return { ok: false, error: "last_owner" };
  await db
    .delete(memberships)
    .where(and(eq(memberships.workspaceId, session.workspaceId), eq(memberships.userId, session.userId)));
  (await cookies()).delete(ACTIVE_WORKSPACE_COOKIE);
  await audit("team.left", { workspaceId: session.workspaceId, actorId: session.userId });
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

// ── Accepting ────────────────────────────────────────────────────────────────────────────
export type AcceptResult = { ok: true } | { ok: false; error: "expired" | "other_email" };

/** Signed in as the invited address: join and switch to the workspace. */
export async function acceptInvite(token: string): Promise<AcceptResult> {
  const session = await getSession();
  const found = await findInvite(token);
  if (!found) return { ok: false, error: "expired" };
  if (found.invite.email.toLowerCase() !== session.user.email.toLowerCase()) return { ok: false, error: "other_email" };
  await join(found.invite.id, found.invite.workspaceId, session.userId, found.invite.role);
  if (!session.user.emailVerifiedAt) {
    await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, session.userId));
  }
  return { ok: true };
}

async function join(inviteId: string, workspaceId: string, userId: string, role: Role) {
  await db.insert(memberships).values({ workspaceId, userId, role }).onConflictDoNothing();
  await db.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, inviteId));
  await setActive(workspaceId);
  await audit("team.joined", { workspaceId, actorId: userId, meta: { role } });
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  await notifyWorkspace(workspaceId, { kind: "member_joined", payload: { name: u?.name ?? "" }, exceptUserId: userId, minRole: "admin" });
}

export type InviteSignupState = { error: "name" | "password" | "taken" | "expired" | null; name: string };

/** No account yet: create one for the invited address (already verified) and join. */
export async function signupFromInvite(_prev: InviteSignupState, form: FormData): Promise<InviteSignupState> {
  const token = String(form.get("token") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!name || name.length > 100) return { error: "name", name };
  if (!passwordSchema.safeParse(password).success) return { error: "password", name };
  const found = await findInvite(token);
  if (!found) return { error: "expired", name };
  if (await findUserByEmail(found.invite.email)) return { error: "taken", name };
  const lang = await locale();
  const userId = await createInvitedUser({
    name,
    email: found.invite.email,
    passwordHash: await bcrypt.hash(password, 12),
    locale: lang,
    workspaceId: found.invite.workspaceId,
    role: found.invite.role,
  });
  await db.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, found.invite.id));
  await setActive(found.invite.workspaceId);
  await audit("account.created", { actorId: userId, meta: { method: "invite" } });
  await audit("team.joined", { workspaceId: found.invite.workspaceId, actorId: userId, meta: { role: found.invite.role } });
  await notifyWorkspace(found.invite.workspaceId, { kind: "member_joined", payload: { name }, exceptUserId: userId, minRole: "admin" });
  await signIn("credentials", { email: found.invite.email, password, redirectTo: `/${lang}` });
  return { error: null, name };
}
