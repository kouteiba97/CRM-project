/**
 * The only place numbers, money and dates become strings (DS › Languages: never hand-build them).
 * en-GB / fr-FR / ar-DZ, always with Latin digits.
 */
export const LOCALES = ["en", "fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", fr: "fr-FR", ar: "ar-DZ" };
const LATN = { numberingSystem: "latn" } as const;

export const isRtl = (locale: Locale) => locale === "ar";
export const dirOf = (locale: Locale) => (isRtl(locale) ? "rtl" : "ltr");

type DateInput = Date | string | number;
/** Plain `YYYY-MM-DD` strings are calendar dates: read them at local noon so no timezone shifts the day. */
export const toDate = (v: DateInput): Date =>
  v instanceof Date ? v : typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : new Date(v);

const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>();
function cached<T extends Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>(key: string, make: () => T): T {
  let f = cache.get(key) as T | undefined;
  if (!f) {
    f = make();
    cache.set(key, f);
  }
  return f;
}

/** Money in minor units → "€4,800.00" / "4 800,00 €" / "4.800,00 €". `whole` rounds to units (KPIs). */
export function money(
  locale: Locale,
  minor: number,
  currency: string,
  opts: { whole?: boolean; compact?: boolean } = {},
): string {
  const digits = opts.whole || opts.compact ? 0 : 2;
  const key = `m|${locale}|${currency}|${digits}|${opts.compact ? 1 : 0}`;
  const f = cached(
    key,
    () =>
      new Intl.NumberFormat(INTL_LOCALE[locale], {
        ...LATN,
        style: "currency",
        currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: opts.compact ? 1 : digits,
        ...(opts.compact ? { notation: "compact" as const } : {}),
      }),
  );
  const symbol = SYMBOL_OVERRIDE[locale]?.[currency];
  if (!symbol) return f.format(minor / 100);
  return f
    .formatToParts(minor / 100)
    .map((p) => (p.type === "currency" ? symbol : p.value))
    .join("");
}

/**
 * fr-FR prints the dinar as "DZD", but Algerian French documents (and the DS Languages table)
 * use "DA" — the symbol fr-DZ produces. Grouping and decimals still come from fr-FR.
 */
const SYMBOL_OVERRIDE: Partial<Record<Locale, Record<string, string>>> = { fr: { DZD: "DA" } };

/** Abbreviated axis value without currency: 14k, 1.2M. */
export function compactNumber(locale: Locale, value: number): string {
  return cached(
    `c|${locale}`,
    () => new Intl.NumberFormat(INTL_LOCALE[locale], { ...LATN, notation: "compact", maximumFractionDigits: 1 }),
  ).format(value);
}

export function number(locale: Locale, value: number, fractionDigits = 0): string {
  return cached(
    `n|${locale}|${fractionDigits}`,
    () =>
      new Intl.NumberFormat(INTL_LOCALE[locale], {
        ...LATN,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }),
  ).format(value);
}

/** 0.12 → "12%"; `signed` → "+12%" / "−8%" (deltas always carry a sign). */
export function percent(locale: Locale, ratio: number, signed = false): string {
  return cached(
    `p|${locale}|${signed ? 1 : 0}`,
    () =>
      new Intl.NumberFormat(INTL_LOCALE[locale], {
        ...LATN,
        style: "percent",
        maximumFractionDigits: 0,
        ...(signed ? { signDisplay: "exceptZero" as const } : {}),
      }),
  ).format(ratio);
}

const DATE_STYLES = {
  /** 14 Oct 2026 · 14 oct. 2026 · 14 أكتوبر 2026 */
  medium: { day: "numeric", month: "short", year: "numeric" },
  /** 14 Oct */
  short: { day: "numeric", month: "short" },
  /** Wed 14 Oct 2026 */
  weekday: { weekday: "short", day: "numeric", month: "short", year: "numeric" },
  /** Oct */
  month: { month: "short" },
  /** 14 */
  day: { day: "numeric" },
  /** October 2026 */
  monthYear: { month: "long", year: "numeric" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;
export type DateStyle = keyof typeof DATE_STYLES;

export function date(locale: Locale, value: DateInput, style: DateStyle = "medium"): string {
  return cached(
    `d|${locale}|${style}`,
    () => new Intl.DateTimeFormat(INTL_LOCALE[locale], { ...LATN, ...DATE_STYLES[style] }),
  ).format(toDate(value));
}

/** 24h clock: 14:32 */
export function time(locale: Locale, value: DateInput): string {
  return cached(
    `t|${locale}`,
    () =>
      new Intl.DateTimeFormat(INTL_LOCALE[locale], { ...LATN, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  ).format(toDate(value));
}

const startOfDay = (v: Date) => {
  const x = new Date(v);
  x.setHours(0, 0, 0, 0);
  return x;
};
/** Whole calendar days from `now` to `value` (negative = past). */
export function dayDiff(value: DateInput, now: Date = new Date()): number {
  return Math.round((startOfDay(toDate(value)).getTime() - startOfDay(now).getTime()) / 86_400_000);
}

/**
 * Relative date ("3 days ago", "tomorrow") only within ±7 days; otherwise null so callers
 * fall back to the absolute date. Always show the absolute date in a tooltip.
 */
export function relativeDay(locale: Locale, value: DateInput, now: Date = new Date()): string | null {
  const diff = dayDiff(value, now);
  if (Math.abs(diff) > 7) return null;
  return cached(
    `r|${locale}`,
    () => new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { ...LATN, numeric: "auto" }),
  ).format(diff, "day");
}

/** Relative time for activity feeds: "2 hours ago", "3 days ago". */
export function relativeTime(locale: Locale, value: DateInput, now: Date = new Date()): string {
  const rtf = cached(
    `rt|${locale}`,
    () => new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { ...LATN, numeric: "auto" }),
  );
  const seconds = Math.round((toDate(value).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), "hour");
  return rtf.format(dayDiff(value, now), "day");
}

/** Convenience bundle bound to one locale. */
export function formatter(locale: Locale) {
  return {
    locale,
    money: (minor: number, currency: string, o?: { whole?: boolean; compact?: boolean }) =>
      money(locale, minor, currency, o),
    compact: (v: number) => compactNumber(locale, v),
    number: (v: number, f?: number) => number(locale, v, f),
    percent: (r: number, signed?: boolean) => percent(locale, r, signed),
    date: (v: DateInput, s?: DateStyle) => date(locale, v, s),
    time: (v: DateInput) => time(locale, v),
    relativeDay: (v: DateInput, now?: Date) => relativeDay(locale, v, now),
    relativeTime: (v: DateInput, now?: Date) => relativeTime(locale, v, now),
  };
}
export type Formatter = ReturnType<typeof formatter>;
