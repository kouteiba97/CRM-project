import {
  Activity,
  ArrowDown,
  ArrowUp,
  Banknote,
  BellRing,
  CalendarDays,
  Check,
  CircleAlert,
  CircleCheck,
  Flag,
  Hourglass,
  Mail,
  Phone,
  Receipt,
  Send,
  SquareCheckBig,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  getFollowUps,
  getKpis,
  getOverdueInvoices,
  getPipelineByStage,
  getRecentActivity,
  getRevenueSeries,
  getTodayTasks,
  getUpcomingMilestones,
  type Range,
} from "@/db/queries/dashboard";
import { due } from "@/lib/due";
import { formatter, type Formatter, type Locale } from "@/lib/format";
import { Card, EmptyState } from "@/components/ui/Card";
import { DueLabel } from "@/components/ui/DueLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WidgetError } from "@/components/ui/WidgetError";
import { ReminderButton } from "./ReminderButton";
import { RevenueCard, type RevenuePoint } from "./RevenueChart";
import { TaskRow } from "./TaskCheck";

type Ctx = { ws: string; currency: string; now: Date };

async function setup() {
  const locale = (await getLocale()) as Locale;
  const f = formatter(locale);
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");
  const overdueWords = (days: number) => tc("overdueDays", { days });
  return { locale, f, t, tc, overdueWords };
}

/** Runs a widget query; a failure renders that widget's ErrorState and never the whole page. */
async function load<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    console.error("[dashboard widget]", err);
    return { ok: false };
  }
}

const othersText = (f: Formatter, others: { currency: string; minor: number }[]) =>
  others.map((o) => f.money(o.minor, o.currency, { whole: true })).join(" · ");

// ── KPI strip ───────────────────────────────────────────────────────────────────────────
export async function KpiStrip({ ctx, range }: { ctx: Ctx; range: Range }) {
  const { f, t } = await setup();
  const res = await load(() => getKpis(ctx.ws, ctx.currency, range, ctx.now));
  if (!res.ok) return <WidgetError title={t("kpis")} />;
  const k = res.data;
  const cur = k.currency;
  const exact = (minor: number) => f.money(minor, cur);
  const revenueLabel = { month: t("kpiRevenue"), quarter: t("kpiRevenueQuarter"), year: t("kpiRevenueYear") }[range];

  const delta = k.revenue.delta;
  const deltaNode =
    delta === null ? (
      <span>{t("noComparison")}</span>
    ) : (
      <>
        <span className={`ax-delta ${delta > 0 ? "up" : delta < 0 ? "down" : "flat"}`}>
          {delta > 0 ? <ArrowUp className="ax-icon ax-icon-xs" aria-hidden /> : delta < 0 ? <ArrowDown className="ax-icon ax-icon-xs" aria-hidden /> : null}
          <span aria-hidden>{f.percent(delta, true)}</span>
          <span className="sr-only">
            {delta >= 0 ? t("deltaUp", { value: f.percent(Math.abs(delta)) }) : t("deltaDown", { value: f.percent(Math.abs(delta)) })}
          </span>
        </span>
        <span>{t("vsLastPeriod")}</span>
      </>
    );

  const tiles: { key: string; href: string; icon: LucideIcon; tint: string; label: string; value: string; title: string; danger?: boolean; sub: React.ReactNode }[] = [
    {
      key: "revenue",
      href: `/payments?period=${range}`,
      icon: Banknote,
      tint: "green",
      label: revenueLabel,
      value: f.money(k.revenue.minor, cur, { whole: true }),
      title: exact(k.revenue.minor),
      sub: deltaNode,
    },
    {
      key: "outstanding",
      href: "/invoices?status=outstanding",
      icon: Hourglass,
      tint: "blue",
      label: t("kpiOutstanding"),
      value: f.money(k.outstanding.minor, cur, { whole: true }),
      title: exact(k.outstanding.minor),
      sub: (
        <>
          <span>{t("notYetDue", { count: k.outstanding.count })}</span>
          {k.outstanding.others.length > 0 && <span>· {t("alsoIn", { amounts: othersText(f, k.outstanding.others) })}</span>}
        </>
      ),
    },
    {
      key: "overdue",
      href: "/invoices?status=overdue",
      icon: CircleAlert,
      tint: "danger",
      label: t("kpiOverdue"),
      value: f.money(k.overdue.minor, cur, { whole: true }),
      title: exact(k.overdue.minor),
      danger: k.overdue.count > 0,
      sub: (
        <>
          <span className={k.overdue.count > 0 ? "down" : undefined}>{t("overdueCount", { count: k.overdue.count })}</span>
          {k.overdue.others.length > 0 && <span>· {t("alsoIn", { amounts: othersText(f, k.overdue.others) })}</span>}
        </>
      ),
    },
    {
      key: "pipeline",
      href: "/leads",
      icon: Target,
      tint: "",
      label: t("kpiPipeline"),
      value: f.money(k.pipeline.minor, cur, { whole: true }),
      title: exact(k.pipeline.minor),
      sub: <span>{t("openLeads", { count: k.pipeline.count })}</span>,
    },
  ];

  return (
    <section className="dash-kpis" aria-label={t("kpis")}>
      {tiles.map((tile) => (
        <Link key={tile.key} href={tile.href} className="ax-kpi kpi">
          <span className={`ax-icon-tile ${tile.tint}`} aria-hidden>
            <tile.icon className="ax-icon" />
          </span>
          <span className="lbl">{tile.label}</span>
          <span className={`val${tile.danger ? " danger" : ""}`} title={tile.title}>
            {tile.value}
          </span>
          <span className="sub">{tile.sub}</span>
        </Link>
      ))}
    </section>
  );
}

