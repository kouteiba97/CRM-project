/** Pure date maths for repeating invoices (no server imports, unit-tested). */
export type Interval = "monthly" | "quarterly" | "yearly";
const MONTHS: Record<Interval, number> = { monthly: 1, quarterly: 3, yearly: 12 };

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Adds one interval to an ISO date, keeping the day of month when it exists and otherwise using
 * the month's last day (31 Jan + 1 month = 28/29 Feb).
 */
export function addInterval(iso: string, interval: Interval, times = 1) {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const total = m - 1 + MONTHS[interval] * times;
  const year = y + Math.floor(total / 12);
  const month = (total % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(d, last))}`;
}

/** Days between two ISO dates (b − a). */
export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function addDays(iso: string, days: number) {
  const t = new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
