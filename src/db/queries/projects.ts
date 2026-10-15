import "server-only";
import { and, asc, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import {
  activities,
  clients,
  invoiceBalances,
  invoices,
  leads,
  milestones,
  projectStatus,
  projects,
  tasks,
  users,
} from "@/db/schema";
import { isUuid } from "./clients";

export const PROJECT_STATUSES = projectStatus.enumValues;
/** Statuses offered when creating or editing (Archived is the archive action, not a status choice). */
export const EDITABLE_STATUSES = ["planning", "active", "on_hold", "at_risk", "completed"] as const;
export const PROJECT_SORT_KEYS = ["deadline", "name", "progress", "billed"] as const;
export type ProjectSortKey = (typeof PROJECT_SORT_KEYS)[number];

export type ProjectFilters = {
  q: string;
  status: (typeof PROJECT_STATUSES)[number] | null;
  client: string | null;
  late: boolean;
  sort: ProjectSortKey;
  dir: "asc" | "desc";
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseProjectFilters(sp: Params): ProjectFilters {
  const status = one(sp.status);
  const client = one(sp.client);
  const sort = one(sp.sort);
  const validSort = (PROJECT_SORT_KEYS as readonly string[]).includes(sort ?? "");
  return {
    q: (one(sp.q) ?? "").trim().slice(0, 100),
    status: (PROJECT_STATUSES as readonly string[]).includes(status ?? "") ? (status as ProjectFilters["status"]) : null,
    client: isUuid(client) ? client : null,
    late: one(sp.late) === "1",
    sort: validSort ? (sort as ProjectSortKey) : "deadline",
    dir: validSort && one(sp.dir) === "desc" ? "desc" : "asc",
  };
}

export type ProjectRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  clientId: string;
  clientName: string;
  deadline: string | null;
  currency: string;
  budgetMinor: number | null;
  tasksTotal: number;
  tasksDone: number;
  milestonesTotal: number;
  milestonesDone: number;
  nextMilestone: { title: string; dueDate: string | null } | null;
  earnedMinor: number;
  billedMinor: number;
  paidMinor: number;
  dueMinor: number;
  lateMilestones: number;
};

export { progressOf } from "@/lib/progress";

type Raw = {
  id: string;
  code: string;
  name: string;
  status: string;
  client_id: string;
  client_name: string;
  deadline: string | null;
  currency: string;
  budget_minor: string | number | null;
  tasks_total: number;
  tasks_done: number;
  ms_total: number;
  ms_done: number;
  ms_late: number;
  next_title: string | null;
  next_due: string | null;
  earned: string | number;
  billed: string | number;
  paid: string | number;
  due: string | number;
};

const fromRaw = (r: Raw): ProjectRow => ({
  id: r.id,
  code: r.code,
  name: r.name,
  status: r.status,
  clientId: r.client_id,
  clientName: r.client_name,
  deadline: r.deadline,
  currency: r.currency,
  budgetMinor: r.budget_minor === null ? null : Number(r.budget_minor),
  tasksTotal: Number(r.tasks_total),
  tasksDone: Number(r.tasks_done),
  milestonesTotal: Number(r.ms_total),
  milestonesDone: Number(r.ms_done),
  lateMilestones: Number(r.ms_late),
  nextMilestone: r.next_title ? { title: r.next_title, dueDate: r.next_due } : null,
  earnedMinor: Number(r.earned),
  billedMinor: Number(r.billed),
  paidMinor: Number(r.paid),
  dueMinor: Number(r.due),
});

/**
 * Projects with their aggregates in one query: task and milestone progress, the next open milestone,
 * value of completed milestones ("earned", for Budget used) and invoiced / paid / due (issued invoices only).
 */
function projectsQuery(ws: string, where: SQL[], order: SQL) {
  return db.execute<Raw>(sql`
    with t as (
      select project_id, count(*)::int as total, count(*) filter (where status = 'done')::int as done
      from tasks where workspace_id = ${ws} and archived_at is null and project_id is not null
      group by project_id
    ),
    m as (
      select project_id,
        count(*)::int as total,
        count(*) filter (where status = 'completed')::int as done,
        count(*) filter (where status <> 'completed' and due_date < current_date)::int as late,
        coalesce(sum(amount_minor) filter (where status = 'completed'), 0)::bigint as earned
      from milestones where workspace_id = ${ws} and archived_at is null
      group by project_id
    ),
    nm as (
      select distinct on (project_id) project_id, title, due_date::text as due_date
      from milestones
      where workspace_id = ${ws} and archived_at is null and status <> 'completed'
      order by project_id, due_date nulls last, position
    ),
    inv as (
      select i.project_id,
        coalesce(sum(i.total_minor), 0)::bigint as billed,
        coalesce(sum(b.paid_minor), 0)::bigint as paid,
        coalesce(sum(b.balance_minor), 0)::bigint as due
      from invoices i join invoice_balances b on b.invoice_id = i.id
      where i.workspace_id = ${ws} and i.project_id is not null and i.state in ('sent', 'viewed')
      group by i.project_id
    )
    select p.id, p.code, p.name, p.status::text as status, p.client_id, c.name as client_name,
      p.deadline::text as deadline, p.currency, p.budget_minor,
      coalesce(t.total, 0) as tasks_total, coalesce(t.done, 0) as tasks_done,
      coalesce(m.total, 0) as ms_total, coalesce(m.done, 0) as ms_done, coalesce(m.late, 0) as ms_late,
      nm.title as next_title, nm.due_date as next_due,
      coalesce(m.earned, 0) as earned,
      coalesce(inv.billed, 0) as billed, coalesce(inv.paid, 0) as paid, coalesce(inv.due, 0) as due
    from projects p
    join clients c on c.id = p.client_id
    left join t on t.project_id = p.id
    left join m on m.project_id = p.id
    left join nm on nm.project_id = p.id
    left join inv on inv.project_id = p.id
    where ${sql.join(where, sql` and `)}
    order by ${order}
  `);
}

export async function listProjects(ws: string, f: ProjectFilters) {
  const where: SQL[] = [sql`p.workspace_id = ${ws}`, sql`p.archived_at is null`];
  if (f.q) {
    const p = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push(sql`(p.name ilike ${p} or p.code ilike ${p} or c.name ilike ${p})`);
  }
  if (f.status) where.push(sql`p.status = ${f.status}`);
  if (f.client) where.push(sql`p.client_id = ${f.client}`);
  if (f.late)
    where.push(sql`p.status not in ('completed', 'archived') and (p.deadline < current_date or coalesce(m.late, 0) > 0)`);
  const dir = sql.raw(f.dir);
  const progress = sql`case when coalesce(t.total, 0) > 0 then t.done::float / t.total
    when coalesce(m.total, 0) > 0 then m.done::float / m.total else 0 end`;
  const order = {
    deadline: sql`p.deadline ${dir} nulls last, lower(p.name)`,
    name: sql`lower(p.name) ${dir}`,
    progress: sql`${progress} ${dir}, lower(p.name)`,
    billed: sql`coalesce(inv.billed, 0) ${dir}, lower(p.name)`,
  }[f.sort];
  const res = await projectsQuery(ws, where, order);
  return res.rows.map(fromRaw);
}

export async function getProjectSummary(ws: string, id: string) {
  const res = await projectsQuery(ws, [sql`p.workspace_id = ${ws}`, sql`p.id = ${id}`, sql`p.archived_at is null`], sql`p.id`);
  return res.rows[0] ? fromRaw(res.rows[0]) : null;
}

export async function getProject(ws: string, id: string) {
  const [row] = await db
    .select({ project: projects, clientName: clients.name, leadTitle: leads.title })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .leftJoin(leads, eq(leads.id, projects.leadId))
    .where(and(eq(projects.id, id), eq(projects.workspaceId, ws), isNull(projects.archivedAt)));
  return row ? { ...row.project, clientName: row.clientName, leadTitle: row.leadTitle } : null;
}
export type ProjectRecord = NonNullable<Awaited<ReturnType<typeof getProject>>>;

export async function getProjectMilestones(ws: string, id: string) {
  return db
    .select({
      id: milestones.id,
      title: milestones.title,
      dueDate: milestones.dueDate,
      status: milestones.status,
      amountMinor: milestones.amountMinor,
      completedAt: milestones.completedAt,
      invoiceId: milestones.invoiceId,
      invoiceNumber: invoices.number,
    })
    .from(milestones)
    .leftJoin(invoices, eq(invoices.id, milestones.invoiceId))
    .where(and(eq(milestones.workspaceId, ws), eq(milestones.projectId, id), isNull(milestones.archivedAt)))
    .orderBy(asc(milestones.position), asc(milestones.dueDate));
}
export type MilestoneRow = Awaited<ReturnType<typeof getProjectMilestones>>[number];

export async function getProjectTasks(ws: string, id: string) {
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      assigneeId: tasks.assigneeId,
      assigneeName: users.name,
    })
    .from(tasks)
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .where(and(eq(tasks.workspaceId, ws), eq(tasks.projectId, id), isNull(tasks.archivedAt)))
    .orderBy(
      sql`${tasks.status} = 'done'`,
      sql`${tasks.dueDate} asc nulls last`,
      sql`array_position(array['urgent','high','medium','low']::priority[], ${tasks.priority})`,
      asc(tasks.position),
    );
}

