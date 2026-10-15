import "server-only";
import { and, asc, desc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import {
  activities,
  clients,
  contacts,
  followUps,
  invoiceBalances,
  invoices,
  leads,
  memberships,
  payments,
  projects,
  quotationDisplayStatus,
  quotations,
  users,
} from "@/db/schema";

/** Project statuses that count as "open" work for a client. */
export const OPEN_PROJECT_STATUSES = ["planning", "active", "on_hold", "at_risk"] as const;
/** Invoice display statuses that still carry a balance. */
const UNPAID = ["sent", "viewed", "partially_paid", "overdue"] as const;
/** Activities that count as a touchpoint with the client ("Last contact"). */
export const CONTACT_KINDS = [
  "followup_done",
  "call_logged",
  "email_logged",
  "note_logged",
  "quotation_sent",
  "invoice_reminder",
] as const;

export type Money = { currency: string; minor: number };

// ── List ────────────────────────────────────────────────────────────────────────────────
export const SORT_KEYS = ["name", "projects", "outstanding", "lastContact", "nextFollowUp", "owner"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";
export const PAGE_SIZES = [25, 50, 100] as const;
export const CLIENT_STATUSES = ["active", "prospect", "inactive"] as const;

export type ClientFilters = {
  q: string;
  status: (typeof CLIENT_STATUSES)[number] | null;
  tag: string | null;
  owner: string | null;
  overdue: boolean;
  sort: SortKey;
  dir: SortDir;
  page: number;
  size: number;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** URL search params → validated filters. Anything unknown falls back to the default. */
export function parseClientFilters(sp: Params): ClientFilters {
  const status = one(sp.status);
  const sort = one(sp.sort);
  const dir = one(sp.dir);
  const owner = one(sp.owner);
  const size = Number(one(sp.size));
  const page = Math.max(1, Math.floor(Number(one(sp.page)) || 1));
  const validSort = (SORT_KEYS as readonly string[]).includes(sort ?? "");
  return {
    q: (one(sp.q) ?? "").trim().slice(0, 100),
    status: (CLIENT_STATUSES as readonly string[]).includes(status ?? "")
      ? (status as ClientFilters["status"])
      : null,
    tag: one(sp.tag)?.trim().slice(0, 50) || null,
    owner: isUuid(owner) ? owner : null,
    overdue: one(sp.overdue) === "1",
    sort: validSort ? (sort as SortKey) : "nextFollowUp",
    dir: validSort && dir === "desc" ? "desc" : "asc",
    page,
    size: (PAGE_SIZES as readonly number[]).includes(size) ? size : 25,
  };
}

export type ClientRow = {
  id: string;
  name: string;
  status: string;
  currency: string | null;
  tags: string[];
  ownerId: string | null;
  ownerName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  openProjects: number;
  outstanding: Money[];
  overdueCount: number;
  nextFollowUp: Date | null;
  lastContact: Date | null;
};

type RawRow = {
  id: string;
  name: string;
  status: string;
  currency: string | null;
  tags: string[] | null;
  owner_id: string | null;
  owner_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  open_projects: number | string;
  outstanding: { currency: string; minor: number | string }[] | null;
  overdue_n: number | string;
  next_due: string | Date | null;
  last_at: string | Date | null;
  total: number | string;
};

const toDate = (v: string | Date | null) => (v === null ? null : v instanceof Date ? v : new Date(v));
const pgArray = (values: readonly string[]) => sql.raw(`array[${values.map((v) => `'${v}'`).join(",")}]`);

/**
 * One query for the whole list: per-client aggregates as CTEs, filters, sort and the page.
 * Outstanding is kept per currency; it sorts by the amount in the client's own currency.
 */
export async function listClients(ws: string, defaultCurrency: string, f: ClientFilters) {
  const where: SQL[] = [sql`c.workspace_id = ${ws}`, sql`c.archived_at is null`];
  if (f.q) {
    const p = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push(sql`(
      c.name ilike ${p} or c.email ilike ${p} or c.phone ilike ${p}
      or exists (select 1 from unnest(c.tags) t where t ilike ${p})
      or exists (
        select 1 from contacts ct
        where ct.client_id = c.id and ct.archived_at is null
          and (concat_ws(' ', ct.first_name, ct.last_name) ilike ${p} or ct.email ilike ${p} or ct.phone ilike ${p})
      )
    )`);
  }
  if (f.status) where.push(sql`c.status = ${f.status}`);
  if (f.tag) where.push(sql`${f.tag} = any(c.tags)`);
  if (f.owner) where.push(sql`c.owner_id = ${f.owner}`);
  if (f.overdue) where.push(sql`coalesce(o.overdue_n, 0) > 0`);

  const dir = sql.raw(f.dir === "desc" ? "desc" : "asc");
  const order: Record<SortKey, SQL> = {
    name: sql`lower(c.name) ${dir}`,
    projects: sql`coalesce(op.n, 0) ${dir}, lower(c.name)`,
    outstanding: sql`coalesce(main_outstanding, 0) ${dir}, lower(c.name)`,
    lastContact: sql`lc.last_at ${dir} nulls last, lower(c.name)`,
    nextFollowUp: sql`fu.next_due ${dir} nulls last, lower(c.name)`,
    owner: sql`lower(u.name) ${dir} nulls last, lower(c.name)`,
  };

  const res = await db.execute<RawRow>(sql`
    with ob as (
      select i.client_id, i.currency,
        sum(b.balance_minor)::bigint as minor,
        count(*) filter (where b.display_status = 'overdue')::int as overdue_n
      from invoice_balances b
      join invoices i on i.id = b.invoice_id
      where b.workspace_id = ${ws} and b.display_status = any(${pgArray(UNPAID)})
      group by i.client_id, i.currency
    ),
    o as (
      select client_id,
        jsonb_agg(jsonb_build_object('currency', currency, 'minor', minor) order by minor desc) as outstanding,
        sum(overdue_n)::int as overdue_n
      from ob group by client_id
    ),
    op as (
      select client_id, count(*)::int as n from projects
      where workspace_id = ${ws} and archived_at is null
        and status::text = any(${pgArray(OPEN_PROJECT_STATUSES)})
      group by client_id
    ),
    fu as (
      select coalesce(f.client_id, l.client_id) as client_id, min(f.due_at) as next_due
      from follow_ups f left join leads l on l.id = f.lead_id
      where f.workspace_id = ${ws} and f.archived_at is null and f.status = 'open'
      group by 1
    ),
    lc as (
      select client_id, max(at) as last_at from (
        select client_id, occurred_at as at from activities
        where workspace_id = ${ws} and client_id is not null and kind = any(${pgArray(CONTACT_KINDS)})
        union all
        select coalesce(f.client_id, l.client_id), f.completed_at
        from follow_ups f left join leads l on l.id = f.lead_id
        where f.workspace_id = ${ws} and f.status = 'done' and f.completed_at is not null
      ) x group by client_id
    ),
    pc as (
      select distinct on (client_id) client_id,
        concat_ws(' ', first_name, last_name) as contact_name, email as contact_email
      from contacts where workspace_id = ${ws} and archived_at is null
      order by client_id, is_primary desc, created_at
    )
    select c.id, c.name, c.status::text as status, c.currency, c.tags,
      u.id as owner_id, u.name as owner_name,
      pc.contact_name, pc.contact_email,
      coalesce(op.n, 0) as open_projects,
      o.outstanding, coalesce(o.overdue_n, 0) as overdue_n,
      fu.next_due, lc.last_at,
      count(*) over () as total
    from clients c
    left join users u on u.id = c.owner_id
    left join pc on pc.client_id = c.id
    left join op on op.client_id = c.id
    left join o on o.client_id = c.id
    left join fu on fu.client_id = c.id
    left join lc on lc.client_id = c.id
    cross join lateral (
      select max((e ->> 'minor')::bigint) as main_outstanding
      from jsonb_array_elements(coalesce(o.outstanding, '[]'::jsonb)) e
      where e ->> 'currency' = coalesce(c.currency, ${defaultCurrency})
    ) mo
    where ${sql.join(where, sql` and `)}
    order by ${order[f.sort]}
    limit ${f.size} offset ${(f.page - 1) * f.size}
  `);

  const rows: ClientRow[] = res.rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    currency: r.currency,
    tags: r.tags ?? [],
    ownerId: r.owner_id,
    ownerName: r.owner_name,
    contactName: r.contact_name || null,
    contactEmail: r.contact_email,
    openProjects: Number(r.open_projects),
    outstanding: (r.outstanding ?? []).map((m) => ({ currency: m.currency, minor: Number(m.minor) })),
    overdueCount: Number(r.overdue_n),
    nextFollowUp: toDate(r.next_due),
    lastContact: toDate(r.last_at),
  }));
  const total = res.rows[0] ? Number(res.rows[0].total) : 0;
  return { rows, total };
}

