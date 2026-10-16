import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoginForm } from "@/components/auth/LoginForm";
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
  const raw = (await searchParams).callbackUrl;
  const callback = safeCallback(raw, locale as Locale);

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span className="ax-avatar md sq" data-hue="1" aria-hidden>
            A
          </span>
          <span className="login-brand-name">Apex CRM</span>
        </div>
        <h1 className="t-page-title">{t("title")}</h1>
        <p className="login-lead">{t("lead")}</p>
        <LoginForm callbackUrl={callback === `/${locale}` ? undefined : callback} />
      </div>
    </main>
  );
}
