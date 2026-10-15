import { z } from "zod";
import { CURRENCIES } from "@/components/clients/schema";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: "tooLong" })
    .transform((v) => v || null);

/** Company details printed on quotations and invoices (DS › InvoiceDocument header and legal footer). */
export const workspaceSchema = z.object({
  name: z.string().trim().min(1, { message: "required" }).max(120, { message: "tooLong" }),
  address: text(240),
  defaultCurrency: z.enum(CURRENCIES),
  defaultDocumentLanguage: z.enum(["en", "fr", "ar"]),
  nif: text(30),
  rc: text(30),
  nis: text(30),
  ai: text(30),
  iban: z
    .string()
    .trim()
    .max(40, { message: "tooLong" })
    .refine((v) => v === "" || /^[A-Za-z]{2}[0-9A-Za-z ]{10,}$/.test(v), { message: "iban" })
    .transform((v) => v.replace(/\s+/g, " ").toUpperCase() || null),
});
export type WorkspaceField = keyof z.input<typeof workspaceSchema>;

export const profileSchema = z.object({
  name: z.string().trim().min(1, { message: "required" }).max(80, { message: "tooLong" }),
});

export function settingsErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = ["required", "tooLong", "iban"].includes(issue.message) ? issue.message : "invalid";
  }
  return out;
}
