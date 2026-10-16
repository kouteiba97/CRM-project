import { cookies } from "next/headers";
import { setRequestLocale } from "next-intl/server";
import { VerifyBanner } from "@/components/auth/VerifyBanner";
import { AppShell, type SidebarState } from "@/components/shell/AppShell";
import { getSidebarCounts } from "@/db/queries/dashboard";
import { getSession } from "@/lib/session";
import { SIDEBAR_COOKIE } from "@/lib/theme";

export default async function AppLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  const counts = await getSidebarCounts(session.workspaceId);
  const stored = (await cookies()).get(SIDEBAR_COOKIE)?.value;
  const sidebar: SidebarState =
    stored === "collapsed" || stored === "expanded"
      ? stored
      : session.user.sidebarCollapsed
        ? "collapsed"
        : "auto";

  return (
    <AppShell
      counts={counts}
      workspaceName={session.workspace.name}
      userName={session.user.name}
      initialSidebar={sidebar}
    >
      {!session.user.emailVerifiedAt && <VerifyBanner email={session.user.email} />}
      {children}
    </AppShell>
  );
}
