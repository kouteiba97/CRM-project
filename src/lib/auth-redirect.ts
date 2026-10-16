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
  if (authPage(raw)) return home;
  return raw;
}

/** Pages for signed-out visitors (and the email links), which need no session. */
export const PUBLIC_PAGES = ["login", "signup", "forgot-password", "reset-password", "verify-email"] as const;
/** Of those, the ones a signed-in user has no reason to see. */
export const GUEST_ONLY = ["login", "signup", "forgot-password"] as const;

/** Which public page a path is, if any (`/fr/login?x` → "login"). */
export function authPage(path: string): (typeof PUBLIC_PAGES)[number] | null {
  const m = /^\/[a-z]{2}\/([a-z-]+)\/?(?:[?#]|$)/.exec(path);
  const page = m?.[1] ?? "";
  return (PUBLIC_PAGES as readonly string[]).includes(page) ? (page as (typeof PUBLIC_PAGES)[number]) : null;
}

/** The locale segment of a path, if it has one. */
export function localeOf(pathname: string): Locale | null {
  const segment = pathname.split("/")[1] ?? "";
  return (LOCALES as readonly string[]).includes(segment) ? (segment as Locale) : null;
}
