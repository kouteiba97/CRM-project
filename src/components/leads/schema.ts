import { z } from "zod";
import { CURRENCIES } from "@/components/clients/schema";

export const OPEN_STAGES = ["new", "contacted", "proposal_sent", "negotiation"] as const;
export const PRIORITY_LEVELS = ["urgent", "high", "medium", "low"] as const;
export const LOST_REASONS = ["budget", "timing", "competitor", "no_response", "scope", "other"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: "tooLong" })
    .transform((v) => v || null);

/** "4 800,50" / "4,800.50" / "4800.5" → minor units. Grouping spaces and the decimal comma are accepted. */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/[\s  ]/g, "");
  if (!s) return null;
  // The last "," or "." followed by 1–2 digits is the decimal separator; any other is grouping.
  const m = s.match(/^(\d{1,3}(?:[.,]?\d{3})*|\d+)(?:[.,](\d{1,2}))?$/);
  if (!m) return null;
  const whole = m[1]!.replace(/[.,]/g, "");
  const frac = (m[2] ?? "").padEnd(2, "0");
  return Number(whole) * 100 + Number(frac || "0");
}

const amount = z
  .string()
  .trim()
  .refine((v) => v === "" || parseAmount(v) !== null, { message: "amount" })
  .transform((v) => (v === "" ? 0 : parseAmount(v)!));

const isoDay = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "date" })
  .transform((v) => v || null);

const isoDateTime = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), { message: "date" })
  .transform((v) => (v ? new Date(v) : null));

/**
 * New / edit lead. Either an existing client or a prospect company is required. Message codes map to
 * messages › leads.errors so the same schema validates in the browser and in the action.
 */
export const leadSchema = z
  .object({
    title: z.string().trim().min(1, { message: "required" }).max(160, { message: "tooLong" }),
    clientId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
    prospectCompany: optionalText(120),
    prospectName: optionalText(120),
    value: amount,
    currency: z.enum(CURRENCIES),
    priority: z.enum(PRIORITY_LEVELS),
    stage: z.enum(OPEN_STAGES),
    expectedCloseDate: isoDay,
    ownerId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
    source: optionalText(80),
    followUpAt: isoDateTime,
    followUpChannel: z.enum(["call", "email", "meeting"]),
  })
  .superRefine((v, ctx) => {
    if (!v.clientId && !v.prospectCompany)
      ctx.addIssue({ code: "custom", path: ["prospectCompany"], message: "prospect" });
  });

export type LeadInput = z.input<typeof leadSchema>;
export type LeadField = keyof LeadInput;
export type LeadFieldErrors = Partial<Record<LeadField, string>>;

const CODES = new Set(["required", "tooLong", "amount", "date", "prospect", "invalid"]);
export function leadFieldErrors(error: z.ZodError): LeadFieldErrors {
  const out: LeadFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as LeadField | undefined;
    if (key && !out[key]) out[key] = CODES.has(issue.message) ? issue.message : "invalid";
  }
  return out;
}

/** Form state: every field as the string the inputs hold. */
export type LeadFormValues = Record<LeadField, string>;

export function emptyLeadValues(o: { currency: string; ownerId: string; stage: string; clientId: string }): LeadFormValues {
  return {
    title: "",
    clientId: o.clientId,
    prospectCompany: "",
    prospectName: "",
    value: "",
    currency: (CURRENCIES as readonly string[]).includes(o.currency) ? o.currency : "EUR",
    priority: "medium",
    stage: o.stage,
    expectedCloseDate: "",
    ownerId: o.ownerId,
    source: "",
    followUpAt: "",
    followUpChannel: "call",
  };
}
