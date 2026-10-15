import { Activity } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { dayDiff, formatter, type Locale } from "@/lib/format";
import { EmptyState } from "@/components/ui/Card";
import { ACTIVITY_LOOK, activitySentence, FALLBACK_LOOK, NOTE_KINDS } from "./look";

export type TimelineItem = {
  id: string;
  kind: string;
  payload: Record<string, string | number>;
  occurredAt: Date;
  actorName: string | null;
};

/**
 * DS › Timeline: newest first, optionally grouped by day under sticky labels (Today, Yesterday, date).
 * Relative time under 7 days with the exact time in a tooltip; notes in an `ax-tl-note` box.
 */
export async function Timeline({
  items,
  now,
  currency,
  grouped,
}: {
  items: TimelineItem[];
  now: Date;
  currency: string;
  grouped: boolean;
}) {
  const f = formatter((await getLocale()) as Locale);
  const t = await getTranslations("timeline");
  const tc = await getTranslations("common");
  const ta = await getTranslations("activity");
  const ts = await getTranslations("status");
  if (items.length === 0) return <EmptyState icon={Activity} title={t("empty")} />;

  const dayLabel = (d: Date) => {
    const diff = dayDiff(d, now);
    if (diff === 0) return tc("today");
    if (diff === -1) return t("yesterday");
    return f.date(d, "medium");
  };
  const groups: { label: string; key: string; items: TimelineItem[] }[] = [];
  for (const a of items) {
    const label = grouped ? dayLabel(a.occurredAt) : "";
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(a);
    else groups.push({ label, key: a.id, items: [a] });
  }

  const item = (a: TimelineItem) => {
    const look = ACTIVITY_LOOK[a.kind] ?? FALLBACK_LOOK;
    const sentence = activitySentence(
      a.kind,
      a.payload,
      f,
      ta as unknown as (k: string, v?: Record<string, string>) => string,
      (d, c) => ts(`${d}.${c}` as never),
      currency,
    );
    const ageDays = -dayDiff(a.occurredAt, now);
    const exact = `${f.date(a.occurredAt, "medium")} · ${f.time(a.occurredAt)}`;
    return (
      <li key={a.id} className="ax-tl-item">
        <span className={`ax-tl-icon ${look.tone}`} aria-hidden>
          <look.icon className="ax-icon" />
        </span>
        <div className="ax-tl-text">
          <b>{sentence}</b>
          {a.actorName ? <> · {a.actorName}</> : null}
          {NOTE_KINDS.has(a.kind) && a.payload.text ? <div className="ax-tl-note">{String(a.payload.text)}</div> : null}
          <time dateTime={a.occurredAt.toISOString()} title={exact}>
            {ageDays < 7 ? f.relativeTime(a.occurredAt, now) : exact}
          </time>
        </div>
      </li>
    );
  };

  if (!grouped) return <ol className="ax-timeline">{items.map(item)}</ol>;
  return (
    <div className="tl-groups">
      {groups.map((g) => (
        <section key={g.key} aria-label={g.label}>
          <h3 className="tl-day">{g.label}</h3>
          <ol className="ax-timeline">{g.items.map(item)}</ol>
        </section>
      ))}
    </div>
  );
}
