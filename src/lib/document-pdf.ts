import "server-only";
import { appUrl } from "@/lib/accounts";
import { printQuery } from "@/lib/doc-signature";
import type { DocumentKind } from "@/lib/documents";
import type { Locale } from "@/lib/format";
import { renderPdf } from "@/lib/pdf";

/** The PDF of one invoice or quotation, exactly as the app shows it (its own language). */
export async function documentPdf(workspaceId: string, kind: DocumentKind, id: string, language: Locale, number: string) {
  const url = `${await appUrl()}/${language}/print/${kind}/${id}?${printQuery(workspaceId, kind, id)}`;
  return { content: await renderPdf(url), filename: `${number}.pdf` };
}
