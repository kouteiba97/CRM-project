import { z } from "zod";

export const CURRENCIES = ["EUR", "DZD", "USD"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: "tooLong" })
    .transform((v) => v || null);

const optionalEmail = z
  .string()
  .trim()
  .max(200, { message: "tooLong" })
  .refine((v) => v === "" || z.email().safeParse(v).success, { message: "email" })
  .transform((v) => v || null);

const optionalPhone = z
  .string()
  .trim()
  .max(40, { message: "tooLong" })
  .refine((v) => v === "" || /^\+?[0-9 ().-]{6,}$/.test(v), { message: "phone" })
  .transform((v) => v || null);

/**
 * New client + its primary contact. Messages are codes (`required`, `email`…) that the drawer
 * turns into words via messages › clients.errors, so the same schema runs in the browser and the action.
 */
export const newClientSchema = z.object({
  name: z.string().trim().min(1, { message: "required" }).max(120, { message: "tooLong" }),
  kind: z.enum(["company", "individual"]),
  status: z.enum(["active", "prospect", "inactive"]),
  email: optionalEmail,
  phone: optionalPhone,
  city: optionalText(80),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^[A-Z]{2}$/.test(v), { message: "country" })
    .transform((v) => v || null),
  currency: z.enum(CURRENCIES),
  documentLanguage: z.enum(["en", "fr", "ar"]),
  ownerId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
  tags: z
    .string()
    .max(300, { message: "tooLong" })
    .transform((v) =>
      Array.from(new Set(v.split(",").map((t) => t.trim()).filter(Boolean))).slice(0, 10),
    ),
  contactFirstName: z.string().trim().min(1, { message: "required" }).max(80, { message: "tooLong" }),
  contactLastName: optionalText(80),
  contactJobTitle: optionalText(80),
  contactEmail: optionalEmail,
  contactPhone: optionalPhone,
});

export type NewClientInput = z.input<typeof newClientSchema>;
export type NewClientField = keyof NewClientInput;
export type FieldErrors = Partial<Record<NewClientField, string>>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as NewClientField | undefined;
    if (key && !out[key]) out[key] = issue.message in ERROR_CODES ? issue.message : "invalid";
  }
  return out;
}

const ERROR_CODES = { required: 1, email: 1, phone: 1, tooLong: 1, country: 1, invalid: 1 } as const;
