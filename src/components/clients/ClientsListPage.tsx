import { Suspense } from "react";
import { cookies } from "next/headers";
import { Plus, Upload } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  getClientListMeta,
  listClients,
  parseClientFilters,
  CLIENT_STATUSES,
} from "@/db/queries/clients";
import { due } from "@/lib/due";
import { formatter, type Locale } from "@/lib/format";
import { getSession } from "@/lib/session";
import { hueOf, initials } from "@/components/shell/initials";
import { WidgetError } from "@/components/ui/WidgetError";
import { ClientsList, type ClientRowView } from "./ClientsList";
import { ClientPreview } from "./ClientPreview";
import { COLUMNS_COOKIE, DENSITY_COOKIE, parseHiddenColumns, patchQuery } from "./url";
import { ClientFormDrawer } from "./ClientFormDrawer";

type SP = Record<string, string | string[] | undefined>;

/** DS › CRM patterns › Clients list: PageHeader (title, count, New client) → toolbar → DataTable. */
export async function ClientsListPage({ searchParams }: { searchParams: SP }) {
  const session = await getSession();
  const t = await getTranslations("clients");
  const tn = await getTranslations("nav");
  const locale = (await getLocale()) as Locale;
  const f = formatter(locale);
  const meta = await getClientListMeta(session.workspaceId).catch(() => null);

  return (
    <>
      <header className="pagehead">
        <h1 className="t-page-title">{tn("clients")}</h1>
        {meta && (
          <span className="meta">{t("count", { count: meta.count, n: f.number(meta.count) })}</span>
        )}
        <div className="actions">
          <Link className="ax-btn ax-btn-secondary ax-btn-sm" href="/clients/import">
            <Upload className="ax-icon" aria-hidden />
            {t("importButton")}
          </Link>
          <Link className="ax-btn ax-btn-primary ax-btn-sm" href="/clients?new=1" scroll={false}>
            <Plus className="ax-icon" aria-hidden />
            {t("newClient")}
            <kbd className="ax-kbd" aria-hidden>
              C
            </kbd>
          </Link>
        </div>
      </header>

      <Suspense fallback={<ListSkeleton label={tn("clients")} />}>
        <ClientsTableSection searchParams={searchParams} />
      </Suspense>

      {typeof searchParams.preview === "string" && (
        <ClientPreview
          ws={session.workspaceId}
          id={searchParams.preview}
          closeHref={`/clients${patchQuery(new URLSearchParams(Object.entries(searchParams).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))), { preview: null }, { keepPage: true })}`}
        />
      )}

      {searchParams.new === "1" && (
        <ClientFormDrawer
          owners={meta?.owners ?? []}
          currentUserId={session.userId}
          defaultCurrency={session.workspace.defaultCurrency}
          defaultLanguage={session.workspace.defaultDocumentLanguage}
        />
      )}
    </>
  );
}

async function ClientsTableSection({ searchParams }: { searchParams: SP }) {
  const session = await getSession();
  const t = await getTranslations("clients");
  const ts = await getTranslations("status.client");
  const tc = await getTranslations("common");
  const locale = (await getLocale()) as Locale;
  const f = formatter(locale);
  const filters = parseClientFilters(searchParams);
  const now = new Date();
  const jar = await cookies();
  const density = jar.get(DENSITY_COOKIE)?.value === "compact" ? "compact" : "default";
  const hiddenColumns = parseHiddenColumns(jar.get(COLUMNS_COOKIE)?.value);

  let data: Awaited<ReturnType<typeof listClients>>;
  let meta: Awaited<ReturnType<typeof getClientListMeta>>;
  try {
    [data, meta] = await Promise.all([
      listClients(session.workspaceId, session.workspace.defaultCurrency, filters),
      getClientListMeta(session.workspaceId),
    ]);
  } catch (err) {
    console.error("[clients list]", err);
    return <WidgetError title={t("tableCaption")} />;
  }

  const overdueWords = (days: number) => tc("overdueDays", { days });
  const rows: ClientRowView[] = data.rows.map((r) => {
    const main =
      r.outstanding.find((m) => m.currency === (r.currency ?? session.workspace.defaultCurrency)) ??
      r.outstanding[0];
    const all = r.outstanding.map((m) => f.money(m.minor, m.currency)).join(" · ");
    return {
      id: r.id,
      name: r.name,
      initials: initials(r.name),
      hue: hueOf(r.id),
      status: r.status,
      contact: r.contactName ?? r.contactEmail,
      openProjects: f.number(r.openProjects),
      outstanding: main
        ? f.money(main.minor, main.currency) +
          (r.outstanding.length > 1 ? ` +${r.outstanding.length - 1}` : "")
        : null,
      outstandingTitle: main ? all : null,
      overdue: r.overdueCount > 0,
      lastContact: r.lastContact
        ? {
            text: capitalize(
              f.relativeDay(r.lastContact, now) ?? f.date(r.lastContact, "medium"),
              locale,
            ),
            title: `${f.date(r.lastContact, "medium")} · ${f.time(r.lastContact)}`,
            iso: r.lastContact.toISOString(),
          }
        : null,
      nextFollowUp: r.nextFollowUp ? due(r.nextFollowUp, f, overdueWords, { now }) : null,
      owner:
        r.ownerId && r.ownerName
          ? { name: r.ownerName, initials: initials(r.ownerName), hue: hueOf(r.ownerId) }
          : null,
    };
  });

  const from = data.total === 0 ? 0 : (filters.page - 1) * filters.size + 1;
  const to = Math.min(data.total, filters.page * filters.size);
  const explicit = typeof searchParams.sort === "string" && searchParams.sort === filters.sort;

  return (
    <ClientsList
      rows={rows}
      total={data.total}
      workspaceTotal={meta.count}
      page={filters.page}
      size={filters.size}
      sort={{ key: filters.sort, dir: filters.dir, explicit }}
      density={density}
      hiddenColumns={hiddenColumns}
      statuses={CLIENT_STATUSES.map((s) => ({ value: s, label: ts(s) }))}
      tags={meta.tags.map((tag) => ({ value: tag, label: tag }))}
      owners={meta.owners.map((o) => ({ value: o.id, label: o.name }))}
      rangeText={t("range", {
        from: f.number(from),
        to: f.number(to),
        total: f.number(data.total),
      })}
    />
  );
}

function ListSkeleton({ label }: { label: string }) {
  return (
    <div className="ax-table-wrap clients-frame" aria-busy="true" aria-label={label}>
      <div className="ax-toolbar clients-toolbar">
        <span className="ax-skel" style={{ width: 240, height: 28 }} />
      </div>
      <div className="skel-rows">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="ax-skel" style={{ width: `${92 - (i % 3) * 9}%` }} />
        ))}
      </div>
    </div>
  );
}

function capitalize(s: string, locale: string) {
  return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
}
