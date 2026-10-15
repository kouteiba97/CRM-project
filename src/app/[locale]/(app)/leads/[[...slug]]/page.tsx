import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LeadRecordPage, loadLeadForMeta } from "@/components/leads/LeadRecordPage";
import { LeadsPage } from "@/components/leads/LeadsPage";

type Props = {
  params: Promise<{ locale: string; slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  if (slug?.length === 1 && slug[0]) {
    const lead = await loadLeadForMeta(slug[0]);
    if (lead) return { title: `${lead.title} · ${t("leads")}` };
  }
  return { title: t("leads") };
}

/** `/leads` is the pipeline (board, or `?view=table`; `?new=1` drawer); `/leads/[id]` is the lead record. */
export default async function Page({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  if (!slug || slug.length === 0) return <LeadsPage searchParams={sp} />;
  if (slug.length === 1 && slug[0]) return <LeadRecordPage id={slug[0]} sp={sp} />;
  notFound();
}
