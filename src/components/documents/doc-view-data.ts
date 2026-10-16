import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { getInvoice, getQuotation } from "@/db/queries/documents";
import { workspaces } from "@/db/schema";
import type { DocumentKind } from "@/lib/documents";
import { asLocale, fromParty, getDocLabels, linesAndTotals, toParty } from "./doc-data";
import type { DocData } from "./DocumentView";

/**
 * Everything DocumentView needs for one invoice or quotation, scoped to a workspace. Shared by
 * the record page, the print view (PDF) and the emails that attach the PDF.
 */
export async function loadDocView(workspaceId: string, kind: DocumentKind, id: string) {
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  if (!workspace) return null;
  const rec = kind === "invoice" ? await getInvoice(workspaceId, id) : await getQuotation(workspaceId, id);
  if (!rec) return null;
  const invoice = kind === "invoice" ? (rec as NonNullable<Awaited<ReturnType<typeof getInvoice>>>) : null;
  const quotation = kind === "quotation" ? (rec as NonNullable<Awaited<ReturnType<typeof getQuotation>>>) : null;
  const language = asLocale(rec.doc.language);
  const data: DocData = {
    kind,
    number: rec.doc.number,
    status: rec.status,
    issueDate: rec.doc.issueDate,
    endDate: invoice ? invoice.doc.dueDate : quotation!.doc.validUntil,
    currency: rec.doc.currency,
    from: fromParty(workspace),
    iban: workspace.iban,
    to: toParty(rec),
    project: rec.projectName,
    paidMinor: invoice?.paidMinor ?? 0,
    notes: rec.doc.notes,
    terms: rec.doc.terms,
    ...linesAndTotals(rec.lines, rec.doc.discountPct),
  };
  return { data, labels: await getDocLabels(language), language, rec, invoice, quotation, workspace };
}
