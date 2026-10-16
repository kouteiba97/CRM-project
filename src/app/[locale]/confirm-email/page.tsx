import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { AuthCard, AuthNotice } from "@/components/auth/AuthCard";
import { Link } from "@/i18n/navigation";
import { confirmEmailChange } from "@/lib/accounts";
import { audit } from "@/lib/audit";
import type { Locale } from "@/lib/format";
import { sendMail } from "@/lib/mail/send";
import { securityNoticeMail } from "@/lib/mail/templates";

export async function generateMetadata({ params }: PageProps<"/[locale]/confirm-email">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("change_title"), referrer: "no-referrer", robots: { index: false } };
}

/** The link sent to a new address: switches the account to it and warns the old inbox. */
export default async function ConfirmEmailPage({ params, searchParams }: PageProps<"/[locale]/confirm-email">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  const raw = (await searchParams).token;
  const result = typeof raw === "string" ? await confirmEmailChange(raw) : { ok: false as const, reason: "expired" as const };
  if (result.ok) {
    await audit("auth.email_changed", { actorId: result.user.id, meta: { from: result.oldEmail, to: result.newEmail } });
    try {
      await sendMail(
        await securityNoticeMail(result.oldEmail, result.user.name, locale as Locale, "email_changed", {
          email: result.newEmail,
        }),
      );
    } catch (error) {
      console.error("email-changed notice failed", error);
    }
  }
  const signedIn = Boolean((await auth())?.user);

  return (
    <AuthCard title={t("change_title")}>
      <div className="login-form">
        <AuthNotice tone={result.ok ? "success" : "error"}>
          {result.ok
            ? t.rich("change_ok", { email: result.newEmail, b: (c) => <b dir="ltr">{c}</b> })
            : t(result.reason === "taken" ? "change_taken" : "change_failed")}
        </AuthNotice>
        <Link href={signedIn ? "/settings?tab=account" : "/login"} className="ax-btn ax-btn-primary login-submit">
          {signedIn ? t("goToApp") : t("signIn")}
        </Link>
      </div>
    </AuthCard>
  );
}
