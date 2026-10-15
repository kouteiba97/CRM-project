"use server";

import { and, asc, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { activities, clients, followUps, leads, leadStage, memberships } from "@/db/schema";
import { getSession } from "@/lib/session";
import { LOST_REASONS, leadFieldErrors, leadSchema, type LeadFieldErrors } from "./schema";

export type LeadResult =
  | { ok: true; id: string; title: string }
  | { ok: false; fieldErrors: LeadFieldErrors; formError?: "generic" };

async function checkRefs(workspaceId: string, userId: string, clientId: string | null, ownerId: string | null) {
  const [client] = clientId
    ? await db
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.id, clientId), eq(clients.workspaceId, workspaceId), isNull(clients.archivedAt)))
    : [];
  const [member] =
    ownerId && ownerId !== userId
      ? await db
          .select({ id: memberships.id })
          .from(memberships)
          .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, ownerId)))
      : [];
  return { clientId: client?.id ?? null, ownerId: member ? ownerId! : userId };
}

/** New lead at the top of its stage, its first follow-up (if given) and a `lead_created` activity, in one batch. */
export async function createLead(input: Record<string, string>): Promise<LeadResult> {
  const { workspaceId, userId } = await getSession();
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: leadFieldErrors(parsed.error) };
  const v = parsed.data;
  const refs = await checkRefs(workspaceId, userId, v.clientId, v.ownerId);
  const [top] = await db
    .select({ min: sql<number>`coalesce(min(${leads.position}), 0)::int` })
    .from(leads)
    .where(and(eq(leads.workspaceId, workspaceId), eq(leads.stage, v.stage), isNull(leads.archivedAt)));
  const id = crypto.randomUUID();
  try {
    await db.batch([
      db.insert(leads).values({
        id,
        workspaceId,
        createdBy: userId,
        title: v.title,
        clientId: refs.clientId,
        prospectCompany: refs.clientId ? null : v.prospectCompany,
        prospectName: refs.clientId ? null : v.prospectName,
        stage: v.stage,
        valueMinor: v.value,
        currency: v.currency,
        priority: v.priority,
        expectedCloseDate: v.expectedCloseDate,
        ownerId: refs.ownerId,
        source: v.source,
        position: (top?.min ?? 0) - 1,
      }),
      ...(v.followUpAt
        ? [
            db.insert(followUps).values({
              workspaceId,
              createdBy: userId,
              leadId: id,
              channel: v.followUpChannel,
              subject: v.title,
              dueAt: v.followUpAt,
              ownerId: refs.ownerId,
            }),
          ]
        : []),
      db.insert(activities).values({
        workspaceId,
        actorId: userId,
        kind: "lead_created",
        entityType: "lead",
        entityId: id,
        clientId: refs.clientId,
        payload: { title: v.title },
      }),
    ]);
  } catch (err) {
    console.error("[createLead]", err);
    return { ok: false, fieldErrors: {}, formError: "generic" };
  }
  revalidatePath("/[locale]", "layout");
  return { ok: true, id, title: v.title };
}

/** Edit drawer. The stage is changed on the board (or with "Move to…"), not here. */
export async function updateLead(leadId: string, input: Record<string, string>): Promise<LeadResult> {
  const { workspaceId, userId } = await getSession();
  const id = z.uuid().parse(leadId);
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: leadFieldErrors(parsed.error) };
  const v = parsed.data;
  const refs = await checkRefs(workspaceId, userId, v.clientId, v.ownerId);
  const [row] = await db
    .update(leads)
    .set({
      title: v.title,
      clientId: refs.clientId,
      prospectCompany: refs.clientId ? null : v.prospectCompany,
      prospectName: refs.clientId ? null : v.prospectName,
      valueMinor: v.value,
      currency: v.currency,
      priority: v.priority,
      expectedCloseDate: v.expectedCloseDate,
      ownerId: refs.ownerId,
      source: v.source,
    })
    .where(and(eq(leads.id, id), eq(leads.workspaceId, workspaceId), isNull(leads.archivedAt)))
    .returning({ id: leads.id });
  if (!row) return { ok: false, fieldErrors: {}, formError: "generic" };
  revalidatePath("/[locale]", "layout");
  return { ok: true, id, title: v.title };
}

const moveSchema = z.object({
  id: z.uuid(),
  stage: z.enum(leadStage.enumValues),
  index: z.number().int().min(0).max(10_000),
  wonValueMinor: z.number().int().min(0).optional(),
  lostReason: z.enum(LOST_REASONS).optional(),
});

/**
 * Moves a lead to `stage` at `index` and renumbers that column. Won stamps `wonAt` (optionally the
 * final value); Lost requires a reason; leaving either clears them, so Undo is just another move.
 */
export async function moveLead(input: {
  id: string;
  stage: string;
  index: number;
  wonValueMinor?: number;
  lostReason?: string;
}) {
  const { workspaceId, userId } = await getSession();
  const v = moveSchema.parse(input);
  if (v.stage === "lost" && !v.lostReason) throw new Error("A lost lead needs a reason");
  const [lead] = await db
    .select({ id: leads.id, title: leads.title, stage: leads.stage, clientId: leads.clientId, lostReason: leads.lostReason })
    .from(leads)
    .where(and(eq(leads.id, v.id), eq(leads.workspaceId, workspaceId), isNull(leads.archivedAt)));
  if (!lead) throw new Error("Lead not found");

  const column = await db
    .select({ id: leads.id })
    .from(leads)
    .where(
      and(eq(leads.workspaceId, workspaceId), eq(leads.stage, v.stage), isNull(leads.archivedAt), ne(leads.id, v.id)),
    )
    .orderBy(asc(leads.position), asc(leads.createdAt));
  const order = column.map((c) => c.id);
  order.splice(Math.min(v.index, order.length), 0, v.id);

  const changed = lead.stage !== v.stage;
  await db.batch([
    db
      .update(leads)
      .set({
        stage: v.stage,
        wonAt: v.stage === "won" ? (changed ? new Date() : undefined) : null,
        lostReason: v.stage === "lost" ? (v.lostReason ?? lead.lostReason) : null,
        ...(v.stage === "won" && v.wonValueMinor !== undefined ? { valueMinor: v.wonValueMinor } : {}),
      })
      .where(eq(leads.id, v.id)),
    ...order.map((leadId, position) => db.update(leads).set({ position }).where(eq(leads.id, leadId))),
    ...(changed
      ? [
          db.insert(activities).values({
            workspaceId,
            actorId: userId,
            kind: "lead_stage_changed",
            entityType: "lead",
            entityId: lead.id,
            clientId: lead.clientId,
            payload: { title: lead.title, stage: v.stage },
          }),
        ]
      : []),
  ]);
  revalidatePath("/[locale]", "layout");
  return { from: lead.stage };
}

async function setArchived(leadId: string, archived: boolean) {
  const { workspaceId } = await getSession();
  const id = z.uuid().parse(leadId);
  const [row] = await db
    .update(leads)
    .set({ archivedAt: archived ? new Date() : null })
    .where(
      and(
        eq(leads.id, id),
        eq(leads.workspaceId, workspaceId),
        archived ? isNull(leads.archivedAt) : isNotNull(leads.archivedAt),
      ),
    )
    .returning({ id: leads.id, title: leads.title });
  if (!row) throw new Error("Lead not found");
  revalidatePath("/[locale]", "layout");
  return row;
}

/** No confirmation dialog: the toast offers Undo. */
export async function archiveLead(leadId: string) {
  return setArchived(leadId, true);
}

export async function restoreLead(leadId: string) {
  return setArchived(leadId, false);
}
