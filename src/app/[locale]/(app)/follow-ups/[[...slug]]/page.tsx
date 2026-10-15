import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FollowUpsPage } from "@/components/followups/FollowUpsPage";

type Props = {
  params: Promise<{ locale: string; slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("followUps") };
}

/** `/follow-ups`: open follow-ups grouped by due; `?new=1` (optionally `&client=` / `&lead=`) plans one. */
export default async function Page({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  if (slug && slug.length > 0) notFound();
  return <FollowUpsPage searchParams={await searchParams} />;
}
