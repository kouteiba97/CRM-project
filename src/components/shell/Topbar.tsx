"use client";

import { useSyncExternalStore } from "react";
import { Bell, BellRing, ChevronRight, Menu as MenuIcon, Moon, Plus, Receipt, Search, Settings, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { saveLocale, saveTheme } from "@/app/actions";
import type { SidebarCounts } from "@/db/queries/dashboard";
import type { Locale } from "@/lib/format";
import { Menu } from "./Menu";
import { activeKey, QUICK_CREATE } from "./nav";
import { initials } from "./initials";

const LANGS: { code: Locale; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "ar", label: "ع" },
];

/** Re-renders when <html data-theme> changes (toggle here, or the "system" boot script). */
function subscribeTheme(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

/** DS › PageHeader › Top bar: breadcrumbs start; search, quick-create, notifications, language, theme, user end. */
export function Topbar({
  counts,
  userName,
  onOpenNav,
  onOpenSearch,
}: {
  counts: SidebarCounts;
  userName: string;
  onOpenNav: () => void;
  onOpenSearch: () => void;
}) {
  const t = useTranslations("shell");
  const tn = useTranslations("nav");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const current = activeKey(pathname);
  const unread = counts.followUpsDue + counts.overdueInvoices;

  const dark = useSyncExternalStore(subscribeTheme, () => document.documentElement.dataset.theme === "dark", () => false);
  const toggleTheme = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.dataset.themePref = next;
    // Written here too so a navigation that races the server action still renders the new theme.
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    void saveTheme(next);
  };

  return (
    <header className="ax-topbar app-topbar">
      <button
        type="button"
        className="ax-btn ax-btn-tertiary ax-btn-icon nav-toggle"
        aria-label={t("openNav")}
        onClick={onOpenNav}
      >
        <MenuIcon className="ax-icon" aria-hidden />
      </button>

      <nav className="crumbs" aria-label={t("breadcrumbs")}>
        <ol className="ax-crumbs" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {current && current !== "dashboard" && (
            <li style={{ display: "contents" }}>
              <Link href="/">{tn("dashboard")}</Link>
              <ChevronRight className="ax-icon sep" aria-hidden />
            </li>
          )}
          <li style={{ display: "contents" }}>
            <span aria-current="page">{tn(current ?? "dashboard")}</span>
          </li>
        </ol>
      </nav>

      <div className="end">
        <button type="button" className="ax-search-trigger" onClick={onOpenSearch} aria-label={t("search")}>
          <Search className="ax-icon ax-icon-sm" aria-hidden />
          <span className="label">{t("search")}</span>
          <span className="ax-kbds" aria-hidden>
            <span className="ax-kbd">Ctrl</span>
            <span className="ax-kbd">K</span>
          </span>
        </button>

        <Menu
          triggerClassName="ax-btn ax-btn-secondary ax-btn-sm"
          trigger={
            <>
              <Plus className="ax-icon" aria-hidden />
              <span className="hide-sm">{t("quickCreate")}</span>
            </>
          }
          triggerLabel={t("quickCreate")}
        >
          {QUICK_CREATE.map((q) => (
            <Link key={q.key} href={q.href} role="menuitem" className="ax-menu-item">
              {t(q.key)}
              <span className="ax-kbd">{q.shortcut}</span>
            </Link>
          ))}
        </Menu>

        <Menu
          triggerClassName="ax-btn ax-btn-tertiary ax-btn-icon rel"
          triggerLabel={unread > 0 ? t("notificationsCount", { count: unread }) : t("notifications")}
          trigger={
            <>
              <Bell className="ax-icon" aria-hidden />
              {unread > 0 && (
                <span className="icon-count" aria-hidden>
                  {unread}
                </span>
              )}
            </>
          }
        >
          <div className="ax-menu-label">{t("notifications")}</div>
          <Link href="/follow-ups" role="menuitem" className="ax-menu-item">
            <BellRing className="ax-icon" aria-hidden />
            {tn("followUps")}
            <span className="ax-count" style={{ marginInlineStart: "auto" }}>
              {counts.followUpsDue}
            </span>
          </Link>
          <Link href="/invoices?status=overdue" role="menuitem" className="ax-menu-item">
            <Receipt className="ax-icon" aria-hidden />
            {tn("invoices")}
            <span className="ax-count is-alert" style={{ marginInlineStart: "auto" }}>
              {tn("countOverdue", { count: counts.overdueInvoices })}
            </span>
          </Link>
        </Menu>

        <div className="ax-lang hide-sm" role="group" aria-label={t("language")}>
          {LANGS.map((l) => (
            <Link
              key={l.code}
              href={pathname}
              locale={l.code}
              lang={l.code}
              aria-current={l.code === locale ? "true" : undefined}
              onClick={() => void saveLocale(l.code)}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <button
          type="button"
          className="ax-btn ax-btn-tertiary ax-btn-icon"
          aria-label={dark ? t("themeToLight") : t("themeToDark")}
          onClick={toggleTheme}
        >
          {dark ? <Sun className="ax-icon" aria-hidden /> : <Moon className="ax-icon" aria-hidden />}
        </button>

        <Menu
          triggerClassName="ax-btn ax-btn-tertiary ax-btn-icon"
          triggerLabel={t("account")}
          trigger={
            <span className="ax-avatar md" data-hue="1" aria-hidden>
              {initials(userName)}
            </span>
          }
        >
          <div className="ax-menu-label">{userName}</div>
          <Link href="/settings" role="menuitem" className="ax-menu-item">
            <Settings className="ax-icon" aria-hidden />
            {t("settings")}
          </Link>
          <div className="ax-menu-sep" role="separator" />
          <div className="ax-menu-label">{t("language")}</div>
          {LANGS.map((l) => (
            <Link
              key={l.code}
              href={pathname}
              locale={l.code}
              role="menuitemradio"
              aria-checked={l.code === locale}
              className="ax-menu-item"
              lang={l.code}
              onClick={() => void saveLocale(l.code)}
            >
              {{ en: "English", fr: "Français", ar: "العربية" }[l.code]}
            </Link>
          ))}
        </Menu>
      </div>
    </header>
  );
}
