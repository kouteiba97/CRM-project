"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { patchQuery } from "@/components/clients/url";
import {
  FilterButton,
  FilterChip,
  FilterSheet,
  SearchBox,
  ToggleChip,
  type Option,
} from "@/components/list/ListControls";

/** Search · Status · Client · Late · Clear (DS › PageHeader › Toolbar); a sheet below bp-sm. */
export function ProjectsToolbar({
  statuses,
  clients,
  resultsLabel,
}: {
  statuses: Option[];
  clients: Option[];
  resultsLabel: string;
}) {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const sp = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(false);
  const params = ["status", "client", "late"];
  const active = params.filter((k) => sp.get(k)).length;
  const groups = [
    { param: "status", label: t("filterStatus"), options: statuses },
    { param: "client", label: t("filterClient"), options: clients },
  ];
  return (
    <>
      <div className="ax-toolbar clients-toolbar" role="search" aria-label={tc("filterButton")}>
        <SearchBox
          basePath="/projects"
          placeholder={t("searchPlaceholder")}
          label={t("searchLabel")}
        />
        <FilterButton count={active} expanded={sheetOpen} onClick={() => setSheetOpen(true)} />
        <div className="toolbar-filters">
          {groups.map((g) =>
            g.options.length > 0 ? <FilterChip key={g.param} basePath="/projects" {...g} /> : null,
          )}
          <ToggleChip
            basePath="/projects"
            param="late"
            label={t("filterLate")}
            icon={<CircleAlert className="ax-icon ax-icon-xs" aria-hidden />}
          />
          {active > 0 && (
            <Link
              className="ax-btn ax-btn-tertiary ax-btn-xs"
              href={`/projects${patchQuery(sp, { status: null, client: null, late: null })}`}
              scroll={false}
            >
              {tc("clearFilters")}
            </Link>
          )}
        </div>
      </div>
      {sheetOpen && (
        <FilterSheet
          basePath="/projects"
          title={tc("filterButton")}
          groups={groups}
          toggles={[{ param: "late", label: t("filterLate") }]}
          resultsLabel={resultsLabel}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}
