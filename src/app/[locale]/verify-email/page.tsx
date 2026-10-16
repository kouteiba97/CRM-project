import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { AuthCard, AuthNotice } from "@/components/auth/AuthCard";
import { Link } from "@/i18n/navigation";
import { confirmEmail } from "@/lib/accounts";

export async function generateMetadata({ params }: PageProps<"/[locale]/verify-email">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("verify_title"), referrer: "no-referrer", robots: { index: false } };
}

export default async function VerifyEmailPage({ params, searchParams }: PageProps<"/[locale]/verify-email">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  const raw = (await searchParams).token;
  const ok = typeof raw === "string" && (await confirmEmail(raw));
  const signedIn = Boolean((await auth())?.user);

  return (
    <AuthCard title={t("verify_title")}>
      <div className="login-form">
        <AuthNotice tone={ok ? "success" : "error"}>{t(ok ? "verify_ok" : "verify_failed")}</AuthNotice>
        <Link href={signedIn ? "/" : "/login"} className="ax-btn ax-btn-primary login-submit">
          {signedIn ? t("goToApp") : t("signIn")}
        </Link>
      </div>
    </AuthCard>
  );
}