export async function getProjectInvoices(ws: string, id: string) {
  return db
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoiceBalances.displayStatus,
      daysOverdue: invoiceBalances.daysOverdue,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      totalMinor: invoices.totalMinor,
      paidMinor: invoiceBalances.paidMinor,
      balanceMinor: invoiceBalances.balanceMinor,
      currency: invoices.currency,
    })
    .from(invoices)
    .innerJoin(invoiceBalances, eq(invoiceBalances.invoiceId, invoices.id))
    .where(and(eq(invoices.workspaceId, ws), eq(invoices.projectId, id)))
    .orderBy(desc(invoices.issueDate), desc(invoices.number));
}
export type ProjectInvoice = Awaited<ReturnType<typeof getProjectInvoices>>[number];

export async function getProjectActivity(ws: string, id: string, limit = 50) {
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
    .where(and(eq(activities.workspaceId, ws), eq(activities.entityType, "project"), eq(activities.entityId, id)))
    .orderBy(desc(activities.occurredAt), desc(activities.id))
    .limit(limit);
}

/** Projects of one client (for the client filter and the client record's Projects tab). */
export async function getProjectClients(ws: string) {
  return db
    .selectDistinct({ id: clients.id, name: clients.name })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(and(eq(projects.workspaceId, ws), isNull(projects.archivedAt)))
    .orderBy(asc(clients.name));
}

/** A won lead offered for conversion ("Convert to project" prefill). */
export async function getLeadForConversion(ws: string, id: string) {
  const [row] = await db
    .select({
      id: leads.id,
      title: leads.title,
      clientId: leads.clientId,
      valueMinor: leads.valueMinor,
      currency: leads.currency,
      convertedProjectId: leads.convertedProjectId,
    })
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.workspaceId, ws), isNull(leads.archivedAt)));
  return row ?? null;
}
