import "server-only";
import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { activities, clients, followUps, leads, priority as priorityEnum, users } from "@/db/schema";
import { LEAD_STAGES } from "@/lib/status";
import { isUuid } from "./clients";

export const PRIORITIES = priorityEnum.enumValues;
export const LEAD_SORT_KEYS = ["value", "nextFollowUp", "expectedClose", "title"] as const;
export type LeadSortKey = (typeof LEAD_SORT_KEYS)[number];

export type LeadFilters = {
  view: "board" | "table";
  q: string;
  priority: (typeof PRIORITIES)[number] | null;
  owner: string | null;
  noFollowUp: boolean;
  /** Table view only: the board always shows every stage. */
  stage: (typeof LEAD_STAGES)[number] | null;
  sort: LeadSortKey;
  dir: "asc" | "desc";
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseLeadFilters(sp: Params): LeadFilters {
  const pr = one(sp.priority);
  const sort = one(sp.sort);
  const owner = one(sp.owner);
  const validSort = (LEAD_SORT_KEYS as readonly string[]).includes(sort ?? "");
  const view = one(sp.view) === "table" ? "table" : "board";
  const stage = one(sp.stage);
  return {
    view,
    stage:
      view === "table" && (LEAD_STAGES as readonly string[]).includes(stage ?? "")
        ? (stage as LeadFilters["stage"])
        : null,
    q: (one(sp.q) ?? "").trim().slice(0, 100),
    priority: (PRIORITIES as readonly string[]).includes(pr ?? "") ? (pr as LeadFilters["priority"]) : null,
    owner: isUuid(owner) ? owner : null,
    noFollowUp: one(sp.nofu) === "1",
    sort: validSort ? (sort as LeadSortKey) : "nextFollowUp",
    dir: validSort && one(sp.dir) === "desc" ? "desc" : "asc",
  };
}

/** Earliest open follow-up per lead. */
const nextFu = db
  .select({ leadId: followUps.leadId, nextDue: sql<Date | null>`min(${followUps.dueAt})`.as("next_due") })
  .from(followUps)
  .where(and(isNull(followUps.archivedAt), eq(followUps.status, "open")))
  .groupBy(followUps.leadId)
  .as("nfu");

const leadColumns = {
  id: leads.id,
  title: leads.title,
  stage: leads.stage,
  valueMinor: leads.valueMinor,
  currency: leads.currency,
  priority: leads.priority,
  position: leads.position,
  expectedCloseDate: leads.expectedCloseDate,
  lostReason: leads.lostReason,
  source: leads.source,
  clientId: leads.clientId,
  clientName: clients.name,
  prospectName: leads.prospectName,
  prospectCompany: leads.prospectCompany,
  ownerId: leads.ownerId,
  ownerName: users.name,
  nextFollowUp: nextFu.nextDue,
  createdAt: leads.createdAt,
};

export async function listLeads(ws: string, f: LeadFilters) {
  const where: (SQL | undefined)[] = [eq(leads.workspaceId, ws), isNull(leads.archivedAt)];
  if (f.q) {
    const p = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push(
      or(
        ilike(leads.title, p),
        ilike(clients.name, p),
        ilike(leads.prospectName, p),
        ilike(leads.prospectCompany, p),
      ),
    );
  }
  if (f.priority) where.push(eq(leads.priority, f.priority));
  if (f.stage) where.push(eq(leads.stage, f.stage));
  if (f.owner) where.push(eq(leads.ownerId, f.owner));
  if (f.noFollowUp) where.push(sql`${nextFu.nextDue} is null and ${leads.stage} not in ('won', 'lost')`);

  const dir = f.dir === "desc" ? desc : asc;
  const order =
    f.view === "board"
      ? [asc(leads.position), asc(leads.createdAt)]
      : {
          value: [dir(leads.valueMinor), asc(leads.title)],
          nextFollowUp: [sql`${nextFu.nextDue} ${sql.raw(f.dir)} nulls last`, asc(leads.title)],
          expectedClose: [sql`${leads.expectedCloseDate} ${sql.raw(f.dir)} nulls last`, asc(leads.title)],
          title: [dir(sql`lower(${leads.title})`)],
        }[f.sort];

  return db
    .select(leadColumns)
    .from(leads)
    .leftJoin(clients, eq(clients.id, leads.clientId))
    .leftJoin(users, eq(users.id, leads.ownerId))
    .leftJoin(nextFu, eq(nextFu.leadId, leads.id))
    .where(and(...where))
    .orderBy(...order);
}
export type LeadRow = Awaited<ReturnType<typeof listLeads>>[number];

export async function getLead(ws: string, id: string) {
  const [row] = await db
    .select(leadColumns)
    .from(leads)
    .leftJoin(clients, eq(clients.id, leads.clientId))
    .leftJoin(users, eq(users.id, leads.ownerId))
    .leftJoin(nextFu, eq(nextFu.leadId, leads.id))
    .where(and(eq(leads.id, id), eq(leads.workspaceId, ws), isNull(leads.archivedAt)));
  return row ?? null;
}

export async function getLeadNextFollowUp(ws: string, id: string) {
  const [row] = await db
    .select({ id: followUps.id, subject: followUps.subject, channel: followUps.channel, dueAt: followUps.dueAt })
    .from(followUps)
    .where(
      and(
        eq(followUps.workspaceId, ws),
        eq(followUps.leadId, id),
        eq(followUps.status, "open"),
        isNull(followUps.archivedAt),
      ),
    )
    .orderBy(asc(followUps.dueAt))
    .limit(1);
  return row ?? null;
}

export async function getLeadActivity(ws: string, id: string, limit = 50) {
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
    .where(and(eq(activities.workspaceId, ws), eq(activities.entityType, "lead"), eq(activities.entityId, id)))
    .orderBy(desc(activities.occurredAt), desc(activities.id))
    .limit(limit);
}

/** Clients offered in the New lead drawer. */
export async function getClientOptions(ws: string) {
  return db
    .select({ id: clients.id, name: clients.name, currency: clients.currency })
    .from(clients)
    .where(and(eq(clients.workspaceId, ws), isNull(clients.archivedAt)))
    .orderBy(asc(clients.name));
}

export { LEAD_STAGES };
