import { Suspense } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, FolderKanban, Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getClientOptions } from "@/db/queries/leads";
import {
  getLeadForConversion,
  getProjectClients,
  listProjects,
  parseProjectFilters,
  progressOf,
  PROJECT_STATUSES,
  type ProjectFilters,
  type ProjectRow,
} from "@/db/queries/projects";
import { due } from "@/lib/due";
import { formatter, type Formatter, type Locale } from "@/lib/format";
import { getSession } from "@/lib/session";
import { patchQuery } from "@/components/clients/url";
import { hueOf, initials } from "@/components/shell/initials";
import { CardSkeleton, EmptyState } from "@/components/ui/Card";
import { DueLabel } from "@/components/ui/DueLabel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WidgetError } from "@/components/ui/WidgetError";
import { ProjectDrawer } from "./ProjectDrawer";
import { ProjectsToolbar } from "./ProjectsToolbar";
import { emptyProjectValues } from "./schema";

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const toQuery = (sp: SP) =>
  new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
  );

/** Budget used = value of completed milestones / budget; > 90% warning, > 100% danger (DS › Progress). */
export function budgetTone(ratio: number) {
  return ratio > 1 ? "danger" : ratio > 0.9 ? "warning" : undefined;
}

/** DS › CRM patterns › Projects list: Project · Client · Status · Progress · Next milestone · Deadline · Budget used · Billed. */
export async function ProjectsPage({ searchParams }: { searchParams: SP }) {
  const session = await getSession();
  const t = await getTranslations("projects");
  const tn = await getTranslations("nav");
  const ts = await getTranslations("status.project");
  const filters = parseProjectFilters(searchParams);
  const projectClients = await getProjectClients(session.workspaceId).catch(() => []);
  const openNew = str(searchParams.new) === "1";
  const newQuery = toQuery(searchParams);
  newQuery.set("new", "1");

  return (
    <>
      <header className="pagehead">
        <h1 className="t-page-title">{tn("projects")}</h1>
        <div className="actions">
          <Link
            className="ax-btn ax-btn-primary ax-btn-sm"
            href={`/projects?${newQuery}`}
            scroll={false}
          >
            <Plus className="ax-icon" aria-hidden />
            {t("newProject")}
            <kbd className="ax-kbd" aria-hidden>
              P
            </kbd>
          </Link>
        </div>
      </header>

      <div className="ax-table-wrap clients-frame">
        <ProjectsToolbar
          statuses={PROJECT_STATUSES.map((s) => ({ value: s, label: ts(s) }))}
          clients={projectClients.map((c) => ({ value: c.id, label: c.name }))}
          resultsLabel={t("showResults")}
        />
        <Suspense
          key={JSON.stringify(filters)}
          fallback={<CardSkeleton rows={6} label={tn("projects")} />}
        >
          <ProjectsTable filters={filters} searchParams={searchParams} />
        </Suspense>
      </div>

      {openNew && <NewProjectDrawer searchParams={searchParams} />}
    </>
  );
}

/** Prefills from `?client=` or a won lead (`?lead=`, "Convert to project"). */
async function NewProjectDrawer({ searchParams }: { searchParams: SP }) {
  const session = await getSession();
  const clients = await getClientOptions(session.workspaceId);
  const leadId = str(searchParams.lead);
  const lead =
    leadId && /^[0-9a-f-]{36}$/i.test(leadId)
      ? await getLeadForConversion(session.workspaceId, leadId)
      : null;
  const clientId = lead?.clientId ?? str(searchParams.client) ?? "";
  const close = toQuery(searchParams);
  for (const k of ["new", "lead", "client"]) close.delete(k);
  const closeQs = close.toString();
  return (
    <ProjectDrawer
      clients={clients.map((c) => ({ value: c.id, label: c.name, currency: c.currency }))}
      initial={emptyProjectValues({
        currency:
          lead?.currency ??
          clients.find((c) => c.id === clientId)?.currency ??
          session.workspace.defaultCurrency,
        clientId: clients.some((c) => c.id === clientId) ? clientId : "",
        name: lead?.title ?? "",
        budget: lead && lead.valueMinor > 0 ? (lead.valueMinor / 100).toFixed(2) : "",
        leadId: lead?.id ?? "",
        status: lead ? "active" : "planning",
      })}
      leadTitle={lead && !lead.clientId ? lead.title : null}
      closeHref={`/projects${closeQs ? `?${closeQs}` : ""}`}
    />
  );
}

