"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { patchQuery } from "@/components/clients/url";
import {
  FilterButton,
  FilterChip,
  FilterSheet,
  SearchBox,
  type Option,
} from "@/components/list/ListControls";

/** Search · Project · Priority · Assignee · Clear — and Group by (Due / Project / Status). */
export function TasksToolbar({
  projects,
  priorities,
  people,
  group,
  resultsLabel,
}: {
  projects: Option[];
  priorities: Option[];
  people: Option[];
  group: "due" | "project" | "status";
  resultsLabel: string;
}) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const sp = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(false);
  const groups = [
    { param: "project", label: t("filterProject"), options: projects },
    { param: "priority", label: t("filterPriority"), options: priorities },
    { param: "assignee", label: t("filterAssignee"), options: people },
  ];
  const active = groups.filter((g) => sp.get(g.param)).length;
  return (
    <>
      <div className="ax-toolbar clients-toolbar" role="search" aria-label={tc("filterButton")}>
        <SearchBox
          basePath="/tasks"
          placeholder={t("searchPlaceholder")}
          label={t("searchLabel")}
        />
        <FilterButton count={active} expanded={sheetOpen} onClick={() => setSheetOpen(true)} />
        <div className="toolbar-filters">
          {groups.map((g) =>
            g.options.length > 0 ? <FilterChip key={g.param} basePath="/tasks" {...g} /> : null,
          )}
          {active > 0 && (
            <Link
              className="ax-btn ax-btn-tertiary ax-btn-xs"
              href={`/tasks${patchQuery(sp, { project: null, priority: null, assignee: null })}`}
              scroll={false}
            >
              {tc("clearFilters")}
            </Link>
          )}
          <span className="ax-spacer" />
        </div>
        <nav className="ax-segmented view-switch" aria-label={t("groupBy")}>
          {(["due", "project", "status"] as const).map((g) => (
            <Link
              key={g}
              href={`/tasks${patchQuery(sp, { group: g === "due" ? null : g })}`}
              aria-current={group === g ? "true" : undefined}
              scroll={false}
            >
              {t(`group_${g}`)}
            </Link>
          ))}
        </nav>
      </div>
      {sheetOpen && (
        <FilterSheet
          basePath="/tasks"
          title={tc("filterButton")}
          groups={groups}
          resultsLabel={resultsLabel}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}
