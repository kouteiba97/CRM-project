import { Download } from "lucide-react";
import { getTranslations } from "next-intl/server";

/** Settings › Data: portability. Plain links: the browser downloads the JSON the route returns. */
export async function DataPanel({ canExportWorkspace }: { canExportWorkspace: boolean }) {
  const t = await getTranslations("settings.data");
  return (
    <div className="settings-stack">
      <section className="ax-card ax-card-body settings-section" aria-labelledby="dx-me">
        <h2 id="dx-me" className="rail-title">
          {t("meTitle")}
        </h2>
        <p className="ax-help">{t("meHelp")}</p>
        <div>
          <a className="ax-btn ax-btn-secondary ax-btn-sm" href="/api/export/me" download>
            <Download className="ax-icon" aria-hidden />
            {t("meDownload")}
          </a>
        </div>
      </section>
      <section className="ax-card ax-card-body settings-section" aria-labelledby="dx-ws">
        <h2 id="dx-ws" className="rail-title">
          {t("wsTitle")}
        </h2>
        <p className="ax-help">{t("wsHelp")}</p>
        {canExportWorkspace ? (
          <div>
            <a className="ax-btn ax-btn-secondary ax-btn-sm" href="/api/export/workspace" download>
              <Download className="ax-icon" aria-hidden />
              {t("wsDownload")}
            </a>
          </div>
        ) : (
          <p className="ax-banner info">{t("wsAdminOnly")}</p>
        )}
      </section>
    </div>
  );
}
