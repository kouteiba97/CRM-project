import { useTranslations } from "next-intl";

/**
 * DS › PriorityIndicator: three ascending bars (Urgent = filled square with "!"). The shape carries the
 * order; `compact` shows the glyph alone (kanban cards, task rows) with the word as its accessible name.
 */
export function Priority({ level, compact = false }: { level: string; compact?: boolean }) {
  const t = useTranslations("status.priority");
  const word = t(level as never);
  const on = { urgent: 3, high: 3, medium: 2, low: 1 }[level] ?? 0;
  const glyph =
    level === "urgent" ? (
      <svg viewBox="0 0 14 14" aria-hidden>
        <rect className="on" x="1" y="1" width="12" height="12" rx="2" />
        <rect x="6.25" y="3.5" width="1.5" height="4.5" rx=".75" className="prio-mark" />
        <rect x="6.25" y="9.25" width="1.5" height="1.5" rx=".75" className="prio-mark" />
      </svg>
    ) : (
      <svg viewBox="0 0 14 14" aria-hidden>
        <rect className={on >= 1 ? "on" : ""} x="1.5" y="7.5" width="2.5" height="5" rx="1" />
        <rect className={on >= 2 ? "on" : ""} x="5.75" y="4.5" width="2.5" height="8" rx="1" />
        <rect className={on >= 3 ? "on" : ""} x="10" y="1.5" width="2.5" height="11" rx="1" />
      </svg>
    );
  if (compact)
    return (
      <span className={`ax-prio ${level}`} role="img" aria-label={word} title={word}>
        {glyph}
      </span>
    );
  return (
    <span className={`ax-prio ${level}`}>
      {glyph}
      <span className="t">{word}</span>
    </span>
  );
}
