"use server";

import { notifyWorkspace } from "@/lib/notifications";
import { nextNumber } from "@/lib/doc-numbers";
import { documentPdf } from "@/lib/document-pdf";
import { sendMail } from "@/lib/mail/send";
import { documentMail } from "@/lib/mail/templates";
import { loadDocView } from "./doc-view-data";
import { audit } from "@/lib/audit";
import { can } from "@/lib/roles";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import {
  activities,
  clients,
  documentSequences,
  invoiceBalances,
  invoices,
  invoiceState,
  lineItems,
  milestones,
  payments,
  projects,
  quotations,
} from "@/db/schema";
import { documentNumber, documentTotals, type DocumentKind } from "@/lib/documents";
import { getSession } from "@/lib/session";
import {
  documentErrors,
  documentSchema,
  paymentSchema,
  sendSchema,
  type DocErrors,
} from "./schema";

export type SaveResult =
  { ok: true; id: string; number: string } | { ok: false; errors: DocErrors };

/** Next document number for the year (atomic upsert on the workspace's sequence). */
const table = (kind: DocumentKind) => (kind === "invoice" ? invoices : quotations);

/**
 * Creates or updates a draft. Totals are recomputed here from the lines (the client's preview is never
 * trusted); lines are replaced as a whole. A new invoice from a milestone bills that milestone.
 */
export async function saveDocument(
  id: string | null,
  input: Record<string, unknown>,
): Promise<SaveResult> {
  const { workspaceId, userId } = await getSession();
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: documentErrors(parsed.error) };
  const v = parsed.data;
  const docId = id === null ? null : z.uuid().parse(id);

  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        eq(clients.id, v.clientId),
        eq(clients.workspaceId, workspaceId),
        isNull(clients.archivedAt),
      ),
    );
  if (!client) return { ok: false, errors: { clientId: "client" } };
  const [project] = v.projectId
    ? await db
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.id, v.projectId),
            eq(projects.workspaceId, workspaceId),
            eq(projects.clientId, v.clientId),
          ),
        )
    : [];

  const totals = documentTotals(
    v.lines.map((l) => ({ quantity: l.quantity, unitPriceMinor: l.unitPrice, taxRate: l.taxRate })),
    v.discountPct,
  );
  const header = {
    clientId: v.clientId,
    projectId: project?.id ?? null,
    issueDate: v.issueDate,
    currency: v.currency,
    language: v.language,
    discountPct: String(v.discountPct),
    notes: v.notes,
    terms: v.terms,
    subtotalMinor: totals.subtotalMinor,
    discountMinor: totals.discountMinor,
    taxMinor: totals.taxMinor,
    totalMinor: totals.totalMinor,
  };
  const lines = (docIdValue: string) =>
    v.lines.map((l, position) => ({
      workspaceId,
      createdBy: userId,
      ...(v.kind === "invoice" ? { invoiceId: docIdValue } : { quotationId: docIdValue }),
      position,
      title: l.title,
      detail: l.detail,
      quantity: String(l.quantity),
      unit: l.unit,
      unitPriceMinor: l.unitPrice,
      taxRate: String(l.taxRate),
      amountMinor: totals.amounts[position]!,
    }));

  try {
    if (docId === null) {
      const newId = crypto.randomUUID();
      const number = await nextNumber(workspaceId, v.kind);
      const base = { id: newId, workspaceId, createdBy: userId, number, ...header };
      await db.batch([
        v.kind === "invoice"
          ? db.insert(invoices).values({ ...base, dueDate: v.endDate!, state: "draft" })
          : db
              .insert(quotations)
              .values({ ...base, validUntil: v.endDate, status: "draft", leadId: v.leadId }),
        db.insert(lineItems).values(lines(newId)),
        ...(v.kind === "invoice" && v.milestoneId
          ? [
              db
                .update(milestones)
                .set({ invoiceId: newId })
                .where(
                  and(
                    eq(milestones.id, v.milestoneId),
                    eq(milestones.workspaceId, workspaceId),
                    isNull(milestones.invoiceId),
                  ),
                ),
            ]
          : []),
        db.insert(activities).values({
          workspaceId,
          actorId: userId,
          kind: `${v.kind}_created`,
          entityType: v.kind,
          entityId: newId,
          clientId: v.clientId,
          payload: { number },
        }),
      ]);
      revalidatePath("/[locale]", "layout");
      return { ok: true, id: newId, number };
    }

    const t = table(v.kind);
    const [existing] = await db
      .select({
        number: t.number,
        draft:
          v.kind === "invoice"
            ? sql<boolean>`${invoices.state} = 'draft'`
            : sql<boolean>`${quotations.status} = 'draft'`,
      })
      .from(t)
      .where(and(eq(t.id, docId), eq(t.workspaceId, workspaceId), isNull(t.archivedAt)));
    if (!existing) return { ok: false, errors: { form: "notFound" } };
    if (!existing.draft) return { ok: false, errors: { form: "notDraft" } };
    await db.batch([
      v.kind === "invoice"
        ? db
            .update(invoices)
            .set({ ...header, dueDate: v.endDate! })
            .where(eq(invoices.id, docId))
        : db
            .update(quotations)
            .set({ ...header, validUntil: v.endDate })
            .where(eq(quotations.id, docId)),
      db
        .delete(lineItems)
        .where(eq(v.kind === "invoice" ? lineItems.invoiceId : lineItems.quotationId, docId)),
      db.insert(lineItems).values(lines(docId)),
    ]);
    revalidatePath("/[locale]", "layout");
    return { ok: true, id: docId, number: existing.number };
  } catch (err) {
    console.error("[saveDocument]", err);
    return { ok: false, errors: { form: "generic" } };
  }
}

