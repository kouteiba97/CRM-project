import { Suspense } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Target, TriangleAlert } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getClientListMeta } from "@/db/queries/clients";
import {
  getClientOptions,
  LEAD_STAGES,
  listLeads,
  parseLeadFilters,
  PRIORITIES,
  type LeadFilters,
  type LeadRow,
} from "@/db/queries/leads";
import { due } from "@/lib/due";
import { formatter, type Formatter, type Locale } from "@/lib/format";
import { getSession } from "@/lib/session";
import { patchQuery } from "@/components/clients/url";
import { hueOf, initials } from "@/components/shell/initials";
import { CardSkeleton, EmptyState } from "@/components/ui/Card";
import { DueLabel } from "@/components/ui/DueLabel";
import { Priority } from "@/components/ui/Priority";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WidgetError } from "@/components/ui/WidgetError";
import { LeadDrawer } from "./LeadDrawer";
import { LeadsBoard, type LeadCardView } from "./LeadsBoard";
import { LeadsToolbar } from "./LeadsToolbar";
import { emptyLeadValues, OPEN_STAGES } from "./schema";

type SP = Record<string, string | string[] | undefined>;

/** DS › CRM patterns › Leads: PageHeader → toolbar (filters, Board/Table) → KanbanBoard or DataTable. */
export async function LeadsPage({ searchParams }: { searchParams: SP }) {
  const session = await getSession();
  const t = await getTranslations("leads");
  const tn = await getTranslations("nav");
  const ts = await getTranslations("status");
  const f = formatter((await getLocale()) as Locale);
  const filters = parseLeadFilters(searchParams);
  const meta = await getClientListMeta(session.workspaceId).catch(() => null);
  const openNew = searchParams.new === "1";
  const clients = openNew ? await getClientOptions(session.workspaceId) : [];
  const newStage =
    typeof searchParams.stage === "string" &&
    (OPEN_STAGES as readonly string[]).includes(searchParams.stage)
      ? searchParams.stage
      : "new";

  return (
    <>
      <header className="pagehead">
        <h1 className="t-page-title">{tn("leads")}</h1>
        <div className="actions">
          <Link
            className="ax-btn ax-btn-primary ax-btn-sm"
            href={newHref(searchParams)}
            scroll={false}
          >
            <Plus className="ax-icon" aria-hidden />
            {t("newLead")}
            <kbd className="ax-kbd" aria-hidden>
              L
            </kbd>
          </Link>
        </div>
      </header>

      <div className={`ax-table-wrap clients-frame leads-frame view-${filters.view}`}>
        <LeadsToolbar
          view={filters.view}
          priorities={PRIORITIES.map((p) => ({ value: p, label: ts(`priority.${p}`) }))}
          owners={(meta?.owners ?? []).map((o) => ({ value: o.id, label: o.name }))}
          stages={LEAD_STAGES.map((s) => ({ value: s, label: ts(`lead.${s}`) }))}
          resultsLabel={t("showResults")}
        />
        <Suspense
          key={JSON.stringify(filters)}
          fallback={<CardSkeleton rows={6} label={tn("leads")} />}
        >
          <LeadsContent filters={filters} searchParams={searchParams} f={f} />
        </Suspense>
      </div>

      {openNew && (
        <LeadDrawer
          clients={clients.map((c) => ({ value: c.id, label: c.name, currency: c.currency }))}
          owners={(meta?.owners ?? []).map((o) => ({ value: o.id, label: o.name }))}
          initial={emptyLeadValues({
            currency: session.workspace.defaultCurrency,
            ownerId: session.userId,
            stage: newStage,
            clientId: typeof searchParams.client === "string" ? searchParams.client : "",
          })}
          closeHref={`/leads${patchQuery(toQuery(searchParams), { stage: filters.view === "table" ? (filters.stage ?? null) : null })}`}
        />
      )}
    </>
  );
}

/** Keeps the current filters and view; opens the New lead drawer on top. */
function newHref(sp: SP) {
  const q = toQuery(sp);
  q.set("new", "1");
  return `/leads?${q}`;
}

const toQuery = (sp: SP) =>
  new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
  );

function toCard(
  r: LeadRow,
  f: Formatter,
  overdueWords: (d: number) => string,
  now: Date,
): LeadCardView {
  const who = r.clientName ?? r.prospectCompany ?? r.prospectName;
  return {
    id: r.id,
    title: r.title,
    stage: r.stage,
    who,
    hue: hueOf(r.clientId ?? r.id),
    initials: initials(who ?? r.title),
    valueMinor: r.valueMinor,
    currency: r.currency,
    valueText: f.money(r.valueMinor, r.currency, { whole: true }),
    priority: r.priority,
    due: r.nextFollowUp ? due(r.nextFollowUp, f, overdueWords, { now }) : null,
    lostReason: r.lostReason,
  };
}

