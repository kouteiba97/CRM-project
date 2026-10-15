"use server";

import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import {
  activities,
  clients,
  contacts,
  followUps,
  followupChannel,
  leads,
  memberships,
  projects,
} from "@/db/schema";
import { getSession } from "@/lib/session";
import { fieldErrors, newClientSchema, type FieldErrors } from "./schema";

export type CreateClientResult =
  | { ok: true; id: string; name: string }
  | { ok: false; fieldErrors: FieldErrors; formError?: "generic" };

/**
 * Inserts the client, its primary contact and a `client_created` activity in one batch
 * (neon-http runs a batch as a single transaction), all scoped to the session's workspace.
 */
export async function createClient(input: Record<string, string>): Promise<CreateClientResult> {
  const { workspaceId, userId } = await getSession();
  const parsed = newClientSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const ownerId = await resolveOwner(workspaceId, userId, v.ownerId);

  const id = crypto.randomUUID();
  const base = { workspaceId, createdBy: userId };
  try {
    await db.batch([
      db.insert(clients).values({
        ...base,
        id,
        name: v.name,
        kind: v.kind,
        status: v.status,
        email: v.email,
        phone: v.phone,
        city: v.city,
        country: v.country,
        currency: v.currency,
        documentLanguage: v.documentLanguage,
        ownerId,
        tags: v.tags,
      }),
      db.insert(contacts).values({
        ...base,
        clientId: id,
        firstName: v.contactFirstName,
        lastName: v.contactLastName,
        jobTitle: v.contactJobTitle,
        email: v.contactEmail,
        phone: v.contactPhone,
        isPrimary: true,
      }),
      db.insert(activities).values({
        workspaceId,
        actorId: userId,
        kind: "client_created",
        entityType: "client",
        entityId: id,
        clientId: id,
        payload: { name: v.name },
      }),
    ]);
  } catch (err) {
    console.error("[createClient]", err);
    return { ok: false, fieldErrors: {}, formError: "generic" };
  }
  revalidatePath("/[locale]", "layout");
  return { ok: true, id, name: v.name };
}

/** A record that can carry activity and follow-ups. */
export type RecordTarget = { type: "client" | "lead" | "project"; id: string };
const targetSchema = z.object({ type: z.enum(["client", "lead", "project"]), id: z.uuid() });

/** Resolves the target in this workspace; returns the client to attach activity to (a lead's client, if any). */
async function resolveTarget(workspaceId: string, target: RecordTarget) {
  const t = targetSchema.parse(target);
  if (t.type === "client") {
    const [c] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, t.id), eq(clients.workspaceId, workspaceId)));
    if (!c) throw new Error("Client not found");
    return { ...t, clientId: c.id as string | null };
  }
  if (t.type === "project") {
    const [p] = await db
      .select({ id: projects.id, clientId: projects.clientId })
      .from(projects)
      .where(and(eq(projects.id, t.id), eq(projects.workspaceId, workspaceId)));
    if (!p) throw new Error("Project not found");
    return { ...t, clientId: p.clientId as string | null };
  }
  const [l] = await db
    .select({ id: leads.id, clientId: leads.clientId })
    .from(leads)
    .where(and(eq(leads.id, t.id), eq(leads.workspaceId, workspaceId)));
  if (!l) throw new Error("Lead not found");
  return { ...t, clientId: l.clientId };
}

const logSchema = z.object({
  kind: z.enum(["call_logged", "email_logged", "note_logged"]),
  text: z.string().trim().min(1).max(2000),
});

/** Timeline composer: log a call, e-mail or note on a client or a lead. */
export async function logActivity(target: RecordTarget, kind: string, text: string) {
  const { workspaceId, userId } = await getSession();
  const v = logSchema.parse({ kind, text });
  const t = await resolveTarget(workspaceId, target);
  await db.insert(activities).values({
    workspaceId,
    actorId: userId,
    kind: v.kind,
    entityType: t.type,
    entityId: t.id,
    clientId: t.clientId,
    payload: { text: v.text },
  });
  revalidatePath("/[locale]", "layout");
}

/** The chosen owner if they belong to the workspace, otherwise the current user. */
async function resolveOwner(workspaceId: string, userId: string, wanted: string | null) {
  if (!wanted || wanted === userId) return userId;
  const [member] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, wanted)));
  return member ? wanted : userId;
}

/** Edit drawer: updates the client and its primary contact (creating one if it has none). */
export async function updateClient(clientId: string, input: Record<string, string>): Promise<CreateClientResult> {
  const { workspaceId, userId } = await getSession();
  const id = z.uuid().parse(clientId);
  const parsed = newClientSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.workspaceId, workspaceId), isNull(clients.archivedAt)));
  if (!client) return { ok: false, fieldErrors: {}, formError: "generic" };
  const [primary] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.clientId, id), eq(contacts.isPrimary, true), isNull(contacts.archivedAt)));
  const ownerId = await resolveOwner(workspaceId, userId, v.ownerId);
  const contact = {
    firstName: v.contactFirstName,
    lastName: v.contactLastName,
    jobTitle: v.contactJobTitle,
    email: v.contactEmail,
    phone: v.contactPhone,
  };
  try {
    await db.batch([
      db
        .update(clients)
        .set({
          name: v.name,
          kind: v.kind,
          status: v.status,
          email: v.email,
          phone: v.phone,
          city: v.city,
          country: v.country,
          currency: v.currency,
          documentLanguage: v.documentLanguage,
          ownerId,
          tags: v.tags,
        })
        .where(and(eq(clients.id, id), eq(clients.workspaceId, workspaceId))),
      primary
        ? db.update(contacts).set(contact).where(eq(contacts.id, primary.id))
        : db.insert(contacts).values({ workspaceId, createdBy: userId, clientId: id, isPrimary: true, ...contact }),
      db.insert(activities).values({
        workspaceId,
        actorId: userId,
        kind: "client_updated",
        entityType: "client",
        entityId: id,
        clientId: id,
        payload: { name: v.name },
      }),
    ]);
  } catch (err) {
    console.error("[updateClient]", err);
    return { ok: false, fieldErrors: {}, formError: "generic" };
  }
  revalidatePath("/[locale]", "layout");
  return { ok: true, id, name: v.name };
}

