"use server";

import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { activities, clients, documentSequences, leads, milestones, projects, projectStatus, tasks } from "@/db/schema";
import { getSession } from "@/lib/session";
import {
  milestoneSchema,
  projectFieldErrors,
  projectSchema,
  taskSchema,
  type ProjectFieldErrors,
} from "./schema";

export type ProjectResult =
  | { ok: true; id: string; name: string; code: string }
  | { ok: false; fieldErrors: ProjectFieldErrors; formError?: "generic" };

/** Next project code for the year, e.g. PRJ-015 (atomic upsert on the workspace's sequence row). */
async function nextProjectCode(workspaceId: string) {
  const year = new Date().getFullYear();
  const res = await db.execute<{ value: number }>(sql`
    insert into ${documentSequences} (workspace_id, kind, year, next_value)
    values (${workspaceId}, 'project', ${year}, 2)
    on conflict (workspace_id, kind, year)
    do update set next_value = ${documentSequences}.next_value + 1
    returning next_value - 1 as value`);
  return `PRJ-${String(res.rows[0]!.value).padStart(3, "0")}`;
}

async function clientInWorkspace(workspaceId: string, clientId: string) {
  const [c] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.workspaceId, workspaceId), isNull(clients.archivedAt)));
  return !!c;
}

/** New project (optionally converted from a lead, which then links back to it) + a `project_created` activity. */
export async function createProject(input: Record<string, string>): Promise<ProjectResult> {
  const { workspaceId, userId } = await getSession();
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: projectFieldErrors(parsed.error) };
  const v = parsed.data;
  if (!(await clientInWorkspace(workspaceId, v.clientId))) return { ok: false, fieldErrors: { clientId: "client" } };
  const [lead] = v.leadId
    ? await db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.id, v.leadId), eq(leads.workspaceId, workspaceId)))
    : [];
  const id = crypto.randomUUID();
  try {
    const code = await nextProjectCode(workspaceId);
    await db.batch([
      db.insert(projects).values({
        id,
        workspaceId,
        createdBy: userId,
        code,
        name: v.name,
        clientId: v.clientId,
        leadId: lead?.id ?? null,
        status: v.status,
        startDate: v.startDate,
        deadline: v.deadline,
        budgetMinor: v.budget,
        currency: v.currency,
        repoUrl: v.repoUrl,
        description: v.description,
      }),
      ...(lead ? [db.update(leads).set({ convertedProjectId: id }).where(eq(leads.id, lead.id))] : []),
      db.insert(activities).values({
        workspaceId,
        actorId: userId,
        kind: "project_created",
        entityType: "project",
        entityId: id,
        clientId: v.clientId,
        payload: { name: v.name, code },
      }),
    ]);
    revalidatePath("/[locale]", "layout");
    return { ok: true, id, name: v.name, code };
  } catch (err) {
    console.error("[createProject]", err);
    return { ok: false, fieldErrors: {}, formError: "generic" };
  }
}

export async function updateProject(projectId: string, input: Record<string, string>): Promise<ProjectResult> {
  const { workspaceId } = await getSession();
  const id = z.uuid().parse(projectId);
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: projectFieldErrors(parsed.error) };
  const v = parsed.data;
  if (!(await clientInWorkspace(workspaceId, v.clientId))) return { ok: false, fieldErrors: { clientId: "client" } };
  const [row] = await db
    .update(projects)
    .set({
      name: v.name,
      clientId: v.clientId,
      status: v.status,
      startDate: v.startDate,
      deadline: v.deadline,
      budgetMinor: v.budget,
      currency: v.currency,
      repoUrl: v.repoUrl,
      description: v.description,
    })
    .where(and(eq(projects.id, id), eq(projects.workspaceId, workspaceId), isNull(projects.archivedAt)))
    .returning({ code: projects.code });
  if (!row) return { ok: false, fieldErrors: {}, formError: "generic" };
  revalidatePath("/[locale]", "layout");
  return { ok: true, id, name: v.name, code: row.code };
}

