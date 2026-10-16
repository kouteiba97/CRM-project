import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { LegalDoc } from "@/content/legal";
import { formatter, type Locale } from "@/lib/format";

// When the text last changed (shown at the top of both pages).
const UPDATED = "2026-10-17";

/** Privacy policy / terms: public pages, readable signed in or not, in the page language. */
export async function LegalPage({ doc, locale }: { doc: LegalDoc; locale: Locale }) {
  const t = await getTranslations("legal");
  const fill = (s: string) =>
    s
      .replace("{operator}", process.env.OPERATOR_NAME || "Apex CRM")
      .replace("{contact}", process.env.CONTACT_EMAIL || t("contactFallback"))
      .replace("{date}", formatter(locale).date(UPDATED));
  return (
    <main className="legal-page">
      <article className="legal-card">
        <nav className="legal-nav" aria-label={t("nav")}>
          <Link href="/login" className="login-link">
            Apex CRM
          </Link>
          <Link href="/privacy" className="login-link">
            {t("privacy")}
          </Link>
          <Link href="/terms" className="login-link">
            {t("terms")}
          </Link>
        </nav>
        <h1 className="t-page-title">{doc.title}</h1>
        <p className="ax-faint">{fill(doc.updated)}</p>
        {doc.sections.map((s) => (
          <section key={s.h}>
            <h2 className="t-section-heading">{s.h}</h2>
            {s.p.map((p) => (
              <p key={p}>{fill(p)}</p>
            ))}
          </section>
        ))}
      </article>
    </main>
  );
}
