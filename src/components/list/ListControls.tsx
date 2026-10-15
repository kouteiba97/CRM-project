"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Menu } from "@/components/shell/Menu";
import { patchQuery } from "@/components/clients/url";

export type Option = { value: string; label: string };

/**
 * DS › SearchField (inline): filters the list as you type (150ms debounce) through `?q=`;
 * Esc or the × clears it. The URL wins when it changes from outside (Back, "Clear filters").
 */
export function SearchBox({
  basePath,
  placeholder,
  label,
}: {
  basePath: string;
  placeholder: string;
  label: string;
}) {
  const tc = useTranslations("common");
  const sp = useSearchParams();
  const router = useRouter();
  const [, start] = useTransition();
  const urlQ = sp.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const [lastUrlQ, setLastUrlQ] = useState(urlQ);
  if (urlQ !== lastUrlQ) {
    setLastUrlQ(urlQ);
    setQ(urlQ);
  }
  const timer = useRef<number | null>(null);
  const spRef = useRef(sp);
  useEffect(() => {
    spRef.current = sp;
  }, [sp]);
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);

  const onSearch = (value: string) => {
    setQ(value);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () =>
        start(() =>
          router.replace(`${basePath}${patchQuery(spRef.current, { q: value.trim() || null })}`, {
            scroll: false,
          }),
        ),
      150,
    );
  };

  return (
    <label className="ax-field-box clients-search">
      <Search className="ax-icon" aria-hidden />
      <input
        type="search"
        value={q}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => onSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && q) {
            e.preventDefault();
            onSearch("");
          }
        }}
      />
      {q && (
        <button
          type="button"
          className="ax-btn ax-btn-tertiary ax-btn-xs ax-btn-icon"
          aria-label={tc("clearSearch")}
          onClick={() => onSearch("")}
        >
          <X className="ax-icon" aria-hidden />
        </button>
      )}
    </label>
  );
}

/** DS › PageHeader › Toolbar chip: dashed "+ Status" when empty, solid "Status: Active ×" when set. */
export function FilterChip({
  basePath,
  param,
  label,
  options,
}: {
  basePath: string;
  param: string;
  label: string;
  options: Option[];
}) {
  const tc = useTranslations("common");
  const sp = useSearchParams();
  const value = sp.get(param);
  const current = options.find((o) => o.value === value);
  return (
    <span className="chip-group">
      <Menu
        align="start"
        triggerClassName={`ax-chip${current ? " is-active chip-main" : ""}`}
        triggerLabel={
          current
            ? tc("filterActive", { filter: label, value: current.label })
            : tc("filterBy", { filter: label })
        }
        trigger={
          current ? (
            <>
              <span className="k">{label}:</span>
              {current.label}
            </>
          ) : (
            <>
              <Plus className="ax-icon ax-icon-xs" aria-hidden />
              {label}
            </>
          )
        }
      >
        {options.map((o) => (
          <Link
            key={o.value}
            role="menuitemradio"
            aria-checked={o.value === value}
            tabIndex={-1}
            className="ax-menu-item"
            href={`${basePath}${patchQuery(sp, { [param]: o.value })}`}
            scroll={false}
          >
            <span className="chip-opt">{o.label}</span>
            <Check className="ax-icon ax-check" aria-hidden />
          </Link>
        ))}
      </Menu>
      {current && (
        <Link
          className="ax-chip is-active chip-clear"
          href={`${basePath}${patchQuery(sp, { [param]: null })}`}
          aria-label={tc("filterRemove", { filter: label })}
          scroll={false}
        >
          <X className="ax-icon ax-icon-xs" aria-hidden />
        </Link>
      )}
    </span>
  );
}

