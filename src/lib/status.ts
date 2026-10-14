/**
 * StatusBadge canonical mappings (DS › Components › StatusBadge): every status is
 * icon-or-dot + words; tone only reinforces. Words live in messages › status.<domain>.<code>.
 */
export type Tone = "neutral" | "info" | "accent" | "warning" | "success" | "danger" | "outline";
export type Glyph = "dot" | "pencil" | "mail" | "eye" | "clock" | "check" | "alert" | "x";
export type StatusDef = { tone: Tone; glyph: Glyph; struck?: boolean };

export const STATUS = {
  invoice: {
    draft: { tone: "neutral", glyph: "pencil" },
    sent: { tone: "info", glyph: "mail" },
    viewed: { tone: "info", glyph: "eye" },
    partially_paid: { tone: "warning", glyph: "clock" },
    paid: { tone: "success", glyph: "check" },
    overdue: { tone: "danger", glyph: "alert" },
    void: { tone: "neutral", glyph: "x", struck: true },
  },
  quotation: {
    draft: { tone: "neutral", glyph: "pencil" },
    sent: { tone: "info", glyph: "mail" },
    accepted: { tone: "success", glyph: "check" },
    declined: { tone: "danger", glyph: "x" },
    expired: { tone: "neutral", glyph: "clock" },
  },
  payment: {
    received: { tone: "success", glyph: "check" },
    pending: { tone: "warning", glyph: "clock" },
    failed: { tone: "danger", glyph: "alert" },
    refunded: { tone: "neutral", glyph: "x" },
  },
  lead: {
    new: { tone: "neutral", glyph: "dot" },
    contacted: { tone: "info", glyph: "dot" },
    proposal_sent: { tone: "accent", glyph: "dot" },
    negotiation: { tone: "warning", glyph: "dot" },
    won: { tone: "success", glyph: "check" },
    lost: { tone: "danger", glyph: "x" },
  },
  project: {
    planning: { tone: "neutral", glyph: "dot" },
    active: { tone: "accent", glyph: "dot" },
    on_hold: { tone: "warning", glyph: "dot" },
    at_risk: { tone: "danger", glyph: "dot" },
    completed: { tone: "success", glyph: "check" },
    archived: { tone: "outline", glyph: "dot" },
  },
  client: {
    active: { tone: "success", glyph: "dot" },
    prospect: { tone: "info", glyph: "dot" },
    inactive: { tone: "outline", glyph: "dot" },
  },
  task: {
    todo: { tone: "neutral", glyph: "dot" },
    in_progress: { tone: "accent", glyph: "dot" },
    in_review: { tone: "info", glyph: "dot" },
    blocked: { tone: "danger", glyph: "alert" },
    done: { tone: "success", glyph: "check" },
  },
  milestone: {
    pending: { tone: "neutral", glyph: "dot" },
    in_progress: { tone: "accent", glyph: "dot" },
    completed: { tone: "success", glyph: "check" },
  },
} as const satisfies Record<string, Record<string, StatusDef>>;

export type StatusDomain = keyof typeof STATUS;
export type StatusCode<D extends StatusDomain> = keyof (typeof STATUS)[D] & string;

/** Lead stages in pipeline order; the first four are "open". */
export const LEAD_STAGES = ["new", "contacted", "proposal_sent", "negotiation", "won", "lost"] as const;
export const OPEN_LEAD_STAGES = ["new", "contacted", "proposal_sent", "negotiation"] as const;

export function statusDef(domain: StatusDomain, code: string): StatusDef {
  const table = STATUS[domain] as Record<string, StatusDef>;
  return table[code] ?? { tone: "neutral", glyph: "dot" };
}
