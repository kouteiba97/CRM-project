import { defineRouting } from "next-intl/routing";
import { LOCALES } from "@/lib/format";

export const routing = defineRouting({
  locales: LOCALES,
  // DS › Languages: default follows the browser, falling back to French.
  defaultLocale: "fr",
  localePrefix: "always",
  localeCookie: { name: "NEXT_LOCALE", maxAge: 60 * 60 * 24 * 365 },
});
