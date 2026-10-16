import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { isoDay } from "./dashboard";

export const REPORT_RANGES = ["year", "12m", "quarter"] as const;
export type ReportRange = (typeof REPORT_RANGES)[number];

export function parseReportRange(v: unknown): ReportRange {
  return (REPORT_RANGES as readonly string[]).includes(String(v)) ? (v as ReportRange) : "year";
}

/** [start, end) of the range and its months (YYYY-MM-01), oldest first. */
export function reportBounds(range: ReportRange, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const first =
    range === "year" ? new Date(y, 0, 1) : range === "quarter" ? new Date(y, m - (m % 3), 1) : new Date(y, m - 11, 1);
  const end = new Date(y, m + 1, 1);
  const months: string[] = [];
  for (let d = new Date(first); d < end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(isoDay(d));
  return { start: isoDay(first), end: isoDay(end), months };
}

const num = (v: unknown) => Number(v ?? 0);

/**
 * Everything the Reports page shows for one range, in the workspace's main currency (other currencies are
 * never summed into it; they are reported as "also in …").
 */
export async function getReports(ws: string, currency: string, range: ReportRange, now = new Date()) {
  const { start, end, months } = reportBounds(range, now);

  const [kpi, series, aging, topClients, pipeline, lost, otherCurrencies, spent] = await Promise.all([
    db.execute<{ collected: string; invoiced: string; invoices: number; won: number; lost: number; won_value: string; avg_days: string | null }>(sql`
      select
        (select coalesce(sum(amount_minor), 0) from payments
          where workspace_id = ${ws} and archived_at is null and status = 'received' and currency = ${currency}
            and paid_on >= ${start} and paid_on < ${end}) as collected,
        (select coalesce(sum(total_minor), 0) from invoices
          where workspace_id = ${ws} and archived_at is null and state in ('sent', 'viewed') and currency = ${currency}
            and issue_date >= ${start} and issue_date < ${end}) as invoiced,
        (select count(*)::int from invoices
          where workspace_id = ${ws} and archived_at is null and state in ('sent', 'viewed')
            and issue_date >= ${start} and issue_date < ${end}) as invoices,
        (select count(*)::int from leads where workspace_id = ${ws} and archived_at is null and stage = 'won'
            and won_at >= ${start} and won_at < ${end}) as won,
        (select count(*)::int from leads where workspace_id = ${ws} and archived_at is null and stage = 'lost'
            and updated_at >= ${start} and updated_at < ${end}) as lost,
        (select coalesce(sum(value_minor) filter (where currency = ${currency}), 0) from leads
          where workspace_id = ${ws} and archived_at is null and stage = 'won' and won_at >= ${start} and won_at < ${end}) as won_value,
        (select avg(p.paid_on - i.issue_date)::numeric(10,1) from payments p join invoices i on i.id = p.invoice_id
          where p.workspace_id = ${ws} and p.archived_at is null and p.status = 'received'
            and p.paid_on >= ${start} and p.paid_on < ${end}) as avg_days`),
    db.execute<{ month: string; invoiced: string; collected: string }>(sql`
      with m as (select generate_series(${start}::date, (${end}::date - interval '1 month'), interval '1 month')::date as month),
      inv as (
        select date_trunc('month', issue_date)::date as month, sum(total_minor) as v from invoices
        where workspace_id = ${ws} and archived_at is null and state in ('sent', 'viewed') and currency = ${currency}
          and issue_date >= ${start} and issue_date < ${end} group by 1),
      col as (
        select date_trunc('month', paid_on)::date as month, sum(amount_minor) as v from payments
        where workspace_id = ${ws} and archived_at is null and status = 'received' and currency = ${currency}
          and paid_on >= ${start} and paid_on < ${end} group by 1)
      select to_char(m.month, 'YYYY-MM-DD') as month, coalesce(inv.v, 0) as invoiced, coalesce(col.v, 0) as collected
      from m left join inv on inv.month = m.month left join col on col.month = m.month order by m.month`),
    // Receivables aging: today's unpaid balances, whatever the range.
    db.execute<{ bucket: string; minor: string; n: number }>(sql`
      select case
          when b.days_overdue = 0 then 'current'
          when b.days_overdue <= 30 then 'd30'
          when b.days_overdue <= 60 then 'd60'
          when b.days_overdue <= 90 then 'd90'
          else 'd90plus' end as bucket,
        sum(b.balance_minor) as minor, count(*)::int as n
      from invoice_balances b join invoices i on i.id = b.invoice_id
      where b.workspace_id = ${ws} and i.currency = ${currency}
        and b.display_status in ('sent', 'viewed', 'partially_paid', 'overdue')
      group by 1`),
    db.execute<{ id: string; name: string; minor: string }>(sql`
      select c.id, c.name, sum(p.amount_minor) as minor
      from payments p join clients c on c.id = p.client_id
      where p.workspace_id = ${ws} and p.archived_at is null and p.status = 'received' and p.currency = ${currency}
        and p.paid_on >= ${start} and p.paid_on < ${end}
      group by c.id, c.name order by minor desc limit 8`),
    db.execute<{ stage: string; n: number; minor: string }>(sql`
      select stage::text as stage, count(*)::int as n,
        coalesce(sum(value_minor) filter (where currency = ${currency}), 0) as minor
      from leads where workspace_id = ${ws} and archived_at is null and stage not in ('won', 'lost')
      group by stage`),
    db.execute<{ reason: string; n: number }>(sql`
      select coalesce(lower(lost_reason), 'other') as reason, count(*)::int as n
      from leads where workspace_id = ${ws} and archived_at is null and stage = 'lost'
        and updated_at >= ${start} and updated_at < ${end}
      group by 1 order by n desc`),
    db.execute<{ currency: string; minor: string }>(sql`
      select currency, sum(amount_minor) as minor from payments
      where workspace_id = ${ws} and archived_at is null and status = 'received' and currency <> ${currency}
        and paid_on >= ${start} and paid_on < ${end}
      group by currency`),
    db.execute<{ category: string; minor: string }>(sql`
      select category::text, sum(amount_minor) as minor from expenses
      where workspace_id = ${ws} and archived_at is null and currency = ${currency}
        and spent_on >= ${start} and spent_on < ${end}
      group by category order by sum(amount_minor) desc`),
  ]);
  const expenseRows = spent.rows.map((r) => ({ category: r.category, minor: num(r.minor) }));
  const expensesMinor = expenseRows.reduce((a, r) => a + r.minor, 0);

  const k = kpi.rows[0]!;
  const closed = num(k.won) + num(k.lost);
  const agingOrder = ["current", "d30", "d60", "d90", "d90plus"] as const;
  return {
    range,
    start,
    end,
    months,
    kpis: {
      collectedMinor: num(k.collected),
      invoicedMinor: num(k.invoiced),
      invoices: num(k.invoices),
      won: num(k.won),
      lost: num(k.lost),
      winRate: closed > 0 ? num(k.won) / closed : null,
      wonValueMinor: num(k.won_value),
      avgDaysToPay: k.avg_days === null ? null : Number(k.avg_days),
    },
    series: series.rows.map((r) => ({ month: r.month, invoiced: num(r.invoiced), collected: num(r.collected) })),
    aging: agingOrder.map((bucket) => {
      const r = aging.rows.find((x) => x.bucket === bucket);
      return { bucket, minor: num(r?.minor), count: num(r?.n) };
    }),
    topClients: topClients.rows.map((r) => ({ id: r.id, name: r.name, minor: num(r.minor) })),
    pipeline: ["new", "contacted", "proposal_sent", "negotiation"].map((stage) => {
      const r = pipeline.rows.find((x) => x.stage === stage);
      return { stage, count: num(r?.n), minor: num(r?.minor) };
    }),
    lostReasons: lost.rows.map((r) => ({ reason: r.reason, count: num(r.n) })),
    otherCurrencies: otherCurrencies.rows.map((r) => ({ currency: r.currency, minor: num(r.minor) })),
    /** Money out in the same range and currency; profit = collected − expenses (cash basis). */
    expenses: { totalMinor: expensesMinor, byCategory: expenseRows, profitMinor: num(k.collected) - expensesMinor },
  };
}
export type Reports = Awaited<ReturnType<typeof getReports>>;
