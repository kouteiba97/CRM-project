import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExpensesPage } from "@/components/expenses/ExpensesPage";

type Props = {
  params: Promise<{ locale: string; slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("expenses") };
}

/** `/expenses` (`?period=`, `?category=`, `?new=1`, `?edit=<id>`). */
export default async function Page({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  if (slug && slug.length > 0) notFound();
  return <ExpensesPage searchParams={await searchParams} />;
}
