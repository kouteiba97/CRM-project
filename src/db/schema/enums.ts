import { pgEnum } from "drizzle-orm/pg-core";

// Stable codes only. Display words come from messages/*.json › status (DS fixed vocabulary).
export const clientStatus = pgEnum("client_status", ["active", "prospect", "inactive"]);
export const clientKind = pgEnum("client_kind", ["company", "individual"]);
export const leadStage = pgEnum("lead_stage", [
  "new",
  "contacted",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
]);
export const priority = pgEnum("priority", ["urgent", "high", "medium", "low"]);
export const projectStatus = pgEnum("project_status", [
  "planning",
  "active",
  "on_hold",
  "at_risk",
  "completed",
  "archived",
]);
export const milestoneStatus = pgEnum("milestone_status", ["pending", "in_progress", "completed"]);
export const taskStatus = pgEnum("task_status", ["todo", "in_progress", "in_review", "blocked", "done"]);
export const followupChannel = pgEnum("followup_channel", ["call", "email", "meeting"]);
export const followupStatus = pgEnum("followup_status", ["open", "done", "cancelled"]);
export const quotationStatus = pgEnum("quotation_status", [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
]);
// Paid / Partially paid / Overdue are derived (view invoice_balances), never stored.
export const invoiceState = pgEnum("invoice_state", ["draft", "sent", "viewed", "void"]);
export const paymentStatus = pgEnum("payment_status", ["received", "pending", "failed", "refunded"]);
export const paymentMethod = pgEnum("payment_method", [
  "bank_transfer",
  "cash",
  "cheque",
  "card",
  "other",
]);
export const locale = pgEnum("locale", ["en", "fr", "ar"]);
export const themePref = pgEnum("theme_pref", ["light", "dark", "system"]);
export const memberRole = pgEnum("member_role", ["owner", "member"]);
export const sequenceKind = pgEnum("sequence_kind", ["quotation", "invoice", "project"]);