/**
 * Records that the document was sent: status Sent (an invoice already sent stays sent), `sentAt`, and a
 * timeline entry with the recipient. Delivery itself happens in the user's mail app (mailto) for now.
 */
export async function markDocumentSent(
  kind: DocumentKind,
  docId: string,
  input: { recipient: string; subject: string; message: string },
) {
  const { workspaceId, userId } = await getSession();
  const id = z.uuid().parse(docId);
  const v = sendSchema.parse(input);
  const t = table(kind);
  const [doc] = await db
    .select({ number: t.number, clientId: t.clientId })
    .from(t)
    .where(and(eq(t.id, id), eq(t.workspaceId, workspaceId), isNull(t.archivedAt)));
  if (!doc) throw new Error("Document not found");
  await db.batch([
    kind === "invoice"
      ? db
          .update(invoices)
          .set({
            state: sql`case when ${invoices.state} = 'draft' then 'sent'::invoice_state else ${invoices.state} end`,
            sentAt: new Date(),
          })
          .where(eq(invoices.id, id))
      : db
          .update(quotations)
          .set({
            status: sql`case when ${quotations.status} = 'draft' then 'sent'::quotation_status else ${quotations.status} end`,
            sentAt: new Date(),
          })
          .where(eq(quotations.id, id)),
    db.insert(activities).values({
      workspaceId,
      actorId: userId,
      kind: `${kind}_sent`,
      entityType: kind,
      entityId: id,
      clientId: doc.clientId,
      payload: { number: doc.number, to: v.recipient },
    }),
  ]);
  revalidatePath("/[locale]", "layout");
  return { number: doc.number };
}

/**
 * DS › Payments: partial amounts are allowed (the view derives Partially paid); more than the balance
 * creates a credit. The idempotency key makes a retried submit a no-op.
 */
