import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { activities, clients, invoiceBalances, invoices, paymentMethod, payments, paymentStatus } from "@/db/schema";
import { isUuid } from "./clients";
import { parseRange, periodBounds } from "./dashboard";

export const PAYMENT_STATUSES = paymentStatus.enumValues;
export const PAYMENT_METHOD_CODES = paymentMethod.enumValues;
export const PAYMENT_SORT_KEYS = ["date", "amount", "client"] as const;
type SortKey = (typeof PAYMENT_SORT_KEYS)[number];

export type PaymentFilters = {
  q: string;
  status: (typeof PAYMENT_STATUSES)[number] | null;
  method: (typeof PAYMENT_METHOD_CODES)[number] | null;
  client: string | null;
  /** Dashboard Revenue KPI links here with ?period=month|quarter|year. */
  period: "month" | "quarter" | "year" | null;
  sort: SortKey;
  dir: "asc" | "desc";
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parsePaymentFilters(sp: Params): PaymentFilters {
  const status = one(sp.status);
  const method = one(sp.method);
  const client = one(sp.client);
  const period = one(sp.period);
  const sort = one(sp.sort);
  const validSort = (PAYMENT_SORT_KEYS as readonly string[]).includes(sort ?? "");
  return {
    q: (one(sp.q) ?? "").trim().slice(0, 100),
    status: (PAYMENT_STATUSES as readonly string[]).includes(status ?? "") ? (status as PaymentFilters["status"]) : null,
    method: (PAYMENT_METHOD_CODES as readonly string[]).includes(method ?? "") ? (method as PaymentFilters["method"]) : null,
    client: isUuid(client) ? client : null,
    period: period === "month" || period === "quarter" || period === "year" ? parseRange(period) : null,
    sort: validSort ? (sort as SortKey) : "date",
    dir: validSort ? (one(sp.dir) === "desc" ? "desc" : "asc") : "desc",
  };
}

export async function listPayments(ws: string, f: PaymentFilters, now = new Date()) {
  const where: (SQL | undefined)[] = [eq(payments.workspaceId, ws), isNull(payments.archivedAt)];
  if (f.q) {
    const p = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push(or(ilike(payments.reference, p), ilike(invoices.number, p), ilike(clients.name, p)));
  }
  if (f.status) where.push(eq(payments.status, f.status));
  if (f.method) where.push(eq(payments.method, f.method));
  if (f.client) where.push(eq(payments.clientId, f.client));
  if (f.period) {
    const b = periodBounds(f.period, now);
    where.push(gte(payments.paidOn, b.start), lt(payments.paidOn, b.end));
  }
  const dir = f.dir === "desc" ? desc : asc;
  const order = {
    date: [dir(payments.paidOn), dir(payments.createdAt)],
    amount: [dir(payments.amountMinor), desc(payments.paidOn)],
    client: [dir(sql`lower(${clients.name})`), desc(payments.paidOn)],
  }[f.sort];
  return db
    .select({
      id: payments.id,
      paidOn: payments.paidOn,
      amountMinor: payments.amountMinor,
      currency: payments.currency,
      method: payments.method,
      reference: payments.reference,
      status: payments.status,
      clientId: clients.id,
      clientName: clients.name,
      invoiceId: invoices.id,
      invoiceNumber: invoices.number,
    })
    .from(payments)
    .innerJoin(clients, eq(clients.id, payments.clientId))
    .leftJoin(invoices, eq(invoices.id, payments.invoiceId))
    .where(and(...where))
    .orderBy(...order)
    .limit(500);
}
export type PaymentRow = Awaited<ReturnType<typeof listPayments>>[number];

/** Issued invoices with a balance, for "Record payment" from the list. */
export async function getPayableInvoices(ws: string) {
  return db
    .select({
      id: invoices.id,
      number: invoices.number,
      clientName: clients.name,
      balanceMinor: invoiceBalances.balanceMinor,
      currency: invoices.currency,
    })
    .from(invoices)
    .innerJoin(invoiceBalances, eq(invoiceBalances.invoiceId, invoices.id))
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(
      and(
        eq(invoices.workspaceId, ws),
        isNull(invoices.archivedAt),
        inArray(invoiceBalances.displayStatus, ["sent", "viewed", "partially_paid", "overdue"]),
      ),
    )
    .orderBy(asc(invoices.dueDate));
}

export async function getPaymentClients(ws: string) {
  return db
    .selectDistinct({ id: clients.id, name: clients.name })
    .from(payments)
    .innerJoin(clients, eq(clients.id, payments.clientId))
    .where(and(eq(payments.workspaceId, ws), isNull(payments.archivedAt)))
    .orderBy(asc(clients.name));
}

/** Reminder activities logged for an invoice (manual "Send reminder" / schedule "Send now"). */
export async function getInvoiceReminders(ws: string, invoiceId: string) {
  return db
    .select({ occurredAt: activities.occurredAt })
    .from(activities)
    .where(
      and(
        eq(activities.workspaceId, ws),
        eq(activities.entityType, "invoice"),
        eq(activities.entityId, invoiceId),
        eq(activities.kind, "invoice_reminder"),
      ),
    )
    .orderBy(asc(activities.occurredAt));
}
