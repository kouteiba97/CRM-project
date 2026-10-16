import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { AuthCard, AuthNotice } from "@/components/auth/AuthCard";
import { AcceptInvite, InviteSignupForm, SignOutToAccept } from "@/components/auth/InviteForms";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { Link } from "@/i18n/navigation";
import { findUserByEmail } from "@/lib/accounts";
import { findInvite } from "@/lib/invites";

export async function generateMetadata({ params }: PageProps<"/[locale]/invite">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("invite_title"), referrer: "no-referrer", robots: { index: false } };
}

/**
 * The link in an invitation email. Signed in as the invited address: one click to join.
 * Signed in as someone else: sign out first. Signed out: sign in, or create the account.
 */
export default async function InvitePage({ params, searchParams }: PageProps<"/[locale]/invite">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  const raw = (await searchParams).token;
  const token = typeof raw === "string" ? raw : "";
  const found = await findInvite(token);

  if (!found) {
    return (
      <AuthCard title={t("invite_title")}>
        <div className="login-form">
          <AuthNotice tone="error">{t("invite_expired")}</AuthNotice>
          <Link href="/login" className="ax-btn ax-btn-primary login-submit">
            {t("signIn")}
          </Link>
        </div>
      </AuthCard>
    );
  }

  const { invite, workspace, inviter } = found;
  const lead = t("invite_lead", { inviter: inviter ?? "—", workspace, role: t(`invite_role_${invite.role}`) });
  const sessionUserId = (await auth())?.user?.id;
  const me = sessionUserId
    ? (await db.select({ email: users.email }).from(users).where(eq(users.id, sessionUserId)))[0]
    : undefined;

  if (me) {
    const same = me.email.toLowerCase() === invite.email.toLowerCase();
    return (
      <AuthCard title={t("invite_title")} lead={lead}>
        {same ? (
          <AcceptInvite token={token} workspace={workspace} />
        ) : (
          <div className="login-form">
            <AuthNotice tone="info">
              {t.rich("invite_other_email", {
                invited: invite.email,
                current: me.email,
                b: (c) => <b dir="ltr">{c}</b>,
              })}
            </AuthNotice>
            <SignOutToAccept />
          </div>
        )}
      </AuthCard>
    );
  }

  const hasAccount = Boolean(await findUserByEmail(invite.email));
  const back = `/${locale}/invite?token=${encodeURIComponent(token)}`;
  return (
    <AuthCard title={t("invite_title")} lead={lead}>
      {hasAccount ? (
        <div className="login-form">
          <AuthNotice tone="info">
            {t.rich("invite_sign_in", { email: invite.email, b: (c) => <b dir="ltr">{c}</b> })}
          </AuthNotice>
          <Link href={`/login?callbackUrl=${encodeURIComponent(back)}`} className="ax-btn ax-btn-primary login-submit">
            {t("signIn")}
          </Link>
        </div>
      ) : (
        <InviteSignupForm token={token} email={invite.email} />
      )}
    </AuthCard>
  );
}
