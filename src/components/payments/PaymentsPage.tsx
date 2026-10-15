import { Suspense } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Wallet } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  getPayableInvoices,
  getPaymentClients,
  listPayments,
  parsePaymentFilters,
  PAYMENT_METHOD_CODES,
  PAYMENT_STATUSES,
  type PaymentFilters,
} from "@/db/queries/payments";
import { formatter, type Locale } from "@/lib/format";
import { getSession } from "@/lib/session";
import { patchQuery } from "@/components/clients/url";
import { hueOf, initials } from "@/components/shell/initials";
import { CardSkeleton, EmptyState } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WidgetError } from "@/components/ui/WidgetError";
import { PaymentRowMenu, PaymentsToolbar, RecordPaymentButton } from "./PaymentsClient";

type SP = Record<string, string | string[] | undefined>;
const toQuery = (sp: SP) =>
  new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
  );

/** DS › CRM patterns › Payments list: Date · Client · Invoice · Method · Reference · Amount · Status. */
export async function PaymentsPage({ searchParams }: { searchParams: SP }) {
  const session = await getSession();
  const t = await getTranslations("payments");
  const tn = await getTranslations("nav");
  const ts = await getTranslations("status.payment");
  const tm = await getTranslations("clients.method");
  const td = await getTranslations("dashboard");
  const filters = parsePaymentFilters(searchParams);
  const [payable, payClients] = await Promise.all([
    getPayableInvoices(session.workspaceId).catch(() => []),
    getPaymentClients(session.workspaceId).catch(() => []),
  ]);
  return (
    <>
      <header className="pagehead">
        <h1 className="t-page-title">{tn("payments")}</h1>
        <div className="actions">
          <RecordPaymentButton invoices={payable} />
        </div>
      </header>
      <div className="ax-table-wrap clients-frame">
        <PaymentsToolbar
          periods={[
            { value: "month", label: td("rangeMonth") },
            { value: "quarter", label: td("rangeQuarter") },
            { value: "year", label: td("rangeYear") },
          ]}
          statuses={PAYMENT_STATUSES.map((s) => ({ value: s, label: ts(s) }))}
          methods={PAYMENT_METHOD_CODES.map((m) => ({ value: m, label: tm(m) }))}
          clients={payClients.map((c) => ({ value: c.id, label: c.name }))}
          resultsLabel={t("showResults")}
        />
        <Suspense
          key={JSON.stringify(filters)}
          fallback={<CardSkeleton rows={6} label={tn("payments")} />}
        >
          <PaymentsTable filters={filters} searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

async function PaymentsTable({
  filters,
  searchParams,
}: {
  filters: PaymentFilters;
  searchParams: SP;
}) {
  const session = await getSession();
  const t = await getTranslations("payments");
  const tc = await getTranslations("common");
  const tm = await getTranslations("clients.method");
  const f = formatter((await getLocale()) as Locale);
  let rows: Awaited<ReturnType<typeof listPayments>>;
  try {
    rows = await listPayments(session.workspaceId, filters);
  } catch (err) {
    console.error("[payments]", err);
    return <WidgetError title={t("caption")} />;
  }
  const anyFilter = !!(
    filters.q ||
    filters.status ||
    filters.method ||
    filters.client ||
    filters.period
  );
  if (rows.length === 0)
    return (
      <div className="clients-empty">
        <EmptyState
          icon={Wallet}
          title={anyFilter ? t("noMatchTitle") : t("emptyTitle")}
          body={anyFilter ? t("noMatchBody") : t("emptyBody")}
        />
        {anyFilter && (
          <Link className="ax-btn ax-btn-secondary ax-btn-sm" href="/payments" scroll={false}>
            {tc("clearFilters")}
          </Link>
        )}
      </div>
    );

  const q = toQuery(searchParams);
  const explicit = typeof searchParams.sort === "string" && searchParams.sort === filters.sort;
  const sortHref = (key: string) => {
    if (!(explicit && filters.sort === key))
      return `/payments${patchQuery(q, { sort: key, dir: null })}`;
    if (filters.dir === "asc") return `/payments${patchQuery(q, { sort: key, dir: "desc" })}`;
    return `/payments${patchQuery(q, { sort: null, dir: null })}`;
  };
  const cols = [
    { key: "date", sortable: true, cls: "" },
    { key: "client", sortable: true, cls: "" },
    { key: "invoice", sortable: false, cls: "" },
    { key: "method", sortable: false, cls: "p3" },
    { key: "reference", sortable: false, cls: "p2" },
    { key: "amount", sortable: true, cls: "num" },
    { key: "status", sortable: false, cls: "" },
  ] as const;
  // Received money per currency (never summed across currencies).
  const received = new Map<string, number>();
  for (const r of rows)
    if (r.status === "received")
      received.set(r.currency, (received.get(r.currency) ?? 0) + r.amountMinor);

  return (
    <div className="table-scroll">
      <table className="ax-table clients-table payments-table">
        <caption className="sr-only">{t("caption")}</caption>
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
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={`${c.cls}${c.sortable ? " sortable" : ""}`}
                  aria-sort={ariaSort}
                >
                  {c.sortable ? (
                    <Link className="th-sort" href={sortHref(c.key)} scroll={false}>
                      {t(`col.${c.key}`)}
                      <span className="sort" aria-hidden>
                        <Icon className="ax-icon ax-icon-xs" />
                      </span>
                    </Link>
                  ) : (
                    t(`col.${c.key}`)
                  )}
                </th>
              );
            })}
            <th className="act">
              <span className="sr-only">{t("col.actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="c-date ax-num">{f.date(r.paidOn, "medium")}</td>
              <td className="c-client" data-label={t("col.client")}>
                <Link className="owner client-link" href={`/clients/${r.clientId}`}>
                  <span className="ax-avatar sm sq" data-hue={hueOf(r.clientId)} aria-hidden>
                    {initials(r.clientName)}
                  </span>
                  {r.clientName}
                </Link>
              </td>
              <td data-label={t("col.invoice")}>
                {r.invoiceId ? (
                  <Link className="ax-link ax-mono ax-ltr" href={`/invoices/${r.invoiceId}`}>
                    {r.invoiceNumber}
                  </Link>
                ) : (
                  <span className="ax-faint">—</span>
                )}
              </td>
              <td className="p3" data-label={t("col.method")}>
                {tm(r.method)}
              </td>
              <td className="p2" data-label={t("col.reference")}>
                {r.reference ? (
                  <span className="ax-mono ax-ltr">{r.reference}</span>
                ) : (
                  <span className="ax-faint">—</span>
                )}
              </td>
              <td className="num c-money" data-label={t("col.amount")}>
                <span className={`money${r.status === "received" ? "" : " is-muted"}`}>
                  {r.status === "refunded" ? "− " : ""}
                  {f.money(r.amountMinor, r.currency)}
                </span>
              </td>
              <td className="c-status" data-label={t("col.status")}>
                <StatusBadge domain="payment" code={r.status} />
              </td>
              <td className="act">
                <PaymentRowMenu
                  id={r.id}
                  status={r.status}
                  label={t("rowActions", {
                    reference: r.reference ?? r.invoiceNumber ?? f.date(r.paidOn),
                  })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ax-pager">
        <span>{t("count", { count: rows.length })}</span>
        <span className="ax-spacer" />
        <span className="doc-sum">
          {t("receivedTotal", {
            amounts:
              [...received].map(([c, m]) => f.money(m, c)).join(" · ") ||
              f.money(0, session.workspace.defaultCurrency),
          })}
        </span>
      </div>
    </div>
  );
}
