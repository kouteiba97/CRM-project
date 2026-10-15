import "server-only";
import { getTranslations } from "next-intl/server";
import type { workspaces } from "@/db/schema";
import { documentTotals } from "@/lib/documents";
import { LOCALES, type Locale } from "@/lib/format";
import type { DocData, DocLabels, DocParty } from "./DocumentView";

const KEYS = [
  "invoice",
  "quotation",
  "issued",
  "due",
  "validUntil",
  "billedTo",
  "from",
  "project",
  "paymentDetails",
  "reference",
  "description",
  "qty",
  "unit",
  "rate",
  "amount",
  "subtotal",
  "discount",
  "tax",
  "total",
  "paidToDate",
  "amountDue",
  "terms",
  "notes",
  "legal",
  "draftWatermark",
] as const;

/** Document labels in `language` (not the UI language), with status stamps in the fixed vocabulary. */
export async function getDocLabels(language: Locale): Promise<DocLabels> {
  const t = await getTranslations({ locale: language, namespace: "document" });
  const ti = await getTranslations({ locale: language, namespace: "status.invoice" });
  const tq = await getTranslations({ locale: language, namespace: "status.quotation" });
  const labels = Object.fromEntries(KEYS.map((k) => [k, t(k)])) as Omit<DocLabels, "stamps">;
  return {
    ...labels,
    stamps: {
      draft: ti("draft"),
      paid: ti("paid"),
      partially_paid: ti("partially_paid"),
      overdue: ti("overdue"),
      void: ti("void"),
      accepted: tq("accepted"),
      declined: tq("declined"),
      expired: tq("expired"),
    },
  };
}

/** Labels for every language, for the editor's live preview (the client may switch the document language). */
export async function getAllDocLabels() {
  const entries = await Promise.all(LOCALES.map(async (l) => [l, await getDocLabels(l)] as const));
  return Object.fromEntries(entries) as Record<Locale, DocLabels>;
}

export const asLocale = (v: string | null | undefined, fallback: Locale = "fr"): Locale =>
  (LOCALES as readonly string[]).includes(v ?? "") ? (v as Locale) : fallback;

export type Workspace = typeof workspaces.$inferSelect;

export function fromParty(ws: Workspace): DocParty {
  return {
    name: ws.name,
    lines: [ws.address],
    ids: [
      ["NIF", ws.nif],
      ["RC", ws.rc],
      ["NIS", ws.nis],
      ["AI", ws.ai],
    ],
  };
}

export function toParty(c: {
  clientName: string;
  clientAddress: string | null;
  clientCity: string | null;
  clientCountry: string | null;
  clientEmail: string | null;
  clientNif: string | null;
  clientRc: string | null;
}): DocParty {
  return {
    name: c.clientName,
    lines: [c.clientAddress, [c.clientCity, c.clientCountry].filter(Boolean).join(", ") || null, c.clientEmail],
    ids: [
      ["NIF", c.clientNif],
      ["RC", c.clientRc],
    ],
  };
}

type StoredLine = { title: string; detail: string | null; quantity: string; unit: string | null; unitPriceMinor: number; taxRate: string; amountMinor: number };

/** Stored lines → document lines + totals (recomputed, so rates and discount always agree with the lines). */
export function linesAndTotals(lines: StoredLine[], discountPct: string | null) {
  const parsed = lines.map((l) => ({
    title: l.title,
    detail: l.detail,
    quantity: Number(l.quantity),
    unit: l.unit,
    unitPriceMinor: l.unitPriceMinor,
    taxRate: Number(l.taxRate),
    amountMinor: l.amountMinor,
  }));
  const pct = Number(discountPct ?? 0);
  const totals = documentTotals(parsed, pct);
  return {
    lines: parsed,
    discountPct: pct,
    subtotalMinor: totals.subtotalMinor,
    discountMinor: totals.discountMinor,
    taxMinor: totals.taxMinor,
    taxRates: totals.rates,
    totalMinor: totals.totalMinor,
  } satisfies Partial<DocData>;
}
