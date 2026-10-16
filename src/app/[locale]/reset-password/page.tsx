import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard, AuthNotice } from "@/components/auth/AuthCard";
import { ResetForm } from "@/components/auth/ResetForm";
import { Link } from "@/i18n/navigation";
import { peekToken } from "@/lib/accounts";

export async function generateMetadata({ params }: PageProps<"/[locale]/reset-password">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  // The token is in the URL: never pass it on to other sites as a referrer.
  return { title: t("reset_title"), referrer: "no-referrer", robots: { index: false } };
}

export default async function ResetPasswordPage({ params, searchParams }: PageProps<"/[locale]/reset-password">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  const raw = (await searchParams).token;
  const token = typeof raw === "string" ? raw : "";
  // Checked without using it up, so link previews by mail scanners cannot burn the link.
  const valid = Boolean(await peekToken(token, "reset_password"));

  return (
    <AuthCard
      title={t("reset_title")}
      lead={valid ? t("reset_lead") : undefined}
      footer={
        <Link href="/login" className="login-link">
          {t("backToLogin")}
        </Link>
      }
    >
      {valid ? (
        <ResetForm token={token} />
      ) : (
        <div className="login-form">
          <AuthNotice tone="error">{t("reset_expired")}</AuthNotice>
          <Link href="/forgot-password" className="ax-btn ax-btn-primary login-submit">
            {t("reset_new_link")}
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
