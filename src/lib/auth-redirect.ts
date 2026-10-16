import { LOCALES, type Locale } from "@/lib/format";

/**
 * Where to go after signing in: only same-site paths inside a locale, never the login page
 * itself, so a crafted `callbackUrl` cannot send the user to another origin.
 */
export function safeCallback(raw: unknown, locale: Locale): string {
  const home = `/${locale}`;
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return home;
  }
  const segment = raw.split(/[/?#]/)[1] ?? "";
  if (!(LOCALES as readonly string[]).includes(segment)) return home;
  if (/^\/[a-z]{2}\/login(?:[/?#]|$)/.test(raw)) return home;
  return raw;
}

/** The locale segment of a path, if it has one. */
export function localeOf(pathname: string): Locale | null {
  const segment = pathname.split("/")[1] ?? "";
  return (LOCALES as readonly string[]).includes(segment) ? (segment as Locale) : null;
}
