import { Suspense } from "react";
import { Plus, SquareCheckBig } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { isUuid } from "@/db/queries/clients";
import {
  getTask,
  getTaskOptions,
  listTasks,
  OPEN_TASK_STATUSES,
  parseTaskFilters,
  TASK_PRIORITIES,
  type TaskFilters,
  type TaskRowData,
} from "@/db/queries/tasks";
import { due } from "@/lib/due";
import { formatter, type Locale } from "@/lib/format";
import { getSession } from "@/lib/session";
import { hueOf, initials } from "@/components/shell/initials";
import { CardSkeleton, EmptyState } from "@/components/ui/Card";
import { WidgetError } from "@/components/ui/WidgetError";
import { TaskBoard, type TaskGroupView, type TaskView } from "./TaskBoard";
import { TaskDrawer } from "./TaskDrawer";
import { TasksToolbar } from "./TasksToolbar";
import {
  addDays,
  daysToWeekEnd,
  dueBucket,
  emptyTaskValues,
  isoLocal,
  type DueBucket,
} from "./schema";

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const toQuery = (sp: SP, drop: string[] = []) => {
  const q = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
  );
  for (const k of drop) q.delete(k);
  return q;
};
const withQuery = (q: URLSearchParams) => `/tasks${q.toString() ? `?${q}` : ""}`;

/** DS › CRM patterns › Tasks: TaskList grouped by due (default), project or status; `T` opens the quick-create drawer. */
export async function TasksPage({ searchParams }: { searchParams: SP }) {
  const session = await getSession();
  const t = await getTranslations("tasks");
  const tn = await getTranslations("nav");
  const ts = await getTranslations("status.priority");
  const filters = parseTaskFilters(searchParams);
  const options = await getTaskOptions(session.workspaceId).catch(() => ({
    projects: [],
    people: [],
  }));
  const newQ = toQuery(searchParams, ["task"]);
  newQ.set("new", "1");
  const editId = str(searchParams.task);
  const editing = editId && isUuid(editId) ? await getTask(session.workspaceId, editId) : null;
  const closeHref = withQuery(toQuery(searchParams, ["new", "task"]));
  const projectOpts = options.projects.map((p) => ({ value: p.id, label: p.name }));
  const peopleOpts = options.people.map((p) => ({ value: p.id, label: p.name }));

  return (
    <>
      <header className="pagehead">
        <h1 className="t-page-title">{tn("tasks")}</h1>
        <div className="actions">
          <Link className="ax-btn ax-btn-primary ax-btn-sm" href={`/tasks?${newQ}`} scroll={false}>
            <Plus className="ax-icon" aria-hidden />
            {t("newTask")}
            <kbd className="ax-kbd" aria-hidden>
              T
            </kbd>
          </Link>
        </div>
      </header>

      <div className="ax-table-wrap clients-frame tasks-frame">
        <TasksToolbar
          group={filters.group}
          projects={[{ value: "none", label: t("noProject") }, ...projectOpts]}
          priorities={TASK_PRIORITIES.map((p) => ({ value: p, label: ts(p) }))}
          people={peopleOpts}
          resultsLabel={t("showResults")}
        />
        <Suspense
          key={JSON.stringify(filters)}
          fallback={<CardSkeleton rows={8} label={tn("tasks")} />}
        >
          <TasksContent
            filters={filters}
            editHref={withQuery(toQuery(searchParams, ["new", "task"]))}
          />
        </Suspense>
      </div>

      {str(searchParams.new) === "1" && (
        <TaskDrawer
          initial={emptyTaskValues({
            assigneeId: session.userId,
            projectId:
              str(searchParams.project) && isUuid(str(searchParams.project))
                ? str(searchParams.project)
                : "",
          })}
          projects={projectOpts}
          people={peopleOpts}
          closeHref={closeHref}
        />
      )}
      {editing && (
        <TaskDrawer
          key={editing.id}
          edit={{ id: editing.id }}
          initial={{
            title: editing.title,
            projectId: editing.projectId ?? "",
            status: editing.status,
            priority: editing.priority,
            dueDate: editing.dueDate ?? "",
            assigneeId: editing.assigneeId ?? "",
          }}
          projects={projectOpts}
          people={peopleOpts}
          closeHref={closeHref}
        />
      )}
    </>
  );
}

