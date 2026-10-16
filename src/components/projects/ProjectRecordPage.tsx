import { Suspense, type ReactNode } from "react";
import { FilesPanel } from "@/components/files/FilesPanel";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CircleAlert,
  Clock,
  FolderGit2,
  Paperclip,
  Plus,
  Receipt,
  SquareCheckBig,
  Target,
  TriangleAlert,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { isUuid } from "@/db/queries/clients";
import { getClientOptions } from "@/db/queries/leads";
import {
  getProject,
  getProjectActivity,
  getProjectInvoices,
  getProjectMilestones,
  getProjectSummary,
  getProjectTasks,
  progressOf,
  type MilestoneRow,
  type ProjectRecord,
  type ProjectRow,
} from "@/db/queries/projects";
import { due } from "@/lib/due";
import { dayDiff, formatter, type Formatter, type Locale } from "@/lib/format";
import { getSession } from "@/lib/session";
import { Timeline } from "@/components/activity/Timeline";
import { ActivityComposer, TabLinks } from "@/components/clients/ProfileClientParts";
import { TaskRow } from "@/components/dashboard/TaskCheck";
import { RecordCrumb } from "@/components/shell/Crumbs";
import { hueOf, initials } from "@/components/shell/initials";
import { Card, CardSkeleton, EmptyState } from "@/components/ui/Card";
import { DueLabel } from "@/components/ui/DueLabel";
import { PaymentSummary, paymentTotals } from "@/components/ui/PaymentSummary";
import { Priority } from "@/components/ui/Priority";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WidgetError } from "@/components/ui/WidgetError";
import { ProjectDrawer } from "./ProjectDrawer";
import {
  InlineAdd,
  MilestoneToggle,
  ProjectMoreMenu,
  ProjectStatusMenu,
} from "./ProjectRecordActions";
import { budgetTone } from "./ProjectsPage";
import type { ProjectFormValues } from "./schema";

export const PROJECT_TABS = [
  "overview",
  "tasks",
  "milestones",
  "files",
  "invoices",
  "activity",
] as const;
type Tab = (typeof PROJECT_TABS)[number];
type SP = Record<string, string | string[] | undefined>;
type Ctx = { ws: string; id: string; currency: string; now: Date; f: Formatter };

export async function loadProjectForMeta(id: string) {
  if (!isUuid(id)) return null;
  const session = await getSession();
  return getProject(session.workspaceId, id).catch(() => null);
}

/**
 * DS › ProjectHeader: title + status + actions (primary "Create invoice" when a completed milestone is
 * unbilled), meta row, stat strip (Progress · Next milestone · Budget · Billing), milestone stepper,
 * tabs Overview · Tasks · Milestones · Files · Invoices · Activity. Money links to the filtered invoices.
 */