const idList = z.array(z.uuid()).min(1).max(200);

async function setArchived(clientIds: string[], archived: boolean) {
  const { workspaceId, userId } = await getSession();
  const list = idList.parse(clientIds);
  const rows = await db
    .update(clients)
    .set({ archivedAt: archived ? new Date() : null })
    .where(
      and(
        eq(clients.workspaceId, workspaceId),
        inArray(clients.id, list),
        archived ? isNull(clients.archivedAt) : isNotNull(clients.archivedAt),
      ),
    )
    .returning({ id: clients.id, name: clients.name });
  if (rows.length)
    await db.insert(activities).values(
      rows.map((r) => ({
        workspaceId,
        actorId: userId,
        kind: archived ? "client_archived" : "client_restored",
        entityType: "client",
        entityId: r.id,
        clientId: r.id,
        payload: { name: r.name },
      })),
    );
  revalidatePath("/[locale]", "layout");
  return { count: rows.length, ids: rows.map((r) => r.id), name: rows[0]?.name ?? "" };
}

/** Archive (soft delete) one or many clients. No confirmation: the toast offers Undo (DS › Interaction). */
export async function archiveClients(clientIds: string[]) {
  return setArchived(clientIds, true);
}

export async function restoreClients(clientIds: string[]) {
  return setArchived(clientIds, false);
}

// ── Follow-ups (record rail) ────────────────────────────────────────────────────────────
const dueAt = z.iso.datetime({ offset: true }).transform((v) => new Date(v));

/** Resolves the follow-up in this workspace and the client it belongs to (directly or through a lead). */
async function followUpScope(workspaceId: string, followUpId: string) {
  const [row] = await db
    .select({ id: followUps.id, clientId: followUps.clientId, leadClientId: leads.clientId })
    .from(followUps)
    .leftJoin(leads, eq(leads.id, followUps.leadId))
    .where(and(eq(followUps.id, followUpId), eq(followUps.workspaceId, workspaceId)));
  if (!row) throw new Error("Follow-up not found");
  return { client: row.clientId ?? row.leadClientId };
}

export async function rescheduleFollowUp(followUpId: string, when: string) {
  const { workspaceId } = await getSession();
  const id = z.uuid().parse(followUpId);
  const date = dueAt.parse(when);
  await followUpScope(workspaceId, id);
  await db
    .update(followUps)
    .set({ dueAt: date })
    .where(and(eq(followUps.id, id), eq(followUps.workspaceId, workspaceId)));
  revalidatePath("/[locale]", "layout");
}

const completeSchema = z.object({
  outcome: z.string().trim().max(2000),
  next: z.union([dueAt, z.literal("")]),
});

/** DS › Follow-ups: completing logs the outcome (optional) and can set the next follow-up. */
export async function completeFollowUp(followUpId: string, input: { outcome: string; next: string }) {
  const { workspaceId, userId } = await getSession();
  const id = z.uuid().parse(followUpId);
  const v = completeSchema.parse(input);
  const { client } = await followUpScope(workspaceId, id);
  const [done] = await db
    .update(followUps)
    .set({ status: "done", completedAt: new Date(), outcome: v.outcome || null })
    .where(and(eq(followUps.id, id), eq(followUps.workspaceId, workspaceId), eq(followUps.status, "open")))
    .returning();
  if (!done) throw new Error("Follow-up not found");
  await db.insert(activities).values({
    workspaceId,
    actorId: userId,
    kind: "followup_done",
    entityType: client ? "client" : "lead",
    entityId: client ?? done.leadId ?? done.id,
    clientId: client,
    payload: v.outcome ? { subject: done.subject, text: v.outcome } : { subject: done.subject },
  });
  if (v.next instanceof Date)
    await db.insert(followUps).values({
      workspaceId,
      createdBy: userId,
      clientId: done.clientId,
      leadId: done.leadId,
      contactId: done.contactId,
      channel: done.channel,
      subject: done.subject,
      dueAt: v.next,
      ownerId: done.ownerId ?? userId,
    });
  revalidatePath("/[locale]", "layout");
}

const planSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  channel: z.enum(followupChannel.enumValues),
  dueAt,
});

/** Plans a follow-up on a client or a lead that has none. */
export async function planFollowUp(target: RecordTarget, input: { subject: string; channel: string; dueAt: string }) {
  const { workspaceId, userId } = await getSession();
  const v = planSchema.parse(input);
  const t = await resolveTarget(workspaceId, target);
  if (t.type === "project") throw new Error("Follow-ups attach to clients and leads");
  await db.insert(followUps).values({
    workspaceId,
    createdBy: userId,
    clientId: t.type === "client" ? t.id : null,
    leadId: t.type === "lead" ? t.id : null,
    channel: v.channel,
    subject: v.subject,
    dueAt: v.dueAt,
    ownerId: userId,
  });
  revalidatePath("/[locale]", "layout");
}
