"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Ellipsis, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/lib/format";
import { patchQuery } from "@/components/clients/url";
import { PaymentModal, type PayableInvoice } from "@/components/documents/PaymentModal";
import {
  FilterButton,
  FilterChip,
  FilterSheet,
  SearchBox,
  type Option,
} from "@/components/list/ListControls";
import { Menu } from "@/components/shell/Menu";
import { useToast } from "@/components/shell/Toasts";
import { setPaymentStatus } from "./actions";

/** "Record payment" from the list: pick an unpaid invoice, then the usual modal. */
export function RecordPaymentButton({ invoices }: { invoices: PayableInvoice[] }) {
  const t = useTranslations("payments");
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="ax-btn ax-btn-primary ax-btn-sm"
        onClick={() => setOpen(true)}
        disabled={invoices.length === 0}
      >
        <Plus className="ax-icon" aria-hidden />
        {t("record")}
      </button>
      {open && <PaymentModal invoices={invoices} locale={locale} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Search · Status · Method · Client · Period · Clear (sheet below bp-sm). */
export function PaymentsToolbar({
  statuses,
  methods,
  clients,
  periods,
  resultsLabel,
}: {
  statuses: Option[];
  methods: Option[];
  clients: Option[];
  periods: Option[];
  resultsLabel: string;
}) {
  const t = useTranslations("payments");
  const tc = useTranslations("common");
  const sp = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(false);
  const groups = [
    { param: "period", label: t("filterPeriod"), options: periods },
    { param: "status", label: t("filterStatus"), options: statuses },
    { param: "method", label: t("filterMethod"), options: methods },
    { param: "client", label: t("filterClient"), options: clients },
  ];
  const active = groups.filter((g) => sp.get(g.param)).length;
  return (
    <>
      <div className="ax-toolbar clients-toolbar" role="search" aria-label={tc("filterButton")}>
        <SearchBox
          basePath="/payments"
          placeholder={t("searchPlaceholder")}
          label={t("searchLabel")}
        />
        <FilterButton count={active} expanded={sheetOpen} onClick={() => setSheetOpen(true)} />
        <div className="toolbar-filters">
          {groups.map((g) =>
            g.options.length > 0 ? <FilterChip key={g.param} basePath="/payments" {...g} /> : null,
          )}
          {active > 0 && (
            <Link
              className="ax-btn ax-btn-tertiary ax-btn-xs"
              href={`/payments${patchQuery(sp, Object.fromEntries(groups.map((g) => [g.param, null])))}`}
              scroll={false}
            >
              {tc("clearFilters")}
            </Link>
          )}
        </div>
      </div>
      {sheetOpen && (
        <FilterSheet
          basePath="/payments"
          title={tc("filterButton")}
          groups={groups}
          resultsLabel={resultsLabel}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}

/** Row menu: mark Received / Pending / Failed / Refunded; no confirmation, Undo in the toast. */
export function PaymentRowMenu({
  id,
  status,
  label,
}: {
  id: string;
  status: string;
  label: string;
}) {
  const t = useTranslations("payments");
  const ts = useTranslations("status.payment");
  const tc = useTranslations("common");
  const toast = useToast();
  const router = useRouter();
  const [, start] = useTransition();
  const change = (next: string, undo = false) =>
    start(async () => {
      try {
        const res = await setPaymentStatus(id, next);
        if (!undo)
          toast({
            tone: "success",
            title: t("statusChanged", { status: ts(next as never) }),
            action: { label: tc("undo"), run: () => change(res.from, true) },
          });
        else router.refresh();
      } catch {
        toast({ tone: "danger", title: t("statusFailed") });
      }
    });
  return (
    <Menu
      triggerClassName="ax-btn ax-btn-tertiary ax-btn-xs ax-btn-icon"
      triggerLabel={label}
      trigger={<Ellipsis className="ax-icon" aria-hidden />}
    >
      <div className="ax-menu-label">{t("markAs")}</div>
      {(["received", "pending", "failed", "refunded"] as const)
        .filter((s) => s !== status)
        .map((s) => (
          <button
            key={s}
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="ax-menu-item menu-btn"
            onClick={() => change(s)}
          >
            {ts(s)}
          </button>
        ))}
    </Menu>
  );
}
