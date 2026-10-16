import { Plus, ReceiptText } from "lucide-react";
import { and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/db/client";
import { clients, expenseCategory, expenses, projects } from "@/db/schema";
import { Link } from "@/i18n/navigation";
import { formatter, type Locale } from "@/lib/format";
import { getSession } from "@/lib/session";
import { EmptyState } from "@/components/ui/Card";
import { ExpenseDrawer, ExpensesToolbar } from "./ExpensesClient";

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
export const PERIODS = ["month", "last_month", "year", "all"] as const;

function periodRange(period: string, now: Date) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  if (period === "month") return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 1))] as const;
  if (period === "last_month") return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 1))] as const;
  if (period === "year") return [`${y}-01-01`, `${y + 1}-01-01`] as const;
  return null;
}

/** `/expenses`: money going out, by period and category, with totals per currency. */
export async function ExpensesPage({ searchParams }: { searchParams: SP }) {
  const session = await getSession();
  const t = await getTranslations("expenses");
  const f = formatter((await getLocale()) as Locale);
  const period = (PERIODS as readonly string[]).includes(str(searchParams.period) ?? "") ? str(searchParams.period)! : "month";
  const category = (expenseCategory.enumValues as readonly string[]).includes(str(searchParams.category) ?? "") ? str(searchParams.category) : undefined;
  const range = periodRange(period, new Date());
  const where = and(
    eq(expenses.workspaceId, session.workspaceId),
    isNull(expenses.archivedAt),
    range ? gte(expenses.spentOn, range[0]) : undefined,
    range ? lt(expenses.spentOn, range[1]) : undefined,
    category ? eq(expenses.category, category as (typeof expenseCategory.enumValues)[number]) : undefined,
  );
  const [rows, totals, projectOptions, clientOptions] = await Promise.all([
    db
      .select({ e: expenses, project: projects.name, client: clients.name })
      .from(expenses)
      .leftJoin(projects, eq(projects.id, expenses.projectId))
      .leftJoin(clients, eq(clients.id, expenses.clientId))
      .where(where)
      .orderBy(desc(expenses.spentOn), desc(expenses.createdAt))
      .limit(500),
    db
      .select({ currency: expenses.currency, total: sql<number>`sum(${expenses.amountMinor})::bigint` })
      .from(expenses)
      .where(where)
      .groupBy(expenses.currency),
    db
      .select({ value: projects.id, label: projects.name })
      .from(projects)
      .where(and(eq(projects.workspaceId, session.workspaceId), isNull(projects.archivedAt)))
      .orderBy(asc(projects.name)),
    db
      .select({ value: clients.id, label: clients.name })
      .from(clients)
      .where(and(eq(clients.workspaceId, session.workspaceId), isNull(clients.archivedAt)))
      .orderBy(asc(clients.name)),
  ]);
  const editId = str(searchParams.edit);
  const editing = editId ? rows.find((r) => r.e.id === editId)?.e : undefined;
  const openNew = str(searchParams.new) === "1";
  const keep = new URLSearchParams(Object.entries(searchParams).flatMap(([k, v]) => (typeof v === "string" && k !== "new" && k !== "edit" ? [[k, v]] : [])));
  const closeHref = `/expenses${keep.toString() ? `?${keep}` : ""}`;
  const withParam = (k: string, v: string) => {
    const q = new URLSearchParams(keep);
    q.set(k, v);
    return `/expenses?${q}`;
  };

  return (
    <>
      <header className="pagehead">
        <h1 className="t-page-title">{t("title")}</h1>
        <div className="actions">
          <Link className="ax-btn ax-btn-primary ax-btn-sm" href={withParam("new", "1")} scroll={false}>
            <Plus className="ax-icon" aria-hidden />
            {t("new")}
          </Link>
        </div>
      </header>
      <ExpensesToolbar period={period} category={category ?? ""} />
      <div className="expense-totals" aria-live="polite">
        {totals.length === 0 ? (
          <span className="ax-faint">{t("noneInPeriod")}</span>
        ) : (
          totals.map((x) => (
            <span key={x.currency} className="ax-kpi-inline">
              <span className="ax-faint">{t("total")}</span> <b>{f.money(Number(x.total), x.currency)}</b>
            </span>
          ))
        )}
      </div>
      {rows.length === 0 ? (
        <div className="ax-card">
          <EmptyState icon={ReceiptText} title={t("emptyTitle")} body={t("emptyBody")} />
        </div>
      ) : (
        <div className="ax-card table-scroll">
          <table className="ax-table data-table expenses-table">
            <caption className="sr-only">{t("title")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("col_date")}</th>
                <th scope="col">{t("col_what")}</th>
                <th scope="col">{t("col_category")}</th>
                <th scope="col">{t("col_for")}</th>
                <th scope="col" className="num">
                  {t("col_amount")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ e, project, client }) => (
                <tr key={e.id}>
                  <td className="ax-nowrap">{f.date(e.spentOn)}</td>
                  <td>
                    <Link className="row-open ax-link" href={withParam("edit", e.id)} scroll={false}>
                      {e.description}
                    </Link>
                    {e.vendor && <span className="ax-faint"> · {e.vendor}</span>}
                  </td>
                  <td>{t(`cat_${e.category}`)}</td>
                  <td>{project ?? client ?? <span className="ax-faint">—</span>}</td>
                  <td className="num">{f.money(e.amountMinor, e.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(openNew || editing) && (
        <ExpenseDrawer
          key={editing?.id ?? "new"}
          closeHref={closeHref}
          defaultCurrency={session.workspace.defaultCurrency}
          projects={projectOptions}
          clients={clientOptions}
          expense={
            editing
              ? {
                  id: editing.id,
                  spentOn: editing.spentOn,
                  category: editing.category,
                  vendor: editing.vendor ?? "",
                  description: editing.description,
                  amount: (editing.amountMinor / 100).toFixed(2),
                  currency: editing.currency,
                  projectId: editing.projectId ?? "",
                  clientId: editing.clientId ?? "",
                }
              : null
          }
        />
      )}
    </>
  );
}