/** Unfiltered count for the page header, plus the values the filter chips offer. */
export async function getClientListMeta(ws: string) {
  const [count, tags, owners] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(clients)
      .where(and(eq(clients.workspaceId, ws), isNull(clients.archivedAt))),
    db.execute<{ tag: string }>(sql`
      select distinct unnest(tags) as tag from clients
      where workspace_id = ${ws} and archived_at is null order by 1`),
    db
      .select({ id: users.id, name: users.name })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.workspaceId, ws))
      .orderBy(asc(users.name)),
  ]);
  return { count: count[0]?.n ?? 0, tags: tags.rows.map((r) => r.tag), owners };
}

// ── Record ──────────────────────────────────────────────────────────────────────────────
export async function getClient(ws: string, id: string) {
  const [row] = await db
    .select({ client: clients, ownerName: users.name })
    .from(clients)
    .leftJoin(users, eq(users.id, clients.ownerId))
    .where(and(eq(clients.id, id), eq(clients.workspaceId, ws), isNull(clients.archivedAt)));
  if (!row) return null;
  const list = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.clientId, id), eq(contacts.workspaceId, ws), isNull(contacts.archivedAt)))
    .orderBy(desc(contacts.isPrimary), asc(contacts.createdAt));
  return { ...row.client, ownerName: row.ownerName, contacts: list };
}
export type ClientRecord = NonNullable<Awaited<ReturnType<typeof getClient>>>;

