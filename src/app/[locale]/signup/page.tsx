import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { googleEnabled } from "@/auth";
import { AuthCard } from "@/components/auth/AuthCard";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { SignupForm } from "@/components/auth/SignupForm";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: PageProps<"/[locale]/signup">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("signup_title") };
}

export default async function SignupPage({ params }: PageProps<"/[locale]/signup">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  return (
    <AuthCard
      title={t("signup_title")}
      lead={t("signup_lead")}
      footer={t.rich("haveAccount", {
        link: (c) => (
          <Link href="/login" className="login-link">
            {c}
          </Link>
        ),
      })}
    >
      {googleEnabled() && <GoogleButton />}
      <SignupForm />
    </AuthCard>
  );
}
