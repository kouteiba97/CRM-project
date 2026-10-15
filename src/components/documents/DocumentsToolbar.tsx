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

/** Search · Status · Client · Clear (with a sheet below bp-sm). */
export function DocumentsToolbar({
  basePath,
  statuses,
  clients,
  resultsLabel,
}: {
  basePath: "/invoices" | "/quotations";
  statuses: Option[];
  clients: Option[];
  resultsLabel: string;
}) {
  const t = useTranslations("documents");
  const tc = useTranslations("common");
  const sp = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(false);
  const groups = [
    { param: "status", label: t("filterStatus"), options: statuses },
    { param: "client", label: t("filterClient"), options: clients },
  ];
  const active = [...groups.map((g) => g.param), "project"].filter((k) => sp.get(k)).length;
  return (
    <>
      <div className="ax-toolbar clients-toolbar" role="search" aria-label={tc("filterButton")}>
        <SearchBox
          basePath={basePath}
          placeholder={t("searchPlaceholder")}
          label={t("searchLabel")}
        />
        <FilterButton count={active} expanded={sheetOpen} onClick={() => setSheetOpen(true)} />
        <div className="toolbar-filters">
          {groups.map((g) =>
            g.options.length > 0 ? <FilterChip key={g.param} basePath={basePath} {...g} /> : null,
          )}
          {active > 0 && (
            <Link
              className="ax-btn ax-btn-tertiary ax-btn-xs"
              href={`${basePath}${patchQuery(sp, { status: null, client: null, project: null })}`}
              scroll={false}
            >
              {tc("clearFilters")}
            </Link>
          )}
        </div>
      </div>
      {sheetOpen && (
        <FilterSheet
          basePath={basePath}
          title={tc("filterButton")}
          groups={groups}
          resultsLabel={resultsLabel}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}
