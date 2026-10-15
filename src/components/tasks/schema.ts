import { z } from "zod";

export const TASK_FORM_STATUSES = ["todo", "in_progress", "in_review", "blocked", "done"] as const;
export const TASK_PRIORITY_LEVELS = ["urgent", "high", "medium", "low"] as const;

const isoDay = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "date" })
  .transform((v) => v || null);

/** Quick-create / edit task. Codes map to messages › tasks.errors. */
export const taskFormSchema = z.object({
  title: z.string().trim().min(1, { message: "required" }).max(200, { message: "tooLong" }),
  projectId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
  status: z.enum(TASK_FORM_STATUSES),
  priority: z.enum(TASK_PRIORITY_LEVELS),
  dueDate: isoDay,
  assigneeId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
});

export type TaskField = keyof z.input<typeof taskFormSchema>;
export type TaskFormValues = Record<TaskField, string>;
export type TaskFieldErrors = Partial<Record<TaskField, string>>;

const CODES = new Set(["required", "tooLong", "date", "invalid"]);
export function taskFieldErrors(error: z.ZodError): TaskFieldErrors {
  const out: TaskFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as TaskField | undefined;
    if (key && !out[key]) out[key] = CODES.has(issue.message) ? issue.message : "invalid";
  }
  return out;
}

export function emptyTaskValues(o: Partial<TaskFormValues>): TaskFormValues {
  return { title: "", projectId: "", status: "todo", priority: "medium", dueDate: "", assigneeId: "", ...o };
}

/** Calendar helpers on local dates, as YYYY-MM-DD. */
export function isoLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
/** Days from `today` to the coming Sunday (0 on Sunday): the end of "This week" (ISO weeks, Mon–Sun). */
export const daysToWeekEnd = (today: Date) => (7 - today.getDay()) % 7;
/** Next Monday (always in the future). */
export const nextMonday = (today: Date) => addDays(today, ((8 - today.getDay()) % 7) || 7);

export type DueBucket = "overdue" | "today" | "week" | "later" | "none";
/** DS › Tasks grouping by due: Overdue · Today · This week · Later · No date. */
export function dueBucket(dueDate: string | null, today: Date): DueBucket {
  if (!dueDate) return "none";
  const t = isoLocal(today);
  if (dueDate < t) return "overdue";
  if (dueDate === t) return "today";
  return dueDate <= isoLocal(addDays(today, daysToWeekEnd(today))) ? "week" : "later";
}
