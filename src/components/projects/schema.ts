import { z } from "zod";
import { CURRENCIES } from "@/components/clients/schema";
import { parseAmount } from "@/components/leads/schema";

export const PROJECT_FORM_STATUSES = ["planning", "active", "on_hold", "at_risk", "completed"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: "tooLong" })
    .transform((v) => v || null);

const isoDay = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "date" })
  .transform((v) => v || null);

const amount = z
  .string()
  .trim()
  .refine((v) => v === "" || parseAmount(v) !== null, { message: "amount" })
  .transform((v) => (v === "" ? null : parseAmount(v)!));

/** New / edit project. A deadline before the start date is refused. Codes map to messages › projects.errors. */
export const projectSchema = z
  .object({
    name: z.string().trim().min(1, { message: "required" }).max(160, { message: "tooLong" }),
    clientId: z.union([z.uuid(), z.literal("")]).refine((v) => v !== "", { message: "client" }),
    status: z.enum(PROJECT_FORM_STATUSES),
    startDate: isoDay,
    deadline: isoDay,
    budget: amount,
    currency: z.enum(CURRENCIES),
    repoUrl: z
      .string()
      .trim()
      .max(300, { message: "tooLong" })
      .refine((v) => v === "" || /^https?:\/\/\S+$/.test(v), { message: "url" })
      .transform((v) => v || null),
    description: optionalText(2000),
    leadId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
  })
  .superRefine((v, ctx) => {
    if (v.startDate && v.deadline && v.deadline < v.startDate)
      ctx.addIssue({ code: "custom", path: ["deadline"], message: "deadlineBeforeStart" });
  });

export type ProjectField = keyof z.input<typeof projectSchema>;
export type ProjectFormValues = Record<ProjectField, string>;
export type ProjectFieldErrors = Partial<Record<ProjectField, string>>;

const CODES = new Set(["required", "tooLong", "date", "amount", "client", "url", "deadlineBeforeStart", "invalid"]);
export function projectFieldErrors(error: z.ZodError): ProjectFieldErrors {
  const out: ProjectFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as ProjectField | undefined;
    if (key && !out[key]) out[key] = CODES.has(issue.message) ? issue.message : "invalid";
  }
  return out;
}

export function emptyProjectValues(o: Partial<ProjectFormValues> & { currency: string }): ProjectFormValues {
  return {
    name: "",
    clientId: "",
    status: "planning",
    startDate: "",
    deadline: "",
    budget: "",
    repoUrl: "",
    description: "",
    leadId: "",
    ...o,
    currency: (CURRENCIES as readonly string[]).includes(o.currency) ? o.currency : "EUR",
  };
}

export const milestoneSchema = z.object({
  title: z.string().trim().min(1, { message: "required" }).max(160, { message: "tooLong" }),
  dueDate: isoDay,
  amount,
});

export const taskSchema = z.object({
  title: z.string().trim().min(1, { message: "required" }).max(200, { message: "tooLong" }),
  dueDate: isoDay,
  priority: z.enum(["urgent", "high", "medium", "low"]),
});