async function ProjectsTable({
  filters,
  searchParams,
}: {
  filters: ProjectFilters;
  searchParams: SP;
}) {
  const session = await getSession();
  const t = await getTranslations("projects");
  const tc = await getTranslations("common");
  const f = formatter((await getLocale()) as Locale);
  const now = new Date();
  let rows: ProjectRow[];
  try {
    rows = await listProjects(session.workspaceId, filters);
  } catch (err) {
    console.error("[projects]", err);
    return <WidgetError title={t("tableCaption")} />;
  }
  const anyFilter = !!(filters.q || filters.status || filters.client || filters.late);
  if (rows.length === 0)
    return (
      <div className="clients-empty">
        <EmptyState
          icon={FolderKanban}
          title={anyFilter ? t("noMatchTitle") : t("emptyTitle")}
          body={anyFilter ? t("noMatchBody") : t("emptyBody")}
        />
        {anyFilter && (
          <Link className="ax-btn ax-btn-secondary ax-btn-sm" href="/projects" scroll={false}>
            {tc("clearFilters")}
          </Link>
        )}
      </div>
    );

  const q = toQuery(searchParams);
  const explicit = str(searchParams.sort) === filters.sort;
  const sortHref = (key: string) => {
    if (!(explicit && filters.sort === key))
      return `/projects${patchQuery(q, { sort: key, dir: null })}`;
    if (filters.dir === "asc") return `/projects${patchQuery(q, { sort: key, dir: "desc" })}`;
    return `/projects${patchQuery(q, { sort: null, dir: null })}`;
  };
  const cols = [
    { key: "name", sortable: true, cls: "" },
    { key: "client", sortable: false, cls: "p2" },
    { key: "status", sortable: false, cls: "" },
    { key: "progress", sortable: true, cls: "" },
    { key: "nextMilestone", sortable: false, cls: "p3" },
    { key: "deadline", sortable: true, cls: "" },
    { key: "budget", sortable: false, cls: "num p3" },
    { key: "billed", sortable: true, cls: "num" },
  ] as const;

  return (
    <div className="table-scroll">
      <table className="ax-table clients-table projects-table">
        <caption className="sr-only">{t("tableCaption")}</caption>
        <thead>
          <tr>
            {cols.map((c) => {
              const ariaSort =
                filters.sort === c.key
                  ? filters.dir === "asc"
                    ? "ascending"
                    : "descending"
                  : undefined;
              const Icon =
                ariaSort === "ascending"
                  ? ArrowUp
                  : ariaSort === "descending"
                    ? ArrowDown
                    : ArrowUpDown;
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={`${c.cls}${c.sortable ? " sortable" : ""}`}
                  aria-sort={ariaSort}
                >
                  {c.sortable ? (
                    <Link className="th-sort" href={sortHref(c.key)} scroll={false}>
                      {t(`col.${c.key}`)}
                      <span className="sort" aria-hidden>
                        <Icon className="ax-icon ax-icon-xs" />
                      </span>
                    </Link>
                  ) : (
                    t(`col.${c.key}`)
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row key={r.id} r={r} f={f} now={now} t={t} tc={tc} />
          ))}
        </tbody>
      </table>
      <div className="ax-pager">
        <span>{t("tableCount", { count: rows.length })}</span>
      </div>
    </div>
  );
}

function Row({
  r,
  f,
  now,
  t,
  tc,
}: {
  r: ProjectRow;
  f: Formatter;
  now: Date;
  t: Awaited<ReturnType<typeof getTranslations<"projects">>>;
  tc: Awaited<ReturnType<typeof getTranslations<"common">>>;
}) {
  const progress = progressOf(r);
  const closed = r.status === "completed" || r.status === "archived";
  const overdueWords = (d: number) => tc("overdueDays", { days: d });
  const used = r.budgetMinor ? r.earnedMinor / r.budgetMinor : null;
  return (
    <tr>
      <td className="c-entity">
        <div className="ax-cell-entity">
          <span className="ax-avatar sq md" data-hue={hueOf(r.clientId)} aria-hidden>
            {initials(r.name)}
          </span>
          <div className="entity-txt">
            <Link className="name row-open" href={`/projects/${r.id}`}>
              {r.name}
            </Link>
            <span className="sub ax-mono ax-ltr">{r.code}</span>
          </div>
        </div>
      </td>
      <td className="p2" data-label={t("col.client")}>
        <Link className="ax-link" href={`/clients/${r.clientId}`}>
          {r.clientName}
        </Link>
      </td>
      <td className="c-status" data-label={t("col.status")}>
        <span
          title={
            r.status === "at_risk" && r.lateMilestones > 0
              ? t("lateMilestones", { count: r.lateMilestones })
              : undefined
          }
        >
          <StatusBadge domain="project" code={r.status} />
        </span>
      </td>
      <td className="c-progress" data-label={t("col.progress")}>
        <span className="progress-cell">
          <ProgressBar value={progress} label={t("progressOf", { name: r.name })} size="sm" />
          <span className="ax-num">{f.percent(progress)}</span>
        </span>
      </td>
      <td className="p3" data-label={t("col.nextMilestone")}>
        {r.nextMilestone ? (
          <span className="ms-cell">
            <span className="trunc">{r.nextMilestone.title}</span>
            {r.nextMilestone.dueDate && (
              <DueLabel due={due(r.nextMilestone.dueDate, f, overdueWords, { now })} />
            )}
          </span>
        ) : (
          <span className="ax-faint">—</span>
        )}
      </td>
      <td className="c-next" data-label={t("col.deadline")}>
        {r.deadline ? (
          closed ? (
            <span className="ax-muted">{f.date(r.deadline, "medium")}</span>
          ) : (
            <DueLabel due={due(r.deadline, f, overdueWords, { now })} />
          )
        ) : (
          <span className="ax-faint">—</span>
        )}
      </td>
      <td className="num p3" data-label={t("col.budget")}>
        {used === null ? (
          <span className="ax-faint">—</span>
        ) : (
          <span
            className={`budget-used ${budgetTone(used) ?? ""}`}
            title={`${f.money(r.earnedMinor, r.currency)} / ${f.money(r.budgetMinor!, r.currency)}`}
          >
            {f.percent(used)}
          </span>
        )}
      </td>
      <td className="num c-money" data-label={t("col.billed")}>
        <span className="money">{f.money(r.billedMinor, r.currency)}</span>
      </td>
    </tr>
  );
}
