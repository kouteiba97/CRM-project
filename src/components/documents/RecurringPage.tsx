import { ArrowLeft, Repeat } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/db/client";
import { clients, invoices, recurringInvoices } from "@/db/schema";
import { Link } from "@/i18n/navigation";
import { formatter, type Locale } from "@/lib/format";
import { getSession } from "@/lib/session";
import { EmptyState } from "@/components/ui/Card";
import { RecurringRowActions } from "./RecurringParts";

/** `/invoices/recurring`: every repeating invoice of the workspace, with pause / resume / delete. */
export async function RecurringPage() {
  const { workspaceId } = await getSession();
  const t = await getTranslations("documents.recurring");
  const tn = await getTranslations("nav");
  const f = formatter((await getLocale()) as Locale);
  const rows = await db
    .select({ r: recurringInvoices, client: clients.name, number: invoices.number, totalMinor: invoices.totalMinor, currency: invoices.currency })
    .from(recurringInvoices)
    .innerJoin(clients, eq(clients.id, recurringInvoices.clientId))
    .innerJoin(invoices, eq(invoices.id, recurringInvoices.sourceInvoiceId))
    .where(eq(recurringInvoices.workspaceId, workspaceId))
    .orderBy(asc(recurringInvoices.nextDate));

  return (
    <>
      <nav aria-label={t("back")} className="profile-back">
        <Link className="ax-link" href="/invoices">
          <ArrowLeft className="ax-icon ax-icon-sm ax-flip" aria-hidden />
          {tn("invoices")}
        </Link>
      </nav>
      <header className="pagehead">
        <h1 className="t-page-title">{t("pageTitle")}</h1>
      </header>
      {rows.length === 0 ? (
        <EmptyState icon={Repeat} title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <div className="ax-card table-scroll">
          <table className="ax-table data-table">
            <caption className="sr-only">{t("pageTitle")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("col_client")}</th>
                <th scope="col">{t("col_copy")}</th>
                <th scope="col">{t("col_every")}</th>
                <th scope="col">{t("col_next")}</th>
                <th scope="col">{t("col_send")}</th>
                <th scope="col">{t("col_runs")}</th>
                <th scope="col">
                  <span className="sr-only">{t("col_actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ r, client, number, totalMinor, currency }) => (
                <tr key={r.id} className={r.active ? undefined : "is-muted"}>
                  <td>{client}</td>
                  <td>
                    <Link className="ax-link ax-mono ax-ltr" href={`/invoices/${r.sourceInvoiceId}`}>
                      {number}
                    </Link>
                    <span className="ax-faint"> · {f.money(totalMinor, currency)}</span>
                  </td>
                  <td>{t(`every_${r.interval}`)}</td>
                  <td>
                    {r.active ? f.date(r.nextDate) : <span className="ax-badge">{t("pausedBadge")}</span>}
                    {r.endDate && <span className="ax-faint"> · {t("until", { date: f.date(r.endDate) })}</span>}
                  </td>
                  <td>{t(r.autoSend ? "sendAuto" : "sendDraft")}</td>
                  <td className="num">{f.number(r.runs)}</td>
                  <td className="act">
                    <RecurringRowActions id={r.id} active={r.active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
