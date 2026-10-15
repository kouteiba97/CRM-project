import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, BellRing, CalendarDays, FileText, FolderKanban } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getClientListMeta, isUuid } from "@/db/queries/clients";
import {
  getClientOptions,
  getLead,
  getLeadActivity,
  getLeadNextFollowUp,
  type LeadRow,
} from "@/db/queries/leads";
import { due } from "@/lib/due";
import { formatter, type Locale } from "@/lib/format";
import { getSession } from "@/lib/session";
import { Timeline } from "@/components/activity/Timeline";
import { ActivityComposer } from "@/components/clients/ProfileClientParts";
import { FollowUpActions } from "@/components/clients/RecordActions";
import { RecordCrumb } from "@/components/shell/Crumbs";
import { hueOf, initials } from "@/components/shell/initials";
import { CardSkeleton } from "@/components/ui/Card";
import { DueLabel } from "@/components/ui/DueLabel";
import { Priority } from "@/components/ui/Priority";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WidgetError } from "@/components/ui/WidgetError";
import { LeadDrawer } from "./LeadDrawer";
import { LeadMoreMenu, LeadStageMenu } from "./LeadRecordActions";
import { OPEN_STAGES, type LeadFormValues } from "./schema";

type SP = Record<string, string | string[] | undefined>;

export async function loadLeadForMeta(id: string) {
  if (!isUuid(id)) return null;
  const session = await getSession();
  return getLead(session.workspaceId, id).catch(() => null);
}

/** Lead record: rail (identity, stage controls, details, next follow-up) + main (stage stepper, activity). */
export async function LeadRecordPage({ id, sp }: { id: string; sp: SP }) {
  if (!isUuid(id)) notFound();
  const session = await getSession();
  const lead = await getLead(session.workspaceId, id);
  if (!lead) notFound();
  const t = await getTranslations("leads.record");
  const tl = await getTranslations("leads");
  const tn = await getTranslations("nav");
  const ts = await getTranslations("status.lead");
  const f = formatter((await getLocale()) as Locale);
  const now = new Date();
  const editing = sp.edit === "1";
  const [meta, clients] = editing
    ? await Promise.all([
        getClientListMeta(session.workspaceId),
        getClientOptions(session.workspaceId),
      ])
    : [null, []];

  const who = lead.clientName ?? lead.prospectCompany ?? lead.prospectName;
  const open = (OPEN_STAGES as readonly string[]).includes(lead.stage);
  const stageIndex = OPEN_STAGES.indexOf(lead.stage as (typeof OPEN_STAGES)[number]);
  const details: [string, ReactNode][] = [
    [
      tl("col.value"),
      <b key="v" className="ax-num">
        {f.money(lead.valueMinor, lead.currency)}
      </b>,
    ],
    [tl("col.priority"), <Priority key="p" level={lead.priority} />],
  ];
  if (lead.clientId && lead.clientName)
    details.push([
      t("client"),
      <Link key="c" className="ax-link" href={`/clients/${lead.clientId}`}>
        {lead.clientName}
      </Link>,
    ]);
  else if (who)
    details.push([
      t("prospect"),
      [lead.prospectCompany, lead.prospectName].filter(Boolean).join(" · "),
    ]);
  if (lead.expectedCloseDate)
    details.push([tl("col.expectedClose"), f.date(lead.expectedCloseDate, "medium")]);
  if (lead.ownerName) details.push([tl("col.owner"), lead.ownerName]);
  if (lead.source) details.push([t("source"), lead.source]);
  if (lead.stage === "lost" && lead.lostReason)
    details.push([t("lostReason"), tl(`reason.${lead.lostReason}` as never)]);
  details.push([t("created"), f.date(lead.createdAt, "medium")]);

  return (
    <>
      <RecordCrumb label={lead.title} />
      <nav aria-label={t("back")} className="profile-back">
        <Link className="ax-link" href="/leads">
          <ArrowLeft className="ax-icon ax-icon-sm ax-flip" aria-hidden />
          {tn("leads")}
        </Link>
      </nav>
      <div className="profile">
        <aside className="profile-rail" aria-label={t("summary")}>
          <section className="ax-card ax-card-body rail-block">
            <div className="identity">
              <span
                className="ax-avatar xl sq"
                data-hue={hueOf(lead.clientId ?? lead.id)}
                aria-hidden
              >
                {initials(who ?? lead.title)}
              </span>
              <div className="identity-txt">
                <h1 className="identity-name">{lead.title}</h1>
                {who && <span className="ax-faint">{who}</span>}
                <StatusBadge domain="lead" code={lead.stage} />
              </div>
            </div>
            <div className="quick-actions" role="group" aria-label={t("quickActions")}>
              <LeadStageMenu
                lead={{
                  id: lead.id,
                  title: lead.title,
                  stage: lead.stage,
                  valueMinor: lead.valueMinor,
                  currency: lead.currency,
                  lostReason: lead.lostReason,
                }}
              />
              <LeadMoreMenu lead={{ id: lead.id, title: lead.title }} />
            </div>
            {lead.stage === "won" && (
              <div className="quick-actions">
                <Link
                  className="ax-btn ax-btn-primary ax-btn-xs"
                  href={`/projects?new=1&lead=${lead.id}`}
                >
                  <FolderKanban className="ax-icon" aria-hidden />
                  {tl("convertToProject")}
                </Link>
                <Link
                  className="ax-btn ax-btn-secondary ax-btn-xs"
                  href={`/quotations?new=1&lead=${lead.id}`}
                >
                  <FileText className="ax-icon" aria-hidden />
                  {tl("createQuotation")}
                </Link>
              </div>
            )}
          </section>

          <section className="ax-card ax-card-body rail-block" aria-labelledby="rail-details">
            <h2 id="rail-details" className="rail-title">
              {t("details")}
            </h2>
            <dl className="ax-dl rail-dl">
              {details.map(([dt, dd], i) => (
                <div key={i} className="dl-row">
                  <dt>{dt}</dt>
                  <dd>{dd}</dd>
                </div>
              ))}
            </dl>
          </section>

          <Suspense fallback={<CardSkeleton rows={1} label={t("nextFollowUp")} />}>
            <LeadFollowUp ws={session.workspaceId} lead={lead} now={now} open={open} />
          </Suspense>
        </aside>

        <div className="profile-main">
          <section className="ax-card ax-card-body" aria-label={t("progress")}>
            <ol className="ax-steps lead-steps">
              {OPEN_STAGES.map((s, i) => {
                const state = !open || i < stageIndex ? "done" : i === stageIndex ? "current" : "";
                return (
                  <li
                    key={s}
                    className={`ax-step ${state}`}
                    aria-current={i === stageIndex ? "step" : undefined}
                  >
                    <span className="n">{ts(s)}</span>
                  </li>
                );
              })}
              <li
                className={`ax-step ${open ? "" : lead.stage === "won" ? "done current" : "late current"}`}
              >
                <span className="n">
                  {open ? `${ts("won")} / ${ts("lost")}` : ts(lead.stage as never)}
                </span>
              </li>
            </ol>
          </section>

          <section className="ax-card activity-card" aria-labelledby="lead-activity">
            <div className="ax-card-head ruled">
              <h2 id="lead-activity" className="rail-title">
                {t("activity")}
              </h2>
            </div>
            <ActivityComposer target={{ type: "lead", id: lead.id }} />
            <Suspense fallback={<CardSkeleton rows={4} label={t("activity")} />}>
              <LeadTimeline
                ws={session.workspaceId}
                id={lead.id}
                now={now}
                currency={lead.currency}
              />
            </Suspense>
          </section>
        </div>
      </div>

      {editing && (
        <LeadDrawer
          edit={{ id: lead.id }}
          clients={clients.map((c) => ({ value: c.id, label: c.name, currency: c.currency }))}
          owners={(meta?.owners ?? []).map((o) => ({ value: o.id, label: o.name }))}
          initial={formValues(lead)}
          closeHref={`/leads/${lead.id}`}
        />
      )}
    </>
  );
}

