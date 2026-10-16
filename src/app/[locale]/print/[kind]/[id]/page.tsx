import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { loadDocView } from "@/components/documents/doc-view-data";
import { DocumentView } from "@/components/documents/DocumentView";
import { isUuid } from "@/db/queries/clients";
import { verifyPrint } from "@/lib/doc-signature";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * One document, nothing else: what the PDF renderer prints. No session here — access is a
 * short-lived signature for this exact workspace + document (lib/doc-signature.ts).
 */
export default async function PrintPage({ params, searchParams }: PageProps<"/[locale]/print/[kind]/[id]">) {
  const { locale, kind, id } = await params;
  setRequestLocale(locale);
  if ((kind !== "invoice" && kind !== "quotation") || !isUuid(id)) notFound();
  const ws = verifyPrint(kind, id, await searchParams);
  if (!ws) notFound();
  const view = await loadDocView(ws, kind, id);
  if (!view) notFound();
  return (
    <main className="print-page">
      <DocumentView data={view.data} labels={view.labels} language={view.language} />
    </main>
  );
}
