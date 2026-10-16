import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/legal/LegalPage";
import { PRIVACY } from "@/content/legal";
import type { Locale } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  return { title: PRIVACY[locale as Locale].title };
}

export default async function Page({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage doc={PRIVACY[locale as Locale]} locale={locale as Locale} />;
}
