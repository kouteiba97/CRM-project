"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { saveSidebar } from "@/app/actions";
import type { SidebarCounts } from "@/db/queries/dashboard";
import { ALL_NAV, QUICK_CREATE } from "./nav";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { ToastProvider } from "./Toasts";
import { CrumbProvider } from "./Crumbs";

export type SidebarState = "auto" | "collapsed" | "expanded";

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

export function AppShell({
  children,
  counts,
  workspaceName,
  workspaceId,
  workspaces,
  userName,
  initialSidebar,
}: {
  children: ReactNode;
  counts: SidebarCounts;
  workspaceName: string;
  workspaceId: string;
  workspaces: { id: string; name: string }[];
  userName: string;
  initialSidebar: SidebarState;
}) {
  const [sidebar, setSidebar] = useState<SidebarState>(initialSidebar);
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("shell");
  const goPending = useRef<number | null>(null);

  // Close the off-canvas sheet after navigating (adjusting state during render, not in an effect).
  const [navPath, setNavPath] = useState(pathname);
  if (navPath !== pathname) {
    setNavPath(pathname);
    setNavOpen(false);
  }

  // Persisting is a side effect, so it runs outside the state updater (updaters must stay pure).
  const toggleSidebar = useCallback(() => {
    const autoCollapsed = window.matchMedia("(min-width: 1024px) and (max-width: 1279px)").matches;
    const collapsedNow = sidebar === "collapsed" || (sidebar === "auto" && autoCollapsed);
    const next: SidebarState = collapsedNow ? "expanded" : "collapsed";
    setSidebar(next);
    void saveSidebar(next);
  }, [sidebar]);

  // Global shortcuts (DS › Interaction › Keyboard). Single keys are ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || paletteOpen) return;
      const key = e.key.toLowerCase();
      if (goPending.current !== null) {
        window.clearTimeout(goPending.current);
        goPending.current = null;
        const target = ALL_NAV.find((i) => i.goKey === key);
        if (target) {
          e.preventDefault();
          router.push(target.href);
        }
        return;
      }
      if (key === "g") {
        goPending.current = window.setTimeout(() => (goPending.current = null), 1200);
      } else if (e.key === "[") {
        e.preventDefault();
        toggleSidebar();
      } else if (e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === "Escape" && navOpen) {
        setNavOpen(false);
      } else {
        const qc = QUICK_CREATE.find((q) => q.shortcut.toLowerCase() === key);
        if (qc && !e.shiftKey) {
          e.preventDefault();
          router.push(qc.href);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, toggleSidebar, navOpen, paletteOpen]);

  return (
    <ToastProvider>
      <CrumbProvider>
      <div className="app" data-sidebar={sidebar} data-nav-open={navOpen}>
        <a className="skip-link" href="#main">
          {t("skipToContent")}
        </a>
        <div className="app-sidebar">
          <Sidebar
            counts={counts}
            workspaceName={workspaceName}
            workspaceId={workspaceId}
            workspaces={workspaces}
            onToggle={toggleSidebar}
          />
        </div>
        <button
          type="button"
          className="nav-scrim"
          aria-label={t("closeNav")}
          tabIndex={-1}
          onClick={() => setNavOpen(false)}
        />
        <div className="app-main">
          <Topbar
            counts={counts}
            userName={userName}
            onOpenNav={() => setNavOpen(true)}
            onOpenSearch={() => setPaletteOpen(true)}
          />
          <main id="main" className="app-content" tabIndex={-1}>
            {children}
          </main>
        </div>
        {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      </div>
      </CrumbProvider>
    </ToastProvider>
  );
}
