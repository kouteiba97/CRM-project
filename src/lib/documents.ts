/**
 * Quotation / invoice arithmetic, shared by the editor's live preview and the server (which recomputes
 * on save, so the client is never trusted with totals). All money is integer minor units.
 *
 *   line amount = round(qty × unit price)
 *   discount    = round(subtotal × discount %)
 *   tax         = Σ round(line amount × (1 − discount %) × line tax rate %)
 *   total       = subtotal − discount + tax
 */
export type LineInput = { quantity: number; unitPriceMinor: number; taxRate: number };

export const lineAmount = (l: Pick<LineInput, "quantity" | "unitPriceMinor">) =>
  Math.round(l.quantity * l.unitPriceMinor);

export function documentTotals(lines: LineInput[], discountPct: number) {
  const pct = Math.min(100, Math.max(0, discountPct || 0)) / 100;
  const amounts = lines.map(lineAmount);
  const subtotalMinor = amounts.reduce((a, v) => a + v, 0);
  const discountMinor = Math.round(subtotalMinor * pct);
  const taxMinor = lines.reduce((a, l, i) => a + Math.round(amounts[i]! * (1 - pct) * ((l.taxRate || 0) / 100)), 0);
  // Tax rates in use, for the "Tax (19%)" label; several rates read "Tax".
  const rates = [...new Set(lines.filter((l) => l.taxRate > 0).map((l) => l.taxRate))];
  return { amounts, subtotalMinor, discountMinor, taxMinor, totalMinor: subtotalMinor - discountMinor + taxMinor, rates };
}

/** "2", "1.5", "1,5", "0.125" → number with up to 3 decimals; null when not a non-negative number. */
export function parseQuantity(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(s)) return null;
  return Number(s);
}

/** "19", "9.5", "9,5" → percent 0–100; null otherwise. */
export function parsePercent(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (s === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n <= 100 ? n : null;
}

export type DocumentKind = "invoice" | "quotation";

/** INV-2026-0144 / Q-2026-034 (the format already used by the seeded documents). */
export function documentNumber(kind: DocumentKind, year: number, value: number) {
  return kind === "invoice" ? `INV-${year}-${String(value).padStart(4, "0")}` : `Q-${year}-${String(value).padStart(3, "0")}`;
}
