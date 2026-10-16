import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { ImportBack, ImportClients } from "./ImportClients";

/** `/clients/import`: bring an existing client list in from a spreadsheet. */
export async function ClientsImportPage() {
  await getSession();
  const t = await getTranslations("clients.import");
  return (
    <>
      <ImportBack />
      <header className="pagehead">
        <h1 className="t-page-title">{t("title")}</h1>
      </header>
      <div className="settings-panel">
        <ImportClients />
      </div>
    </>
  );
}
