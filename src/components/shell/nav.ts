import {
  BellRing,
  ChartColumn,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Receipt,
  Settings,
  SquareCheckBig,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { SidebarCounts } from "@/db/queries/dashboard";

export type NavKey =
  | "dashboard"
  | "followUps"
  | "clients"
  | "leads"
  | "projects"
  | "tasks"
  | "quotations"
  | "invoices"
  | "payments"
  | "reports"
  | "settings";

export type NavItem = {
  key: NavKey;
  href: string;
  /** DS › Iconography: module icons are fixed. */
  icon: LucideIcon;
  count?: { key: keyof SidebarCounts; alert?: boolean };
  /** `G` then this key jumps to the module (DS › Interaction › Keyboard). */
  goKey?: string;
};

export type NavGroup = { label?: "sales" | "delivery" | "finance"; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    items: [
      { key: "dashboard", href: "/", icon: LayoutDashboard, goKey: "d" },
      { key: "followUps", href: "/follow-ups", icon: BellRing, count: { key: "followUpsDue" } },
    ],
  },
  {
    label: "sales",
    items: [
      { key: "clients", href: "/clients", icon: Users, goKey: "c" },
      { key: "leads", href: "/leads", icon: Target, goKey: "l" },
    ],
  },
  {
    label: "delivery",
    items: [
      { key: "projects", href: "/projects", icon: FolderKanban, goKey: "p" },
      { key: "tasks", href: "/tasks", icon: SquareCheckBig, goKey: "t", count: { key: "tasksDue" } },
    ],
  },
  {
    label: "finance",
    items: [
      { key: "quotations", href: "/quotations", icon: FileText },
      {
        key: "invoices",
        href: "/invoices",
        icon: Receipt,
        goKey: "i",
        count: { key: "overdueInvoices", alert: true },
      },
      { key: "payments", href: "/payments", icon: Wallet },
    ],
  },
];

export const NAV_FOOTER: NavItem[] = [
  { key: "reports", href: "/reports", icon: ChartColumn },
  { key: "settings", href: "/settings", icon: Settings },
];

export const ALL_NAV: NavItem[] = [...NAV.flatMap((g) => g.items), ...NAV_FOOTER];

export function activeKey(pathname: string): NavKey | undefined {
  if (pathname === "/" || pathname === "") return "dashboard";
  return ALL_NAV.find((i) => i.href !== "/" && (pathname === i.href || pathname.startsWith(`${i.href}/`)))
    ?.key;
}

export const QUICK_CREATE = [
  { key: "newClient", href: "/clients?new=1", shortcut: "C" },
  { key: "newLead", href: "/leads?new=1", shortcut: "L" },
  { key: "newInvoice", href: "/invoices?new=1", shortcut: "I" },
  { key: "newTask", href: "/tasks?new=1", shortcut: "T" },
] as const;
