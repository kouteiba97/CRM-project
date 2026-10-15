import { Suspense } from "react";
import { BellRing, CalendarDays, Check, Mail, Phone, Plus, type LucideIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getClientListMeta } from "@/db/queries/clients";
import {
  FOLLOWUP_CHANNELS,
  getFollowUpTargets,
  listFollowUps,
  parseFollowUpFilters,
  type FollowUpFilters,
  type FollowUpRow,
} from "@/db/queries/followups";
import { due } from "@/lib/due";
import { formatter, type Formatter, type Locale } from "@/lib/format";
import { getSession } from "@/lib/session";
import { FollowUpActions } from "@/components/clients/RecordActions";
import { hueOf, initials } from "@/components/shell/initials";
import { dueBucket, isoLocal, type DueBucket } from "@/components/tasks/schema";
import { CardSkeleton, EmptyState } from "@/components/ui/Card";
import { DueLabel } from "@/components/ui/DueLabel";
import { WidgetError } from "@/components/ui/WidgetError";
import { FollowUpDrawer, FollowUpsToolbar } from "./FollowUpsClient";

type SP = Record<string, string | string[] | undefined>;
const CHANNEL_ICON: Record<string, LucideIcon> = {
  call: Phone,
  email: Mail,
  meeting: CalendarDays,
};
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const toQuery = (sp: SP, drop: string[]) => {
  const q = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
  );
  for (const k of drop) q.delete(k);
  return q;
};

/**
 * DS › Follow-ups: dated reminders on a client or lead (call, email, meeting), grouped by due
 * (Overdue · Today · This week · Later) with the due styling; Done prompts for the outcome and the next
 * follow-up inline. Recently completed ones are listed (collapsed) at the end.
 */
export async function FollowUpsPage({ searchParams }: { searchParams: SP }) {
  const session = await getSession();
  const t = await getTranslations("followUps");
  const tn = await getTranslations("nav");
  const tch = await getTranslations("channel");
  const filters = parseFollowUpFilters(searchParams);
  const meta = await getClientListMeta(session.workspaceId).catch(() => null);
  const openNew = str(searchParams.new) === "1";
  const targets = openNew ? await getFollowUpTargets(session.workspaceId) : null;
  const newQ = toQuery(searchParams, []);
  newQ.set("new", "1");
  const closeQ = toQuery(searchParams, ["new", "client", "lead"]).toString();
  const preset = str(searchParams.client)
    ? `client:${str(searchParams.client)}`
    : str(searchParams.lead)
      ? `lead:${str(searchParams.lead)}`
      : "";

  return (
    <>
      <header className="pagehead">
        <h1 className="t-page-title">{tn("followUps")}</h1>
        <div className="actions">
          <Link
            className="ax-btn ax-btn-primary ax-btn-sm"
            href={`/follow-ups?${newQ}`}
            scroll={false}
          >
            <Plus className="ax-icon" aria-hidden />
            {t("new")}
          </Link>
        </div>
      </header>
      <div className="ax-table-wrap clients-frame">
        <FollowUpsToolbar
          channels={FOLLOWUP_CHANNELS.map((c) => ({ value: c, label: tch(c) }))}
          kinds={[
            { value: "client", label: t("onClients") },
            { value: "lead", label: t("onLeads") },
          ]}
          owners={(meta?.owners ?? []).map((o) => ({ value: o.id, label: o.name }))}
          resultsLabel={t("showResults")}
        />
        <Suspense
          key={JSON.stringify(filters)}
          fallback={<CardSkeleton rows={6} label={tn("followUps")} />}
        >
          <FollowUpsList filters={filters} />
        </Suspense>
      </div>
      {openNew && targets && (
        <FollowUpDrawer
          clients={targets.clients.map((c) => ({ value: c.id, label: c.name }))}
          leads={targets.leads.map((l) => ({ value: l.id, label: l.title }))}
          initialTarget={preset}
          closeHref={`/follow-ups${closeQ ? `?${closeQ}` : ""}`}
        />
      )}
    </>
  );
}

