import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { VerifyBanner } from "@/components/auth/VerifyBanner";
import { AppShell, type SidebarState } from "@/components/shell/AppShell";
import type { BellNotification } from "@/components/shell/Topbar";
import { formatter, type Locale } from "@/lib/format";
import { getNotifications } from "@/lib/notifications";
import { getSidebarCounts } from "@/db/queries/dashboard";
import { getSession } from "@/lib/session";
import { SIDEBAR_COOKIE } from "@/lib/theme";

export default async function AppLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  const [counts, notes] = await Promise.all([
    getSidebarCounts(session.workspaceId),
    getNotifications(session.userId, session.workspaceId),
  ]);
  const tn = await getTranslations("notifications");
  const f = formatter(locale as Locale);
  // Final text in the reader's language, built here so the bell only has to show it.
  const notifications: BellNotification[] = notes.rows.map((n) => {
    const p = n.payload;
    const amount = typeof p.amountMinor === "number" && typeof p.currency === "string" ? f.money(p.amountMinor, p.currency) : "";
    return {
      id: n.id,
      text: tn(`${n.kind}` as never, { ...p, amount } as never),
      href: n.href,
      read: Boolean(n.readAt),
      ago: f.relativeTime(n.createdAt),
    };
  });
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
      workspaceId={session.workspaceId}
      workspaces={session.workspaces}
      userName={session.user.name}
      initialSidebar={sidebar}
      notifications={notifications}
      unreadNotifications={notes.unread}
    >
      {!session.user.emailVerifiedAt && <VerifyBanner email={session.user.email} />}
      {children}
    </AppShell>
  );
}
