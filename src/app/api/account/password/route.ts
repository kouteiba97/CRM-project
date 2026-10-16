import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";
import { passwordSchema } from "@/lib/accounts";
import { audit } from "@/lib/audit";
import type { Locale } from "@/lib/format";
import { sendMail } from "@/lib/mail/send";
import { securityNoticeMail } from "@/lib/mail/templates";
import { bumpAndKeepCurrent } from "@/lib/session-change";
import { sameOrigin } from "@/lib/session-proof";
import { getSession } from "@/lib/session";

export type PasswordError = "current_wrong" | "too_short" | "same" | "no_password";

/** Settings › Account › Password: new password, other devices signed out, notice emailed. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false }, { status: 403 });
  const { user } = await getSession();
  const body = (await req.json().catch(() => ({}))) as { current?: unknown; next?: unknown; locale?: unknown };
  const current = String(body.current ?? "");
  const next = String(body.next ?? "");
  const fail = (error: PasswordError) => NextResponse.json({ ok: false, error });

  if (!user.passwordHash) return fail("no_password");
  if (!(await bcrypt.compare(current, user.passwordHash))) {
    await audit("auth.sign_in_failed", { actorId: user.id, meta: { context: "change_password" } });
    return fail("current_wrong");
  }
  if (!passwordSchema.safeParse(next).success) return fail("too_short");
  if (next === current) return fail("same");

  await bumpAndKeepCurrent(user.id, { passwordHash: await bcrypt.hash(next, 12) });
  await audit("auth.password_changed", { actorId: user.id });
  try {
    const locale = (["en", "fr", "ar"].includes(String(body.locale)) ? body.locale : await getLocale()) as Locale;
    await sendMail(await securityNoticeMail(user.email, user.name, locale, "password_changed"));
  } catch (error) {
    console.error("password notice failed", error);
  }
  return NextResponse.json({ ok: true });
}