async function TasksContent({ filters, editHref }: { filters: TaskFilters; editHref: string }) {
  const session = await getSession();
  const t = await getTranslations("tasks");
  const tc = await getTranslations("common");
  const tst = await getTranslations("status.task");
  const f = formatter((await getLocale()) as Locale);
  const now = new Date();
  let data: Awaited<ReturnType<typeof listTasks>>;
  try {
    data = await listTasks(session.workspaceId, filters, now);
  } catch (err) {
    console.error("[tasks]", err);
    return <WidgetError title={t("listLabel")} />;
  }
  const anyFilter = !!(filters.q || filters.project || filters.priority || filters.assignee);
  if (data.open.length === 0 && data.done.length === 0)
    return (
      <div className="clients-empty">
        <EmptyState
          icon={SquareCheckBig}
          title={anyFilter ? t("noMatchTitle") : t("emptyTitle")}
          body={anyFilter ? t("noMatchBody") : t("emptyBody")}
        />
        {anyFilter && (
          <Link className="ax-btn ax-btn-secondary ax-btn-sm" href="/tasks" scroll={false}>
            {tc("clearFilters")}
          </Link>
        )}
      </div>
    );

  const view = (r: TaskRowData): TaskView => {
    const d = r.dueDate ? due(r.dueDate, f, (n) => tc("overdueDays", { days: n }), { now }) : null;
    return {
      id: r.id,
      title: r.title,
      status: r.status,
      priority: r.priority,
      due: d,
      overdue: d?.tone === "overdue" && r.status !== "done",
      done: r.status === "done",
      project: r.projectId && r.projectName ? { id: r.projectId, name: r.projectName } : null,
      assignee: r.assigneeName
        ? {
            name: r.assigneeName,
            initials: initials(r.assigneeName),
            hue: hueOf(r.assigneeId ?? ""),
          }
        : null,
    };
  };
  const projectFilter = filters.project && filters.project !== "none" ? filters.project : "";
  const completed: TaskGroupView = {
    key: "done",
    label: t("group.completed"),
    rows: data.done.map(view),
    add: null,
    collapsed: true,
  };
  const groups: TaskGroupView[] = [];

  if (filters.group === "due") {
    const today = new Date(now);
    const defaults: Record<DueBucket, string | null> = {
      overdue: null,
      today: isoLocal(today),
      week: isoLocal(addDays(today, 1)),
      later: isoLocal(addDays(today, daysToWeekEnd(today) + 1)),
      none: "",
    };
    for (const bucket of ["overdue", "today", "week", "later", "none"] as const) {
      const rows = data.open.filter((r) => dueBucket(r.dueDate, today) === bucket).map(view);
      // "This week" has no days left on Sundays; Overdue never gets an add row.
      const add =
        defaults[bucket] === null || (bucket === "week" && daysToWeekEnd(today) === 0)
          ? null
          : { dueDate: defaults[bucket]!, projectId: projectFilter };
      groups.push({
        key: bucket,
        label: t(`group.${bucket}`),
        rows,
        add,
        danger: bucket === "overdue" && rows.length > 0,
      });
    }
  } else if (filters.group === "project") {
    const byProject = new Map<string, { name: string; rows: TaskRowData[] }>();
    for (const r of data.open) {
      const key = r.projectId ?? "none";
      const g = byProject.get(key) ?? { name: r.projectName ?? t("noProject"), rows: [] };
      g.rows.push(r);
      byProject.set(key, g);
    }
    const keys = [...byProject.keys()].sort((a, b) =>
      a === "none"
        ? 1
        : b === "none"
          ? -1
          : byProject.get(a)!.name.localeCompare(byProject.get(b)!.name),
    );
    for (const key of keys)
      groups.push({
        key,
        label: byProject.get(key)!.name,
        rows: byProject.get(key)!.rows.map(view),
        add: { dueDate: "", projectId: key === "none" ? "" : key },
      });
  } else {
    for (const s of OPEN_TASK_STATUSES) {
      const rows = data.open.filter((r) => r.status === s).map(view);
      groups.push({
        key: s,
        label: tst(s),
        rows,
        add: null,
        danger: s === "blocked" && rows.length > 0,
      });
    }
  }
  groups.push(completed);

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {t("openCount", { count: data.open.length })}
      </p>
      <TaskBoard groups={groups} editHref={editHref} />
    </>
  );
}
