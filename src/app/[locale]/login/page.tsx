import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { googleEnabled } from "@/auth";
import { AuthCard, AuthNotice } from "@/components/auth/AuthCard";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { LoginForm } from "@/components/auth/LoginForm";
import { Link } from "@/i18n/navigation";
import { safeCallback } from "@/lib/auth-redirect";
import type { Locale } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("title") };
}

export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  const sp = await searchParams;
  const callback = safeCallback(sp.callbackUrl, locale as Locale);
  const callbackUrl = callback === `/${locale}` ? undefined : callback;
  // Auth.js sends failed Google sign-ins back here with ?error=…
  const notice = sp.error ? "error_google" : sp.deleted ? "notice_deleted" : sp.expired ? "notice_expired" : null;

  return (
    <AuthCard
      title={t("title")}
      lead={t("lead")}
      footer={t.rich("noAccount", {
        link: (c) => (
          <Link href="/signup" className="login-link">
            {c}
          </Link>
        ),
      })}
    >
      {notice && <AuthNotice tone={notice === "error_google" ? "error" : "info"}>{t(notice)}</AuthNotice>}
      {googleEnabled() && <GoogleButton callbackUrl={callbackUrl} />}
      <LoginForm callbackUrl={callbackUrl} />
    </AuthCard>
  );
}