export async function ProjectRecordPage({ id, sp }: { id: string; sp: SP }) {
  if (!isUuid(id)) notFound();
  const session = await getSession();
  const [project, summary] = await Promise.all([
    getProject(session.workspaceId, id),
    getProjectSummary(session.workspaceId, id),
  ]);
  if (!project || !summary) notFound();
  const tabParam = typeof sp.tab === "string" ? sp.tab : "";
  const tab: Tab = (PROJECT_TABS as readonly string[]).includes(tabParam)
    ? (tabParam as Tab)
    : "overview";
  const t = await getTranslations("projects.record");
  const tn = await getTranslations("nav");
  const f = formatter((await getLocale()) as Locale);
  const now = new Date();
  const ctx: Ctx = { ws: session.workspaceId, id, currency: project.currency, now, f };
  const milestones = await getProjectMilestones(session.workspaceId, id).catch(
    () => [] as MilestoneRow[],
  );
  const unbilled = milestones.find((m) => m.status === "completed" && !m.invoiceId);
  const editing = sp.edit === "1";
  const clients = editing ? await getClientOptions(session.workspaceId) : [];

  const tabs = PROJECT_TABS.map((key) => ({
    key,
    label: t(`tab_${key}`),
    count:
      key === "tasks"
        ? summary.tasksTotal - summary.tasksDone
        : key === "milestones"
          ? summary.milestonesTotal
          : undefined,
    href: key === "overview" ? `/projects/${id}` : `/projects/${id}?tab=${key}`,
  }));

  return (
    <>
      <RecordCrumb label={project.name} />
      <nav aria-label={t("back")} className="profile-back">
        <Link className="ax-link" href="/projects">
          <ArrowLeft className="ax-icon ax-icon-sm ax-flip" aria-hidden />
          {tn("projects")}
        </Link>
      </nav>

      <header className="ax-card project-head">
        <div className="project-title">
          <h1 className="t-page-title">{project.name}</h1>
          <span
            className="status-wrap"
            title={
              project.status === "at_risk" && summary.lateMilestones > 0
                ? t("lateMilestones", { count: summary.lateMilestones })
                : undefined
            }
          >
            <StatusBadge domain="project" code={project.status} />
          </span>
          <div className="actions">
            <ProjectStatusMenu id={id} name={project.name} status={project.status} />
            <Link
              className="ax-btn ax-btn-secondary ax-btn-sm"
              href={`/projects/${id}?tab=tasks`}
              scroll={false}
            >
              <Plus className="ax-icon" aria-hidden />
              {t("newTask")}
            </Link>
            {unbilled && (
              <Link
                className="ax-btn ax-btn-primary ax-btn-sm"
                href={`/invoices?new=1&project=${id}&milestone=${unbilled.id}`}
              >
                <Receipt className="ax-icon" aria-hidden />
                {t("createInvoice")}
              </Link>
            )}
            <ProjectMoreMenu id={id} name={project.name} />
          </div>
        </div>
        <Meta project={project} f={f} now={now} t={t} />
        {unbilled && (
          <p className="ax-banner info unbilled">
            <Receipt className="ax-icon" aria-hidden />
            {t("unbilledMilestone", { title: unbilled.title })}
          </p>
        )}
        <StatStrip summary={summary} f={f} now={now} id={id} />
        {milestones.length > 0 && (
          <Stepper milestones={milestones} f={f} now={now} label={t("milestoneSteps")} />
        )}
      </header>

      <TabLinks label={t("tabs")} tabs={tabs} current={tab} panelId="project-tabpanel" />
      <section
        id="project-tabpanel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="profile-panel"
      >
        <Suspense key={tab} fallback={<CardSkeleton rows={5} label={t(`tab_${tab}`)} />}>
          {tab === "overview" && <Overview ctx={ctx} />}
          {tab === "tasks" && <TasksTab ctx={ctx} />}
          {tab === "milestones" && <MilestonesTab ctx={ctx} milestones={milestones} />}
          {tab === "files" && (
            <FilesPanel entityType="project" entityId={ctx.id} emptyTitle={t("noFiles")} emptyBody={t("noFilesBody")} />
          )}
          {tab === "invoices" && <InvoicesTab ctx={ctx} />}
          {tab === "activity" && <ActivityTab ctx={ctx} />}
        </Suspense>
      </section>

      {editing && (
        <ProjectDrawer
          edit={{ id }}
          clients={clients.map((c) => ({ value: c.id, label: c.name, currency: c.currency }))}
          initial={formValues(project)}
          closeHref={tab === "overview" ? `/projects/${id}` : `/projects/${id}?tab=${tab}`}
        />
      )}
    </>
  );
}

function formValues(p: ProjectRecord): ProjectFormValues {
  return {
    name: p.name,
    clientId: p.clientId,
    status: p.status === "archived" ? "completed" : p.status,
    startDate: p.startDate ?? "",
    deadline: p.deadline ?? "",
    budget: p.budgetMinor === null ? "" : (p.budgetMinor / 100).toFixed(2),
    currency: p.currency,
    repoUrl: p.repoUrl ?? "",
    description: p.description ?? "",
    leadId: p.leadId ?? "",
  };
}

type T = Awaited<ReturnType<typeof getTranslations<"projects.record">>>;

