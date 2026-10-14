import { dayDiff, type Formatter } from "./format";

export type DueTone = "overdue" | "soon" | "future";
export type Due = { tone: DueTone; days: number; label: string; absolute: string };

type OverdueWords = (days: number) => string;

/**
 * DS › Follow-ups due styling: future text-secondary · today/tomorrow status-warning + clock ·
 * overdue status-danger + words ("Overdue · 12 days"). Relative words only within ±7 days.
 */
export function due(
  value: Date | string,
  f: Formatter,
  overdueWords: OverdueWords,
  opts: { withTime?: boolean; now?: Date } = {},
): Due {
  const now = opts.now ?? new Date();
  const days = dayDiff(value, now);
  const absolute = f.date(value, "medium") + (opts.withTime ? ` · ${f.time(value)}` : "");
  if (days < 0) return { tone: "overdue", days, label: overdueWords(-days), absolute };
  const rel = f.relativeDay(value, now);
  const day = rel ? capitalize(rel, f.locale) : f.date(value, "short");
  const label = opts.withTime ? `${day} · ${f.time(value)}` : day;
  return { tone: days <= 1 ? "soon" : "future", days, label, absolute };
}

function capitalize(s: string, locale: string) {
  return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
}
