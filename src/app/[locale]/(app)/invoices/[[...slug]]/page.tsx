import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { DocumentEditorPage } from "@/components/documents/DocumentEditorPage";
import { DocumentRecordPage, loadDocumentForMeta } from "@/components/documents/DocumentRecordPage";
import { DocumentsPage } from "@/components/documents/DocumentsPage";

type Props = {
  params: Promise<{ locale: string; slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const NAV = "invoices";

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  if (slug?.[0] && slug[0] !== "new") {
    const doc = await loadDocumentForMeta("invoice", slug[0]);
    if (doc) return { title: `${doc.number} · ${t(NAV)}` };
  }
  return { title: t(NAV) };
}

/**
 * `/invoices` list · `/invoices/new` editor (`?new=1` on the list redirects there, keeping prefills)
 * · `/invoices/[id]` record · `/invoices/[id]/edit` editor (drafts only).
 */
export default async function Page({ params, searchParams }: Props) {
  const { locale, slug = [] } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  if (slug.length === 0) {
    if (sp.new === "1") {
      const q = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" && k !== "new" ? [[k, v]] : [])));
      redirect({ href: `/invoices/new${q.toString() ? `?${q}` : ""}`, locale });
    }
    return <DocumentsPage kind="invoice" searchParams={sp} />;
  }
  if (slug.length === 1 && slug[0] === "new") return <DocumentEditorPage kind="invoice" id={null} sp={sp} locale={locale} />;
  if (slug.length === 1 && slug[0]) return <DocumentRecordPage kind="invoice" id={slug[0]} />;
  if (slug.length === 2 && slug[0] && slug[1] === "edit") return <DocumentEditorPage kind="invoice" id={slug[0]} sp={sp} locale={locale} />;
  notFound();
}
