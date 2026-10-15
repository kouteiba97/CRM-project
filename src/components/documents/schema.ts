import { z } from "zod";
import { CURRENCIES } from "@/components/clients/schema";
import { parseAmount } from "@/components/leads/schema";
import { parsePercent, parseQuantity } from "@/lib/documents";

export const PAYMENT_METHODS = ["bank_transfer", "cash", "cheque", "card", "other"] as const;

const isoDay = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "date" });

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: "tooLong" })
    .transform((v) => v || null);

export const lineSchema = z.object({
  title: z.string().trim().min(1, { message: "required" }).max(200, { message: "tooLong" }),
  detail: text(300),
  quantity: z
    .string()
    .refine((v) => parseQuantity(v) !== null, { message: "quantity" })
    .transform((v) => parseQuantity(v)!),
  unit: text(20),
  unitPrice: z
    .string()
    .refine((v) => v.trim() !== "" && parseAmount(v) !== null, { message: "amount" })
    .transform((v) => parseAmount(v)!),
  taxRate: z
    .string()
    .refine((v) => parsePercent(v) !== null, { message: "percent" })
    .transform((v) => parsePercent(v)!),
});

/**
 * Quotation / invoice editor. Codes map to messages › documents.errors; line errors are reported as
 * `lines.<index>.<field>` so the editor can mark the exact cell.
 */
export const documentSchema = z
  .object({
    kind: z.enum(["invoice", "quotation"]),
    clientId: z.union([z.uuid(), z.literal("")]).refine((v) => v !== "", { message: "client" }),
    projectId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
    issueDate: isoDay.refine((v) => v !== "", { message: "required" }),
    endDate: isoDay.transform((v) => v || null),
    currency: z.enum(CURRENCIES),
    language: z.enum(["en", "fr", "ar"]),
    discountPct: z
      .string()
      .refine((v) => parsePercent(v) !== null, { message: "percent" })
      .transform((v) => parsePercent(v)!),
    notes: text(2000),
    terms: text(2000),
    milestoneId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
    leadId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
    lines: z.array(lineSchema).min(1, { message: "noLines" }).max(100),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "invoice" && !v.endDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "required" });
    if (v.endDate && v.endDate < v.issueDate)
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "beforeIssue" });
  });

export type DocumentInput = z.input<typeof documentSchema>;
export type LineDraft = z.input<typeof lineSchema> & { key: string };
export type DocErrors = Record<string, string>;

const CODES = new Set(["required", "tooLong", "date", "client", "quantity", "amount", "percent", "noLines", "beforeIssue"]);
export function documentErrors(error: z.ZodError): DocErrors {
  const out: DocErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !out[key]) out[key] = CODES.has(issue.message) ? issue.message : "invalid";
    if (!key) out.form = "invalid";
  }
  return out;
}

export const paymentSchema = z.object({
  amount: z
    .string()
    .refine((v) => {
      const n = parseAmount(v);
      return n !== null && n > 0;
    }, { message: "amount" })
    .transform((v) => parseAmount(v)!),
  paidOn: z.iso.date({ message: "date" }),
  method: z.enum(PAYMENT_METHODS),
  reference: text(80),
  key: z.string().min(8).max(80),
});

export const sendSchema = z.object({
  recipient: z.email({ message: "email" }),
  subject: z.string().trim().min(1, { message: "required" }).max(200),
  message: z.string().trim().max(5000),
});