/** KPI strip: lifetime revenue · outstanding · overdue (per currency) · open projects. */
export async function getClientKpis(ws: string, id: string) {
  const [paid, balances, open] = await Promise.all([
    db
      .select({ currency: payments.currency, minor: sql<number>`sum(${payments.amountMinor})::bigint` })
      .from(payments)
      .where(
        and(
          eq(payments.workspaceId, ws),
          eq(payments.clientId, id),
          isNull(payments.archivedAt),
          eq(payments.status, "received"),
        ),
      )
      .groupBy(payments.currency),
    db
      .select({
        currency: invoices.currency,
        outstanding: sql<number>`coalesce(sum(${invoiceBalances.balanceMinor}), 0)::bigint`,
        overdue: sql<number>`coalesce(sum(${invoiceBalances.balanceMinor}) filter (where ${invoiceBalances.displayStatus} = 'overdue'), 0)::bigint`,
        overdueCount: sql<number>`count(*) filter (where ${invoiceBalances.displayStatus} = 'overdue')::int`,
      })
      .from(invoiceBalances)
      .innerJoin(invoices, eq(invoices.id, invoiceBalances.invoiceId))
      .where(
        and(
          eq(invoiceBalances.workspaceId, ws),
          eq(invoices.clientId, id),
          inArray(invoiceBalances.displayStatus, [...UNPAID]),
        ),
      )
      .groupBy(invoices.currency),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(projects)
      .where(
        and(
          eq(projects.workspaceId, ws),
          eq(projects.clientId, id),
          isNull(projects.archivedAt),
          inArray(projects.status, [...OPEN_PROJECT_STATUSES]),
        ),
      ),
  ]);
  const money = (rows: { currency: string; minor: number }[]) =>
    rows.map((r) => ({ currency: r.currency, minor: Number(r.minor) })).filter((r) => r.minor !== 0);
  return {
    revenue: money(paid),
    outstanding: money(balances.map((b) => ({ currency: b.currency, minor: b.outstanding }))),
    overdue: money(balances.map((b) => ({ currency: b.currency, minor: b.overdue }))),
    overdueCount: balances.reduce((a, b) => a + b.overdueCount, 0),
    openProjects: open[0]?.n ?? 0,
  };
}

/** The earliest open follow-up on the client or on one of its leads. */
export async function getNextFollowUp(ws: string, id: string) {
  const [row] = await db
    .select({
      id: followUps.id,
      subject: followUps.subject,
      channel: followUps.channel,
      dueAt: followUps.dueAt,
      leadTitle: leads.title,
    })
    .from(followUps)
    .leftJoin(leads, eq(leads.id, followUps.leadId))
    .where(
      and(
        eq(followUps.workspaceId, ws),
        isNull(followUps.archivedAt),
        eq(followUps.status, "open"),
        or(eq(followUps.clientId, id), eq(leads.clientId, id)),
      ),
    )
    .orderBy(asc(followUps.dueAt))
    .limit(1);
  return row ?? null;
}

