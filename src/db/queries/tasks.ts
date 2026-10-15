import "server-only";
import { and, asc, desc, eq, gte, ilike, isNotNull, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { memberships, priority as priorityEnum, projects, tasks, taskStatus, users } from "@/db/schema";
import { isUuid } from "./clients";

export const TASK_STATUSES = taskStatus.enumValues;
export const OPEN_TASK_STATUSES = ["todo", "in_progress", "in_review", "blocked"] as const;
export const TASK_PRIORITIES = priorityEnum.enumValues;
export const TASK_GROUPINGS = ["due", "project", "status"] as const;
export type TaskGrouping = (typeof TASK_GROUPINGS)[number];

export type TaskFilters = {
  group: TaskGrouping;
  q: string;
  project: string | null;
  priority: (typeof TASK_PRIORITIES)[number] | null;
  assignee: string | null;
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseTaskFilters(sp: Params): TaskFilters {
  const group = one(sp.group);
  const pr = one(sp.priority);
  const project = one(sp.project);
  const assignee = one(sp.assignee);
  return {
    group: (TASK_GROUPINGS as readonly string[]).includes(group ?? "") ? (group as TaskGrouping) : "due",
    q: (one(sp.q) ?? "").trim().slice(0, 100),
    project: project === "none" || isUuid(project) ? (project ?? null) : null,
    priority: (TASK_PRIORITIES as readonly string[]).includes(pr ?? "") ? (pr as TaskFilters["priority"]) : null,
    assignee: isUuid(assignee) ? assignee : null,
  };
}

const columns = {
  id: tasks.id,
  title: tasks.title,
  status: tasks.status,
  priority: tasks.priority,
  dueDate: tasks.dueDate,
  completedAt: tasks.completedAt,
  projectId: tasks.projectId,
  projectName: projects.name,
  projectCode: projects.code,
  assigneeId: tasks.assigneeId,
  assigneeName: users.name,
  position: tasks.position,
};

/** DS › TaskList sort inside a group: due date, then priority (Urgent first), then manual position. */
const taskOrder = [
  sql`${tasks.dueDate} asc nulls last`,
  sql`array_position(array['urgent','high','medium','low']::priority[], ${tasks.priority})`,
  asc(tasks.position),
  asc(tasks.createdAt),
];

function filterWhere(ws: string, f: TaskFilters): SQL[] {
  const where: SQL[] = [eq(tasks.workspaceId, ws), isNull(tasks.archivedAt)];
  if (f.q) {
    const p = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push(or(ilike(tasks.title, p), ilike(projects.name, p))!);
  }
  if (f.project === "none") where.push(isNull(tasks.projectId));
  else if (f.project) where.push(eq(tasks.projectId, f.project));
  if (f.priority) where.push(eq(tasks.priority, f.priority));
  if (f.assignee) where.push(eq(tasks.assigneeId, f.assignee));
  return where;
}

/** Open tasks (all) and tasks completed in the last 14 days (for the collapsed Completed group). */
export async function listTasks(ws: string, f: TaskFilters, now = new Date()) {
  const since = new Date(now.getTime() - 14 * 86_400_000);
  const base = filterWhere(ws, f);
  const [open, done] = await Promise.all([
    db
      .select(columns)
      .from(tasks)
      .leftJoin(projects, eq(projects.id, tasks.projectId))
      .leftJoin(users, eq(users.id, tasks.assigneeId))
      .where(and(...base, ne(tasks.status, "done")))
      .orderBy(...taskOrder),
    db
      .select(columns)
      .from(tasks)
      .leftJoin(projects, eq(projects.id, tasks.projectId))
      .leftJoin(users, eq(users.id, tasks.assigneeId))
      .where(and(...base, eq(tasks.status, "done"), isNotNull(tasks.completedAt), gte(tasks.completedAt, since)))
      .orderBy(desc(tasks.completedAt))
      .limit(50),
  ]);
  return { open, done };
}
export type TaskRowData = Awaited<ReturnType<typeof listTasks>>["open"][number];

export async function getTask(ws: string, id: string) {
  const [row] = await db
    .select(columns)
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws), isNull(tasks.archivedAt)));
  return row ?? null;
}

/** Choices for filters and the task drawer. */
export async function getTaskOptions(ws: string) {
  const [projectRows, people] = await Promise.all([
    db
      .select({ id: projects.id, name: projects.name, code: projects.code })
      .from(projects)
      .where(and(eq(projects.workspaceId, ws), isNull(projects.archivedAt), ne(projects.status, "archived")))
      .orderBy(asc(projects.name)),
    db
      .select({ id: users.id, name: users.name })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.workspaceId, ws))
      .orderBy(asc(users.name)),
  ]);
  return { projects: projectRows, people };
}
