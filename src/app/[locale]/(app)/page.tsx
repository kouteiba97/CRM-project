import { Suspense } from "react";
import { CalendarDays } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { parseRange } from "@/db/queries/dashboard";
import { formatter, type Locale } from "@/lib/format";
import { getSession } from "@/lib/session";
import { CardSkeleton } from "@/components/ui/Card";
import {
  ActivityCard,
  FollowUpsCard,
  KpiStrip,
  MilestonesCard,
  OverdueInvoicesCard,
  PipelineCard,
  RevenueWidget,
  TodayCard,
} from "@/components/dashboard/widgets";

export async function generateMetadata({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: t("title") };
}

/**
 * DS › DashboardLayout: header → KPI strip → Today · Follow-ups · Overdue invoices →
 * Revenue (8) + Pipeline by stage (4) → Recent activity (8) + Upcoming milestones (4).
 * Each widget streams on its own and fails on its own.
 */
export default async function DashboardPage({ params, searchParams }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const range = parseRange((await searchParams).range);
  const t = await getTranslations("dashboard");
  const f = formatter(locale as Locale);
  const session = await getSession();
  const now = new Date();
  const ctx = { ws: session.workspaceId, currency: session.workspace.defaultCurrency, now };
  const ranges = [
    { key: "month", label: t("rangeMonth") },
    { key: "quarter", label: t("rangeQuarter") },
    { key: "year", label: t("rangeYear") },
  ] as const;

  return (
    <>
      <header className="pagehead">
        <h1 className="t-page-title">{t("title")}</h1>
        <span className="meta" style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}>
          <CalendarDays className="ax-icon ax-icon-sm" aria-hidden />
          <time dateTime={now.toISOString().slice(0, 10)}>{f.date(now, "weekday")}</time>
        </span>
        <div className="actions">
          <nav className="ax-segmented" aria-label={t("range")}>
            {ranges.map((r) => (
              <Link
                key={r.key}
                href={r.key === "month" ? "/" : `/?range=${r.key}`}
                aria-current={range === r.key ? "true" : undefined}
                scroll={false}
              >
                {r.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <Suspense key={range} fallback={<CardSkeleton rows={2} label={t("kpis")} />}>
        <KpiStrip ctx={ctx} range={range} />
      </Suspense>

      <div className="dash-grid">
        <Suspense fallback={<div className="row3 span-4"><CardSkeleton label={t("todayTitle")} /></div>}>
          <TodayCard ctx={ctx} />
        </Suspense>
        <Suspense fallback={<div className="row3 span-4"><CardSkeleton label={t("followUpsTitle")} /></div>}>
          <FollowUpsCard ctx={ctx} />
        </Suspense>
        <Suspense fallback={<div className="row3 span-4"><CardSkeleton label={t("overdueTitle")} /></div>}>
          <OverdueInvoicesCard ctx={ctx} />
        </Suspense>

        <Suspense fallback={<div className="span-8"><CardSkeleton rows={6} label={t("revenueSub")} /></div>}>
          <RevenueWidget ctx={ctx} />
        </Suspense>
        <Suspense fallback={<div className="span-4"><CardSkeleton label={t("pipelineAria")} /></div>}>
          <PipelineCard ctx={ctx} />
        </Suspense>

        <Suspense fallback={<div className="span-8"><CardSkeleton label={t("activityTitle")} /></div>}>
          <ActivityCard ctx={ctx} />
        </Suspense>
        <Suspense fallback={<div className="span-4"><CardSkeleton label={t("milestonesTitle")} /></div>}>
          <MilestonesCard ctx={ctx} />
        </Suspense>
      </div>
    </>
  );
}
