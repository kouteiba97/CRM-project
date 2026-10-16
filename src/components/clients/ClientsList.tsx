"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  Plus,
  SearchX,
  Users,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import type { Due } from "@/lib/due";
import { Menu } from "@/components/shell/Menu";
import { useToast } from "@/components/shell/Toasts";
import { toCsv } from "@/lib/csv";
import { archiveClients, recordClientsExport, restoreClients } from "./actions";
import { DueLabel } from "@/components/ui/DueLabel";
import { EmptyState } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  FilterButton,
  FilterChip,
  FilterSheet,
  SearchBox,
  type Option,
} from "@/components/list/ListControls";
import { DENSITY_COOKIE, FILTER_KEYS, patchQuery } from "./url";

export type ClientRowView = {
  id: string;
  name: string;
  initials: string;
  hue: number;
  status: string;
  contact: string | null;
  openProjects: string;
  outstanding: string | null;
  outstandingTitle: string | null;
  overdue: boolean;
  lastContact: { text: string; title: string; iso: string } | null;
  nextFollowUp: Due | null;
  owner: { name: string; initials: string; hue: number } | null;
};

export type Density = "default" | "compact";

type Sort = { key: string; dir: "asc" | "desc"; explicit: boolean };

const COLUMNS = [
  { key: "name", sortable: true, cls: "" },
  { key: "status", sortable: false, cls: "" },
  { key: "projects", sortable: true, cls: "num p3" },
  { key: "outstanding", sortable: true, cls: "num" },
  { key: "lastContact", sortable: true, cls: "p3" },
  { key: "nextFollowUp", sortable: true, cls: "" },
  { key: "owner", sortable: true, cls: "p2" },
] as const;

export function ClientsList({
  rows,
  total,
  workspaceTotal,
  page,
  size,
  sort,
  density: initialDensity,
  statuses,
  tags,
  owners,
  rangeText,
}: {
  rows: ClientRowView[];
  total: number;
  workspaceTotal: number;
  page: number;
  size: number;
  sort: Sort;
  density: Density;
  statuses: Option[];
  tags: Option[];
  owners: Option[];
  rangeText: string;
}) {
  const t = useTranslations("clients");
  const sp = useSearchParams();
  const router = useRouter();
  const [density, setDensity] = useState(initialDensity);
  const [pending, start] = useTransition();
  const go = (qs: string) => start(() => router.replace(`/clients${qs}`, { scroll: false }));

  const setDensityPref = (d: Density) => {
    setDensity(d);
    document.cookie = `${DENSITY_COOKIE}=${d}; path=/; max-age=31536000; samesite=lax`;
  };

  const active = FILTER_KEYS.some((k) => sp.get(k));
  const pages = Math.max(1, Math.ceil(total / size));

  // Selection belongs to the visible page: it resets whenever the rows change (filter, sort, page).
  const rowsKey = rows.map((r) => r.id).join(",");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selKey, setSelKey] = useState(rowsKey);
  if (selKey !== rowsKey) {
    setSelKey(rowsKey);
    setSelected(new Set());
  }

  return (
    <div className="ax-table-wrap clients-frame" aria-busy={pending}>
      {selected.size > 0 ? (
        <BulkBar
          rows={rows.filter((r) => selected.has(r.id))}
          onClear={() => setSelected(new Set())}
        />
      ) : (
        <Toolbar
          statuses={statuses}
          tags={tags}
          owners={owners}
          density={density}
          onDensity={setDensityPref}
          go={go}
          total={total}
        />
      )}

      {rows.length === 0 ? (
        workspaceTotal === 0 ? (
          <div className="clients-empty">
            <EmptyState icon={Users} title={t("emptyTitle")} body={t("emptyBody")} />
            <Link className="ax-btn ax-btn-primary ax-btn-sm" href="/clients?new=1" scroll={false}>
              <Plus className="ax-icon" aria-hidden />
              {t("newClient")}
            </Link>
          </div>
        ) : (
          <div className="clients-empty">
            <EmptyState icon={SearchX} title={t("noMatchTitle")} body={t("noMatchBody")} />
            {active && (
              <Link className="ax-btn ax-btn-secondary ax-btn-sm" href="/clients" scroll={false}>
                {t("clearFilters")}
              </Link>
            )}
          </div>
        )
      ) : (
        <div className="table-scroll">
          <Table
            rows={rows}
            sort={sort}
            density={density}
            selected={selected}
            onSelect={setSelected}
          />
        </div>
      )}

      <nav className="ax-pager" aria-label={t("pagination")}>
        <span aria-live="polite">{rangeText}</span>
        <span className="ax-spacer" />
        <span id="rows-label">{t("rowsPerPage")}</span>
        <Menu
          triggerClassName="ax-btn ax-btn-secondary ax-btn-xs"
          triggerLabel={t("rowsPerPageValue", { size })}
          trigger={
            <>
              <span aria-hidden>{size}</span>
              <ChevronDown className="ax-icon" aria-hidden />
            </>
          }
        >
          {[25, 50, 100].map((n) => (
            <Link
              key={n}
              role="menuitemradio"
              aria-checked={n === size}
              tabIndex={-1}
              className="ax-menu-item"
              href={`/clients${patchQuery(sp, { size: n === 25 ? null : String(n) })}`}
              scroll={false}
            >
              {n}
              <Check className="ax-icon ax-check" aria-hidden />
            </Link>
          ))}
        </Menu>
        <PageLink page={page - 1} disabled={page <= 1} label={t("previousPage")} icon="prev" />
        <PageLink page={page + 1} disabled={page >= pages} label={t("nextPage")} icon="next" />
      </nav>
    </div>
  );
}

