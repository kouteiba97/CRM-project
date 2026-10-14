"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ALL_NAV, QUICK_CREATE } from "./nav";

/** Ctrl/⌘K: jump to a module or start a record. Full record search arrives with the list pages. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const t = useTranslations("shell");
  const tn = useTranslations("nav");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    input.current?.focus();
    return () => (opener.current as HTMLElement | null)?.focus?.();
  }, []);

  const entries = useMemo(() => {
    const all = [
      ...ALL_NAV.map((i) => ({ id: i.key, label: tn(i.key), href: i.href, icon: i.icon })),
      ...QUICK_CREATE.map((q) => ({ id: q.key, label: t(q.key), href: q.href, icon: Plus })),
    ];
    const q = query.trim().toLocaleLowerCase();
    return q ? all.filter((e) => e.label.toLocaleLowerCase().includes(q)) : all;
  }, [query, t, tn]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className="palette-scrim ax-scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="ax-palette"
        role="dialog"
        aria-modal="true"
        aria-label={t("search")}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, entries.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && entries[active]) {
            e.preventDefault();
            go(entries[active].href);
          } else if (e.key === "Tab") e.preventDefault();
        }}
      >
        <div className="ax-palette-input">
          <Search className="ax-icon" aria-hidden />
          <input
            ref={input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder={t("search")}
            aria-label={t("search")}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={entries[active] ? `pal-${entries[active].id}` : undefined}
          />
          <span className="ax-kbd">Esc</span>
        </div>
        <ul id="palette-list" role="listbox" className="ax-palette-list">
          {entries.map((e, i) => (
            <li
              key={e.id}
              id={`pal-${e.id}`}
              role="option"
              aria-selected={i === active}
              data-active={i === active}
              className="ax-menu-item"
              onPointerMove={() => setActive(i)}
              onClick={() => go(e.href)}
            >
              <e.icon className="ax-icon" aria-hidden />
              {e.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