async function LeadsContent({
  filters,
  searchParams,
  f,
}: {
  filters: LeadFilters;
  searchParams: SP;
  f: Formatter;
}) {
  const session = await getSession();
  const t = await getTranslations("leads");
  const tc = await getTranslations("common");
  const now = new Date();
  let rows: LeadRow[];
  try {
    rows = await listLeads(session.workspaceId, filters);
  } catch (err) {
    console.error("[leads]", err);
    return <WidgetError title={t("boardLabel")} />;
  }
  const overdueWords = (d: number) => tc("overdueDays", { days: d });
  const anyFilter = !!(
    filters.q ||
    filters.priority ||
    filters.owner ||
    filters.noFollowUp ||
    filters.stage
  );

  if (rows.length === 0 && (anyFilter || filters.view === "table"))
    return (
      <div className="clients-empty">
        <EmptyState
          icon={Target}
          title={anyFilter ? t("noMatchTitle") : t("emptyTitle")}
          body={anyFilter ? t("noMatchBody") : t("emptyBody")}
        />
        {anyFilter && (
          <Link
            className="ax-btn ax-btn-secondary ax-btn-sm"
            href={filters.view === "table" ? "/leads?view=table" : "/leads"}
            scroll={false}
          >
            {tc("clearFilters")}
          </Link>
        )}
      </div>
    );

  if (filters.view === "board")
    return (
      <div className="board-scroll">
        <LeadsBoard
          initial={rows.map((r) => toCard(r, f, overdueWords, now))}
          currency={session.workspace.defaultCurrency}
        />
      </div>
    );
  return <LeadsTable rows={rows} filters={filters} searchParams={searchParams} f={f} now={now} />;
}

async function LeadsTable({
  rows,
  filters,
  searchParams,
  f,
  now,
}: {
  rows: LeadRow[];
  filters: LeadFilters;
  searchParams: SP;
  f: Formatter;
  now: Date;
}) {
  const t = await getTranslations("leads");
  const tc = await getTranslations("common");
  const q = toQuery(searchParams);
  const explicit = typeof searchParams.sort === "string" && searchParams.sort === filters.sort;
  const cols = [
    { key: "title", sortable: true, cls: "" },
    { key: "stage", sortable: false, cls: "" },
    { key: "value", sortable: true, cls: "num" },
    { key: "priority", sortable: false, cls: "p3" },
    { key: "nextFollowUp", sortable: true, cls: "" },
    { key: "expectedClose", sortable: true, cls: "p3" },
    { key: "owner", sortable: false, cls: "p2" },
  ] as const;
  const sortHref = (key: string) => {
    if (!(explicit && filters.sort === key))
      return `/leads${patchQuery(q, { sort: key, dir: null })}`;
    if (filters.dir === "asc") return `/leads${patchQuery(q, { sort: key, dir: "desc" })}`;
    return `/leads${patchQuery(q, { sort: null, dir: null })}`;
  };
  const overdueWords = (d: number) => tc("overdueDays", { days: d });

  return (
    <div className="table-scroll">
      <table className="ax-table clients-table leads-table">
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
          {rows.map((r) => {
            const who = r.clientName ?? r.prospectCompany ?? r.prospectName;
            const open = (OPEN_STAGES as readonly string[]).includes(r.stage);
            return (
              <tr key={r.id}>
                <td className="c-entity">
                  <div className="ax-cell-entity">
                    <span
                      className="ax-avatar sq md"
                      data-hue={hueOf(r.clientId ?? r.id)}
                      aria-hidden
                    >
                      {initials(who ?? r.title)}
                    </span>
                    <div className="entity-txt">
                      <Link className="name row-open" href={`/leads/${r.id}`}>
                        {r.title}
                      </Link>
                      {who && <span className="sub">{who}</span>}
                    </div>
                  </div>
                </td>
                <td className="c-status" data-label={t("col.stage")}>
                  <StatusBadge domain="lead" code={r.stage} />
                </td>
                <td className="num c-money" data-label={t("col.value")}>
                  <span className="money">{f.money(r.valueMinor, r.currency)}</span>
                </td>
                <td className="p3" data-label={t("col.priority")}>
                  <Priority level={r.priority} />
                </td>
                <td className="c-next" data-label={t("col.nextFollowUp")}>
                  {r.nextFollowUp ? (
                    <DueLabel due={due(r.nextFollowUp, f, overdueWords, { now })} />
                  ) : open ? (
                    <span className="ax-due no-fu">
                      <TriangleAlert className="ax-icon" aria-hidden />
                      {tc("noFollowUp")}
                    </span>
                  ) : (
                    <span className="ax-faint">—</span>
                  )}
                </td>
                <td className="p3" data-label={t("col.expectedClose")}>
                  {r.expectedCloseDate ? (
                    f.date(r.expectedCloseDate, "medium")
                  ) : (
                    <span className="ax-faint">—</span>
                  )}
                </td>
                <td className="p2" data-label={t("col.owner")}>
                  {r.ownerName ? (
                    <span className="owner">
                      <span className="ax-avatar sm" data-hue={hueOf(r.ownerId ?? "")} aria-hidden>
                        {initials(r.ownerName)}
                      </span>
                      {r.ownerName}
                    </span>
                  ) : (
                    <span className="ax-faint">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="ax-pager">
        <span>{t("tableCount", { count: rows.length })}</span>
      </div>
    </div>
  );
}
