"use server";

import { AuthError } from "next-auth";
import { getLocale } from "next-intl/server";
import { signIn, signOut } from "@/auth";
import { safeCallback } from "@/lib/auth-redirect";
import type { Locale } from "@/lib/format";

export type LoginState = { error: "invalid" | "too_many" | "missing" | null; email: string };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "missing", email };
  const locale = (await getLocale()) as Locale;
  try {
    // Throws Next's redirect on success, which must propagate.
    await signIn("credentials", {
      email,
      password,
      redirectTo: safeCallback(form.get("callbackUrl"), locale),
    });
    return { error: null, email };
  } catch (error) {
    if (error instanceof AuthError) {
      const code = "code" in error && error.code === "too_many" ? "too_many" : "invalid";
      return { error: code, email };
    }
    throw error;
  }
}

export async function logout() {
  await signOut({ redirectTo: `/${await getLocale()}/login` });
}
