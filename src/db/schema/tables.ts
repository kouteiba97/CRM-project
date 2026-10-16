import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import * as e from "./enums";

const id = () => uuid("id").primaryKey().defaultRandom();
/** Money is always integer minor units (cents) next to a currency code — never a float. */
const money = (name: string) => bigint(name, { mode: "number" });
const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const workspaces = pgTable("workspaces", {
  id: id(),
  name: text("name").notNull(),
  defaultCurrency: char("default_currency", { length: 3 }).notNull().default("EUR"),
  defaultLocale: e.locale("default_locale").notNull().default("fr"),
  defaultDocumentLanguage: e.locale("default_document_language").notNull().default("fr"),
  nif: text("nif"),
  rc: text("rc"),
  nis: text("nis"),
  ai: text("ai"),
  address: text("address"),
  iban: text("iban"),
  ...timestamps(),
});

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  /** bcrypt hash; null means the user cannot sign in with a password. */
  passwordHash: text("password_hash"),
  /** Set once the user proved they own the address (link clicked, reset done, or Google). */
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  /** Bumped on password change; sessions signed with an older value are signed out. */
  sessionVersion: integer("session_version").notNull().default(0),
  locale: e.locale("locale"),
  theme: e.themePref("theme").notNull().default("light"),
  sidebarCollapsed: boolean("sidebar_collapsed").notNull().default(false),
  ...timestamps(),
});

/**
 * One-time links sent by email (password reset, email confirmation). Only the SHA-256 of the
 * token is stored, so a database leak cannot be turned into working links.
 */
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: e.authTokenKind("kind").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_tokens_user_kind_idx").on(t.userId, t.kind, t.createdAt)],
);

export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: e.memberRole("role").notNull().default("member"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("memberships_ws_user").on(t.workspaceId, t.userId)],
);

