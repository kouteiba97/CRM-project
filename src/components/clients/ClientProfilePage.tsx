import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BellRing,
  CalendarDays,
  CircleAlert,
  FileText,
  FolderKanban,
  Mail,
  Paperclip,
  Phone,
  Plus,
  Receipt,
  Wallet,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  ACTIVITY_FILTERS,
  getClient,
  getClientActivity,
  getClientListMeta,
  getClientInvoices,
  getClientKpis,
  getClientPayments,
  getClientProjects,
  getClientQuotations,
  getNextFollowUp,
  getTabCounts,
  isUuid,
  type ActivityFilter,
  type ClientRecord,
  type Money,
} from "@/db/queries/clients";
import { due } from "@/lib/due";
import { formatter, type Formatter, type Locale } from "@/lib/format";
import { getSession } from "@/lib/session";
import { Timeline } from "@/components/activity/Timeline";
import { RecordCrumb } from "@/components/shell/Crumbs";
import { hueOf, initials } from "@/components/shell/initials";
import { Card, CardSkeleton, EmptyState } from "@/components/ui/Card";
import { DueLabel } from "@/components/ui/DueLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WidgetError } from "@/components/ui/WidgetError";
import { ReminderSwitch } from "@/components/payments/ReminderSwitch";
import { ClientFormDrawer, type ClientFormValues } from "./ClientFormDrawer";
import { ActivityComposer, CopyButton, TabLinks } from "./ProfileClientParts";
import { FollowUpActions, ProfileMoreMenu } from "./RecordActions";

export const PROFILE_TABS = [
  "overview",
  "projects",
  "quotations",
  "invoices",
  "payments",
  "files",
  "activity",
] as const;
type Tab = (typeof PROFILE_TABS)[number];

async function setup() {
  const locale = (await getLocale()) as Locale;
  const f = formatter(locale);
  const t = await getTranslations("clients.profile");
  const tc = await getTranslations("common");
  return { locale, f, t, tc, overdueWords: (days: number) => tc("overdueDays", { days }) };
}

async function load<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    console.error("[client profile]", err);
    return { ok: false };
  }
}

export async function loadClientForMeta(id: string) {
  if (!isUuid(id)) return null;
  const session = await getSession();
  return getClient(session.workspaceId, id).catch(() => null);
}

/** Digits and a leading + only, for tel: links. */
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

/**
 * DS › ClientProfile: rail (identity, quick actions, contacts, details, next follow-up) +
 * main (KPI strip, tabs Overview · Projects · Quotations · Invoices · Payments · Files · Activity).
 */
