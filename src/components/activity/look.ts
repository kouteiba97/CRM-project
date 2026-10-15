import {
  Activity,
  Archive,
  ArchiveRestore,
  Ban,
  Check,
  FileText,
  Flag,
  FolderKanban,
  Mail,
  NotebookPen,
  Pencil,
  Phone,
  Receipt,
  Send,
  Target,
  UserPlus,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Formatter } from "@/lib/format";

/** DS › Timeline: neutral node by default; payments success, documents sent accent. */
export const ACTIVITY_LOOK: Record<string, { icon: LucideIcon; tone: string }> = {
  lead_created: { icon: Target, tone: "accent" },
  lead_stage_changed: { icon: Target, tone: "blue" },
  followup_done: { icon: Phone, tone: "blue" },
  payment_received: { icon: Wallet, tone: "success" },
  quotation_sent: { icon: Send, tone: "accent" },
  invoice_reminder: { icon: Send, tone: "" },
  milestone_completed: { icon: Flag, tone: "success" },
  task_completed: { icon: Check, tone: "success" },
  client_created: { icon: UserPlus, tone: "accent" },
  call_logged: { icon: Phone, tone: "" },
  email_logged: { icon: Mail, tone: "" },
  note_logged: { icon: NotebookPen, tone: "" },
  client_updated: { icon: Pencil, tone: "" },
  client_archived: { icon: Archive, tone: "" },
  client_restored: { icon: ArchiveRestore, tone: "" },
  project_created: { icon: FolderKanban, tone: "accent" },
  project_status_changed: { icon: FolderKanban, tone: "blue" },
  invoice_created: { icon: Receipt, tone: "" },
  quotation_created: { icon: FileText, tone: "" },
  invoice_sent: { icon: Send, tone: "accent" },
  invoice_voided: { icon: Ban, tone: "" },
  quotation_accepted: { icon: Check, tone: "success" },
  quotation_declined: { icon: X, tone: "danger" },
  quotation_converted: { icon: Receipt, tone: "accent" },
  payment_status_changed: { icon: Wallet, tone: "" },
};
export const FALLBACK_LOOK = { icon: Activity, tone: "" };

/** Kinds whose `payload.text` is shown as a note box under the sentence. */
export const NOTE_KINDS = new Set(["call_logged", "email_logged", "note_logged", "followup_done"]);

type T = (key: string, values?: Record<string, string>) => string;

/** "Payment received — €2,000.00 for INV-2026-0138": payload values formatted, status codes as words. */
export function activitySentence(
  kind: string,
  payload: Record<string, string | number>,
  f: Formatter,
  t: T,
  /** Fixed-vocabulary status word, e.g. ("lead", "won") → "Won". */
  statusWord: (domain: string, code: string) => string,
  fallbackCurrency: string,
): string {
  if (!ACTIVITY_LOOK[kind]) return t("unknown");
  const vals: Record<string, string> = Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, String(v)]));
  if (kind === "payment_received" && typeof payload.amountMinor === "number")
    vals.amount = f.money(payload.amountMinor, String(payload.currency ?? fallbackCurrency));
  if (kind === "lead_stage_changed" && payload.stage) vals.stage = statusWord("lead", String(payload.stage));
  if (kind === "project_status_changed" && payload.status) vals.status = statusWord("project", String(payload.status));
  if (kind === "payment_status_changed" && payload.status) vals.status = statusWord("payment", String(payload.status));
  return t(kind, vals);
}
