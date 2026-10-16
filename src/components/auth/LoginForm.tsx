"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { login, type LoginState } from "./actions";
import { AuthNotice } from "./AuthCard";
import { PasswordInput } from "./PasswordInput";

const INITIAL: LoginState = { error: null, email: "" };

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(login, INITIAL);
  const password = useRef<HTMLInputElement>(null);

  // A failed attempt clears and focuses the password so the next try starts there.
  useEffect(() => {
    if (state.error && state.error !== "missing" && password.current) {
      password.current.value = "";
      password.current.focus();
    }
  }, [state]);

  const message = state.error ? t(`error_${state.error}`) : null;
  const described = message ? "login-error" : undefined;

  return (
    <form action={action} className="login-form">
      {message && (
        <AuthNotice tone="error" id="login-error">
          {message}
        </AuthNotice>
      )}
      {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
      <div className="ax-field">
        <label className="ax-label" htmlFor="login-email">
          {t("email")}
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          className="ax-input"
          autoComplete="username"
          dir="ltr"
          required
          autoFocus
          defaultValue={state.email}
          aria-invalid={message ? true : undefined}
          aria-describedby={described}
        />
      </div>
      <div className="ax-field">
        <div className="login-label-row">
          <label className="ax-label" htmlFor="login-password">
            {t("password")}
          </label>
          <Link href="/forgot-password" className="login-link">
            {t("forgotLink")}
          </Link>
        </div>
        <PasswordInput
          ref={password}
          id="login-password"
          name="password"
          autoComplete="current-password"
          required
          invalid={Boolean(message)}
          aria-describedby={described}
        />
      </div>
      <button type="submit" className="ax-btn ax-btn-primary login-submit" disabled={pending}>
        {pending ? t("signingIn") : t("signIn")}
      </button>
    </form>
  );
}
