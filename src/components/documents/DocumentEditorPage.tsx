import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { isUuid } from "@/db/queries/clients";
import {
  getEditorOptions,
  getInvoice,
  getLeadForQuotation,
  getMilestoneForInvoice,
  getQuotation,
} from "@/db/queries/documents";
import type { DocumentKind } from "@/lib/documents";
import { getSession } from "@/lib/session";
import { RecordCrumb } from "@/components/shell/Crumbs";
import { asLocale, fromParty, getAllDocLabels } from "./doc-data";
import { DocumentEditor, type EditorHeader } from "./DocumentEditor";
import type { LineDraft } from "./schema";

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};
const major = (minor: number) => (minor / 100).toFixed(2);

/**
 * Full-page editor. New documents can be prefilled: `?client=`, `?project=`, `?milestone=` (bills a
 * completed milestone: "Create invoice" on a project) or `?lead=` ("Create quotation" on a won lead).
 */
export async function DocumentEditorPage({
  kind,
  id,
  sp,
  locale,
}: {
  kind: DocumentKind;
  id: string | null;
  sp: SP;
  locale: string;
}) {
  const session = await getSession();
  const ws = session.workspaceId;
  const t = await getTranslations("documents.editor");
  const tn = await getTranslations("nav");
  const [options, labels] = await Promise.all([getEditorOptions(ws), getAllDocLabels()]);
  const base = kind === "invoice" ? "/invoices" : "/quotations";
  const wsLang = asLocale(session.workspace.defaultDocumentLanguage);

  let header: EditorHeader;
  let lines: LineDraft[] = [];
  let number: string | null = null;

  if (id) {
    if (!isUuid(id)) notFound();
    const rec = kind === "invoice" ? await getInvoice(ws, id) : await getQuotation(ws, id);
    if (!rec) notFound();
    const isDraft =
      kind === "invoice"
        ? (rec.doc as { state: string }).state === "draft"
        : (rec.doc as { status: string }).status === "draft";
    if (!isDraft) redirect({ href: `${base}/${id}`, locale });
    number = rec.doc.number;
    header = {
      clientId: rec.doc.clientId,
      projectId: rec.doc.projectId ?? "",
      issueDate: rec.doc.issueDate,
      endDate:
        (kind === "invoice"
          ? (rec.doc as { dueDate: string }).dueDate
          : (rec.doc as { validUntil: string | null }).validUntil) ?? "",
      currency: rec.doc.currency,
      language: asLocale(rec.doc.language),
      discountPct: rec.doc.discountPct ? String(Number(rec.doc.discountPct)) : "0",
      notes: rec.doc.notes ?? "",
      terms: rec.doc.terms ?? "",
      milestoneId: "",
      leadId: kind === "quotation" ? ((rec.doc as { leadId: string | null }).leadId ?? "") : "",
    };
    lines = rec.lines.map((l, i) => ({
      key: `s${i}`,
      title: l.title,
      detail: l.detail ?? "",
      quantity: String(Number(l.quantity)),
      unit: l.unit ?? "",
      unitPrice: major(l.unitPriceMinor),
      taxRate: String(Number(l.taxRate)),
    }));
  } else {
    const client = options.clients.find((c) => c.id === str(sp.client));
    header = {
      clientId: client?.id ?? "",
      projectId: "",
      issueDate: iso(new Date()),
      endDate: plusDays(30),
      currency: client?.currency ?? session.workspace.defaultCurrency,
      language: asLocale(client?.language, wsLang),
      discountPct: "0",
      notes: "",
      terms: "",
      milestoneId: "",
      leadId: "",
    };
    const projectId = str(sp.project);
    const project = options.projects.find((p) => p.id === projectId);
    if (project) {
      const c = options.clients.find((x) => x.id === project.clientId);
      header = {
        ...header,
        clientId: project.clientId,
        projectId: project.id,
        currency: c?.currency ?? header.currency,
        language: asLocale(c?.language, wsLang),
      };
    }
    const milestoneId = str(sp.milestone);
    if (kind === "invoice" && milestoneId && isUuid(milestoneId)) {
      const m = await getMilestoneForInvoice(ws, milestoneId);
      if (m && !m.invoiceId) {
        const c = options.clients.find((x) => x.id === m.clientId);
        header = {
          ...header,
          clientId: m.clientId,
          projectId: m.projectId,
          currency: m.currency,
          language: asLocale(c?.language, wsLang),
          milestoneId: m.id,
        };
        lines = [
          {
            key: "s0",
            title: m.title,
            detail: m.projectName,
            quantity: "1",
            unit: "",
            unitPrice: m.amountMinor ? major(m.amountMinor) : "",
            taxRate: "0",
          },
        ];
      }
    }
    const leadId = str(sp.lead);
    if (kind === "quotation" && leadId && isUuid(leadId)) {
      const l = await getLeadForQuotation(ws, leadId);
      if (l) {
        const c = options.clients.find((x) => x.id === l.clientId);
        header = {
          ...header,
          clientId: l.clientId ?? "",
          currency: l.currency,
          language: asLocale(c?.language, wsLang),
          leadId: l.id,
        };
        lines = [
          {
            key: "s0",
            title: l.title,
            detail: "",
            quantity: "1",
            unit: "",
            unitPrice: l.valueMinor ? major(l.valueMinor) : "",
            taxRate: "0",
          },
        ];
      }
    }
  }

  const title = id
    ? t(kind === "invoice" ? "editInvoice" : "editQuotation", { number: number ?? "" })
    : t(kind === "invoice" ? "newInvoice" : "newQuotation");
  return (
    <>
      <RecordCrumb label={number ?? t("newCrumb")} />
      <nav aria-label={t("back")} className="profile-back">
        <Link className="ax-link" href={id ? `${base}/${id}` : base}>
          <ArrowLeft className="ax-icon ax-icon-sm ax-flip" aria-hidden />
          {id ? number : tn(kind === "invoice" ? "invoices" : "quotations")}
        </Link>
      </nav>
      <header className="pagehead">
        <h1 className="t-page-title">{title}</h1>
      </header>
      <DocumentEditor
        kind={kind}
        docId={id}
        number={number}
        initial={header}
        initialLines={lines}
        clients={options.clients}
        projects={options.projects}
        labels={labels}
        from={fromParty(session.workspace)}
        iban={session.workspace.iban}
        cancelHref={id ? `${base}/${id}` : base}
      />
    </>
  );
}
