"use client";

import { useRef, useState, useTransition, type KeyboardEvent } from "react";
import { Copy, Mail, NotebookPen, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/shell/Toasts";
import { logActivity, type RecordTarget } from "./actions";

/** DS › Tabs: links reflected in `?tab=`, roving focus with ←/→ (mirrored in RTL), Home/End. */
export function TabLinks({
  label,
  tabs,
  current,
  panelId,
}: {
  label: string;
  tabs: { key: string; label: string; count?: number; href: string }[];
  current: string;
  panelId: string;
}) {
  const list = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const onKeyDown = (e: KeyboardEvent) => {
    const items = Array.from(
      list.current?.querySelectorAll<HTMLAnchorElement>('[role="tab"]') ?? [],
    );
    const i = items.indexOf(document.activeElement as HTMLAnchorElement);
    if (i < 0) return;
    const rtl = getComputedStyle(list.current!).direction === "rtl";
    const fwd = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    let n = -1;
    if (e.key === fwd) n = (i + 1) % items.length;
    else if (e.key === back) n = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = items.length - 1;
    if (n < 0) return;
    e.preventDefault();
    items[n]?.focus();
    const href = tabs[n]?.href;
    if (href) router.replace(href, { scroll: false });
  };

  return (
    <div
      ref={list}
      className="ax-tabs profile-tabs"
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {tabs.map((tab) => {
        const selected = tab.key === current;
        return (
          <Link
            key={tab.key}
            id={`tab-${tab.key}`}
            role="tab"
            className="ax-tab"
            href={tab.href}
            scroll={false}
            replace
            aria-selected={selected}
            aria-controls={selected ? panelId : undefined}
            tabIndex={selected ? 0 : -1}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ax-count">{tab.count}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/** Copies an e-mail or phone; the label names what is copied. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const t = useTranslations("clients.profile");
  const toast = useToast();
  return (
    <button
      type="button"
      className="ax-btn ax-btn-tertiary ax-btn-xs ax-btn-icon"
      aria-label={label}
      title={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast({ tone: "success", title: t("copied", { value }) });
        } catch {
          toast({ tone: "danger", title: t("copyFailed") });
        }
      }}
    >
      <Copy className="ax-icon" aria-hidden />
    </button>
  );
}

const KINDS = [
  { key: "call_logged", icon: Phone },
  { key: "email_logged", icon: Mail },
  { key: "note_logged", icon: NotebookPen },
] as const;

/** DS › Timeline composer: "Log a call / note / email" + textarea. */
export function ActivityComposer({ target }: { target: RecordTarget }) {
  const t = useTranslations("clients.composer");
  const tc = useTranslations("common");
  const toast = useToast();
  const [kind, setKind] = useState<(typeof KINDS)[number]["key"]>("call_logged");
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);

  const submit = () => {
    if (!text.trim() || pending) {
      setError(!text.trim());
      return;
    }
    start(async () => {
      try {
        await logActivity(target, kind, text);
        setText("");
        setError(false);
        toast({ tone: "success", title: t("logged") });
      } catch {
        toast({ tone: "danger", title: t("failed"), action: { label: tc("retry"), run: submit } });
      }
    });
  };

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="ax-segmented" role="group" aria-label={t("kind")}>
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            aria-pressed={kind === k.key}
            onClick={() => setKind(k.key)}
          >
            <k.icon className="ax-icon ax-icon-sm" aria-hidden />
            {t(k.key)}
          </button>
        ))}
      </div>
      <label className="sr-only" htmlFor="composer-text">
        {t("label")}
      </label>
      <textarea
        id="composer-text"
        className="ax-input"
        rows={3}
        value={text}
        placeholder={t(`placeholder_${kind}`)}
        aria-invalid={error || undefined}
        aria-describedby={error ? "composer-err" : undefined}
        onChange={(e) => {
          setText(e.target.value);
          if (error && e.target.value.trim()) setError(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
      />
      {error && (
        <span className="ax-error" id="composer-err">
          {t("required")}
        </span>
      )}
      <div className="composer-foot">
        <button type="submit" className="ax-btn ax-btn-primary ax-btn-sm" aria-busy={pending}>
          {pending && <span className="ax-spinner" aria-hidden />}
          {t("submit")}
        </button>
      </div>
    </form>
  );
}