// ── Today ───────────────────────────────────────────────────────────────────────────────
export async function TodayCard({ ctx }: { ctx: Ctx }) {
  const { f, t, tc, overdueWords } = await setup();
  const res = await load(() => getTodayTasks(ctx.ws, ctx.now));
  if (!res.ok) return <WidgetError title={t("todayTitle")} />;
  const { rows } = res.data;
  return (
    <Card id="today" title={t("todayTitle")} sub={t("todaySub")} icon={SquareCheckBig} href="/tasks?due=today" linkLabel={tc("viewAll")} className="row3 span-4">
      {rows.length === 0 ? (
        <EmptyState icon={CircleCheck} title={t("todayEmpty")} />
      ) : (
        <ul className="card-list">
          {rows.map((task) => {
            const d = due(task.dueDate!, f, overdueWords, { now: ctx.now });
            return (
              <TaskRow key={task.id} id={task.id} title={task.title} status={task.status} overdue={d.tone === "overdue"}>
                <span className="title">{task.title}</span>
                {task.projectName && <span className="proj">{task.projectName}</span>}
                <DueLabel due={d.tone === "overdue" ? d : { ...d, label: tc("today") }} />
              </TaskRow>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ── Follow-ups ──────────────────────────────────────────────────────────────────────────
const CHANNEL_ICON: Record<string, LucideIcon> = { call: Phone, email: Mail, meeting: CalendarDays };

export async function FollowUpsCard({ ctx }: { ctx: Ctx }) {
  const { f, t, tc, overdueWords } = await setup();
  const tch = await getTranslations("channel");
  const res = await load(() => getFollowUps(ctx.ws));
  if (!res.ok) return <WidgetError title={t("followUpsTitle")} />;
  return (
    <Card id="followups" title={t("followUpsTitle")} sub={t("followUpsSub")} icon={BellRing} tint="blue" href="/follow-ups" linkLabel={tc("viewAll")} className="row3 span-4">
      {res.data.length === 0 ? (
        <EmptyState icon={BellRing} title={t("followUpsEmpty")} />
      ) : (
        <ul className="card-list">
          {res.data.map((fu) => {
            const Icon = CHANNEL_ICON[fu.channel] ?? Phone;
            const d = due(fu.dueAt, f, overdueWords, { withTime: true, now: ctx.now });
            return (
              <li key={fu.id} className="ax-agenda">
                <span className="ax-date-tile" aria-hidden>
                  <b>{f.date(fu.dueAt, "day")}</b>
                  <span>{f.date(fu.dueAt, "month")}</span>
                </span>
                <div className="txt">
                  <Link className="row-link t" href={fu.leadId ? `/leads/${fu.leadId}` : `/clients/${fu.clientId}`}>
                    {fu.subject}
                  </Link>
                  <span className="s">
                    {fu.clientName ?? ""}
                    {fu.leadTitle ? ` · ${fu.leadTitle}` : ""}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                  <DueLabel due={d} />
                  <span className="ax-due" title={tch(fu.channel)}>
                    <Icon className="ax-icon" aria-hidden />
                    {tch(fu.channel)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ── Overdue invoices ────────────────────────────────────────────────────────────────────
export async function OverdueInvoicesCard({ ctx }: { ctx: Ctx }) {
  const { f, t, tc, overdueWords } = await setup();
  const res = await load(() => getOverdueInvoices(ctx.ws));
  if (!res.ok) return <WidgetError title={t("overdueTitle")} />;
  return (
    <Card id="overdue" title={t("overdueTitle")} icon={Receipt} tint="danger" href="/invoices?status=overdue" linkLabel={tc("viewAll")} className="row3 span-4">
      {res.data.length === 0 ? (
        <EmptyState icon={Check} title={t("overdueEmpty")} />
      ) : (
        <ul className="card-list">
          {res.data.map((inv) => (
            <li key={inv.id} className="inv-row">
              <div className="who">
                <b>{inv.clientName}</b>
                <span style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
                  <Link href={`/invoices/${inv.id}`} className="ax-mono ax-ltr ax-link" style={{ fontWeight: 500 }}>
                    {inv.number}
                  </Link>
                  <span className="ax-due overdue">
                    <CircleAlert className="ax-icon" aria-hidden />
                    {overdueWords(inv.daysOverdue)}
                  </span>
                </span>
              </div>
              <span className="amt" title={f.money(inv.balanceMinor, inv.currency)}>
                {f.money(inv.balanceMinor, inv.currency)}
              </span>
              <ReminderButton invoiceId={inv.id} number={inv.number} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── Revenue chart ───────────────────────────────────────────────────────────────────────
function niceScale(max: number) {
  if (max <= 0) return { top: 0, step: 0 };
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  return { top: Math.ceil(max / step) * step, step };
}

export async function RevenueWidget({ ctx }: { ctx: Ctx }) {
  const { f, t } = await setup();
  const res = await load(() => getRevenueSeries(ctx.ws, ctx.currency, ctx.now));
  if (!res.ok) return <WidgetError title={t("revenueTitle", { currency: ctx.currency })} />;
  const points: RevenuePoint[] = res.data.map((p) => ({
    month: p.month,
    short: f.date(p.month, "month"),
    long: f.date(p.month, "monthYear"),
    invoiced: p.invoiced / 100,
    collected: p.collected / 100,
    invoicedText: f.money(p.invoiced, ctx.currency),
    collectedText: f.money(p.collected, ctx.currency),
  }));
  const { top, step } = niceScale(Math.max(...points.flatMap((p) => [p.invoiced, p.collected])));
  const ticks = step > 0 ? Array.from({ length: Math.round(top / step) + 1 }, (_, i) => ({ value: i * step, label: f.compact(i * step) })) : [];
  return (
    <RevenueCard
      points={points}
      ticks={ticks}
      max={top}
      title={t("revenueTitle", { currency: ctx.currency })}
      ariaLabel={t("revenueAria", { currency: ctx.currency })}
    />
  );
}

// ── Pipeline by stage ───────────────────────────────────────────────────────────────────
export async function PipelineCard({ ctx }: { ctx: Ctx }) {
  const { f, t, tc } = await setup();
  const ts = await getTranslations("status.lead");
  const res = await load(() => getPipelineByStage(ctx.ws, ctx.currency));
  if (!res.ok) return <WidgetError title={t("pipelineTitle", { currency: ctx.currency })} />;
  const max = Math.max(...res.data.map((s) => s.minor), 1);
  const total = res.data.reduce((a, s) => a + s.count, 0);
  return (
    <Card id="pipeline" title={t("pipelineTitle", { currency: ctx.currency })} icon={Target} href="/leads" linkLabel={tc("viewAll")} className="span-4">
      <div className="card-body">
        {total === 0 ? (
          <EmptyState icon={Target} title={t("pipelineEmpty")} />
        ) : (
          <ul className="hbars" aria-label={t("pipelineAria")}>
            {res.data.map((s) => (
              <li key={s.stage}>
                <Link className="hbar-link" href={`/leads?stage=${s.stage}`}>
                  <span className="hbar-head">
                    <span className="lbl">{ts(s.stage)}</span>
                    <span className="n">{t("leadsCount", { count: s.count })}</span>
                    <span className="v" title={f.money(s.minor, ctx.currency)}>
                      {f.money(s.minor, ctx.currency, { whole: true })}
                    </span>
                  </span>
                  <span className="hbar-track" aria-hidden>
                    <span style={{ width: `${(s.minor / max) * 100}%` }} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

// ── Recent activity ─────────────────────────────────────────────────────────────────────
const ACTIVITY_LOOK: Record<string, { icon: LucideIcon; tone: string }> = {
  lead_created: { icon: Target, tone: "accent" },
  lead_stage_changed: { icon: Target, tone: "blue" },
  followup_done: { icon: Phone, tone: "blue" },
  payment_received: { icon: Wallet, tone: "success" },
  quotation_sent: { icon: Send, tone: "blue" },
  invoice_reminder: { icon: Send, tone: "" },
  milestone_completed: { icon: Flag, tone: "success" },
  task_completed: { icon: Check, tone: "success" },
};

export async function ActivityCard({ ctx }: { ctx: Ctx }) {
  const { f, t } = await setup();
  const ta = await getTranslations("activity");
  const ts = await getTranslations("status.lead");
  const res = await load(() => getRecentActivity(ctx.ws));
  if (!res.ok) return <WidgetError title={t("activityTitle")} />;

  const sentence = (kind: string, p: Record<string, string | number>) => {
    const vals: Record<string, string> = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)]));
    if (kind === "payment_received" && typeof p.amountMinor === "number")
      vals.amount = f.money(p.amountMinor, String(p.currency ?? ctx.currency));
    if (kind === "lead_stage_changed" && p.stage) vals.stage = ts(String(p.stage) as never);
    return ACTIVITY_LOOK[kind] ? (ta as unknown as (k: string, v: Record<string, string>) => string)(kind, vals) : ta("unknown");
  };

  return (
    <Card id="activity" title={t("activityTitle")} icon={Activity} tint="violet" className="span-8">
      {res.data.length === 0 ? (
        <EmptyState icon={Activity} title={t("activityEmpty")} />
      ) : (
        <ol className="ax-timeline">
          {res.data.map((a) => {
            const look = ACTIVITY_LOOK[a.kind] ?? { icon: Activity, tone: "" };
            return (
              <li key={a.id} className="ax-tl-item">
                <span className={`ax-tl-icon ${look.tone}`} aria-hidden>
                  <look.icon className="ax-icon" />
                </span>
                <div className="ax-tl-text">
                  <b>{sentence(a.kind, a.payload)}</b>
                  {a.clientName ? <> · {a.clientName}</> : null}
                  <time dateTime={a.occurredAt.toISOString()} title={`${f.date(a.occurredAt)} · ${f.time(a.occurredAt)}`}>
                    {f.relativeTime(a.occurredAt, ctx.now)}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

// ── Upcoming milestones ─────────────────────────────────────────────────────────────────
export async function MilestonesCard({ ctx }: { ctx: Ctx }) {
  const { f, t, tc, overdueWords } = await setup();
  const res = await load(() => getUpcomingMilestones(ctx.ws, ctx.now));
  if (!res.ok) return <WidgetError title={t("milestonesTitle")} />;
  return (
    <Card id="milestones" title={t("milestonesTitle")} icon={Flag} tint="blue" href="/projects" linkLabel={tc("viewAll")} className="span-4">
      {res.data.length === 0 ? (
        <EmptyState icon={Flag} title={t("milestonesEmpty")} />
      ) : (
        <ul className="card-list">
          {res.data.map((m) => (
            <li key={m.id} className="ms-row">
              <span className="ax-date-tile" aria-hidden>
                <b>{f.date(m.dueDate!, "day")}</b>
                <span>{f.date(m.dueDate!, "month")}</span>
              </span>
              <div className="txt">
                <Link className="row-link" href={`/projects/${m.projectId}`}>
                  <b>{m.title}</b>
                </Link>
                <span>
                  <span className="ax-mono ax-ltr">{m.projectCode}</span> · {m.clientName}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <StatusBadge domain="milestone" code={m.status} />
                <DueLabel due={due(m.dueDate!, f, overdueWords, { now: ctx.now })} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