export async function recordPayment(invoiceId: string, input: Record<string, string>) {
  const { workspaceId, userId } = await getSession();
  const id = z.uuid().parse(invoiceId);
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: documentErrors(parsed.error) };
  const v = parsed.data;
  const [inv] = await db
    .select({
      number: invoices.number,
      clientId: invoices.clientId,
      currency: invoices.currency,
      state: invoices.state,
    })
    .from(invoices)
    .where(
      and(eq(invoices.id, id), eq(invoices.workspaceId, workspaceId), isNull(invoices.archivedAt)),
    );
  if (!inv) throw new Error("Invoice not found");
  if (inv.state === "draft" || inv.state === "void")
    return { ok: false as const, errors: { form: "notIssued" } };
  const inserted = await db
    .insert(payments)
    .values({
      workspaceId,
      createdBy: userId,
      invoiceId: id,
      clientId: inv.clientId,
      paidOn: v.paidOn,
      amountMinor: v.amount,
      currency: inv.currency,
      method: v.method,
      reference: v.reference,
      idempotencyKey: v.key,
    })
    .onConflictDoNothing({ target: payments.idempotencyKey })
    .returning({ id: payments.id });
  if (inserted.length)
    await db.insert(activities).values({
      workspaceId,
      actorId: userId,
      kind: "payment_received",
      entityType: "invoice",
      entityId: id,
      clientId: inv.clientId,
      payload: { number: inv.number, amountMinor: v.amount, currency: inv.currency },
    });
  if (inserted.length) {
    // Admins and the client's owner hear about money coming in (not the person recording it).
    const [client] = await db
      .select({ name: clients.name, ownerId: clients.ownerId })
      .from(clients)
      .where(eq(clients.id, inv.clientId));
    const n = {
      kind: "payment_received" as const,
      payload: { number: inv.number, amountMinor: v.amount, currency: inv.currency, client: client?.name ?? "" },
      href: `/invoices/${id}`,
    };
    await notifyWorkspace(workspaceId, { ...n, minRole: "admin", exceptUserId: userId, alsoUserIds: [client?.ownerId] });
  }
  revalidatePath("/[locale]", "layout");
  const [after] = await db
    .select({ balance: invoiceBalances.balanceMinor })
    .from(invoiceBalances)
    .where(eq(invoiceBalances.invoiceId, id));
  return { ok: true as const, number: inv.number, balanceMinor: after?.balance ?? 0 };
}

/** Void (or Undo it): returns the previous state. */
export async function setInvoiceState(invoiceId: string, state: string) {
  const { workspaceId, userId, role } = await getSession();
  const id = z.uuid().parse(invoiceId);
  const next = z.enum(invoiceState.enumValues).parse(state);
  const [inv] = await db
    .select({ state: invoices.state, number: invoices.number, clientId: invoices.clientId })
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.workspaceId, workspaceId)));
  if (!inv) throw new Error("Invoice not found");
  // Voiding (and undoing a void) is for owners and admins.
  if ((next === "void" || inv.state === "void") && !can(role, "admin"))
    throw new Error("Forbidden");
  if (next === "void")
    await audit("invoice.voided", {
      workspaceId,
      actorId: userId,
      entityType: "invoice",
      entityId: id,
      meta: { number: inv.number },
    });
  await db.batch([
    db
      .update(invoices)
      .set({ state: next, voidedAt: next === "void" ? new Date() : null })
      .where(eq(invoices.id, id)),
    ...(next === "void"
      ? [
          db.insert(activities).values({
            workspaceId,
            actorId: userId,
            kind: "invoice_voided",
            entityType: "invoice",
            entityId: id,
            clientId: inv.clientId,
            payload: { number: inv.number },
          }),
        ]
      : []),
  ]);
  revalidatePath("/[locale]", "layout");
  return { from: inv.state };
}

/** Accepted / Declined (or Undo back to the previous status). */
export async function setQuotationStatus(quotationId: string, status: string) {
  const { workspaceId, userId } = await getSession();
  const id = z.uuid().parse(quotationId);
  const next = z.enum(["draft", "sent", "accepted", "declined"]).parse(status);
  const [q] = await db
    .select({ status: quotations.status, number: quotations.number, clientId: quotations.clientId })
    .from(quotations)
    .where(and(eq(quotations.id, id), eq(quotations.workspaceId, workspaceId)));
  if (!q) throw new Error("Quotation not found");
  await db.batch([
    db
      .update(quotations)
      .set({ status: next, acceptedAt: next === "accepted" ? new Date() : null })
      .where(eq(quotations.id, id)),
    ...(next === "accepted" || next === "declined"
      ? [
          db.insert(activities).values({
            workspaceId,
            actorId: userId,
            kind: `quotation_${next}`,
            entityType: "quotation",
            entityId: id,
            clientId: q.clientId,
            payload: { number: q.number },
          }),
        ]
      : []),
  ]);
  revalidatePath("/[locale]", "layout");
  return { from: q.status };
}

