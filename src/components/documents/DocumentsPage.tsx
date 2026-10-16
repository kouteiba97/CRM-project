import { Suspense } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, FileText, Plus, Receipt, Repeat } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  getDocumentClients,
  INVOICE_DISPLAY,
  listInvoices,
  listQuotations,
  parseDocFilters,
  QUOTATION_DISPLAY,
  type DocFilters,
} from "@/db/queries/documents";
import { due } from "@/lib/due";
import type { DocumentKind } from "@/lib/documents";
import { formatter, type Locale } from "@/lib/format";
import { getSession } from "@/lib/session";
import { patchQuery } from "@/components/clients/url";
import { hueOf, initials } from "@/components/shell/initials";
import { CardSkeleton, EmptyState } from "@/components/ui/Card";
import { DueLabel } from "@/components/ui/DueLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WidgetError } from "@/components/ui/WidgetError";
import { DocumentsToolbar } from "./DocumentsToolbar";

type SP = Record<string, string | string[] | undefined>;
const toQuery = (sp: SP) =>
  new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
  );
const base = (kind: DocumentKind) => (kind === "invoice" ? "/invoices" : "/quotations");

/** DS › Quotations & invoices list: Number (mono) · Client · Status · Issue date · Due/Valid until · Amount · Balance. */
export async function DocumentsPage({
  kind,
  searchParams,
}: {
  kind: DocumentKind;
  searchParams: SP;
}) {
  const session = await getSession();
  const t = await getTranslations("documents");
  const tr = await getTranslations("documents.recurring");
  const tn = await getTranslations("nav");
  const ts = await getTranslations("status");
  const filters = parseDocFilters(kind, searchParams);
  const docClients = await getDocumentClients(session.workspaceId, kind).catch(() => []);
  const statuses =
    kind === "invoice"
      ? [
          { value: "outstanding", label: t("statusOutstanding") },
          ...INVOICE_DISPLAY.map((s) => ({ value: s, label: ts(`invoice.${s}`) })),
        ]
      : QUOTATION_DISPLAY.map((s) => ({ value: s, label: ts(`quotation.${s}`) }));
  const title = kind === "invoice" ? tn("invoices") : tn("quotations");

  return (
    <>
      <header className="pagehead">
        <h1 className="t-page-title">{title}</h1>
        <div className="actions">
          {kind === "invoice" && (
            <Link className="ax-btn ax-btn-secondary ax-btn-sm" href="/invoices/recurring">
              <Repeat className="ax-icon" aria-hidden />
              {tr("pageTitle")}
            </Link>
          )}
          <Link className="ax-btn ax-btn-primary ax-btn-sm" href={`${base(kind)}/new`}>
            <Plus className="ax-icon" aria-hidden />
            {t(kind === "invoice" ? "newInvoice" : "newQuotation")}
            {kind === "invoice" && (
              <kbd className="ax-kbd" aria-hidden>
                I
              </kbd>
            )}
          </Link>
        </div>
      </header>
      <div className="ax-table-wrap clients-frame">
        <DocumentsToolbar
          basePath={base(kind)}
          statuses={statuses}
          clients={docClients.map((c) => ({ value: c.id, label: c.name }))}
          resultsLabel={t("showResults")}
        />
        <Suspense key={JSON.stringify(filters)} fallback={<CardSkeleton rows={6} label={title} />}>
          <DocumentsTable kind={kind} filters={filters} searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

async function DocumentsTable({
  kind,
  filters,
  searchParams,
}: {
  kind: DocumentKind;
  filters: DocFilters;
  searchParams: SP;
}) {
  const session = await getSession();
  const t = await getTranslations("documents");
  const tc = await getTranslations("common");
  const tp = await getTranslations("clients.profile");
  const f = formatter((await getLocale()) as Locale);
  const now = new Date();
  const path = base(kind);
  type Row = {
    id: string;
    number: string;
    clientId: string;
    clientName: string;
    status: string;
    daysOverdue: number;
    issueDate: string;
    endDate: string | null;
    totalMinor: number;
    balanceMinor: number | null;
    currency: string;
  };
  let rows: Row[];
  try {
    rows =
      kind === "invoice"
        ? (await listInvoices(session.workspaceId, filters)).map((r) => ({
            ...r,
            endDate: r.dueDate,
          }))
        : (await listQuotations(session.workspaceId, filters)).map((r) => ({
            ...r,
            endDate: r.validUntil,
            daysOverdue: 0,
            balanceMinor: null,
          }));
  } catch (err) {
    console.error("[documents]", err);
    return <WidgetError title={t(kind === "invoice" ? "invoicesCaption" : "quotationsCaption")} />;
  }
  const anyFilter = !!(filters.q || filters.status || filters.client || filters.project);
  if (rows.length === 0)
    return (
      <div className="clients-empty">
        <EmptyState
          icon={kind === "invoice" ? Receipt : FileText}
          title={
            anyFilter
              ? t("noMatchTitle")
              : t(kind === "invoice" ? "emptyInvoices" : "emptyQuotations")
          }
          body={anyFilter ? t("noMatchBody") : undefined}
        />
        {anyFilter && (
          <Link className="ax-btn ax-btn-secondary ax-btn-sm" href={path} scroll={false}>
            {tc("clearFilters")}
          </Link>
        )}
      </div>
    );

  const q = toQuery(searchParams);
  const explicit = typeof searchParams.sort === "string" && searchParams.sort === filters.sort;
  const sortHref = (key: string) => {
    if (!(explicit && filters.sort === key))
      return `${path}${patchQuery(q, { sort: key, dir: null })}`;
    if (filters.dir === "asc") return `${path}${patchQuery(q, { sort: key, dir: "desc" })}`;
    return `${path}${patchQuery(q, { sort: null, dir: null })}`;
  };
  const cols = [
    { key: "number", sortable: true, cls: "" },
    { key: "client", sortable: false, cls: "" },
    { key: "status", sortable: false, cls: "" },
    { key: "issue", sortable: true, cls: "p3" },
    { key: "due", sortable: true, cls: "" },
    { key: "amount", sortable: true, cls: "num" },
    ...(kind === "invoice" ? [{ key: "balance", sortable: true, cls: "num" }] : []),
  ];
  const overdueWords = (d: number) => tc("overdueDays", { days: d });
  const totals = new Map<string, number>();
  for (const r of rows)
    totals.set(r.currency, (totals.get(r.currency) ?? 0) + (r.balanceMinor ?? r.totalMinor));

  return (
    <div className="table-scroll">
      <table className="ax-table clients-table documents-table">
        <caption className="sr-only">
          {t(kind === "invoice" ? "invoicesCaption" : "quotationsCaption")}
        </caption>
        <thead>
          <tr>
            {cols.map((c) => {
              const ariaSort =
                filters.sort === c.key
                  ? filters.dir === "asc"
                    ? "ascending"
                    : "descending"
                  : undefined;
              const Icon =
                ariaSort === "ascending"
                  ? ArrowUp
                  : ariaSort === "descending"
                    ? ArrowDown
                    : ArrowUpDown;
              const label = t(
                `col.${c.key === "due" ? (kind === "invoice" ? "due" : "validUntil") : c.key}`,
              );
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={`${c.cls}${c.sortable ? " sortable" : ""}`}
                  aria-sort={ariaSort}
                >
                  {c.sortable ? (
                    <Link className="th-sort" href={sortHref(c.key)} scroll={false}>
                      {label}
                      <span className="sort" aria-hidden>
                        <Icon className="ax-icon ax-icon-xs" />
                      </span>
                    </Link>
                  ) : (
                    label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const open = ["sent", "viewed", "partially_paid"].includes(r.status);
            return (
              <tr key={r.id} className={r.status === "overdue" ? "is-overdue-row" : undefined}>
                <td className="c-number">
                  <Link className="row-open ax-mono ax-ltr doc-link" href={`${path}/${r.id}`}>
                    {r.number}
                  </Link>
                </td>
                <td className="c-client" data-label={t("col.client")}>
                  <span className="owner">
                    <span className="ax-avatar sm sq" data-hue={hueOf(r.clientId)} aria-hidden>
                      {initials(r.clientName)}
                    </span>
                    {r.clientName}
                  </span>
                </td>
                <td className="c-status" data-label={t("col.status")}>
                  <StatusBadge
                    domain={kind}
                    code={r.status}
                    suffix={
                      r.status === "overdue" ? tp("daysCount", { count: r.daysOverdue }) : undefined
                    }
                  />
                </td>
                <td className="p3" data-label={t("col.issue")}>
                  {f.date(r.issueDate, "medium")}
                </td>
                <td
                  className="c-next"
                  data-label={t(kind === "invoice" ? "col.due" : "col.validUntil")}
                >
                  {r.endDate ? (
                    open || (kind === "quotation" && r.status === "sent") ? (
                      <DueLabel due={due(r.endDate, f, overdueWords, { now })} />
                    ) : (
                      <span className="ax-muted">{f.date(r.endDate, "medium")}</span>
                    )
                  ) : (
                    <span className="ax-faint">—</span>
                  )}
                </td>
                <td className="num c-money" data-label={t("col.amount")}>
                  <span className={`money${r.status === "void" ? " is-void" : ""}`}>
                    {f.money(r.totalMinor, r.currency)}
                  </span>
                </td>
                {kind === "invoice" && (
                  <td className="num" data-label={t("col.balance")}>
                    <span className={`money${r.status === "overdue" ? " overdue" : ""}`}>
                      {r.status === "void" || r.status === "draft" ? (
                        <span className="ax-faint">—</span>
                      ) : (
                        f.money(r.balanceMinor ?? 0, r.currency)
                      )}
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="ax-pager">
        <span>{t("count", { count: rows.length })}</span>
        <span className="ax-spacer" />
        <span className="doc-sum">
          {t(kind === "invoice" ? "balanceTotal" : "amountTotal", {
            amounts: [...totals].map(([c, m]) => f.money(m, c)).join(" · "),
          })}
        </span>
      </div>
    </div>
  );
}