/** Columns every workspace-scoped record carries. */
const scoped = () => ({
  id: id(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps(),
});

export const clients = pgTable(
  "clients",
  {
    ...scoped(),
    name: text("name").notNull(),
    kind: e.clientKind("kind").notNull().default("company"),
    status: e.clientStatus("status").notNull().default("active"),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    addressLine: text("address_line"),
    city: text("city"),
    postalCode: text("postal_code"),
    country: char("country", { length: 2 }),
    nif: text("nif"),
    rc: text("rc"),
    nis: text("nis"),
    ai: text("ai"),
    documentLanguage: e.locale("document_language"),
    currency: char("currency", { length: 3 }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    remindersEnabled: boolean("reminders_enabled").notNull().default(true),
    notes: text("notes"),
  },
  (t) => [index("clients_ws_status").on(t.workspaceId, t.status)],
);

export const contacts = pgTable(
  "contacts",
  {
    ...scoped(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    jobTitle: text("job_title"),
    email: text("email"),
    phone: text("phone"),
    isPrimary: boolean("is_primary").notNull().default(false),
  },
  (t) => [
    index("contacts_ws_client").on(t.workspaceId, t.clientId),
    uniqueIndex("contacts_one_primary").on(t.clientId).where(sql`${t.isPrimary}`),
  ],
);

export const leads = pgTable(
  "leads",
  {
    ...scoped(),
    title: text("title").notNull(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    prospectName: text("prospect_name"),
    prospectCompany: text("prospect_company"),
    stage: e.leadStage("stage").notNull().default("new"),
    valueMinor: money("value_minor").notNull().default(0),
    currency: char("currency", { length: 3 }).notNull(),
    priority: e.priority("priority").notNull().default("medium"),
    source: text("source"),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    expectedCloseDate: date("expected_close_date"),
    lostReason: text("lost_reason"),
    wonAt: timestamp("won_at", { withTimezone: true }),
    position: integer("position").notNull().default(0),
    convertedProjectId: uuid("converted_project_id"),
  },
  (t) => [
    index("leads_ws_stage").on(t.workspaceId, t.stage, t.position),
    index("leads_ws_client").on(t.workspaceId, t.clientId),
  ],
);

export const projects = pgTable(
  "projects",
  {
    ...scoped(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    status: e.projectStatus("status").notNull().default("planning"),
    startDate: date("start_date"),
    deadline: date("deadline"),
    budgetMinor: money("budget_minor"),
    currency: char("currency", { length: 3 }).notNull(),
    repoUrl: text("repo_url"),
    description: text("description"),
  },
  (t) => [
    uniqueIndex("projects_ws_code").on(t.workspaceId, t.code),
    index("projects_ws_client").on(t.workspaceId, t.clientId),
  ],
);

export const milestones = pgTable(
  "milestones",
  {
    ...scoped(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    dueDate: date("due_date"),
    status: e.milestoneStatus("status").notNull().default("pending"),
    amountMinor: money("amount_minor"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    position: integer("position").notNull().default(0),
    /** Set once billed; a completed milestone without one surfaces "Create invoice". */
    invoiceId: uuid("invoice_id"),
  },
  (t) => [
    index("milestones_ws_project").on(t.workspaceId, t.projectId),
    index("milestones_ws_due").on(t.workspaceId, t.dueDate),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    ...scoped(),
    title: text("title").notNull(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    milestoneId: uuid("milestone_id").references(() => milestones.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    status: e.taskStatus("status").notNull().default("todo"),
    priority: e.priority("priority").notNull().default("medium"),
    dueDate: date("due_date"),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    index("tasks_ws_due").on(t.workspaceId, t.dueDate),
    index("tasks_ws_project").on(t.workspaceId, t.projectId),
  ],
);

export const followUps = pgTable(
  "follow_ups",
  {
    ...scoped(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    channel: e.followupChannel("channel").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    status: e.followupStatus("status").notNull().default("open"),
    subject: text("subject").notNull(),
    outcome: text("outcome"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    index("follow_ups_ws_due").on(t.workspaceId, t.status, t.dueAt),
    check("follow_ups_one_subject", sql`(${t.clientId} is null) <> (${t.leadId} is null)`),
  ],
);

const documentTotals = () => ({
  subtotalMinor: money("subtotal_minor").notNull().default(0),
  discountMinor: money("discount_minor").notNull().default(0),
  taxMinor: money("tax_minor").notNull().default(0),
  totalMinor: money("total_minor").notNull().default(0),
});

export const quotations = pgTable(
  "quotations",
  {
    ...scoped(),
    number: text("number").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    status: e.quotationStatus("status").notNull().default("draft"),
    issueDate: date("issue_date").notNull(),
    validUntil: date("valid_until"),
    currency: char("currency", { length: 3 }).notNull(),
    language: e.locale("language").notNull(),
    discountPct: numeric("discount_pct", { precision: 5, scale: 2 }),
    notes: text("notes"),
    terms: text("terms"),
    ...documentTotals(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    convertedInvoiceId: uuid("converted_invoice_id"),
  },
  (t) => [
    uniqueIndex("quotations_ws_number").on(t.workspaceId, t.number),
    index("quotations_ws_client").on(t.workspaceId, t.clientId),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    ...scoped(),
    number: text("number").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    quotationId: uuid("quotation_id").references(() => quotations.id, { onDelete: "set null" }),
    state: e.invoiceState("state").notNull().default("draft"),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    language: e.locale("language").notNull(),
    discountPct: numeric("discount_pct", { precision: 5, scale: 2 }),
    notes: text("notes"),
    terms: text("terms"),
    ...documentTotals(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("invoices_ws_number").on(t.workspaceId, t.number),
    index("invoices_ws_client").on(t.workspaceId, t.clientId),
    index("invoices_ws_due").on(t.workspaceId, t.dueDate),
  ],
);

export const lineItems = pgTable(
  "line_items",
  {
    ...scoped(),
    quotationId: uuid("quotation_id").references(() => quotations.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    title: text("title").notNull(),
    detail: text("detail"),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("1"),
    unit: text("unit"),
    unitPriceMinor: money("unit_price_minor").notNull(),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    amountMinor: money("amount_minor").notNull(),
  },
  (t) => [
    index("line_items_quotation").on(t.quotationId, t.position),
    index("line_items_invoice").on(t.invoiceId, t.position),
    check("line_items_one_document", sql`(${t.quotationId} is null) <> (${t.invoiceId} is null)`),
  ],
);

export const payments = pgTable(
  "payments",
  {
    ...scoped(),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "restrict" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    paidOn: date("paid_on").notNull(),
    amountMinor: money("amount_minor").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    method: e.paymentMethod("method").notNull(),
    reference: text("reference"),
    status: e.paymentStatus("status").notNull().default("received"),
    /** A retried request can never create two payments. */
    idempotencyKey: text("idempotency_key").notNull().unique(),
    notes: text("notes"),
  },
  (t) => [
    index("payments_ws_paid_on").on(t.workspaceId, t.paidOn),
    index("payments_ws_invoice").on(t.workspaceId, t.invoiceId),
  ],
);

export const activities = pgTable(
  "activities",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    payload: jsonb("payload").$type<Record<string, string | number>>().notNull().default({}),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("activities_ws_time").on(t.workspaceId, t.occurredAt),
    index("activities_entity").on(t.entityType, t.entityId),
  ],
);

export const documentSequences = pgTable(
  "document_sequences",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: e.sequenceKind("kind").notNull(),
    year: integer("year").notNull(),
    nextValue: integer("next_value").notNull().default(1),
  },
  (t) => [uniqueIndex("document_sequences_key").on(t.workspaceId, t.kind, t.year)],
);
