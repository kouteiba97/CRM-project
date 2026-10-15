import "server-only";
import { and, asc, desc, eq, gte, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { clients, followupChannel, followUps, leads, users } from "@/db/schema";
import { isUuid } from "./clients";

export const FOLLOWUP_CHANNELS = followupChannel.enumValues;

export type FollowUpFilters = {
  q: string;
  channel: (typeof FOLLOWUP_CHANNELS)[number] | null;
  /** Follow-ups on clients or on leads. */
  on: "client" | "lead" | null;
  owner: string | null;
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseFollowUpFilters(sp: Params): FollowUpFilters {
  const channel = one(sp.channel);
  const on = one(sp.on);
  const owner = one(sp.owner);
  return {
    q: (one(sp.q) ?? "").trim().slice(0, 100),
    channel: (FOLLOWUP_CHANNELS as readonly string[]).includes(channel ?? "") ? (channel as FollowUpFilters["channel"]) : null,
    on: on === "client" || on === "lead" ? on : null,
    owner: isUuid(owner) ? owner : null,
  };
}

const leadClient = sql`(select name from clients lc where lc.id = ${leads.clientId})`;
const columns = {
  id: followUps.id,
  subject: followUps.subject,
  channel: followUps.channel,
  dueAt: followUps.dueAt,
  status: followUps.status,
  outcome: followUps.outcome,
  completedAt: followUps.completedAt,
  clientId: followUps.clientId,
  clientName: clients.name,
  leadId: followUps.leadId,
  leadTitle: leads.title,
  leadCompany: sql<string | null>`coalesce(${leadClient}, ${leads.prospectCompany}, ${leads.prospectName})`,
  ownerName: users.name,
  ownerId: followUps.ownerId,
};

function where(ws: string, f: FollowUpFilters): SQL[] {
  const w: SQL[] = [eq(followUps.workspaceId, ws), isNull(followUps.archivedAt)];
  if (f.q) {
    const p = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    w.push(or(ilike(followUps.subject, p), ilike(clients.name, p), ilike(leads.title, p), ilike(leads.prospectCompany, p))!);
  }
  if (f.channel) w.push(eq(followUps.channel, f.channel));
  if (f.on === "client") w.push(isNotNull(followUps.clientId));
  if (f.on === "lead") w.push(isNotNull(followUps.leadId));
  if (f.owner) w.push(eq(followUps.ownerId, f.owner));
  return w;
}

/** Open follow-ups (all, soonest first) and those completed in the last 14 days. */
export async function listFollowUps(ws: string, f: FollowUpFilters, now = new Date()) {
  const since = new Date(now.getTime() - 14 * 86_400_000);
  const base = () =>
    db
      .select(columns)
      .from(followUps)
      .leftJoin(clients, eq(clients.id, followUps.clientId))
      .leftJoin(leads, eq(leads.id, followUps.leadId))
      .leftJoin(users, eq(users.id, followUps.ownerId));
  const [open, done] = await Promise.all([
    base()
      .where(and(...where(ws, f), eq(followUps.status, "open")))
      .orderBy(asc(followUps.dueAt)),
    base()
      .where(and(...where(ws, f), eq(followUps.status, "done"), gte(followUps.completedAt, since)))
      .orderBy(desc(followUps.completedAt))
      .limit(50),
  ]);
  return { open, done };
}
export type FollowUpRow = Awaited<ReturnType<typeof listFollowUps>>["open"][number];

/** Clients and open leads a follow-up can be attached to (New follow-up drawer). */
export async function getFollowUpTargets(ws: string) {
  const [clientRows, leadRows] = await Promise.all([
    db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(and(eq(clients.workspaceId, ws), isNull(clients.archivedAt)))
      .orderBy(asc(clients.name)),
    db
      .select({ id: leads.id, title: leads.title })
      .from(leads)
      .where(and(eq(leads.workspaceId, ws), isNull(leads.archivedAt), sql`${leads.stage} not in ('won', 'lost')`))
      .orderBy(asc(leads.title)),
  ]);
  return { clients: clientRows, leads: leadRows };
}
