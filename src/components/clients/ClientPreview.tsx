import { ArrowRight, Mail, Phone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { getClient, getClientActivity, getClientKpis, isUuid } from "@/db/queries/clients";
import { Link } from "@/i18n/navigation";
import { formatter, type Locale } from "@/lib/format";
import { PreviewPanel } from "@/components/ui/PreviewPanel";
import { StatusBadge } from "@/components/ui/StatusBadge";

/** `/clients?preview=<id>`: the essentials of one client over the list. */
export async function ClientPreview({ ws, id, closeHref }: { ws: string; id: string; closeHref: string }) {
  if (!isUuid(id)) return null;
  const client = await getClient(ws, id);
  if (!client) return null;
  const [kpis, activity] = await Promise.all([getClientKpis(ws, id).catch(() => null), getClientActivity(ws, id, 5).catch(() => [])]);
  const t = await getTranslations("clients");
  const f = formatter((await getLocale()) as Locale);
  const contact = client.contacts[0];
  const outstanding = (kpis?.outstanding ?? []).filter((b) => b.minor > 0);

  return (
    <PreviewPanel title={client.name} closeHref={closeHref}>
      <div className="preview-row">
        <StatusBadge domain="client" code={client.status} />
        {client.city && <span className="ax-faint">{client.city}</span>}
      </div>
      {contact && (
        <section className="preview-section">
          <h3 className="rail-title">{t("previewContact")}</h3>
          <p className="t-body-strong">
            {contact.firstName} {contact.lastName ?? ""}
          </p>
          {(contact.email ?? client.email) && (
            <a className="ax-link preview-line" href={`mailto:${contact.email ?? client.email}`} dir="ltr">
              <Mail className="ax-icon ax-icon-sm" aria-hidden />
              {contact.email ?? client.email}
            </a>
          )}
          {(contact.phone ?? client.phone) && (
            <a className="ax-link preview-line" href={`tel:${(contact.phone ?? client.phone)!.replace(/\s/g, "")}`} dir="ltr">
              <Phone className="ax-icon ax-icon-sm" aria-hidden />
              {contact.phone ?? client.phone}
            </a>
          )}
        </section>
      )}
      <section className="preview-section">
        <h3 className="rail-title">{t("col.outstanding")}</h3>
        {outstanding.length ? (
          outstanding.map((b) => (
            <p key={b.currency} className="t-body-strong">
              {f.money(b.minor, b.currency)}
            </p>
          ))
        ) : (
          <p className="ax-faint">{t("previewNothingDue")}</p>
        )}
      </section>
      <section className="preview-section">
        <h3 className="rail-title">{t("previewRecent")}</h3>
        {activity.length ? (
          <ul className="preview-activity">
            {activity.map((a) => (
              <li key={a.id}>
                <span>{t.has(`previewKind.${a.kind}` as never) ? t(`previewKind.${a.kind}` as never) : a.kind.replace(/_/g, " ")}</span>
                <span className="ax-faint">{f.relativeTime(a.occurredAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ax-faint">{t("previewNoActivity")}</p>
        )}
      </section>
      <Link className="ax-btn ax-btn-primary ax-btn-sm" href={`/clients/${client.id}`}>
        {t("previewOpen")}
        <ArrowRight className="ax-icon ax-flip" aria-hidden />
      </Link>
    </PreviewPanel>
  );
}
