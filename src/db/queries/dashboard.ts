import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  activities,
  clients,
  followUps,
  invoiceBalances,
  invoices,
  leads,
  milestones,
  payments,
  projects,
  tasks,
} from "@/db/schema";
import { OPEN_LEAD_STAGES } from "@/lib/status";

/** Server-local calendar date as YYYY-MM-DD. */
export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export type Range = "month" | "quarter" | "year";
export function parseRange(v: unknown): Range {
  return v === "quarter" || v === "year" ? v : "month";
}
/**
 * [start, end) of the current period, and the same elapsed stretch of the previous period
 * (Oct 1–14 is compared with Sep 1–14, not with all of September).
 */
export function periodBounds(range: Range, now: Date) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const startMonth = range === "month" ? m : range === "quarter" ? m - (m % 3) : 0;
  const len = range === "month" ? 1 : range === "quarter" ? 3 : 12;
  const start = new Date(y, startMonth, 1);
  const end = new Date(y, startMonth + len, 1);
  const prevStart = new Date(y, startMonth - len, 1);
  const elapsedDays = Math.round((new Date(y, m, now.getDate() + 1).getTime() - start.getTime()) / 86_400_000);
  const prevEnd = new Date(prevStart.getFullYear(), prevStart.getMonth(), prevStart.getDate() + elapsedDays);
  return {
    start: isoDay(start),
    end: isoDay(end),
    prevStart: isoDay(prevStart),
    prevEnd: isoDay(prevEnd < start ? prevEnd : start),
  };
}

const live = <T extends { archivedAt: unknown; workspaceId: unknown }>(t: T, ws: string) =>
  and(eq(t.workspaceId as never, ws), isNull(t.archivedAt as never));

export type Money = { currency: string; minor: number };

// ── Sidebar counts ──────────────────────────────────────────────────────────────────────
export async function getSidebarCounts(ws: string, now = new Date()) {
  const today = isoDay(now);
  const [fu, tk, inv] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(followUps)
      .where(and(live(followUps, ws), eq(followUps.status, "open"), lte(followUps.dueAt, endOfDay(now)))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(tasks)
      .where(and(live(tasks, ws), ne(tasks.status, "done"), lte(tasks.dueDate, today))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(invoiceBalances)
      .where(and(eq(invoiceBalances.workspaceId, ws), eq(invoiceBalances.displayStatus, "overdue"))),
  ]);
  return { followUpsDue: fu[0]?.n ?? 0, tasksDue: tk[0]?.n ?? 0, overdueInvoices: inv[0]?.n ?? 0 };
}
export type SidebarCounts = Awaited<ReturnType<typeof getSidebarCounts>>;

// ── KPIs ────────────────────────────────────────────────────────────────────────────────
export async function getKpis(ws: string, currency: string, range: Range, now = new Date()) {
  const p = periodBounds(range, now);
  const revenue = (from: string, to: string) =>
    db
      .select({ minor: sql<number>`coalesce(sum(${payments.amountMinor}), 0)::bigint` })
      .from(payments)
      .where(
        and(
          live(payments, ws),
          eq(payments.status, "received"),
          eq(payments.currency, currency),
          gte(payments.paidOn, from),
          lt(payments.paidOn, to),
        ),
      );
  const balancesBy = (statuses: string[]) =>
    db
      .select({
        currency: invoices.currency,
        minor: sql<number>`sum(${invoiceBalances.balanceMinor})::bigint`,
        count: sql<number>`count(*)::int`,
      })
      .from(invoiceBalances)
      .innerJoin(invoices, eq(invoices.id, invoiceBalances.invoiceId))
      .where(and(eq(invoiceBalances.workspaceId, ws), inArray(invoiceBalances.displayStatus, statuses)))
      .groupBy(invoices.currency);

  const [cur, prev, outstanding, overdue, pipeline] = await Promise.all([
    revenue(p.start, p.end),
    revenue(p.prevStart, p.prevEnd),
    balancesBy(["sent", "viewed", "partially_paid"]),
    balancesBy(["overdue"]),
    db
      .select({
        currency: leads.currency,
        minor: sql<number>`sum(${leads.valueMinor})::bigint`,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(and(live(leads, ws), inArray(leads.stage, [...OPEN_LEAD_STAGES])))
      .groupBy(leads.currency),
  ]);

  /** Primary currency first; other currencies are listed beside it, never summed into it. */
  const split = (rows: { currency: string; minor: number; count: number }[]) => {
    const main = rows.find((r) => r.currency === currency);
    return {
      minor: Number(main?.minor ?? 0),
      count: rows.reduce((a, r) => a + r.count, 0),
      others: rows
        .filter((r) => r.currency !== currency)
        .map((r) => ({ currency: r.currency, minor: Number(r.minor) })),
    };
  };

  const revenueMinor = Number(cur[0]?.minor ?? 0);
  const previousMinor = Number(prev[0]?.minor ?? 0);
  return {
    currency,
    revenue: {
      minor: revenueMinor,
      previousMinor,
      delta: previousMinor > 0 ? (revenueMinor - previousMinor) / previousMinor : null,
    },
    outstanding: split(outstanding),
    overdue: split(overdue),
    pipeline: split(pipeline),
  };
}

// ── Today: overdue + due today ──────────────────────────────────────────────────────────
export async function getTodayTasks(ws: string, now = new Date()) {
  const today = isoDay(now);
  const where = and(live(tasks, ws), ne(tasks.status, "done"), lte(tasks.dueDate, today));
  const [rows, total] = await Promise.all([
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        projectName: projects.name,
      })
      .from(tasks)
      .leftJoin(projects, eq(projects.id, tasks.projectId))
      .where(where)
      .orderBy(
        asc(tasks.dueDate),
        sql`array_position(array['urgent','high','medium','low']::priority[], ${tasks.priority})`,
        asc(tasks.position),
      )
      .limit(7),
    db.select({ n: sql<number>`count(*)::int` }).from(tasks).where(where),
  ]);
  return { rows, total: total[0]?.n ?? 0 };
}