function PageLink({
  page,
  disabled,
  label,
  icon,
}: {
  page: number;
  disabled: boolean;
  label: string;
  icon: "prev" | "next";
}) {
  const sp = useSearchParams();
  const Icon = icon === "prev" ? ChevronLeft : ChevronRight;
  const inner = <Icon className="ax-icon ax-flip" aria-hidden />;
  if (disabled)
    return (
      <span
        className="ax-btn ax-btn-secondary ax-btn-xs ax-btn-icon is-disabled"
        role="link"
        aria-disabled="true"
        aria-label={label}
      >
        {inner}
      </span>
    );
  return (
    <Link
      className="ax-btn ax-btn-secondary ax-btn-xs ax-btn-icon"
      aria-label={label}
      href={`/clients${patchQuery(sp, { page: page <= 1 ? null : String(page) })}`}
      scroll={false}
    >
      {inner}
    </Link>
  );
}

// ── Toolbar: search · Status · Tag · Owner · Has overdue · Clear · density ───────────────
function Toolbar({
  statuses,
  tags,
  owners,
  density,
  onDensity,
  go,
  total,
}: {
  statuses: Option[];
  tags: Option[];
  owners: Option[];
  density: Density;
  onDensity: (d: Density) => void;
  go: (qs: string) => void;
  total: number;
}) {
  const t = useTranslations("clients");
  const sp = useSearchParams();
  const overdue = sp.get("overdue") === "1";
  const anyFilter = FILTER_KEYS.some((k) => sp.get(k));
  const activeCount = (["status", "tag", "owner", "overdue"] as const).filter((k) =>
    sp.get(k),
  ).length;
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <div className="ax-toolbar clients-toolbar" role="search" aria-label={t("filters")}>
        <SearchBox
          basePath="/clients"
          placeholder={t("searchPlaceholder")}
          label={t("searchLabel")}
        />

        {/* Below bp-sm the chips and density move into a sheet behind one Filter button. */}
        <FilterButton count={activeCount} expanded={sheetOpen} onClick={() => setSheetOpen(true)} />

        <div className="toolbar-filters">
          <FilterChip
            basePath="/clients"
            param="status"
            label={t("filterStatus")}
            options={statuses}
          />
          {tags.length > 0 && (
            <FilterChip basePath="/clients" param="tag" label={t("filterTag")} options={tags} />
          )}
          {owners.length > 0 && (
            <FilterChip
              basePath="/clients"
              param="owner"
              label={t("filterOwner")}
              options={owners}
            />
          )}
          <button
            type="button"
            className={`ax-chip${overdue ? " is-active" : ""}`}
            aria-pressed={overdue}
            onClick={() => go(patchQuery(sp, { overdue: overdue ? null : "1" }))}
          >
            {overdue ? (
              <Check className="ax-icon ax-icon-xs" aria-hidden />
            ) : (
              <CircleAlert className="ax-icon ax-icon-xs" aria-hidden />
            )}
            {t("filterOverdue")}
          </button>
          {anyFilter && (
            <Link className="ax-btn ax-btn-tertiary ax-btn-xs" href="/clients" scroll={false}>
              {t("clearFilters")}
            </Link>
          )}

          <span className="ax-spacer" />
          <div className="ax-segmented" role="group" aria-label={t("density")}>
            {(["default", "compact"] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={density === d}
                onClick={() => onDensity(d)}
              >
                {t(d === "default" ? "densityDefault" : "densityCompact")}
              </button>
            ))}
          </div>
        </div>
      </div>
      {sheetOpen && (
        <FilterSheet
          basePath="/clients"
          title={t("filters")}
          groups={[
            { param: "status", label: t("filterStatus"), options: statuses },
            { param: "tag", label: t("filterTag"), options: tags },
            { param: "owner", label: t("filterOwner"), options: owners },
          ]}
          toggles={[{ param: "overdue", label: t("filterOverdue") }]}
          extra={
            <section className="sheet-group" aria-labelledby="sheet-density">
              <h3 id="sheet-density" className="sheet-label">
                {t("density")}
              </h3>
              <div className="ax-segmented" role="group" aria-labelledby="sheet-density">
                {(["default", "compact"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={density === d}
                    onClick={() => onDensity(d)}
                  >
                    {t(d === "default" ? "densityDefault" : "densityCompact")}
                  </button>
                ))}
              </div>
            </section>
          }
          resultsLabel={t("showResults", { count: total })}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}

// ── Bulk bar: replaces the toolbar while rows are selected (DS › DataTable) ───────────
function BulkBar({ rows, onClear }: { rows: ClientRowView[]; onClear: () => void }) {
  const t = useTranslations("clients");
  const ts = useTranslations("status.client");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  const exportCsv = () => {
    const head = (
      ["name", "status", "projects", "outstanding", "lastContact", "nextFollowUp", "owner"] as const
    ).map((k) => t(`col.${k}`));
    const lines = rows.map((r) => [
      r.name,
      ts(r.status as never),
      r.openProjects,
      r.outstandingTitle ?? "",
      r.lastContact?.title ?? "",
      r.nextFollowUp?.absolute ?? "",
      r.owner?.name ?? "",
    ]);
    void recordClientsExport(rows.length);
    const blob = new Blob([toCsv([head, ...lines])], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const archive = () =>
    start(async () => {
      const ids = rows.map((r) => r.id);
      try {
        const res = await archiveClients(ids);
        onClear();
        toast({
          tone: "success",
          title: t("archivedCount", { count: res.count }),
          action: {
            label: tc("undo"),
            run: () =>
              void restoreClients(res.ids).then(
                () => router.refresh(),
                () => toast({ tone: "danger", title: t("restoreFailed") }),
              ),
          },
        });
      } catch {
        toast({ tone: "danger", title: t("archiveFailed") });
      }
    });

  return (
    <div className="ax-bulkbar clients-bulkbar" role="region" aria-label={t("bulkActions")}>
      <span aria-live="polite">{t("selectedCount", { count: rows.length })}</span>
      <button type="button" className="ax-btn ax-btn-secondary ax-btn-xs" onClick={exportCsv}>
        <Download className="ax-icon" aria-hidden />
        {t("exportCsv")}
      </button>
      <button
        type="button"
        className="ax-btn ax-btn-danger-ghost ax-btn-xs"
        aria-busy={pending}
        onClick={archive}
      >
        {pending ? (
          <span className="ax-spinner" aria-hidden />
        ) : (
          <Archive className="ax-icon" aria-hidden />
        )}
        {t("archive")}
      </button>
      <span className="ax-spacer" />
      <button type="button" className="ax-btn ax-btn-tertiary ax-btn-xs" onClick={onClear}>
        {t("clearSelection")}
      </button>
    </div>
  );
}

// ── Table ───────────────────────────────────────────────────────────────────────────────
function Table({
  rows,
  sort,
  density,
  selected,
  onSelect,
}: {
  rows: ClientRowView[];
  sort: Sort;
  density: Density;
  selected: Set<string>;
  onSelect: (next: Set<string>) => void;
}) {
  const t = useTranslations("clients");
  const sp = useSearchParams();
  const router = useRouter();
  const body = useRef<HTMLTableSectionElement>(null);
  const allBox = useRef<HTMLInputElement>(null);
  const anchor = useRef<number | null>(null);
  const all = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const some = !all && rows.some((r) => selected.has(r.id));
  useEffect(() => {
    if (allBox.current) allBox.current.indeterminate = some;
  }, [some]);

  /** Click toggles one row; Shift+click selects the range from the last clicked row (DS › DataTable). */
  const toggle = (index: number, shift: boolean) => {
    const next = new Set(selected);
    const id = rows[index]!.id;
    if (shift && anchor.current !== null) {
      const [a, b] = [Math.min(anchor.current, index), Math.max(anchor.current, index)];
      for (let i = a; i <= b; i++) next.add(rows[i]!.id);
    } else if (next.has(id)) next.delete(id);
    else next.add(id);
    anchor.current = index;
    onSelect(next);
  };

  /** DS › DataTable sort cycle: asc → desc → none (none = default: next follow-up ascending). */
  const sortHref = (key: string) => {
    const isCurrent = sort.explicit && sort.key === key;
    if (!isCurrent)
      return `/clients${patchQuery(sp, { sort: key, dir: null }, { keepPage: true })}`;
    if (sort.dir === "asc")
      return `/clients${patchQuery(sp, { sort: key, dir: "desc" }, { keepPage: true })}`;
    return `/clients${patchQuery(sp, { sort: null, dir: null }, { keepPage: true })}`;
  };

  // ↑/↓ or J/K move between rows; Enter on the focused row's link opens the record.
  const onKeyDown = (e: KeyboardEvent<HTMLTableSectionElement>) => {
    const key = e.key.toLowerCase();
    // Space / X toggle the focused row; Esc clears the selection.
    const focused = (document.activeElement as HTMLElement | null)?.closest<HTMLTableRowElement>(
      "tr[data-index]",
    );
    if (
      (key === " " || key === "x") &&
      focused &&
      (document.activeElement as HTMLElement).matches("a.row-open")
    ) {
      e.preventDefault();
      toggle(Number(focused.dataset.index), e.shiftKey);
      return;
    }
    if (key === "escape" && selected.size > 0) {
      e.preventDefault();
      onSelect(new Set());
      return;
    }
    const down = key === "arrowdown" || key === "j";
    const up = key === "arrowup" || key === "k";
    if (!down && !up) return;
    const links = Array.from(body.current?.querySelectorAll<HTMLAnchorElement>("a.row-open") ?? []);
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next = links[i < 0 ? 0 : Math.min(links.length - 1, Math.max(0, i + (down ? 1 : -1)))];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  const onRowClick = (e: MouseEvent<HTMLTableRowElement>, id: string) => {
    if (
      (e.target as HTMLElement).closest("a, button, label, input") ||
      window.getSelection()?.toString()
    )
      return;
    router.push(`/clients/${id}`);
  };

  return (
    <table className={`ax-table clients-table${density === "compact" ? " is-compact" : ""}`}>
      <caption className="sr-only">{t("tableCaption")}</caption>
      <thead>
        <tr>
          <th scope="col" className="chk">
            <label className="ax-choice">
              <input
                ref={allBox}
                type="checkbox"
                checked={all}
                aria-label={t("selectAll")}
                onChange={() => onSelect(all ? new Set() : new Set(rows.map((r) => r.id)))}
              />
            </label>
          </th>
          {COLUMNS.map((c) => {
            const ariaSort =
              sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined;
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
      <tbody ref={body} onKeyDown={onKeyDown}>
        {rows.map((r, index) => (
          <tr
            key={r.id}
            data-index={index}
            aria-selected={selected.has(r.id)}
            onClick={(e) => onRowClick(e, r.id)}
          >
            <td className="chk">
              <label className="ax-choice">
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  aria-label={t("selectRow", { name: r.name })}
                  onChange={() => {}}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(index, e.shiftKey);
                  }}
                />
              </label>
            </td>
            <td className="c-entity">
              <div className="ax-cell-entity">
                <span
                  className={`ax-avatar sq${density === "compact" ? "" : " md"}`}
                  data-hue={r.hue}
                  aria-hidden
                >
                  {r.initials}
                </span>
                <div className="entity-txt">
                  <Link className="name row-open" href={`/clients/${r.id}`}>
                    {r.name}
                  </Link>
                  {r.contact && <span className="sub">{r.contact}</span>}
                </div>
              </div>
            </td>
            <td className="c-status" data-label={t("col.status")}>
              <StatusBadge domain="client" code={r.status} />
            </td>
            <td className="num p3 c-projects" data-label={t("col.projects")}>
              {r.openProjects}
            </td>
            <td className="num c-money" data-label={t("col.outstanding")}>
              {r.outstanding ? (
                <span
                  className={r.overdue ? "money overdue" : "money"}
                  title={r.outstandingTitle ?? undefined}
                >
                  {r.overdue && <CircleAlert className="ax-icon ax-icon-sm" aria-hidden />}
                  {r.outstanding}
                  {r.overdue && <span className="sr-only"> · {t("hasOverdue")}</span>}
                </span>
              ) : (
                <Dash label={t("none")} />
              )}
            </td>
            <td className="p3 c-last" data-label={t("col.lastContact")}>
              {r.lastContact ? (
                <time dateTime={r.lastContact.iso} title={r.lastContact.title} className="ax-muted">
                  {r.lastContact.text}
                </time>
              ) : (
                <Dash label={t("none")} />
              )}
            </td>
            <td className="c-next" data-label={t("col.nextFollowUp")}>
              {r.nextFollowUp ? (
                <DueLabel due={r.nextFollowUp} />
              ) : (
                <span className="ax-due no-fu">{t("noFollowUp")}</span>
              )}
            </td>
            <td className="p2 c-owner" data-label={t("col.owner")}>
              {r.owner ? (
                <span className="owner">
                  <span className="ax-avatar sm" data-hue={r.owner.hue} aria-hidden>
                    {r.owner.initials}
                  </span>
                  {r.owner.name}
                </span>
              ) : (
                <Dash label={t("none")} />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Dash({ label }: { label: string }) {
  return (
    <span className="ax-faint">
      <span aria-hidden>—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