async function FollowUpsList({ filters }: { filters: FollowUpFilters }) {
  const session = await getSession();
  const t = await getTranslations("followUps");
  const tc = await getTranslations("common");
  const f = formatter((await getLocale()) as Locale);
  const now = new Date();
  let data: Awaited<ReturnType<typeof listFollowUps>>;
  try {
    data = await listFollowUps(session.workspaceId, filters, now);
  } catch (err) {
    console.error("[follow-ups]", err);
    return <WidgetError title={t("listLabel")} />;
  }
  const anyFilter = !!(filters.q || filters.channel || filters.on || filters.owner);
  if (data.open.length === 0 && data.done.length === 0)
    return (
      <div className="clients-empty">
        <EmptyState
          icon={BellRing}
          title={anyFilter ? t("noMatchTitle") : t("emptyTitle")}
          body={anyFilter ? t("noMatchBody") : t("emptyBody")}
        />
        {anyFilter && (
          <Link className="ax-btn ax-btn-secondary ax-btn-sm" href="/follow-ups" scroll={false}>
            {tc("clearFilters")}
          </Link>
        )}
      </div>
    );

  const buckets: Exclude<DueBucket, "none">[] = ["overdue", "today", "week", "later"];
  const byBucket = new Map(buckets.map((b) => [b, [] as FollowUpRow[]]));
  for (const r of data.open) {
    const b = dueBucket(isoLocal(r.dueAt), now);
    byBucket.get(b === "none" ? "later" : b)!.push(r);
  }

  return (
    <div className="fu-board">
      {buckets.map((b) => {
        const rows = byBucket.get(b)!;
        if (rows.length === 0) return null;
        return (
          <section
            key={b}
            className={`fu-group${b === "overdue" ? " is-danger" : ""}`}
            aria-labelledby={`fu-g-${b}`}
          >
            <h2 className="fu-group-head" id={`fu-g-${b}`}>
              <span className="name">{t(`group.${b}`)}</span>
              <span className="ax-count">{rows.length}</span>
            </h2>
            <ul className="fu-list">
              {rows.map((r) => (
                <FollowUpItem key={r.id} r={r} f={f} now={now} />
              ))}
            </ul>
          </section>
        );
      })}
      {data.done.length > 0 && (
        <details className="fu-group fu-done">
          <summary className="fu-group-head">
            <span className="name">{t("group.done")}</span>
            <span className="ax-count">{data.done.length}</span>
          </summary>
          <ul className="fu-list">
            {data.done.map((r) => (
              <FollowUpItem key={r.id} r={r} f={f} now={now} done />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

async function FollowUpItem({
  r,
  f,
  now,
  done = false,
}: {
  r: FollowUpRow;
  f: Formatter;
  now: Date;
  done?: boolean;
}) {
  const t = await getTranslations("followUps");
  const tc = await getTranslations("common");
  const tch = await getTranslations("channel");
  const Icon = CHANNEL_ICON[r.channel] ?? Phone;
  const d = due(r.dueAt, f, (n) => tc("overdueDays", { days: n }), { withTime: true, now });
  const target = r.leadId
    ? { type: "lead" as const, id: r.leadId }
    : { type: "client" as const, id: r.clientId! };
  return (
    <li
      className={`fu-row${d.tone === "overdue" && !done ? " is-overdue" : ""}${done ? " is-done" : ""}`}
    >
      <span className="ax-date-tile" aria-hidden>
        <b>{f.date(r.dueAt, "day")}</b>
        <span>{f.date(r.dueAt, "month")}</span>
      </span>
      <div className="fu-main">
        <span className="fu-subject">
          <Icon className="ax-icon ax-icon-sm" aria-hidden />
          <span className="sr-only">{tch(r.channel)}: </span>
          <b>{r.subject}</b>
        </span>
        <span className="fu-about">
          {r.leadId ? (
            <>
              <Link className="ax-link" href={`/leads/${r.leadId}`}>
                {r.leadTitle}
              </Link>
              {r.leadCompany ? <span className="ax-faint"> · {r.leadCompany}</span> : null}
            </>
          ) : (
            <Link className="ax-link" href={`/clients/${r.clientId}`}>
              {r.clientName}
            </Link>
          )}
        </span>
        {done && r.outcome && <span className="ax-tl-note fu-outcome">{r.outcome}</span>}
      </div>
      <div className="fu-when">
        {done ? (
          <span className="ax-due">
            <Check className="ax-icon" aria-hidden />
            {t("doneOn", { date: f.date(r.completedAt ?? r.dueAt, "medium") })}
          </span>
        ) : (
          <DueLabel due={d} />
        )}
        {r.ownerName && (
          <span
            className="ax-avatar sm"
            data-hue={hueOf(r.ownerId ?? "")}
            title={r.ownerName}
            aria-hidden
          >
            {initials(r.ownerName)}
          </span>
        )}
      </div>
      {!done && (
        <div className="fu-actions-cell">
          <FollowUpActions
            target={target}
            followUp={{ id: r.id, dueAt: r.dueAt.toISOString(), subject: r.subject }}
          />
        </div>
      )}
    </li>
  );
}