/** Accepted quotation → a draft invoice with the same client, project, lines and terms (due in 30 days). */
export async function convertQuotation(quotationId: string) {
  const { workspaceId, userId } = await getSession();
  const id = z.uuid().parse(quotationId);
  const [q] = await db
    .select()
    .from(quotations)
    .where(
      and(
        eq(quotations.id, id),
        eq(quotations.workspaceId, workspaceId),
        isNull(quotations.archivedAt),
      ),
    );
  if (!q) throw new Error("Quotation not found");
  if (q.convertedInvoiceId) return { id: q.convertedInvoiceId, number: null };
  const lines = await db.select().from(lineItems).where(eq(lineItems.quotationId, id));
  const newId = crypto.randomUUID();
  const number = await nextNumber(workspaceId, "invoice");
  const today = new Date();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const due = new Date(today);
  due.setDate(due.getDate() + 30);
  await db.batch([
    db.insert(invoices).values({
      id: newId,
      workspaceId,
      createdBy: userId,
      number,
      clientId: q.clientId,
      projectId: q.projectId,
      quotationId: q.id,
      state: "draft",
      issueDate: iso(today),
      dueDate: iso(due),
      currency: q.currency,
      language: q.language,
      discountPct: q.discountPct,
      notes: q.notes,
      terms: q.terms,
      subtotalMinor: q.subtotalMinor,
      discountMinor: q.discountMinor,
      taxMinor: q.taxMinor,
      totalMinor: q.totalMinor,
    }),
    ...(lines.length
      ? [
          db.insert(lineItems).values(
            lines.map((l) => ({
              workspaceId,
              createdBy: userId,
              invoiceId: newId,
              position: l.position,
              title: l.title,
              detail: l.detail,
              quantity: l.quantity,
              unit: l.unit,
              unitPriceMinor: l.unitPriceMinor,
              taxRate: l.taxRate,
              amountMinor: l.amountMinor,
            })),
          ),
        ]
      : []),
    db.update(quotations).set({ convertedInvoiceId: newId }).where(eq(quotations.id, id)),
    db.insert(activities).values({
      workspaceId,
      actorId: userId,
      kind: "quotation_converted",
      entityType: "quotation",
      entityId: id,
      clientId: q.clientId,
      payload: { number: q.number, invoice: number },
    }),
  ]);
  revalidatePath("/[locale]", "layout");
  return { id: newId, number };
}

export type EmailResult = { ok: true } | { ok: false; error: "pdf" | "mail" };

/**
 * Sends the document by email with its PDF attached (from the company's name, replies to the
 * sender), then marks it sent like before. If the PDF or the email fails, nothing is marked.
 */
export async function emailDocument(
  kind: DocumentKind,
  docId: string,
  input: { recipient: string; subject: string; message: string },
): Promise<EmailResult> {
  const session = await getSession();
  const id = z.uuid().parse(docId);
  const v = sendSchema.parse(input);
  const view = await loadDocView(session.workspaceId, kind, id);
  if (!view) throw new Error("Document not found");
  let pdf: { content: Buffer; filename: string };
  try {
    pdf = await documentPdf(session.workspaceId, kind, id, view.language, view.data.number);
  } catch (error) {
    console.error("[emailDocument] pdf", error);
    return { ok: false, error: "pdf" };
  }
  try {
    await sendMail(
      documentMail({
        to: v.recipient,
        subject: v.subject,
        message: v.message,
        locale: view.language,
        company: session.workspace.name,
        replyTo: session.user.email,
        attachment: pdf,
      }),
    );
  } catch (error) {
    console.error("[emailDocument] mail", error);
    return { ok: false, error: "mail" };
  }
  await markDocumentSent(kind, id, v);
  await audit("invoice.emailed", {
    workspaceId: session.workspaceId,
    actorId: session.userId,
    entityType: kind,
    entityId: id,
    meta: { number: view.data.number, to: v.recipient },
  });
  return { ok: true };
}
