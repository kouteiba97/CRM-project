"use client";

import { ChevronDown, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { SidebarCounts } from "@/db/queries/dashboard";
import { Menu } from "./Menu";
import { activeKey, NAV, NAV_FOOTER, type NavItem } from "./nav";
import { initials } from "./initials";

/** DS › SidebarNav: workspace row, primary group, Sales / Delivery / Finance, footer. */
export function Sidebar({
  counts,
  workspaceName,
  onToggle,
}: {
  counts: SidebarCounts;
  workspaceName: string;
  onToggle: () => void;
}) {
  const t = useTranslations("nav");
  const ts = useTranslations("shell");
  const current = activeKey(usePathname());

  const item = (i: NavItem) => {
    const n = i.count ? counts[i.count.key] : 0;
    const label = t(i.key);
    const countLabel = i.count?.alert ? t("countOverdue", { count: n }) : t("countDue", { count: n });
    return (
      <Link
        key={i.key}
        href={i.href}
        className="ax-nav-item"
        aria-current={current === i.key ? "page" : undefined}
      >
        <i.icon className="ax-icon" aria-hidden />
        <span className="label">{label}</span>
        {n > 0 && (
          <span className={`ax-count${i.count?.alert ? " is-alert" : ""}`}>
            <span aria-hidden>{n}</span>
            <span className="sr-only">{countLabel}</span>
          </span>
        )}
        <span className="rail-tip ax-tooltip" aria-hidden>
          {label}
          {n > 0 ? ` · ${n}` : ""}
        </span>
      </Link>
    );
  };

  return (
    <nav className="ax-sidebar" aria-label={t("main")}>
      <Menu
        triggerClassName="ws-row"
        triggerLabel={ts("workspaceMenu")}
        align="start"
        trigger={
          <>
            <span className="ax-avatar md sq" data-hue="1" aria-hidden>
              {initials(workspaceName)}
            </span>
            <span className="name t-body-strong">{workspaceName}</span>
            <ChevronDown className="ax-icon chev" aria-hidden />
          </>
        }
      >
        <Link href="/settings" role="menuitem" className="ax-menu-item">
          <Settings className="ax-icon" aria-hidden />
          {ts("settings")}
        </Link>
      </Menu>

      {NAV.map((group, gi) => (
        <div key={group.label ?? gi} role="group" aria-label={group.label ? t(group.label) : undefined}>
          {group.label && (
            <div className="ax-nav-group" aria-hidden>
              {t(group.label)}
            </div>
          )}
          {group.items.map(item)}
        </div>
      ))}

      <div className="nav-spacer" />
      {NAV_FOOTER.map(item)}
      <button type="button" className="ax-nav-item nav-collapse" onClick={onToggle}>
        <PanelLeftClose className="ax-icon ax-flip when-expanded" aria-hidden />
        <PanelLeftOpen className="ax-icon ax-flip when-collapsed" aria-hidden />
        <span className="label when-expanded">{ts("collapse")}</span>
        <span className="sr-only when-collapsed">{ts("expand")}</span>
        <span className="ax-kbd label when-expanded" style={{ marginInlineStart: "auto" }}>
          [
        </span>
      </button>
    </nav>
  );
}