function Meta({ project, f, now, t }: { project: ProjectRecord; f: Formatter; now: Date; t: T }) {
  const closed = project.status === "completed" || project.status === "archived";
  const left = project.deadline ? dayDiff(project.deadline, now) : null;
  const parts: ReactNode[] = [
    <span key="c" className="meta-client">
      <span className="ax-avatar sm sq" data-hue={hueOf(project.clientId)} aria-hidden>
        {initials(project.clientName)}
      </span>
      <Link className="ax-link" href={`/clients/${project.clientId}`}>
        {project.clientName}
      </Link>
    </span>,
    <span key="code" className="ax-mono ax-ltr">
      {project.code}
    </span>,
  ];
  if (project.startDate || project.deadline)
    parts.push(
      <span key="d" className="ax-num">
        {project.startDate ? f.date(project.startDate, "medium") : "…"} →{" "}
        {project.deadline ? f.date(project.deadline, "medium") : "…"}
      </span>,
    );
  if (left !== null && !closed)
    parts.push(
      left < 0 ? (
        <span key="l" className="ax-due overdue">
          <CircleAlert className="ax-icon" aria-hidden />
          {t("daysLate", { count: -left })}
        </span>
      ) : (
        <span key="l" className={`ax-due${left <= 1 ? " soon" : ""}`}>
          <Clock className="ax-icon" aria-hidden />
          {t("daysLeft", { count: left })}
        </span>
      ),
    );
  if (project.repoUrl)
    parts.push(
      <a
        key="r"
        className="ax-link ax-mono ax-ltr repo"
        href={project.repoUrl}
        target="_blank"
        rel="noreferrer"
      >
        <FolderGit2 className="ax-icon ax-icon-sm" aria-hidden />
        {project.repoUrl.replace(/^https?:\/\//, "")}
      </a>,
    );
  if (project.leadId && project.leadTitle)
    parts.push(
      <Link key="lead" className="ax-link" href={`/leads/${project.leadId}`}>
        <Target className="ax-icon ax-icon-sm" aria-hidden />{" "}
        {t("fromLead", { title: project.leadTitle })}
      </Link>,
    );
  return (
    <div className="project-meta">
      {parts.map((p, i) => (
        <span key={i} className="meta-part">
          {i > 0 && (
            <span className="sep" aria-hidden>
              ·
            </span>
          )}
          {p}
        </span>
      ))}
    </div>
  );
}

async function StatStrip({
  summary: s,
  f,
  now,
  id,
}: {
  summary: ProjectRow;
  f: Formatter;
  now: Date;
  id: string;
}) {
  const t = await getTranslations("projects.record");
  const tc = await getTranslations("common");
  const progress = progressOf(s);
  const used = s.budgetMinor ? s.earnedMinor / s.budgetMinor : null;
  const tone = used === null ? undefined : budgetTone(used);
  const invoicesHref = `/invoices?project=${id}`;
  return (
    <section className="ax-kpis project-kpis" aria-label={t("stats")}>
      <div className="ax-metric">
        <span className="lbl">{t("progress")}</span>
        <ProgressBar value={progress} label={t("progress")} />
        <span className="sub">
          {s.tasksTotal > 0
            ? t("tasksDone", { done: f.number(s.tasksDone), total: f.number(s.tasksTotal) })
            : t("milestonesDone", {
                done: f.number(s.milestonesDone),
                total: f.number(s.milestonesTotal),
              })}
          {" · "}
          {f.percent(progress)}
        </span>
      </div>
      <div className="ax-metric">
        <span className="lbl">{t("nextMilestone")}</span>
        {s.nextMilestone ? (
          <>
            <span className="val-sm">{s.nextMilestone.title}</span>
            <span className="sub">
              {s.nextMilestone.dueDate ? (
                <DueLabel
                  due={due(s.nextMilestone.dueDate, f, (d) => tc("overdueDays", { days: d }), {
                    now,
                  })}
                />
              ) : (
                t("noDate")
              )}
            </span>
          </>
        ) : (
          <span className="val-sm ax-faint">{t("noNextMilestone")}</span>
        )}
      </div>
      <div className="ax-metric">
        <span className="lbl">{t("budget")}</span>
        {s.budgetMinor ? (
          <>
            <span className="val-sm ax-num">
              {f.money(s.earnedMinor, s.currency, { whole: true })} /{" "}
              {f.money(s.budgetMinor, s.currency, { whole: true })}
            </span>
            <span className={`sub budget-used ${tone ?? ""}`}>
              {tone && <TriangleAlert className="ax-icon ax-icon-sm" aria-hidden />}
              {used! > 1
                ? t("overBudget", { amount: f.money(s.earnedMinor - s.budgetMinor, s.currency) })
                : t("budgetUsed", { percent: f.percent(used!) })}
            </span>
          </>
        ) : (
          <span className="val-sm ax-faint">{t("noBudget")}</span>
        )}
      </div>
      <div className="ax-metric">
        <span className="lbl">{t("billing")}</span>
        <Link className="val-sm ax-num ax-link" href={invoicesHref}>
          {t("invoiced", { amount: f.money(s.billedMinor, s.currency, { whole: true }) })}
        </Link>
        <span className="sub">
          {t("paidDue", {
            paid: f.money(s.paidMinor, s.currency, { whole: true }),
            due: f.money(s.dueMinor, s.currency, { whole: true }),
          })}
        </span>
      </div>
    </section>
  );
}

function Stepper({
  milestones,
  f,
  now,
  label,
}: {
  milestones: MilestoneRow[];
  f: Formatter;
  now: Date;
  label: string;
}) {
  const currentIndex = milestones.findIndex((m) => m.status !== "completed");
  return (
    <ol className="ax-steps project-steps" aria-label={label}>
      {milestones.map((m, i) => {
        const late = m.status !== "completed" && m.dueDate !== null && dayDiff(m.dueDate, now) < 0;
        const cls =
          m.status === "completed" ? "done" : late ? "late" : i === currentIndex ? "current" : "";
        return (
          <li
            key={m.id}
            className={`ax-step ${cls}`}
            aria-current={i === currentIndex ? "step" : undefined}
          >
            <span className="n">{m.title}</span>
            {m.dueDate && (
              <span className={late ? "step-late" : ""}>{f.date(m.dueDate, "short")}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ── Tabs ────────────────────────────────────────────────────────────────────────────────
async function Overview({ ctx }: { ctx: Ctx }) {
  const t = await getTranslations("projects.record");
  const tc = await getTranslations("common");
  const [invoices, taskRows, activity] = await Promise.all([
    getProjectInvoices(ctx.ws, ctx.id).catch(() => null),
    getProjectTasks(ctx.ws, ctx.id).catch(() => null),
    getProjectActivity(ctx.ws, ctx.id, 5).catch(() => null),
  ]);
  const open = (taskRows ?? []).filter((x) => x.status !== "done").slice(0, 5);
  return (
    <div className="overview-grid">
      {taskRows ? (
        <Card
          id="pj-tasks"
          title={t("openTasks")}
          icon={SquareCheckBig}
          href={`/projects/${ctx.id}?tab=tasks`}
          linkLabel={tc("viewAll")}
        >
          {open.length === 0 ? (
            <EmptyState icon={SquareCheckBig} title={t("noOpenTasks")} />
          ) : (
            <TaskList rows={open} ctx={ctx} />
          )}
        </Card>
      ) : (
        <WidgetError title={t("openTasks")} />
      )}
      {invoices ? (
        <Card
          id="pj-pay"
          title={t("payments")}
          icon={Receipt}
          tint="orange"
          href={`/projects/${ctx.id}?tab=invoices`}
          linkLabel={tc("viewAll")}
        >
          <div className="card-body">
            <PaymentSummary totals={paymentTotals(ctx.currency, invoices)} f={ctx.f} />
          </div>
        </Card>
      ) : (
        <WidgetError title={t("payments")} />
      )}
      {activity ? (
        <Card
          id="pj-act"
          title={t("recentActivity")}
          icon={Target}
          tint="violet"
          href={`/projects/${ctx.id}?tab=activity`}
          linkLabel={tc("viewAll")}
          className="span-all"
        >
          <Timeline items={activity} now={ctx.now} currency={ctx.currency} grouped={false} />
        </Card>
      ) : (
        <WidgetError title={t("recentActivity")} />
      )}
    </div>
  );
}

async function TaskList({
  rows,
  ctx,
}: {
  rows: Awaited<ReturnType<typeof getProjectTasks>>;
  ctx: Ctx;
}) {
  const tc = await getTranslations("common");
  const ts = await getTranslations("status.task");
  return (
    <ul className="card-list project-tasks">
      {rows.map((task) => {
        const d = task.dueDate
          ? due(task.dueDate, ctx.f, (n) => tc("overdueDays", { days: n }), { now: ctx.now })
          : null;
        return (
          <TaskRow
            key={task.id}
            id={task.id}
            title={task.title}
            status={task.status}
            overdue={d?.tone === "overdue" && task.status !== "done"}
            initialDone={task.status === "done"}
          >
            <Priority level={task.priority} compact />
            <span className="title">{task.title}</span>
            {task.status !== "todo" && task.status !== "done" && (
              <span className="proj">{ts(task.status as never)}</span>
            )}
            {d && task.status !== "done" && <DueLabel due={d} />}
            {task.assigneeName && (
              <span
                className="ax-avatar sm"
                data-hue={hueOf(task.assigneeId ?? "")}
                title={task.assigneeName}
                aria-hidden
              >
                {initials(task.assigneeName)}
              </span>
            )}
          </TaskRow>
        );
      })}
    </ul>
  );
}

async function TasksTab({ ctx }: { ctx: Ctx }) {
  const t = await getTranslations("projects.record");
  const rows = await getProjectTasks(ctx.ws, ctx.id).catch(() => null);
  if (!rows) return <WidgetError title={t("tab_tasks")} />;
  return (
    <div className="ax-card">
      {rows.length === 0 ? (
        <EmptyState icon={SquareCheckBig} title={t("noTasks")} />
      ) : (
        <TaskList rows={rows} ctx={ctx} />
      )}
      <div className="inline-add-row">
        <InlineAdd projectId={ctx.id} kind="task" />
      </div>
    </div>
  );
}

async function MilestonesTab({ ctx, milestones }: { ctx: Ctx; milestones: MilestoneRow[] }) {
  const t = await getTranslations("projects.record");
  const tm = await getTranslations("projects.milestones");
  const tc = await getTranslations("common");
  return (
    <div className="ax-card">
      {milestones.length === 0 ? (
        <EmptyState icon={Target} title={t("noMilestones")} />
      ) : (
        <ul className="card-list milestone-list">
          {milestones.map((m) => (
            <li key={m.id} className="ms-row">
              <div className="txt">
                <b>{m.title}</b>
                <span>
                  {m.dueDate && m.status !== "completed" ? (
                    <DueLabel
                      due={due(m.dueDate, ctx.f, (n) => tc("overdueDays", { days: n }), {
                        now: ctx.now,
                      })}
                    />
                  ) : m.completedAt ? (
                    tm("completedOn", { date: ctx.f.date(m.completedAt, "medium") })
                  ) : null}
                </span>
              </div>
              {m.amountMinor !== null && (
                <span className="amt ax-num">{ctx.f.money(m.amountMinor, ctx.currency)}</span>
              )}
              <StatusBadge domain="milestone" code={m.status} />
              {m.status === "completed" &&
                (m.invoiceId ? (
                  <Link className="ax-link ax-mono ax-ltr" href={`/invoices/${m.invoiceId}`}>
                    {m.invoiceNumber}
                  </Link>
                ) : (
                  <Link
                    className="ax-btn ax-btn-primary ax-btn-xs"
                    href={`/invoices?new=1&project=${ctx.id}&milestone=${m.id}`}
                  >
                    <Receipt className="ax-icon" aria-hidden />
                    {t("createInvoice")}
                  </Link>
                ))}
              {!m.invoiceId && <MilestoneToggle id={m.id} title={m.title} status={m.status} />}
            </li>
          ))}
        </ul>
      )}
      <div className="inline-add-row">
        <InlineAdd projectId={ctx.id} kind="milestone" />
      </div>
    </div>
  );
}

async function InvoicesTab({ ctx }: { ctx: Ctx }) {
  const t = await getTranslations("projects.record");
  const tp = await getTranslations("clients.profile");
  const rows = await getProjectInvoices(ctx.ws, ctx.id).catch(() => null);
  if (!rows) return <WidgetError title={t("tab_invoices")} />;
  if (rows.length === 0)
    return (
      <div className="ax-card">
        <EmptyState icon={Receipt} title={t("noInvoices")} />
      </div>
    );
  return (
    <div
      className="ax-table-wrap scroll-x"
      tabIndex={0}
      role="region"
      aria-label={t("tab_invoices")}
    >
      <table className="ax-table">
        <caption className="sr-only">{t("tab_invoices")}</caption>
        <thead>
          <tr>
            <th scope="col">{tp("colNumber")}</th>
            <th scope="col">{tp("colStatus")}</th>
            <th scope="col">{tp("colIssued")}</th>
            <th scope="col">{tp("colDue")}</th>
            <th scope="col" className="num">
              {tp("colAmount")}
            </th>
            <th scope="col" className="num">
              {tp("colBalance")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((inv) => (
            <tr key={inv.id}>
              <td>
                <Link className="ax-link ax-mono ax-ltr" href={`/invoices/${inv.id}`}>
                  {inv.number}
                </Link>
              </td>
              <td>
                <StatusBadge
                  domain="invoice"
                  code={inv.status}
                  suffix={
                    inv.status === "overdue"
                      ? tp("daysCount", { count: inv.daysOverdue })
                      : undefined
                  }
                />
              </td>
              <td>{ctx.f.date(inv.issueDate, "medium")}</td>
              <td>{ctx.f.date(inv.dueDate, "medium")}</td>
              <td className="num">{ctx.f.money(inv.totalMinor, inv.currency)}</td>
              <td className="num strong">{ctx.f.money(inv.balanceMinor, inv.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function ActivityTab({ ctx }: { ctx: Ctx }) {
  const t = await getTranslations("projects.record");
  const items = await getProjectActivity(ctx.ws, ctx.id, 100).catch(() => null);
  return (
    <div className="ax-card activity-card">
      <ActivityComposer target={{ type: "project", id: ctx.id }} />
      {items ? (
        <Timeline items={items} now={ctx.now} currency={ctx.currency} grouped />
      ) : (
        <WidgetError title={t("tab_activity")} />
      )}
    </div>
  );
}
