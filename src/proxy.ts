import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { auth } from "./auth";
import { routing } from "./i18n/routing";
import { authPage, GUEST_ONLY, localeOf } from "./lib/auth-redirect";

// Locale negotiation: URL segment → NEXT_LOCALE cookie → Accept-Language → French.
const intl = createMiddleware(routing);

/**
 * Optimistic auth check from the session cookie only (no database): signed-out visitors go to
 * the login page of their locale, signed-in ones skip login/sign-up. getSession() re-checks.
 */
export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const locale = localeOf(pathname);
  if (locale) {
    // The PDF renderer's view of one document: guarded by a signature, not a session.
    if (pathname.startsWith(`/${locale}/print/`)) return intl(req);
    const page = authPage(pathname);
    if (!req.auth && !page) {
      const url = new URL(`/${locale}/login`, req.url);
      if (pathname !== `/${locale}`) url.searchParams.set("callbackUrl", pathname + search);
      return NextResponse.redirect(url);
    }
    if (req.auth && page && (GUEST_ONLY as readonly string[]).includes(page)) {
      return NextResponse.redirect(new URL(`/${locale}`, req.url));
    }
  }
  return intl(req);
});

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
