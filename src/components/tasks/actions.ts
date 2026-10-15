"use server";

import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { activities, memberships, projects, tasks, taskStatus } from "@/db/schema";
import { getSession } from "@/lib/session";
import { taskFieldErrors, taskFormSchema, type TaskFieldErrors } from "./schema";

export type TaskResult =
  | { ok: true; id: string; title: string }
  | { ok: false; fieldErrors: TaskFieldErrors; formError?: "generic" };

/** Project (and its client) and assignee, only if they belong to the workspace. */
async function refs(workspaceId: string, userId: string, projectId: string | null, assigneeId: string | null) {
  const [project] = projectId
    ? await db
        .select({ id: projects.id, clientId: projects.clientId })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId), isNull(projects.archivedAt)))
    : [];
  const [member] =
    assigneeId && assigneeId !== userId
      ? await db
          .select({ id: memberships.id })
          .from(memberships)
          .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, assigneeId)))
      : [];
  return {
    projectId: project?.id ?? null,
    clientId: project?.clientId ?? null,
    assigneeId: assigneeId === null ? null : member || assigneeId === userId ? assigneeId : userId,
  };
}

const logDone = (workspaceId: string, userId: string, t: { id: string; title: string; projectId: string | null; clientId: string | null }) =>
  db.insert(activities).values({
    workspaceId,
    actorId: userId,
    kind: "task_completed",
    entityType: t.projectId ? "project" : "task",
    entityId: t.projectId ?? t.id,
    clientId: t.clientId,
    payload: { title: t.title },
  });

export async function createTask(input: Record<string, string>): Promise<TaskResult> {
  const { workspaceId, userId } = await getSession();
  const parsed = taskFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: taskFieldErrors(parsed.error) };
  const v = parsed.data;
  const r = await refs(workspaceId, userId, v.projectId, v.assigneeId);
  const id = crypto.randomUUID();
  try {
    await db.insert(tasks).values({
      id,
      workspaceId,
      createdBy: userId,
      title: v.title,
      projectId: r.projectId,
      clientId: r.clientId,
      status: v.status,
      priority: v.priority,
      dueDate: v.dueDate,
      assigneeId: r.assigneeId,
      completedAt: v.status === "done" ? new Date() : null,
    });
  } catch (err) {
    console.error("[createTask]", err);
    return { ok: false, fieldErrors: {}, formError: "generic" };
  }
  revalidatePath("/[locale]", "layout");
  return { ok: true, id, title: v.title };
}

export async function updateTask(taskId: string, input: Record<string, string>): Promise<TaskResult> {
  const { workspaceId, userId } = await getSession();
  const id = z.uuid().parse(taskId);
  const parsed = taskFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: taskFieldErrors(parsed.error) };
  const v = parsed.data;
  const [before] = await db
    .select({ status: tasks.status })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, workspaceId), isNull(tasks.archivedAt)));
  if (!before) return { ok: false, fieldErrors: {}, formError: "generic" };
  const r = await refs(workspaceId, userId, v.projectId, v.assigneeId);
  const nowDone = v.status === "done" && before.status !== "done";
  await db
    .update(tasks)
    .set({
      title: v.title,
      projectId: r.projectId,
      clientId: r.clientId,
      status: v.status,
      priority: v.priority,
      dueDate: v.dueDate,
      assigneeId: r.assigneeId,
      ...(nowDone ? { completedAt: new Date() } : v.status !== "done" ? { completedAt: null } : {}),
    })
    .where(eq(tasks.id, id));
  if (nowDone) await logDone(workspaceId, userId, { id, title: v.title, projectId: r.projectId, clientId: r.clientId });
  revalidatePath("/[locale]", "layout");
  return { ok: true, id, title: v.title };
}

const inlineSchema = z.object({
  title: z.string().trim().min(1).max(200),
  dueDate: z.union([z.iso.date(), z.literal("")]).transform((v) => v || null),
  projectId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
});

/** Inline add at the bottom of a group: the group decides the default due date (or project). */
export async function quickAddTask(input: { title: string; dueDate: string; projectId: string }) {
  const { workspaceId, userId } = await getSession();
  const v = inlineSchema.parse(input);
  const r = await refs(workspaceId, userId, v.projectId, userId);
  await db.insert(tasks).values({
    workspaceId,
    createdBy: userId,
    title: v.title,
    dueDate: v.dueDate,
    projectId: r.projectId,
    clientId: r.clientId,
    assigneeId: userId,
  });
  revalidatePath("/[locale]", "layout");
}

