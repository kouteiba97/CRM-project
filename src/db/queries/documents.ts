import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import {
  activities,
  clients,
  contacts,
  invoiceBalances,
  invoices,
  leads,
  lineItems,
  milestones,
  payments,
  projects,
  quotationDisplayStatus,
  quotations,
  users,
} from "@/db/schema";
import type { DocumentKind } from "@/lib/documents";
import { isUuid } from "./clients";

export const INVOICE_DISPLAY = ["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "void"] as const;
export const QUOTATION_DISPLAY = ["draft", "sent", "accepted", "declined", "expired"] as const;
/** Dashboard and project links filter on these groups. */
export const INVOICE_STATUS_GROUPS = { outstanding: ["sent", "viewed", "partially_paid"], unpaid: ["sent", "viewed", "partially_paid", "overdue"] } as const;
export const DOC_SORT_KEYS = ["issue", "due", "number", "amount", "balance"] as const;
export type DocSortKey = (typeof DOC_SORT_KEYS)[number];

export type DocFilters = {
  q: string;
  status: string | null;
  client: string | null;
  project: string | null;
  sort: DocSortKey;
  dir: "asc" | "desc";
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseDocFilters(kind: DocumentKind, sp: Params): DocFilters {
  const status = one(sp.status);
  const allowed: readonly string[] =
    kind === "invoice" ? [...INVOICE_DISPLAY, ...Object.keys(INVOICE_STATUS_GROUPS)] : QUOTATION_DISPLAY;
  const sort = one(sp.sort);
  const validSort = (DOC_SORT_KEYS as readonly string[]).includes(sort ?? "") && !(kind === "quotation" && sort === "balance");
  const client = one(sp.client);
  const project = one(sp.project);
  return {
    q: (one(sp.q) ?? "").trim().slice(0, 100),
    status: allowed.includes(status ?? "") ? status! : null,
    client: isUuid(client) ? client : null,
    project: isUuid(project) ? project : null,
    sort: validSort ? (sort as DocSortKey) : "issue",
    // Newest first by default; an explicit sort starts ascending.
    dir: validSort ? (one(sp.dir) === "desc" ? "desc" : "asc") : "desc",
  };
}

const escape = (q: string) => `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

export async function listInvoices(ws: string, f: DocFilters) {
  const where: (SQL | undefined)[] = [eq(invoices.workspaceId, ws), isNull(invoices.archivedAt)];
  if (f.q) where.push(or(ilike(invoices.number, escape(f.q)), ilike(clients.name, escape(f.q))));
  if (f.status) {
    const group = INVOICE_STATUS_GROUPS[f.status as keyof typeof INVOICE_STATUS_GROUPS];
    where.push(group ? inArray(invoiceBalances.displayStatus, [...group]) : eq(invoiceBalances.displayStatus, f.status));
  }
  if (f.client) where.push(eq(invoices.clientId, f.client));
  if (f.project) where.push(eq(invoices.projectId, f.project));
  const dir = f.dir === "desc" ? desc : asc;
  const order = {
    issue: [dir(invoices.issueDate), dir(invoices.number)],
    due: [dir(invoices.dueDate), asc(invoices.number)],
    number: [dir(invoices.number)],
    amount: [dir(invoices.totalMinor), asc(invoices.number)],
    balance: [dir(invoiceBalances.balanceMinor), asc(invoices.number)],
  }[f.sort];
  return db
    .select({
      id: invoices.id,
      number: invoices.number,
      clientId: clients.id,
      clientName: clients.name,
      projectName: projects.name,
      status: invoiceBalances.displayStatus,
      daysOverdue: invoiceBalances.daysOverdue,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      totalMinor: invoices.totalMinor,
      balanceMinor: invoiceBalances.balanceMinor,
      currency: invoices.currency,
    })
    .from(invoices)
    .innerJoin(invoiceBalances, eq(invoiceBalances.invoiceId, invoices.id))
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .leftJoin(projects, eq(projects.id, invoices.projectId))
    .where(and(...where))
    .orderBy(...order);
}
export type InvoiceListRow = Awaited<ReturnType<typeof listInvoices>>[number];

export async function listQuotations(ws: string, f: DocFilters) {
  const where: (SQL | undefined)[] = [eq(quotations.workspaceId, ws), isNull(quotations.archivedAt)];
  if (f.q) where.push(or(ilike(quotations.number, escape(f.q)), ilike(clients.name, escape(f.q))));
  if (f.status) where.push(eq(quotationDisplayStatus.displayStatus, f.status));
  if (f.client) where.push(eq(quotations.clientId, f.client));
  if (f.project) where.push(eq(quotations.projectId, f.project));
  const dir = f.dir === "desc" ? desc : asc;
  const order = {
    issue: [dir(quotations.issueDate), dir(quotations.number)],
    due: [sql`${quotations.validUntil} ${sql.raw(f.dir)} nulls last`, asc(quotations.number)],
    number: [dir(quotations.number)],
    amount: [dir(quotations.totalMinor), asc(quotations.number)],
    balance: [dir(quotations.totalMinor)],
  }[f.sort];
  return db
    .select({
      id: quotations.id,
      number: quotations.number,
      clientId: clients.id,
      clientName: clients.name,
      status: quotationDisplayStatus.displayStatus,
      issueDate: quotations.issueDate,
      validUntil: quotations.validUntil,
      totalMinor: quotations.totalMinor,
      currency: quotations.currency,
      convertedInvoiceId: quotations.convertedInvoiceId,
    })
    .from(quotations)
    .innerJoin(quotationDisplayStatus, eq(quotationDisplayStatus.quotationId, quotations.id))
    .innerJoin(clients, eq(clients.id, quotations.clientId))
    .where(and(...where))
    .orderBy(...order);
}
export type QuotationListRow = Awaited<ReturnType<typeof listQuotations>>[number];

/** Clients that have documents of this kind (filter chip). */
export async function getDocumentClients(ws: string, kind: DocumentKind) {
  const t = kind === "invoice" ? invoices : quotations;
  return db
    .selectDistinct({ id: clients.id, name: clients.name })
    .from(t)
    .innerJoin(clients, eq(clients.id, t.clientId))
    .where(and(eq(t.workspaceId, ws), isNull(t.archivedAt)))
    .orderBy(asc(clients.name));
}

// ── Record ──────────────────────────────────────────────────────────────────────────────
const clientCols = {
  clientId: clients.id,
  clientName: clients.name,
  clientEmail: clients.email,
  clientAddress: clients.addressLine,
  clientCity: clients.city,
  clientCountry: clients.country,
  clientNif: clients.nif,
  clientRc: clients.rc,
  clientReminders: clients.remindersEnabled,
};

export async function getInvoice(ws: string, id: string) {
  const [row] = await db
    .select({
      doc: invoices,
      ...clientCols,
      projectName: projects.name,
      status: invoiceBalances.displayStatus,
      paidMinor: invoiceBalances.paidMinor,
      balanceMinor: invoiceBalances.balanceMinor,
      daysOverdue: invoiceBalances.daysOverdue,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .innerJoin(invoiceBalances, eq(invoiceBalances.invoiceId, invoices.id))
    .leftJoin(projects, eq(projects.id, invoices.projectId))
    .where(and(eq(invoices.id, id), eq(invoices.workspaceId, ws), isNull(invoices.archivedAt)));
  if (!row) return null;
  const lines = await getLines(ws, "invoice", id);
  return { ...row, lines };
}
export type InvoiceRecord = NonNullable<Awaited<ReturnType<typeof getInvoice>>>;

export async function getQuotation(ws: string, id: string) {
  const [row] = await db
    .select({
      doc: quotations,
      ...clientCols,
      projectName: projects.name,
      status: quotationDisplayStatus.displayStatus,
      convertedNumber: invoices.number,
    })
    .from(quotations)
    .innerJoin(clients, eq(clients.id, quotations.clientId))
    .innerJoin(quotationDisplayStatus, eq(quotationDisplayStatus.quotationId, quotations.id))
    .leftJoin(projects, eq(projects.id, quotations.projectId))
    .leftJoin(invoices, eq(invoices.id, quotations.convertedInvoiceId))
    .where(and(eq(quotations.id, id), eq(quotations.workspaceId, ws), isNull(quotations.archivedAt)));
  if (!row) return null;
  const lines = await getLines(ws, "quotation", id);
  return { ...row, lines };
}
export type QuotationRecord = NonNullable<Awaited<ReturnType<typeof getQuotation>>>;

export async function getLines(ws: string, kind: DocumentKind, id: string) {
  return db
    .select({
      id: lineItems.id,
      title: lineItems.title,
      detail: lineItems.detail,
      quantity: lineItems.quantity,
      unit: lineItems.unit,
      unitPriceMinor: lineItems.unitPriceMinor,
      taxRate: lineItems.taxRate,
      amountMinor: lineItems.amountMinor,
    })
    .from(lineItems)
    .where(and(eq(lineItems.workspaceId, ws), eq(kind === "invoice" ? lineItems.invoiceId : lineItems.quotationId, id)))
    .orderBy(asc(lineItems.position));
}

export async function getInvoicePayments(ws: string, id: string) {
  return db
    .select({
      id: payments.id,
      paidOn: payments.paidOn,
      amountMinor: payments.amountMinor,
      currency: payments.currency,
      method: payments.method,
      reference: payments.reference,
      status: payments.status,
    })
    .from(payments)
    .where(and(eq(payments.workspaceId, ws), eq(payments.invoiceId, id), isNull(payments.archivedAt)))
    .orderBy(desc(payments.paidOn));
}

export async function getDocumentActivity(ws: string, kind: DocumentKind, id: string) {
  return db
    .select({
      id: activities.id,
      kind: activities.kind,
      payload: activities.payload,
      occurredAt: activities.occurredAt,
      actorName: users.name,
    })
    .from(activities)
    .leftJoin(users, eq(users.id, activities.actorId))
    .where(and(eq(activities.workspaceId, ws), eq(activities.entityType, kind), eq(activities.entityId, id)))
    .orderBy(desc(activities.occurredAt))
    .limit(50);
}

// ── Editor options and prefills ─────────────────────────────────────────────────────────
export async function getEditorOptions(ws: string) {
  const [clientRows, projectRows, primaryContacts] = await Promise.all([
    db
      .select({
        id: clients.id,
        name: clients.name,
        currency: clients.currency,
        language: clients.documentLanguage,
        email: clients.email,
        address: clients.addressLine,
        city: clients.city,
        country: clients.country,
        nif: clients.nif,
        rc: clients.rc,
      })
      .from(clients)
      .where(and(eq(clients.workspaceId, ws), isNull(clients.archivedAt)))
      .orderBy(asc(clients.name)),
    db
      .select({ id: projects.id, name: projects.name, code: projects.code, clientId: projects.clientId })
      .from(projects)
      .where(and(eq(projects.workspaceId, ws), isNull(projects.archivedAt)))
      .orderBy(asc(projects.name)),
    db
      .select({ clientId: contacts.clientId, email: contacts.email })
      .from(contacts)
      .where(and(eq(contacts.workspaceId, ws), eq(contacts.isPrimary, true), isNull(contacts.archivedAt))),
  ]);
  const contactEmail = new Map(primaryContacts.map((c) => [c.clientId, c.email]));
  return {
    clients: clientRows.map((c) => ({ ...c, email: c.email ?? contactEmail.get(c.id) ?? null })),
    projects: projectRows,
  };
}
export type EditorOptions = Awaited<ReturnType<typeof getEditorOptions>>;

export async function getMilestoneForInvoice(ws: string, id: string) {
  const [row] = await db
    .select({
      id: milestones.id,
      title: milestones.title,
      amountMinor: milestones.amountMinor,
      invoiceId: milestones.invoiceId,
      projectId: projects.id,
      projectName: projects.name,
      clientId: projects.clientId,
      currency: projects.currency,
    })
    .from(milestones)
    .innerJoin(projects, eq(projects.id, milestones.projectId))
    .where(and(eq(milestones.id, id), eq(milestones.workspaceId, ws)));
  return row ?? null;
}

export async function getLeadForQuotation(ws: string, id: string) {
  const [row] = await db
    .select({ id: leads.id, title: leads.title, clientId: leads.clientId, valueMinor: leads.valueMinor, currency: leads.currency })
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.workspaceId, ws)));
  return row ?? null;
}
