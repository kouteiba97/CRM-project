import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/db/client";
import { memberships } from "@/db/schema";
import { getSession } from "@/lib/session";
import { SIDEBAR_COOKIE } from "@/lib/theme";
import { TabLinks } from "@/components/clients/ProfileClientParts";
import { GeneralSettings, ProfileForm, WorkspaceForm } from "./SettingsForms";

const TABS = ["general", "workspace", "profile"] as const;
type SP = Record<string, string | string[] | undefined>;

/** Settings: General (language, theme, sidebar) · Workspace (details on documents) · Profile. Tab in `?tab=`. */
export async function SettingsPage({ searchParams }: { searchParams: SP }) {
  const session = await getSession();
  const t = await getTranslations("settings");
  const tn = await getTranslations("nav");
  const raw = typeof searchParams.tab === "string" ? searchParams.tab : "general";
  const tab = (TABS as readonly string[]).includes(raw)
    ? (raw as (typeof TABS)[number])
    : "general";
  const stored = (await cookies()).get(SIDEBAR_COOKIE)?.value;
  const sidebar =
    stored === "collapsed" || stored === "expanded"
      ? stored
      : session.user.sidebarCollapsed
        ? "collapsed"
        : "auto";
  const [m] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(
      and(eq(memberships.workspaceId, session.workspaceId), eq(memberships.userId, session.userId)),
    );
  const ws = session.workspace;

  return (
    <>
      <header className="pagehead">
        <h1 className="t-page-title">{tn("settings")}</h1>
      </header>
      <TabLinks
        label={t("tabs")}
        current={tab}
        panelId="settings-panel"
        tabs={TABS.map((key) => ({
          key,
          label: t(`tab_${key}`),
          href: key === "general" ? "/settings" : `/settings?tab=${key}`,
        }))}
      />
      <section
        id="settings-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="settings-panel"
      >
        {tab === "general" && <GeneralSettings sidebar={sidebar} />}
        {tab === "workspace" && (
          <WorkspaceForm
            readOnly={m?.role !== "owner"}
            initial={{
              name: ws.name,
              address: ws.address ?? "",
              defaultCurrency: ws.defaultCurrency,
              defaultDocumentLanguage: ws.defaultDocumentLanguage,
              nif: ws.nif ?? "",
              rc: ws.rc ?? "",
              nis: ws.nis ?? "",
              ai: ws.ai ?? "",
              iban: ws.iban ?? "",
            }}
          />
        )}
        {tab === "profile" && (
          <ProfileForm initial={{ name: session.user.name }} email={session.user.email} />
        )}
      </section>
    </>
  );
}
