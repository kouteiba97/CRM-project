import { desc, eq, or } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/db/client";
import { auditEvents, users } from "@/db/schema";
import { formatter, type Locale } from "@/lib/format";
import { can } from "@/lib/roles";
import type { Session } from "@/lib/session";

/** "Edge on Windows" from a user agent: enough to recognise a device, nothing more. */
export function deviceOf(ua: string | null) {
  if (!ua) return "—";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad/.test(ua)
        ? "iOS"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} · ${os}` : browser;
}

/**
 * The security log: owners and admins see the workspace's events and their own sign-ins;
 * members see only their own.
 */
export async function AuditLog({ session }: { session: Session }) {
  const t = await getTranslations("settings.audit");
  const f = formatter((await getLocale()) as Locale);
  const scope = can(session.role, "admin")
    ? or(eq(auditEvents.workspaceId, session.workspaceId), eq(auditEvents.actorId, session.userId))
    : eq(auditEvents.actorId, session.userId);
  const rows = await db
    .select({ e: auditEvents, actor: users.name })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorId))
    .where(scope)
    .orderBy(desc(auditEvents.at))
    .limit(50);

  return (
    <section className="ax-card ax-card-body settings-section" aria-labelledby="audit-title">
      <h2 id="audit-title" className="rail-title">
        {t("title")}
      </h2>
      <p className="ax-help">{t(can(session.role, "admin") ? "helpAdmin" : "helpMember")}</p>
      {rows.length === 0 ? (
        <p className="ax-help">{t("empty")}</p>
      ) : (
        <div className="audit-scroll">
          <table className="ax-table audit-table">
            <caption className="sr-only">{t("title")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("when")}</th>
                <th scope="col">{t("what")}</th>
                <th scope="col">{t("who")}</th>
                <th scope="col">{t("where")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ e, actor }) => (
                <tr key={e.id}>
                  <td className="ax-nowrap">
                    <time dateTime={e.at.toISOString()} title={`${f.date(e.at)} ${f.time(e.at)}`}>
                      {f.relativeTime(e.at)}
                    </time>
                  </td>
                  <td>{t(`action.${e.action.replace(/\./g, "_")}` as never)}</td>
                  <td>{actor ?? "—"}</td>
                  <td>
                    <span dir="ltr" className="ax-mono">
                      {e.ip ?? "—"}
                    </span>
                    <span className="ax-faint"> · {deviceOf(e.userAgent)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