type SP = Record<string, string | string[] | undefined>;
const param = (sp: SP, k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

export async function ClientProfilePage({ id, sp }: { id: string; sp: SP }) {
  const tabParam = param(sp, "tab");
  if (!isUuid(id)) notFound();
  const session = await getSession();
  const client = await getClient(session.workspaceId, id);
  if (!client) notFound();
  const tab: Tab = (PROFILE_TABS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as Tab)
    : "overview";
  const t = await getTranslations("clients.profile");
  const tn = await getTranslations("nav");
  const counts = await getTabCounts(session.workspaceId, id).catch(() => null);
  const ctx: Ctx = {
    ws: session.workspaceId,
    id,
    currency: client.currency ?? session.workspace.defaultCurrency,
    now: new Date(),
  };
  const activityType = (ACTIVITY_FILTERS as readonly string[]).includes(param(sp, "type") ?? "")
    ? (param(sp, "type") as ActivityFilter)
    : "all";
  const activityLimit = Math.min(
    500,
    Math.max(PAGE, Math.floor(Number(param(sp, "limit")) || PAGE)),
  );
  const owners =
    param(sp, "edit") === "1" ? (await getClientListMeta(session.workspaceId)).owners : [];

  const tabs = PROFILE_TABS.map((key) => ({
    key,
    label: t(`tab_${key}`),
    count: counts && key in counts ? counts[key as keyof typeof counts] : undefined,
    href: key === "overview" ? `/clients/${id}` : `/clients/${id}?tab=${key}`,
  }));

  return (
    <>
      <RecordCrumb label={client.name} />
      <nav aria-label={t("back")} className="profile-back">
        <Link className="ax-link" href="/clients">
          <ArrowLeft className="ax-icon ax-icon-sm ax-flip" aria-hidden />
          {tn("clients")}
        </Link>
      </nav>
      <div className="profile">
        <Rail client={client} ctx={ctx} />
        <div className="profile-main">
          <Suspense fallback={<CardSkeleton rows={2} label={t("kpis")} />}>
            <KpiStrip ctx={ctx} />
          </Suspense>
          <TabLinks label={t("tabs")} tabs={tabs} current={tab} panelId="client-tabpanel" />
          <section
            id="client-tabpanel"
            role="tabpanel"
            aria-labelledby={`tab-${tab}`}
            className="profile-panel"
          >
            <Suspense key={tab} fallback={<CardSkeleton rows={5} label={t(`tab_${tab}`)} />}>
              <TabPanel
                tab={tab}
                ctx={ctx}
                activity={{ type: activityType, limit: activityLimit }}
              />
            </Suspense>
          </section>
        </div>
      </div>
      {param(sp, "edit") === "1" && (
        <ClientFormDrawer
          owners={owners}
          currentUserId={session.userId}
          defaultCurrency={session.workspace.defaultCurrency}
          defaultLanguage={session.workspace.defaultDocumentLanguage}
          closeHref={tab === "overview" ? `/clients/${id}` : `/clients/${id}?tab=${tab}`}
          edit={{
            id,
            values: formValues(
              client,
              session.workspace.defaultCurrency,
              session.workspace.defaultDocumentLanguage,
            ),
          }}
        />
      )}
    </>
  );
}

function formValues(c: ClientRecord, currency: string, language: string): ClientFormValues {
  const p = c.contacts.find((x) => x.isPrimary) ?? c.contacts[0];
  return {
    name: c.name,
    kind: c.kind,
    status: c.status,
    email: c.email ?? "",
    phone: c.phone ?? "",
    city: c.city ?? "",
    country: c.country ?? "",
    currency: c.currency ?? currency,
    documentLanguage: c.documentLanguage ?? language,
    ownerId: c.ownerId ?? "",
    tags: c.tags.join(", "),
    contactFirstName: p?.firstName ?? "",
    contactLastName: p?.lastName ?? "",
    contactJobTitle: p?.jobTitle ?? "",
    contactEmail: p?.email ?? "",
    contactPhone: p?.phone ?? "",
  };
}

type Ctx = { ws: string; id: string; currency: string; now: Date };

// ── Rail ────────────────────────────────────────────────────────────────────────────────
async function Rail({ client, ctx }: { client: ClientRecord; ctx: Ctx }) {
  const { f, t } = await setup();
  const tn = await getTranslations("clients.new");
  const primary = client.contacts[0];
  const email = client.email ?? primary?.email ?? null;
  const phone = client.phone ?? primary?.phone ?? null;
  const place = [client.city, client.country].filter(Boolean).join(", ");
  const languageName = (code: string | null) =>
    code ? { fr: "Français", ar: "العربية", en: "English" }[code] : null;

  const details: [string, ReactNode][] = [];
  if (client.email)
    details.push([
      tn("email"),
      <>
        <a className="ax-link ax-ltr trunc" href={`mailto:${client.email}`}>
          {client.email}
        </a>
        <CopyButton value={client.email} label={t("copyEmail", { value: client.email })} />
      </>,
    ]);
  if (client.phone)
    details.push([
      tn("phone"),
      <>
        <a className="ax-link ax-ltr" href={telHref(client.phone)}>
          {client.phone}
        </a>
        <CopyButton value={client.phone} label={t("copyPhone", { value: client.phone })} />
      </>,
    ]);
  if (client.website)
    details.push([
      t("website"),
      <span className="ax-ltr trunc" key="w">
        {client.website}
      </span>,
    ]);
  if (place) details.push([t("location"), place]);
  for (const key of ["nif", "rc", "nis", "ai"] as const) {
    const v = client[key];
    if (v)
      details.push([
        t(key),
        <span className="ax-mono ax-ltr" key={key}>
          {v}
        </span>,
      ]);
  }
  details.push([tn("currency"), client.currency ?? ctx.currency]);
  const lang = languageName(client.documentLanguage);
  if (lang) details.push([tn("documentLanguage"), lang]);
  if (client.ownerName) details.push([tn("owner"), client.ownerName]);
  details.push([t("since"), f.date(client.createdAt, "medium")]);
  if (client.tags.length)
    details.push([
      tn("tags"),
      <span className="tag-list" key="tags">
        {client.tags.map((tag) => (
          <Link
            key={tag}
            className="ax-badge outline"
            href={`/clients?tag=${encodeURIComponent(tag)}`}
          >
            {tag}
          </Link>
        ))}
      </span>,
    ]);

  return (
    <aside className="profile-rail" aria-label={t("summary")}>
      <section className="ax-card ax-card-body rail-block">
        <div className="identity">
          <span className="ax-avatar xl sq" data-hue={hueOf(client.id)} aria-hidden>
            {initials(client.name)}
          </span>
          <div className="identity-txt">
            <h1 className="identity-name">{client.name}</h1>
            <span className="ax-faint">
              {t(client.kind === "company" ? "kindCompany" : "kindIndividual")}
              {place ? ` · ${place}` : ""}
            </span>
            <StatusBadge domain="client" code={client.status} />
          </div>
        </div>
        <div className="quick-actions" role="group" aria-label={t("quickActions")}>
          <ActionLink
            href={email ? `mailto:${email}` : null}
            icon={<Mail className="ax-icon" aria-hidden />}
            label={t("actionEmail")}
            title={email ?? t("noEmail")}
          />
          <ActionLink
            href={phone ? telHref(phone) : null}
            icon={<Phone className="ax-icon" aria-hidden />}
            label={t("actionCall")}
            title={phone ?? t("noPhone")}
          />
          <Link
            className="ax-btn ax-btn-secondary ax-btn-xs"
            href={`/projects?new=1&client=${client.id}`}
          >
            <Plus className="ax-icon" aria-hidden />
            {t("actionProject")}
          </Link>
          <ProfileMoreMenu clientId={client.id} name={client.name} />
        </div>
      </section>

      <section className="ax-card ax-card-body rail-block" aria-labelledby="rail-contacts">
        <h2 id="rail-contacts" className="rail-title">
          {t("contacts")}
        </h2>
        {client.contacts.length === 0 ? (
          <p className="ax-faint rail-empty">{t("noContacts")}</p>
        ) : (
          <ul className="contact-list">
            {client.contacts.map((c) => {
              const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
              return (
                <li key={c.id} className="contact">
                  <span className="ax-avatar md" data-hue={hueOf(c.id)} aria-hidden>
                    {initials(name)}
                  </span>
                  <div className="contact-txt">
                    <span className="contact-name">
                      {name}
                      {c.isPrimary && <span className="ax-badge outline">{t("primary")}</span>}
                    </span>
                    {c.jobTitle && <span className="ax-faint">{c.jobTitle}</span>}
                    {c.email && (
                      <span className="contact-line">
                        <Mail className="ax-icon ax-icon-sm" aria-hidden />
                        <a className="ax-link ax-ltr trunc" href={`mailto:${c.email}`}>
                          {c.email}
                        </a>
                        <CopyButton value={c.email} label={t("copyEmail", { value: c.email })} />
                      </span>
                    )}
                    {c.phone && (
                      <span className="contact-line">
                        <Phone className="ax-icon ax-icon-sm" aria-hidden />
                        <a className="ax-link ax-ltr" href={telHref(c.phone)}>
                          {c.phone}
                        </a>
                        <CopyButton value={c.phone} label={t("copyPhone", { value: c.phone })} />
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
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
          <ReminderSwitch clientId={client.id} enabled={client.remindersEnabled} />
      </section>

      <Suspense fallback={<CardSkeleton rows={1} label={t("nextFollowUp")} />}>
        <NextFollowUp ctx={ctx} />
      </Suspense>
    </aside>
  );
}

function ActionLink({
  href,
  icon,
  label,
  title,
}: {
  href: string | null;
  icon: ReactNode;
  label: string;
  title: string;
}) {
  if (!href)
    return (
      <span
        className="ax-btn ax-btn-secondary ax-btn-xs is-disabled"
        role="link"
        aria-disabled="true"
        title={title}
      >
        {icon}
        {label}
      </span>
    );
  return (
    <a className="ax-btn ax-btn-secondary ax-btn-xs" href={href} title={title}>
      {icon}
      {label}
      <span className="sr-only">
        {" "}
        · <span className="ax-ltr">{title}</span>
      </span>
    </a>
  );
}

async function NextFollowUp({ ctx }: { ctx: Ctx }) {
  const { f, t, overdueWords } = await setup();
  const tch = await getTranslations("channel");
  const res = await load(() => getNextFollowUp(ctx.ws, ctx.id));
  if (!res.ok) return <WidgetError title={t("nextFollowUp")} />;
  const fu = res.data;
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
            <span className="ax-faint">
              {tch(fu.channel)}
              {fu.leadTitle ? ` · ${fu.leadTitle}` : ""}
            </span>
            <DueLabel due={due(fu.dueAt, f, overdueWords, { withTime: true, now: ctx.now })} />
          </div>
        </div>
      ) : (
        <p className="ax-due no-fu">{t("noFollowUp")}</p>
      )}
      <FollowUpActions
        target={{ type: "client", id: ctx.id }}
        followUp={fu ? { id: fu.id, dueAt: fu.dueAt.toISOString(), subject: fu.subject } : null}
      />
      <Link className="ax-link fu-link" href="/follow-ups">
        <CalendarDays className="ax-icon ax-icon-sm" aria-hidden />
        {t("allFollowUps")}
      </Link>
    </section>
  );
}

// ── KPI strip ───────────────────────────────────────────────────────────────────────────
function moneyParts(f: Formatter, list: Money[], currency: string) {
  const main = list.find((m) => m.currency === currency);
  return {
    value: f.money(main?.minor ?? 0, currency),
    others: list.filter((m) => m.currency !== currency).map((m) => f.money(m.minor, m.currency)),
  };
}

async function KpiStrip({ ctx }: { ctx: Ctx }) {
  const { f, t } = await setup();
  const res = await load(() => getClientKpis(ctx.ws, ctx.id));
  if (!res.ok) return <WidgetError title={t("kpis")} />;
  const k = res.data;
  const revenue = moneyParts(f, k.revenue, ctx.currency);
  const outstanding = moneyParts(f, k.outstanding, ctx.currency);
  const overdue = moneyParts(f, k.overdue, ctx.currency);
  const tiles = [
    { key: "revenue", label: t("kpiRevenue"), ...revenue, danger: false, sub: null },
    { key: "outstanding", label: t("kpiOutstanding"), ...outstanding, danger: false, sub: null },
    {
      key: "overdue",
      label: t("kpiOverdue"),
      ...overdue,
      danger: k.overdueCount > 0,
      sub: k.overdueCount > 0 ? t("overdueInvoices", { count: k.overdueCount }) : null,
    },
    {
      key: "projects",
      label: t("kpiProjects"),
      value: f.number(k.openProjects),
      others: [] as string[],
      danger: false,
      sub: null,
    },
  ];
  return (
    <section className="ax-kpis profile-kpis" aria-label={t("kpis")}>
      {tiles.map((tile) => (
        <div key={tile.key} className="ax-metric">
          <span className="lbl">{tile.label}</span>
          <span className={`val${tile.danger ? " danger" : ""}`}>{tile.value}</span>
          {(tile.sub || tile.others.length > 0) && (
            <span className="sub">
              {tile.danger && <CircleAlert className="ax-icon ax-icon-xs" aria-hidden />}
              {[
                tile.sub,
                tile.others.length ? t("alsoIn", { amounts: tile.others.join(" · ") }) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </div>
      ))}
    </section>
  );
}

// ── Tabs ────────────────────────────────────────────────────────────────────────────────
async function TabPanel({
  tab,
  ctx,
  activity,
}: {
  tab: Tab;
  ctx: Ctx;
  activity: { type: ActivityFilter; limit: number };
}) {
  switch (tab) {
    case "overview":
      return <Overview ctx={ctx} />;
    case "projects":
      return <ProjectsTab ctx={ctx} />;
    case "quotations":
      return <QuotationsTab ctx={ctx} />;
    case "invoices":
      return <InvoicesTab ctx={ctx} />;
    case "payments":
      return <PaymentsTab ctx={ctx} />;
    case "files":
      return <FilesTab />;
    case "activity":
      return <ActivityTab ctx={ctx} {...activity} />;
  }
}

async function Overview({ ctx }: { ctx: Ctx }) {
  const { f, t, tc, overdueWords } = await setup();
  const [projects, invoices, activity] = await Promise.all([
    load(() => getClientProjects(ctx.ws, ctx.id, true)),
    load(() => getClientInvoices(ctx.ws, ctx.id, true)),
    load(() => getClientActivity(ctx.ws, ctx.id, 5)),
  ]);
  const base = `/clients/${ctx.id}`;
  return (
    <div className="overview-grid">
      {projects.ok ? (
        <Card
          id="ov-projects"
          title={t("openProjects")}
          icon={FolderKanban}
          tint="blue"
          href={`${base}?tab=projects`}
          linkLabel={tc("viewAll")}
        >
          {projects.data.length === 0 ? (
            <EmptyState icon={FolderKanban} title={t("noOpenProjects")} />
          ) : (
            <ul className="card-list">
              {projects.data.map((p) => (
                <li key={p.id} className="ms-row">
                  <div className="txt">
                    <Link className="row-link" href={`/projects/${p.id}`}>
                      <b>{p.name}</b>
                    </Link>
                    <span>
                      <span className="ax-mono ax-ltr">{p.code}</span>
                      {p.deadline ? ` · ${f.date(p.deadline, "medium")}` : ""}
                    </span>
                  </div>
                  <StatusBadge domain="project" code={p.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <WidgetError title={t("openProjects")} />
      )}
      {invoices.ok ? (
        <Card
          id="ov-invoices"
          title={t("unpaidInvoices")}
          icon={Receipt}
          tint="orange"
          href={`${base}?tab=invoices`}
          linkLabel={tc("viewAll")}
        >
          {invoices.data.length === 0 ? (
            <EmptyState icon={Receipt} title={t("noUnpaid")} />
          ) : (
            <ul className="card-list">
              {invoices.data.map((inv) => (
                <li key={inv.id} className="inv-row">
                  <div className="who">
                    <Link href={`/invoices/${inv.id}`} className="ax-mono ax-ltr ax-link">
                      {inv.number}
                    </Link>
                    {inv.status === "overdue" ? (
                      <span className="ax-due overdue">
                        <CircleAlert className="ax-icon" aria-hidden />
                        {overdueWords(inv.daysOverdue)}
                      </span>
                    ) : (
                      <DueLabel due={due(inv.dueDate, f, overdueWords, { now: ctx.now })} />
                    )}
                  </div>
                  <StatusBadge domain="invoice" code={inv.status} />
                  <span className="amt">{f.money(inv.balanceMinor, inv.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <WidgetError title={t("unpaidInvoices")} />
      )}
      {activity.ok ? (
        <Card
          id="ov-activity"
          title={t("recentActivity")}
          icon={Activity}
          tint="violet"
          href={`${base}?tab=activity`}
          linkLabel={tc("viewAll")}
          className="span-all"
        >
          <Timeline items={activity.data} now={ctx.now} currency={ctx.currency} grouped={false} />
        </Card>
      ) : (
        <WidgetError title={t("recentActivity")} />
      )}
    </div>
  );
}

function TableFrame({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="ax-table-wrap scroll-x" tabIndex={0} role="region" aria-label={caption}>
      <table className="ax-table">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

function Empty({ icon, title }: { icon: typeof Receipt; title: string }) {
  return (
    <div className="ax-card">
      <EmptyState icon={icon} title={title} />
    </div>
  );
}

async function ProjectsTab({ ctx }: { ctx: Ctx }) {
  const { f, t } = await setup();
  const res = await load(() => getClientProjects(ctx.ws, ctx.id));
  if (!res.ok) return <WidgetError title={t("tab_projects")} />;
  if (res.data.length === 0) return <Empty icon={FolderKanban} title={t("noProjects")} />;
  return (
    <TableFrame caption={t("tab_projects")}>
      <thead>
        <tr>
          <th scope="col">{t("colProject")}</th>
          <th scope="col">{t("colStatus")}</th>
          <th scope="col">{t("colDeadline")}</th>
          <th scope="col" className="num">
            {t("colBudget")}
          </th>
        </tr>
      </thead>
      <tbody>
        {res.data.map((p) => (
          <tr key={p.id}>
            <td>
              <Link className="ax-link" href={`/projects/${p.id}`}>
                {p.name}
              </Link>{" "}
              <span className="ax-mono ax-ltr ax-faint">{p.code}</span>
            </td>
            <td>
              <StatusBadge domain="project" code={p.status} />
            </td>
            <td>{p.deadline ? f.date(p.deadline, "medium") : "—"}</td>
            <td className="num">
              {p.budgetMinor !== null ? f.money(p.budgetMinor, p.currency) : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}

async function QuotationsTab({ ctx }: { ctx: Ctx }) {
  const { f, t } = await setup();
  const res = await load(() => getClientQuotations(ctx.ws, ctx.id));
  if (!res.ok) return <WidgetError title={t("tab_quotations")} />;
  if (res.data.length === 0) return <Empty icon={FileText} title={t("noQuotations")} />;
  return (
    <TableFrame caption={t("tab_quotations")}>
      <thead>
        <tr>
          <th scope="col">{t("colNumber")}</th>
          <th scope="col">{t("colStatus")}</th>
          <th scope="col">{t("colIssued")}</th>
          <th scope="col">{t("colValidUntil")}</th>
          <th scope="col" className="num">
            {t("colAmount")}
          </th>
        </tr>
      </thead>
      <tbody>
        {res.data.map((q) => (
          <tr key={q.id}>
            <td>
              <Link className="ax-link ax-mono ax-ltr" href={`/quotations/${q.id}`}>
                {q.number}
              </Link>
            </td>
            <td>
              <StatusBadge domain="quotation" code={q.status} />
            </td>
            <td>{f.date(q.issueDate, "medium")}</td>
            <td>{q.validUntil ? f.date(q.validUntil, "medium") : "—"}</td>
            <td className="num">{f.money(q.totalMinor, q.currency)}</td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}

async function InvoicesTab({ ctx }: { ctx: Ctx }) {
  const { f, t } = await setup();
  const res = await load(() => getClientInvoices(ctx.ws, ctx.id));
  if (!res.ok) return <WidgetError title={t("tab_invoices")} />;
  if (res.data.length === 0) return <Empty icon={Receipt} title={t("noInvoices")} />;
  return (
    <TableFrame caption={t("tab_invoices")}>
      <thead>
        <tr>
          <th scope="col">{t("colNumber")}</th>
          <th scope="col">{t("colStatus")}</th>
          <th scope="col">{t("colIssued")}</th>
          <th scope="col">{t("colDue")}</th>
          <th scope="col" className="num">
            {t("colAmount")}
          </th>
          <th scope="col" className="num">
            {t("colBalance")}
          </th>
        </tr>
      </thead>
      <tbody>
        {res.data.map((inv) => (
          <tr key={inv.id}>
            <td>
              <Link className="ax-link ax-mono ax-ltr" href={`/invoices/${inv.id}`}>
                {inv.number}
              </Link>
            </td>
            <td>
              <StatusBadge
                domain="invoice"
                code={inv.status}
                suffix={
                  inv.status === "overdue" ? t("daysCount", { count: inv.daysOverdue }) : undefined
                }
              />
            </td>
            <td>{f.date(inv.issueDate, "medium")}</td>
            <td>{f.date(inv.dueDate, "medium")}</td>
            <td className="num">{f.money(inv.totalMinor, inv.currency)}</td>
            <td className="num strong">{f.money(inv.balanceMinor, inv.currency)}</td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}

async function PaymentsTab({ ctx }: { ctx: Ctx }) {
  const { f, t } = await setup();
  const tm = await getTranslations("clients.method");
  const res = await load(() => getClientPayments(ctx.ws, ctx.id));
  if (!res.ok) return <WidgetError title={t("tab_payments")} />;
  if (res.data.length === 0) return <Empty icon={Wallet} title={t("noPayments")} />;
  return (
    <TableFrame caption={t("tab_payments")}>
      <thead>
        <tr>
          <th scope="col">{t("colDate")}</th>
          <th scope="col">{t("colInvoice")}</th>
          <th scope="col">{t("colMethod")}</th>
          <th scope="col">{t("colReference")}</th>
          <th scope="col" className="num">
            {t("colAmount")}
          </th>
          <th scope="col">{t("colStatus")}</th>
        </tr>
      </thead>
      <tbody>
        {res.data.map((p) => (
          <tr key={p.id}>
            <td>{f.date(p.paidOn, "medium")}</td>
            <td>
              {p.invoiceId ? (
                <Link className="ax-link ax-mono ax-ltr" href={`/invoices/${p.invoiceId}`}>
                  {p.invoiceNumber}
                </Link>
              ) : (
                "—"
              )}
            </td>
            <td>{tm(p.method)}</td>
            <td>{p.reference ? <span className="ax-mono ax-ltr">{p.reference}</span> : "—"}</td>
            <td className="num strong">{f.money(p.amountMinor, p.currency)}</td>
            <td>
              <StatusBadge domain="payment" code={p.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}

async function FilesTab() {
  const { t } = await setup();
  return (
    <div className="ax-card">
      <EmptyState icon={Paperclip} title={t("noFiles")} body={t("noFilesBody")} />
    </div>
  );
}

/** Activity page size; "Load older activity" raises `?limit=` by this much (never infinite scroll). */
const PAGE = 30;

async function ActivityTab({
  ctx,
  type,
  limit,
}: {
  ctx: Ctx;
  type: ActivityFilter;
  limit: number;
}) {
  const { t } = await setup();
  // One extra row tells whether there is anything older.
  const res = await load(() => getClientActivity(ctx.ws, ctx.id, limit + 1, type));
  const base = `/clients/${ctx.id}?tab=activity`;
  const href = (next: { type?: ActivityFilter; limit?: number }) => {
    const ty = next.type ?? type;
    const li = next.limit ?? PAGE;
    return `${base}${ty === "all" ? "" : `&type=${ty}`}${li === PAGE ? "" : `&limit=${li}`}`;
  };
  return (
    <div className="ax-card activity-card">
      <ActivityComposer target={{ type: "client", id: ctx.id }} />
      <nav className="tl-filters" aria-label={t("activityFilters")}>
        {ACTIVITY_FILTERS.map((f) => (
          <Link
            key={f}
            className={`ax-chip${f === type ? " is-active" : ""}`}
            aria-current={f === type ? "true" : undefined}
            href={href({ type: f })}
            scroll={false}
            replace
          >
            {t(`filter_${f}`)}
          </Link>
        ))}
      </nav>
      {res.ok ? (
        <>
          <Timeline
            items={res.data.slice(0, limit)}
            now={ctx.now}
            currency={ctx.currency}
            grouped
          />
          {res.data.length > limit && (
            <div className="tl-more">
              <Link
                className="ax-btn ax-btn-secondary ax-btn-sm"
                href={href({ limit: limit + PAGE })}
                scroll={false}
                replace
              >
                {t("loadOlder")}
              </Link>
            </div>
          )}
        </>
      ) : (
        <WidgetError title={t("tab_activity")} />
      )}
    </div>
  );
}