/** Status change from the record; returns the previous status so the toast can Undo. */
export async function setProjectStatus(projectId: string, status: string) {
  const { workspaceId, userId } = await getSession();
  const id = z.uuid().parse(projectId);
  const next = z.enum(projectStatus.enumValues).parse(status);
  const [before] = await db
    .select({ status: projects.status, name: projects.name, clientId: projects.clientId })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.workspaceId, workspaceId)));
  if (!before) throw new Error("Project not found");
  await db.batch([
    db.update(projects).set({ status: next }).where(eq(projects.id, id)),
    db.insert(activities).values({
      workspaceId,
      actorId: userId,
      kind: "project_status_changed",
      entityType: "project",
      entityId: id,
      clientId: before.clientId,
      payload: { name: before.name, status: next },
    }),
  ]);
  revalidatePath("/[locale]", "layout");
  return { from: before.status };
}

async function setArchived(projectId: string, archived: boolean) {
  const { workspaceId } = await getSession();
  const id = z.uuid().parse(projectId);
  const [row] = await db
    .update(projects)
    .set({ archivedAt: archived ? new Date() : null })
    .where(
      and(
        eq(projects.id, id),
        eq(projects.workspaceId, workspaceId),
        archived ? isNull(projects.archivedAt) : isNotNull(projects.archivedAt),
      ),
    )
    .returning({ id: projects.id, name: projects.name });
  if (!row) throw new Error("Project not found");
  revalidatePath("/[locale]", "layout");
  return row;
}
export async function archiveProject(projectId: string) {
  return setArchived(projectId, true);
}
export async function restoreProject(projectId: string) {
  return setArchived(projectId, false);
}

async function projectScope(workspaceId: string, projectId: string) {
  const [p] = await db
    .select({ id: projects.id, clientId: projects.clientId })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId), isNull(projects.archivedAt)));
  if (!p) throw new Error("Project not found");
  return p;
}

// ── Milestones ──────────────────────────────────────────────────────────────────────────
export async function addMilestone(projectId: string, input: { title: string; dueDate: string; amount: string }) {
  const { workspaceId, userId } = await getSession();
  const p = await projectScope(workspaceId, z.uuid().parse(projectId));
  const parsed = milestoneSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "invalid" };
  const v = parsed.data;
  const [last] = await db
    .select({ max: sql<number>`coalesce(max(${milestones.position}), -1)::int` })
    .from(milestones)
    .where(eq(milestones.projectId, p.id));
  await db.insert(milestones).values({
    workspaceId,
    createdBy: userId,
    projectId: p.id,
    title: v.title,
    dueDate: v.dueDate,
    amountMinor: v.amount,
    position: (last?.max ?? -1) + 1,
  });
  revalidatePath("/[locale]", "layout");
  return { ok: true as const };
}

/** Completing logs `milestone_completed`; reopening clears the completion date. Undo is another call. */
export async function setMilestoneStatus(milestoneId: string, status: string) {
  const { workspaceId, userId } = await getSession();
  const id = z.uuid().parse(milestoneId);
  const next = z.enum(["pending", "in_progress", "completed"]).parse(status);
  const [m] = await db
    .select({ status: milestones.status, title: milestones.title, projectId: milestones.projectId, clientId: projects.clientId })
    .from(milestones)
    .innerJoin(projects, eq(projects.id, milestones.projectId))
    .where(and(eq(milestones.id, id), eq(milestones.workspaceId, workspaceId)));
  if (!m) throw new Error("Milestone not found");
  await db
    .update(milestones)
    .set({ status: next, completedAt: next === "completed" ? new Date() : null })
    .where(eq(milestones.id, id));
  if (next === "completed" && m.status !== "completed")
    await db.insert(activities).values({
      workspaceId,
      actorId: userId,
      kind: "milestone_completed",
      entityType: "project",
      entityId: m.projectId,
      clientId: m.clientId,
      payload: { title: m.title },
    });
  revalidatePath("/[locale]", "layout");
  return { from: m.status };
}

// ── Tasks (inline add on the project; completion uses setTaskStatus) ─────────────────────
export async function addProjectTask(projectId: string, input: { title: string; dueDate: string; priority: string }) {
  const { workspaceId, userId } = await getSession();
  const p = await projectScope(workspaceId, z.uuid().parse(projectId));
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "invalid" };
  const v = parsed.data;
  await db.insert(tasks).values({
    workspaceId,
    createdBy: userId,
    projectId: p.id,
    clientId: p.clientId,
    title: v.title,
    dueDate: v.dueDate,
    priority: v.priority,
    assigneeId: userId,
  });
  revalidatePath("/[locale]", "layout");
  return { ok: true as const };
}
