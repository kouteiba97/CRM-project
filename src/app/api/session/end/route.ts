import type { NextRequest } from "next/server";
import { signOut } from "@/auth";
import { localeOf } from "@/lib/auth-redirect";

/** Clears a session cookie the server no longer accepts, then shows the login page. */
export async function GET(req: NextRequest) {
  const locale = localeOf(`/${req.nextUrl.searchParams.get("locale") ?? ""}`) ?? "fr";
  await signOut({ redirectTo: `/${locale}/login?expired=1` });
}