function formValues(l: LeadRow): LeadFormValues {
  return {
    title: l.title,
    clientId: l.clientId ?? "",
    prospectCompany: l.prospectCompany ?? "",
    prospectName: l.prospectName ?? "",
    value: (l.valueMinor / 100).toFixed(2),
    currency: l.currency,
    priority: l.priority,
    stage: (OPEN_STAGES as readonly string[]).includes(l.stage) ? l.stage : "new",
    expectedCloseDate: l.expectedCloseDate ?? "",
    ownerId: l.ownerId ?? "",
    source: l.source ?? "",
    followUpAt: "",
    followUpChannel: "call",
  };
}

async function LeadFollowUp({
  ws,
  lead,
  now,
  open,
}: {
  ws: string;
  lead: LeadRow;
  now: Date;
  open: boolean;
}) {
  const t = await getTranslations("leads.record");
  const tc = await getTranslations("common");
  const tch = await getTranslations("channel");
  const f = formatter((await getLocale()) as Locale);
  let fu: Awaited<ReturnType<typeof getLeadNextFollowUp>>;
  try {
    fu = await getLeadNextFollowUp(ws, lead.id);
  } catch {
    return <WidgetError title={t("nextFollowUp")} />;
  }
  return (
    <section className="ax-card ax-card-body rail-block" aria-labelledby="rail-fu">
      <h2 id="rail-fu" className="rail-title">
        <BellRing className="ax-icon ax-icon-sm" aria-hidden />
        {t("nextFollowUp")}
      </h2>
      {fu ? (
        <div className="fu">
          <span className="ax-date-tile" aria-hidden>
            <b>{f.date(fu.dueAt, "day")}</b>
            <span>{f.date(fu.dueAt, "month")}</span>
          </span>
          <div className="fu-txt">
            <b>{fu.subject}</b>
            <span className="ax-faint">{tch(fu.channel)}</span>
            <DueLabel
              due={due(fu.dueAt, f, (d) => tc("overdueDays", { days: d }), { withTime: true, now })}
            />
          </div>
        </div>
      ) : (
        <p className={`ax-due${open ? " no-fu" : ""}`}>{tc("noFollowUp")}</p>
      )}
      <FollowUpActions
        target={{ type: "lead", id: lead.id }}
        followUp={fu ? { id: fu.id, dueAt: fu.dueAt.toISOString(), subject: fu.subject } : null}
      />
      <Link className="ax-link fu-link" href="/follow-ups">
        <CalendarDays className="ax-icon ax-icon-sm" aria-hidden />
        {t("allFollowUps")}
      </Link>
    </section>
  );
}

async function LeadTimeline({
  ws,
  id,
  now,
  currency,
}: {
  ws: string;
  id: string;
  now: Date;
  currency: string;
}) {
  const t = await getTranslations("leads.record");
  const items = await getLeadActivity(ws, id, 100).catch((err) => {
    console.error("[lead activity]", err);
    return null;
  });
  if (!items) return <WidgetError title={t("activity")} />;
  return <Timeline items={items} now={now} currency={currency} grouped />;
}
