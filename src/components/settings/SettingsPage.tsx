import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { TabLinks } from "@/components/clients/ProfileClientParts";
import { can } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { SIDEBAR_COOKIE } from "@/lib/theme";
import { DeleteAccountCard, EmailForm, PasswordForm, SessionsCard } from "./AccountForms";
import { AuditLog } from "./AuditLog";
import { DataPanel } from "./DataPanel";
import { GeneralSettings, ProfileForm, WorkspaceForm } from "./SettingsForms";
import { TeamPanel } from "./TeamPanel";

const TABS = ["general", "account", "security", "workspace", "team", "data"] as const;
type Tab = (typeof TABS)[number];
type SP = Record<string, string | string[] | undefined>;

/**
 * Settings, one tab per `?tab=`: General (language, theme, sidebar) · Account (name, email,
 * password, delete) · Security (sessions, activity log) · Workspace (details on documents) ·
 * Team (members, roles, invitations) · Data (exports).
 */
export async function SettingsPage({ searchParams }: { searchParams: SP }) {
  const session = await getSession();
  const t = await getTranslations("settings");
  const tn = await getTranslations("nav");
  const raw = typeof searchParams.tab === "string" ? searchParams.tab : "general";
  // `profile` was the old name of the Account tab.
  const wanted = raw === "profile" ? "account" : raw;
  const tab: Tab = (TABS as readonly string[]).includes(wanted) ? (wanted as Tab) : "general";
  const stored = (await cookies()).get(SIDEBAR_COOKIE)?.value;
  const sidebar =
    stored === "collapsed" || stored === "expanded"
      ? stored
      : session.user.sidebarCollapsed
        ? "collapsed"
        : "auto";
  const ws = session.workspace;
  const hasPassword = Boolean(session.user.passwordHash);

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
      <section id="settings-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="settings-panel">
        {tab === "general" && <GeneralSettings sidebar={sidebar} />}
        {tab === "account" && (
          <div className="settings-stack">
            <ProfileForm initial={{ name: session.user.name }} email={session.user.email} />
            <EmailForm email={session.user.email} hasPassword={hasPassword} />
            <PasswordForm hasPassword={hasPassword} />
            <DeleteAccountCard email={session.user.email} hasPassword={hasPassword} />
          </div>
        )}
        {tab === "security" && (
          <div className="settings-stack">
            <SessionsCard />
            <AuditLog session={session} />
          </div>
        )}
        {tab === "workspace" && (
          <WorkspaceForm
            readOnly={!can(session.role, "admin")}
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
        {tab === "team" && <TeamPanel session={session} />}
        {tab === "data" && <DataPanel canExportWorkspace={can(session.role, "admin")} />}
      </section>
    </>
  );
}