/** A yes/no filter chip (e.g. "Has overdue", "No follow-up"). */
export function ToggleChip({
  basePath,
  param,
  label,
  icon,
}: {
  basePath: string;
  param: string;
  label: string;
  icon: React.ReactNode;
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const [, start] = useTransition();
  const on = sp.get(param) === "1";
  return (
    <button
      type="button"
      className={`ax-chip${on ? " is-active" : ""}`}
      aria-pressed={on}
      onClick={() =>
        start(() =>
          router.replace(`${basePath}${patchQuery(sp, { [param]: on ? null : "1" })}`, {
            scroll: false,
          }),
        )
      }
    >
      {on ? <Check className="ax-icon ax-icon-xs" aria-hidden /> : icon}
      {label}
    </button>
  );
}

export type FilterGroup = { param: string; label: string; options: Option[] };

/** Below bp-sm: the one toolbar button that opens the FilterSheet, with the active-filter count. */
export function FilterButton({
  count,
  expanded,
  onClick,
}: {
  count: number;
  expanded: boolean;
  onClick: () => void;
}) {
  const tc = useTranslations("common");
  return (
    <button
      type="button"
      className="ax-btn ax-btn-secondary ax-btn-sm filter-open"
      aria-haspopup="dialog"
      aria-expanded={expanded}
      onClick={onClick}
    >
      <SlidersHorizontal className="ax-icon" aria-hidden />
      {tc("filterButton")}
      {count > 0 && (
        <span className="ax-count">
          <span aria-hidden>{count}</span>
          <span className="sr-only">{tc("activeFilters", { count })}</span>
        </span>
      )}
    </button>
  );
}

/**
 * DS › Layout › bp-sm: the toolbar's filters as a modal sheet (native <dialog>: focus trap + Esc).
 * Every choice updates the URL right away; the footer button only closes the sheet.
 */
export function FilterSheet({
  basePath,
  title,
  groups,
  toggles = [],
  extra,
  resultsLabel,
  onClose,
}: {
  basePath: string;
  title: string;
  groups: FilterGroup[];
  toggles?: { param: string; label: string }[];
  extra?: React.ReactNode;
  resultsLabel: string;
  onClose: () => void;
}) {
  const tc = useTranslations("common");
  const sp = useSearchParams();
  const router = useRouter();
  const [, start] = useTransition();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = "filter-sheet-title";

  // No close() in cleanup: Strict Mode re-runs effects, and close() would fire onClose and unmount the
  // sheet. Removing the <dialog> from the DOM ends its modal state anyway.
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  const params = [...groups.map((g) => g.param), ...toggles.map((x) => x.param)];
  const anyActive = params.some((k) => sp.get(k));

  return (
    <dialog ref={ref} className="filter-sheet" aria-labelledby={titleId} onClose={onClose}>
      <div className="ax-drawer-head">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="ax-btn ax-btn-tertiary ax-btn-sm ax-btn-icon"
          aria-label={tc("close")}
          onClick={onClose}
        >
          <X className="ax-icon" aria-hidden />
        </button>
      </div>
      <div className="ax-drawer-body">
        {groups
          .filter((g) => g.options.length > 0)
          .map((g) => {
            const value = sp.get(g.param);
            return (
              <section key={g.param} className="sheet-group" aria-labelledby={`sheet-${g.param}`}>
                <h3 id={`sheet-${g.param}`} className="sheet-label">
                  {g.label}
                </h3>
                <ul className="sheet-options">
                  {[{ value: "", label: tc("any") }, ...g.options].map((o) => {
                    const selected = (value ?? "") === o.value;
                    return (
                      <li key={o.value || "any"}>
                        <Link
                          className="ax-menu-item sheet-option"
                          aria-current={selected ? "true" : undefined}
                          href={`${basePath}${patchQuery(sp, { [g.param]: o.value || null })}`}
                          replace
                          scroll={false}
                        >
                          {o.label}
                          {selected && <Check className="ax-icon sheet-check" aria-hidden />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        {toggles.map((x) => {
          const on = sp.get(x.param) === "1";
          return (
            <label key={x.param} className="ax-choice ax-switch sheet-switch">
              <span>{x.label}</span>
              <input
                type="checkbox"
                role="switch"
                checked={on}
                onChange={() =>
                  start(() =>
                    router.replace(`${basePath}${patchQuery(sp, { [x.param]: on ? null : "1" })}`, {
                      scroll: false,
                    }),
                  )
                }
              />
            </label>
          );
        })}
        {extra}
      </div>
      <div className="ax-drawer-foot">
        {anyActive && (
          <Link
            className="ax-btn ax-btn-tertiary ax-btn-sm"
            href={`${basePath}${patchQuery(sp, Object.fromEntries(params.map((k) => [k, null])))}`}
            replace
            scroll={false}
          >
            {tc("clearFilters")}
          </Link>
        )}
        <button type="button" className="ax-btn ax-btn-primary ax-btn-sm" onClick={onClose}>
          {resultsLabel}
        </button>
      </div>
    </dialog>
  );
}