export async function getTabCounts(ws: string, id: string) {
  const count = (t: typeof projects | typeof quotations | typeof invoices | typeof payments) =>
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(t)
      .where(and(eq(t.workspaceId, ws), eq(t.clientId, id), isNull(t.archivedAt)));
  const [p, q, i, pay] = await Promise.all([count(projects), count(quotations), count(invoices), count(payments)]);
  return { projects: p[0]?.n ?? 0, quotations: q[0]?.n ?? 0, invoices: i[0]?.n ?? 0, payments: pay[0]?.n ?? 0 };
}

export async function getClientProjects(ws: string, id: string, openOnly = false) {
  return db
    .select({
      id: projects.id,
      code: projects.code,
      name: projects.name,
      status: projects.status,
      deadline: projects.deadline,
      budgetMinor: projects.budgetMinor,
      currency: projects.currency,
    })
    .from(projects)
    .where(
      and(
        eq(projects.workspaceId, ws),
        eq(projects.clientId, id),
        isNull(projects.archivedAt),
        openOnly ? inArray(projects.status, [...OPEN_PROJECT_STATUSES]) : undefined,
      ),
    )
    .orderBy(asc(projects.deadline), asc(projects.code));
}

export async function getClientQuotations(ws: string, id: string) {
  return db
    .select({
      id: quotations.id,
      number: quotations.number,
      status: quotationDisplayStatus.displayStatus,
      issueDate: quotations.issueDate,
      validUntil: quotations.validUntil,
      totalMinor: quotations.totalMinor,
      currency: quotations.currency,
    })
    .from(quotations)
    .innerJoin(quotationDisplayStatus, eq(quotationDisplayStatus.quotationId, quotations.id))
    .where(and(eq(quotations.workspaceId, ws), eq(quotations.clientId, id)))
    .orderBy(desc(quotations.issueDate), desc(quotations.number));
}

export async function getClientInvoices(ws: string, id: string, unpaidOnly = false) {
  return db
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoiceBalances.displayStatus,
      daysOverdue: invoiceBalances.daysOverdue,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      totalMinor: invoices.totalMinor,
      balanceMinor: invoiceBalances.balanceMinor,
      currency: invoices.currency,
    })
    .from(invoices)
    .innerJoin(invoiceBalances, eq(invoiceBalances.invoiceId, invoices.id))
    .where(
      and(
        eq(invoices.workspaceId, ws),
        eq(invoices.clientId, id),
        unpaidOnly ? inArray(invoiceBalances.displayStatus, [...UNPAID]) : undefined,
      ),
    )
    .orderBy(unpaidOnly ? asc(invoices.dueDate) : desc(invoices.issueDate), desc(invoices.number));
}

export async function getClientPayments(ws: string, id: string) {
  return db
    .select({
      id: payments.id,
      paidOn: payments.paidOn,
      amountMinor: payments.amountMinor,
      currency: payments.currency,
      method: payments.method,
      reference: payments.reference,
      status: payments.status,
      invoiceId: invoices.id,
      invoiceNumber: invoices.number,
    })
    .from(payments)
    .leftJoin(invoices, eq(invoices.id, payments.invoiceId))
    .where(and(eq(payments.workspaceId, ws), eq(payments.clientId, id), isNull(payments.archivedAt)))
    .orderBy(desc(payments.paidOn));
}

/** DS › Timeline filter chips: All · Notes · Calls · Emails · Documents · Payments. */
export const ACTIVITY_FILTERS = ["all", "notes", "calls", "emails", "documents", "payments"] as const;
export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number];
const FILTER_KINDS: Record<Exclude<ActivityFilter, "all">, string[]> = {
  notes: ["note_logged"],
  calls: ["call_logged", "followup_done"],
  emails: ["email_logged", "invoice_reminder"],
  documents: ["quotation_sent"],
  payments: ["payment_received"],
};

export async function getClientActivity(ws: string, id: string, limit = 50, filter: ActivityFilter = "all") {
  return db
    .select({
      id: activities.id,
      kind: activities.kind,
      payload: activities.payload,
      occurredAt: activities.occurredAt,
      actorName: users.name,
    })
    .from(activities)
    .leftJoin(users, eq(users.id, activities.actorId))
    .where(
      and(
        eq(activities.workspaceId, ws),
        or(eq(activities.clientId, id), and(eq(activities.entityType, "client"), eq(activities.entityId, id))),
        filter === "all" ? undefined : inArray(activities.kind, FILTER_KINDS[filter]),
      ),
    )
    .orderBy(desc(activities.occurredAt), desc(activities.id))
    .limit(limit);
}
export type ActivityItem = Awaited<ReturnType<typeof getClientActivity>>[number];