// ── Follow-ups ──────────────────────────────────────────────────────────────────────────
export async function getFollowUps(ws: string, limit = 6) {
  return db
    .select({
      id: followUps.id,
      subject: followUps.subject,
      channel: followUps.channel,
      dueAt: followUps.dueAt,
      leadId: followUps.leadId,
      leadTitle: leads.title,
      clientId: sql<string | null>`coalesce(${followUps.clientId}, ${leads.clientId})`,
      clientName: sql<string | null>`coalesce(${clients.name}, ${leads.prospectCompany}, ${leads.prospectName})`,
    })
    .from(followUps)
    .leftJoin(leads, eq(leads.id, followUps.leadId))
    .leftJoin(clients, sql`${clients.id} = coalesce(${followUps.clientId}, ${leads.clientId})`)
    .where(and(live(followUps, ws), eq(followUps.status, "open")))
    .orderBy(asc(followUps.dueAt))
    .limit(limit);
}

// ── Overdue invoices ────────────────────────────────────────────────────────────────────
export async function getOverdueInvoices(ws: string, limit = 6) {
  return db
    .select({
      id: invoices.id,
      number: invoices.number,
      currency: invoices.currency,
      clientId: clients.id,
      clientName: clients.name,
      balanceMinor: invoiceBalances.balanceMinor,
      daysOverdue: invoiceBalances.daysOverdue,
    })
    .from(invoiceBalances)
    .innerJoin(invoices, eq(invoices.id, invoiceBalances.invoiceId))
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoiceBalances.workspaceId, ws), eq(invoiceBalances.displayStatus, "overdue")))
    .orderBy(desc(invoiceBalances.daysOverdue))
    .limit(limit);
}

// ── Revenue: invoiced vs collected, last 6 months ───────────────────────────────────────
export async function getRevenueSeries(ws: string, currency: string, now = new Date()) {
  const first = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const from = isoDay(first);
  const months = Array.from({ length: 6 }, (_, i) =>
    isoDay(new Date(first.getFullYear(), first.getMonth() + i, 1)),
  );
  const [inv, col] = await Promise.all([
    db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${invoices.issueDate}), 'YYYY-MM-DD')`,
        minor: sql<number>`sum(${invoices.totalMinor})::bigint`,
      })
      .from(invoices)
      .where(
        and(
          live(invoices, ws),
          inArray(invoices.state, ["sent", "viewed"]),
          eq(invoices.currency, currency),
          gte(invoices.issueDate, from),
        ),
      )
      .groupBy(sql`1`),
    db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${payments.paidOn}), 'YYYY-MM-DD')`,
        minor: sql<number>`sum(${payments.amountMinor})::bigint`,
      })
      .from(payments)
      .where(
        and(
          live(payments, ws),
          eq(payments.status, "received"),
          eq(payments.currency, currency),
          gte(payments.paidOn, from),
        ),
      )
      .groupBy(sql`1`),
  ]);
  const byMonth = (rows: { month: string; minor: number }[]) =>
    new Map(rows.map((r) => [r.month, Number(r.minor)]));
  const i = byMonth(inv);
  const c = byMonth(col);
  return months.map((month) => ({ month, invoiced: i.get(month) ?? 0, collected: c.get(month) ?? 0 }));
}

// ── Pipeline by stage ───────────────────────────────────────────────────────────────────
export async function getPipelineByStage(ws: string, currency: string) {
  const rows = await db
    .select({
      stage: leads.stage,
      count: sql<number>`count(*)::int`,
      minor: sql<number>`coalesce(sum(${leads.valueMinor}) filter (where ${leads.currency} = ${currency}), 0)::bigint`,
    })
    .from(leads)
    .where(and(live(leads, ws), inArray(leads.stage, [...OPEN_LEAD_STAGES])))
    .groupBy(leads.stage);
  return OPEN_LEAD_STAGES.map((stage) => {
    const r = rows.find((x) => x.stage === stage);
    return { stage, count: r?.count ?? 0, minor: Number(r?.minor ?? 0) };
  });
}

// ── Recent activity ─────────────────────────────────────────────────────────────────────
export async function getRecentActivity(ws: string, limit = 6) {
  return db
    .select({
      id: activities.id,
      kind: activities.kind,
      entityType: activities.entityType,
      entityId: activities.entityId,
      payload: activities.payload,
      occurredAt: activities.occurredAt,
      clientName: clients.name,
    })
    .from(activities)
    .leftJoin(clients, eq(clients.id, activities.clientId))
    .where(eq(activities.workspaceId, ws))
    .orderBy(desc(activities.occurredAt))
    .limit(limit);
}

// ── Upcoming milestones ─────────────────────────────────────────────────────────────────
export async function getUpcomingMilestones(ws: string, now = new Date(), limit = 5) {
  return db
    .select({
      id: milestones.id,
      title: milestones.title,
      dueDate: milestones.dueDate,
      status: milestones.status,
      projectId: projects.id,
      projectCode: projects.code,
      projectName: projects.name,
      clientName: clients.name,
    })
    .from(milestones)
    .innerJoin(projects, eq(projects.id, milestones.projectId))
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(and(live(milestones, ws), ne(milestones.status, "completed"), gte(milestones.dueDate, isoDay(now))))
    .orderBy(asc(milestones.dueDate))
    .limit(limit);
}
