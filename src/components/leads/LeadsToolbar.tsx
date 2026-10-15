"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Columns3, Rows3, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  FilterButton,
  FilterChip,
  FilterSheet,
  SearchBox,
  ToggleChip,
  type Option,
} from "@/components/list/ListControls";
import { patchQuery } from "@/components/clients/url";

/** Search · Priority · Owner · (Stage, table only) · No follow-up · Clear — and the Board/Table switch. */
export function LeadsToolbar({
  priorities,
  owners,
  stages,
  view,
  resultsLabel,
}: {
  priorities: Option[];
  owners: Option[];
  stages: Option[];
  view: "board" | "table";
  resultsLabel: string;
}) {
  const t = useTranslations("leads");
  const tc = useTranslations("common");
  const sp = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(false);
  const params = ["priority", "owner", "nofu", ...(view === "table" ? ["stage"] : [])];
  const active = params.filter((k) => sp.get(k)).length;
  const groups = [
    { param: "priority", label: t("filterPriority"), options: priorities },
    { param: "owner", label: t("filterOwner"), options: owners },
    ...(view === "table" ? [{ param: "stage", label: t("filterStage"), options: stages }] : []),
  ];

  return (
    <>
      <div className="ax-toolbar clients-toolbar" role="search" aria-label={tc("filterButton")}>
        <SearchBox
          basePath="/leads"
          placeholder={t("searchPlaceholder")}
          label={t("searchLabel")}
        />
        <FilterButton count={active} expanded={sheetOpen} onClick={() => setSheetOpen(true)} />
        <div className="toolbar-filters">
          {groups.map((g) =>
            g.options.length > 0 ? <FilterChip key={g.param} basePath="/leads" {...g} /> : null,
          )}
          <ToggleChip
            basePath="/leads"
            param="nofu"
            label={tc("noFollowUp")}
            icon={<TriangleAlert className="ax-icon ax-icon-xs" aria-hidden />}
          />
          {active > 0 && (
            <Link
              className="ax-btn ax-btn-tertiary ax-btn-xs"
              href={`/leads${patchQuery(sp, Object.fromEntries(params.map((k) => [k, null])))}`}
              scroll={false}
            >
              {tc("clearFilters")}
            </Link>
          )}
          <span className="ax-spacer" />
        </div>
        <nav className="ax-segmented view-switch" aria-label={t("view")}>
          <Link
            href={`/leads${patchQuery(sp, { view: null, stage: null, sort: null, dir: null })}`}
            aria-current={view === "board" ? "true" : undefined}
            scroll={false}
          >
            <Columns3 className="ax-icon ax-icon-sm" aria-hidden />
            {t("viewBoard")}
          </Link>
          <Link
            href={`/leads${patchQuery(sp, { view: "table" })}`}
            aria-current={view === "table" ? "true" : undefined}
            scroll={false}
          >
            <Rows3 className="ax-icon ax-icon-sm" aria-hidden />
            {t("viewTable")}
          </Link>
        </nav>
      </div>
      {sheetOpen && (
        <FilterSheet
          basePath="/leads"
          title={tc("filterButton")}
          groups={groups}
          toggles={[{ param: "nofu", label: tc("noFollowUp") }]}
          resultsLabel={resultsLabel}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}
