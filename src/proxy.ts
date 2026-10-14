import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Locale negotiation: URL segment → NEXT_LOCALE cookie → Accept-Language → French.
export default createMiddleware(routing);

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
