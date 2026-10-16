import {
  ReceiptText,
  Banknote,
  ChartColumn,
  CircleAlert,
  Clock,
  Hourglass,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getReports, parseReportRange, REPORT_RANGES, type Reports } from "@/db/queries/reports";
import { formatter, type Formatter, type Locale } from "@/lib/format";
import { getSession } from "@/lib/session";
import { RevenueCard, type RevenuePoint } from "@/components/dashboard/RevenueChart";
import { niceScale } from "@/components/dashboard/widgets";
import { Card, EmptyState } from "@/components/ui/Card";
import { WidgetError } from "@/components/ui/WidgetError";

type SP = Record<string, string | string[] | undefined>;

/**
 * Reports: KPI strip (Collected · Invoiced · Win rate · Days to pay) → Invoiced vs collected per month →
 * Receivables aging · Top clients · Pipeline and loss reasons. Every bar links to the matching list
 * (DS › Data visualization: charts are actionable and have a table alternative).
 */
export async function ReportsPage({ searchParams }: { searchParams: SP }) {
  const session = await getSession();
  const t = await getTranslations("reports");
  const tn = await getTranslations("nav");
  const f = formatter((await getLocale()) as Locale);
  const range = parseReportRange(searchParams.range);
  const currency = session.workspace.defaultCurrency;
  let data: Reports | null = null;
  try {
    data = await getReports(session.workspaceId, currency, range);
  } catch (err) {
    console.error("[reports]", err);
  }

  return (
    <>
      <header className="pagehead">
        <h1 className="t-page-title">{tn("reports")}</h1>
        {data && (
          <span className="meta">
            {f.date(data.start, "medium")} –{" "}
            {f.date(new Date(new Date(`${data.end}T12:00:00`).getTime() - 86_400_000), "medium")}
          </span>
        )}
        <div className="actions">
          <nav className="ax-segmented" aria-label={t("range")}>
            {REPORT_RANGES.map((r) => (
              <Link
                key={r}
                href={r === "year" ? "/reports" : `/reports?range=${r}`}
                aria-current={range === r ? "true" : undefined}
                scroll={false}
              >
                {t(`range_${r}`)}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {data ? (
        <ReportsBody data={data} f={f} currency={currency} />
      ) : (
        <WidgetError title={tn("reports")} />
      )}
    </>
  );
}

async function ReportsBody({
  data,
  f,
  currency,
}: {
  data: Reports;
  f: Formatter;
  currency: string;
}) {
  const t = await getTranslations("reports");
  const tl = await getTranslations("status.lead");
  const tr = await getTranslations("leads.reason");
  const te = await getTranslations("expenses");
  const td = await getTranslations("dashboard");
  const k = data.kpis;
  const others = data.otherCurrencies
    .map((o) => f.money(o.minor, o.currency, { whole: true }))
    .join(" · ");

  const points: RevenuePoint[] = data.series.map((p) => ({
    month: p.month,
    short: f.date(p.month, "month"),
    long: f.date(p.month, "monthYear"),
    invoiced: p.invoiced / 100,
    collected: p.collected / 100,
    invoicedText: f.money(p.invoiced, currency),
    collectedText: f.money(p.collected, currency),
  }));
  const { top, step } = niceScale(Math.max(0, ...points.flatMap((p) => [p.invoiced, p.collected])));
  const ticks =
    step > 0
      ? Array.from({ length: Math.round(top / step) + 1 }, (_, i) => ({
          value: i * step,
          label: f.compact(i * step),
        }))
      : [];

  const agingMax = Math.max(1, ...data.aging.map((a) => a.minor));
  const clientsTotal = data.topClients.reduce((a, c) => a + c.minor, 0);
  const clientMax = Math.max(1, ...data.topClients.map((c) => c.minor));
  const pipeMax = Math.max(1, ...data.pipeline.map((s) => s.minor));
  const lostTotal = data.lostReasons.reduce((a, r) => a + r.count, 0);

  const tiles = [
    {
      key: "collected",
      icon: Banknote,
      tint: "green",
      label: t("kpiCollected"),
      value: f.money(k.collectedMinor, currency, { whole: true }),
      title: f.money(k.collectedMinor, currency),
      sub: others ? t("alsoIn", { amounts: others }) : t("receivedPayments"),
      href: "/payments?status=received",
    },
    {
      key: "invoiced",
      icon: Hourglass,
      tint: "blue",
      label: t("kpiInvoiced"),
      value: f.money(k.invoicedMinor, currency, { whole: true }),
      title: f.money(k.invoicedMinor, currency),
      sub: t("invoicesCount", { count: k.invoices }),
      href: "/invoices",
    },
    {
      key: "win",
      icon: Trophy,
      tint: "violet",
      label: t("kpiWinRate"),
      value: k.winRate === null ? "—" : f.percent(k.winRate),
      title: undefined,
      sub: t("wonLost", {
        won: k.won,
        lost: k.lost,
        value: f.money(k.wonValueMinor, currency, { whole: true }),
      }),
      href: "/leads?view=table&stage=won",
    },
    {
      key: "days",
      icon: Clock,
      tint: "orange",
      label: t("kpiDaysToPay"),
      value: k.avgDaysToPay === null ? "—" : t("days", { count: Math.round(k.avgDaysToPay) }),
      title: undefined,
      sub: t("daysToPayHint"),
      href: "/payments",
    },
  ];

  return (
    <>
      <section className="dash-kpis" aria-label={t("kpis")}>
        {tiles.map((tile) => (
          <Link key={tile.key} href={tile.href} className="ax-kpi kpi">
            <span className={`ax-icon-tile ${tile.tint}`} aria-hidden>
              <tile.icon className="ax-icon" />
            </span>
            <span className="lbl">{tile.label}</span>
            <span className="val" title={tile.title}>
              {tile.value}
            </span>
            <span className="sub">{tile.sub}</span>
          </Link>
        ))}
      </section>

      <div className="dash-grid reports-grid">
        <div className="span-8">
          <RevenueCard
            points={points}
            ticks={ticks}
            max={top}
            title={td("revenueTitle", { currency })}
            ariaLabel={t("revenueAria", { currency })}
            sub={t(`range_${data.range}`)}
          />
        </div>

        <Card
          id="rep-aging"
          title={t("agingTitle", { currency })}
          sub={t("agingSub")}
          icon={CircleAlert}
          tint="danger"
          href="/invoices?status=unpaid"
          linkLabel={t("viewInvoices")}
          className="span-4"
        >
          <div className="card-body">
            {data.aging.every((a) => a.count === 0) ? (
              <EmptyState icon={CircleAlert} title={t("agingEmpty")} />
            ) : (
              <ul className="hbars" aria-label={t("agingTitle", { currency })}>
                {data.aging.map((a) => (
                  <li key={a.bucket}>
                    <Link
                      className="hbar-link"
                      href={
                        a.bucket === "current"
                          ? "/invoices?status=outstanding"
                          : "/invoices?status=overdue&sort=due"
                      }
                    >
                      <span className="hbar-head">
                        <span className="lbl">{t(`aging_${a.bucket}`)}</span>
                        <span className="n">{t("invoicesCount", { count: a.count })}</span>
                        <span className="v" title={f.money(a.minor, currency)}>
                          {f.money(a.minor, currency, { whole: true })}
                        </span>
                      </span>
                      <span
                        className={`hbar-track${a.bucket === "current" ? "" : " is-late"}`}
                        aria-hidden
                      >
                        <span style={{ width: `${(a.minor / agingMax) * 100}%` }} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card
          id="rep-clients"
          title={t("clientsTitle", { currency })}
          sub={t("clientsSub")}
          icon={Users}
          tint="blue"
          className="span-6"
        >
          <div className="card-body">
            {data.topClients.length === 0 ? (
              <EmptyState icon={Users} title={t("clientsEmpty")} />
            ) : (
              <ul className="hbars" aria-label={t("clientsTitle", { currency })}>
                {data.topClients.map((c) => (
                  <li key={c.id}>
                    <Link className="hbar-link" href={`/clients/${c.id}?tab=payments`}>
                      <span className="hbar-head">
                        <span className="lbl">{c.name}</span>
                        <span className="n">
                          {f.percent(clientsTotal ? c.minor / clientsTotal : 0)}
                        </span>
                        <span className="v" title={f.money(c.minor, currency)}>
                          {f.money(c.minor, currency, { whole: true })}
                        </span>
                      </span>
                      <span className="hbar-track" aria-hidden>
                        <span style={{ width: `${(c.minor / clientMax) * 100}%` }} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card
          id="rep-pipeline"
          title={t("pipelineTitle", { currency })}
          icon={Target}
          href="/leads"
          linkLabel={t("viewLeads")}
          className="span-6"
        >
          <div className="card-body reports-pipeline">
            <ul className="hbars" aria-label={t("pipelineTitle", { currency })}>
              {data.pipeline.map((s) => (
                <li key={s.stage}>
                  <Link className="hbar-link" href={`/leads?view=table&stage=${s.stage}`}>
                    <span className="hbar-head">
                      <span className="lbl">{tl(s.stage as never)}</span>
                      <span className="n">{td("leadsCount", { count: s.count })}</span>
                      <span className="v" title={f.money(s.minor, currency)}>
                        {f.money(s.minor, currency, { whole: true })}
                      </span>
                    </span>
                    <span className="hbar-track" aria-hidden>
                      <span style={{ width: `${(s.minor / pipeMax) * 100}%` }} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="lost-reasons">
              <h3 className="rail-title">
                <ChartColumn className="ax-icon ax-icon-sm" aria-hidden />
                {t("lostReasons")}
              </h3>
              {data.lostReasons.length === 0 ? (
                <p className="ax-faint">{t("noLost")}</p>
              ) : (
                <ul className="reason-list">
                  {data.lostReasons.map((r) => (
                    <li key={r.reason}>
                      <span>{tr.has(r.reason as never) ? tr(r.reason as never) : r.reason}</span>
                      <span className="ax-num ax-faint">
                        {r.count} · {f.percent(r.count / lostTotal)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>

        <Card
          id="rep-profit"
          title={t("profitTitle", { currency })}
          sub={t("profitSub")}
          icon={ReceiptText}
          tint="green"
          className="span-12"
        >
          <div className="card-body profit-body">
            <dl className="profit-figures">
              <div>
                <dt>{t("profitCollected")}</dt>
                <dd>{f.money(data.kpis.collectedMinor, currency)}</dd>
              </div>
              <div>
                <dt>{t("profitExpenses")}</dt>
                <dd>− {f.money(data.expenses.totalMinor, currency)}</dd>
              </div>
              <div className={data.expenses.profitMinor < 0 ? "is-negative" : undefined}>
                <dt>{t("profitResult")}</dt>
                <dd>{f.money(data.expenses.profitMinor, currency)}</dd>
              </div>
            </dl>
            {data.expenses.byCategory.length > 0 ? (
              <ul className="reason-list" aria-label={t("profitByCategory")}>
                {data.expenses.byCategory.map((c) => (
                  <li key={c.category}>
                    <Link className="ax-link" href={`/expenses?period=all&category=${c.category}`}>
                      {te(`cat_${c.category}` as never)}
                    </Link>
                    <span className="ax-num ax-faint">{f.money(c.minor, currency)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ax-faint">
                {t("profitNoExpenses")}{" "}
                <Link className="ax-link" href="/expenses?new=1">
                  {t("profitAddExpense")}
                </Link>
              </p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