const idList = z.array(z.uuid()).min(1).max(200);

/** db.batch needs a non-empty tuple; one round trip, one transaction (neon-http). */
async function batchAll<Q extends Parameters<typeof db.batch>[0][number]>(queries: Q[]) {
  const [first, ...rest] = queries;
  if (first) await db.batch([first, ...rest]);
}

/** Bulk reschedule; returns each task's previous due date so Undo can put them back. */
export async function rescheduleTasks(taskIds: string[], dueDate: string | null) {
  const { workspaceId } = await getSession();
  const ids = idList.parse(taskIds);
  const date = dueDate === null ? null : z.iso.date().parse(dueDate);
  const before = await db
    .select({ id: tasks.id, dueDate: tasks.dueDate })
    .from(tasks)
    .where(and(eq(tasks.workspaceId, workspaceId), inArray(tasks.id, ids), isNull(tasks.archivedAt)));
  if (before.length) await db.update(tasks).set({ dueDate: date }).where(inArray(tasks.id, before.map((b) => b.id)));
  revalidatePath("/[locale]", "layout");
  return before.map((b) => ({ id: b.id, dueDate: b.dueDate }));
}

/** Undo for a bulk reschedule: every task back to its own previous date. */
export async function restoreDueDates(previous: { id: string; dueDate: string | null }[]) {
  const { workspaceId } = await getSession();
  const list = z
    .array(z.object({ id: z.uuid(), dueDate: z.union([z.iso.date(), z.null()]) }))
    .min(1)
    .max(200)
    .parse(previous);
  await batchAll(
    list.map((p) =>
      db.update(tasks).set({ dueDate: p.dueDate }).where(and(eq(tasks.id, p.id), eq(tasks.workspaceId, workspaceId))),
    ),
  );
  revalidatePath("/[locale]", "layout");
}

/** Bulk complete; returns previous statuses for Undo. */
export async function completeTasks(taskIds: string[]) {
  const { workspaceId, userId } = await getSession();
  const ids = idList.parse(taskIds);
  const before = await db
    .select({ id: tasks.id, status: tasks.status, title: tasks.title, projectId: tasks.projectId, clientId: tasks.clientId })
    .from(tasks)
    .where(and(eq(tasks.workspaceId, workspaceId), inArray(tasks.id, ids), isNull(tasks.archivedAt)));
  const open = before.filter((b) => b.status !== "done");
  if (open.length) {
    await db.update(tasks).set({ status: "done", completedAt: new Date() }).where(inArray(tasks.id, open.map((b) => b.id)));
    await batchAll(open.map((t) => logDone(workspaceId, userId, t)));
  }
  revalidatePath("/[locale]", "layout");
  return open.map((b) => ({ id: b.id, status: b.status }));
}

export async function restoreStatuses(previous: { id: string; status: string }[]) {
  const { workspaceId } = await getSession();
  const list = z
    .array(z.object({ id: z.uuid(), status: z.enum(taskStatus.enumValues) }))
    .min(1)
    .max(200)
    .parse(previous);
  await batchAll(
    list.map((p) =>
      db
        .update(tasks)
        .set({ status: p.status, completedAt: p.status === "done" ? new Date() : null })
        .where(and(eq(tasks.id, p.id), eq(tasks.workspaceId, workspaceId))),
    ),
  );
  revalidatePath("/[locale]", "layout");
}

async function setArchived(taskId: string, archived: boolean) {
  const { workspaceId } = await getSession();
  const id = z.uuid().parse(taskId);
  const [row] = await db
    .update(tasks)
    .set({ archivedAt: archived ? new Date() : null })
    .where(
      and(eq(tasks.id, id), eq(tasks.workspaceId, workspaceId), archived ? isNull(tasks.archivedAt) : isNotNull(tasks.archivedAt)),
    )
    .returning({ id: tasks.id, title: tasks.title });
  if (!row) throw new Error("Task not found");
  revalidatePath("/[locale]", "layout");
  return row;
}
/** Delete = archive (soft); the toast offers Undo. */
export async function archiveTask(taskId: string) {
  return setArchived(taskId, true);
}
export async function restoreTask(taskId: string) {
  return setArchived(taskId, false);
}
