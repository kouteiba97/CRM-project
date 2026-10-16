"use client";

import { useActionState, useEffect, useRef } from "react";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { login, type LoginState } from "./actions";

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

  return (
    <form action={action} className="login-form">
      {message && (
        <div className="login-alert" role="alert" id="login-error">
          <CircleAlert className="ax-icon" aria-hidden />
          {message}
        </div>
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
          aria-describedby={message ? "login-error" : undefined}
        />
      </div>
      <div className="ax-field">
        <label className="ax-label" htmlFor="login-password">
          {t("password")}
        </label>
        <input
          ref={password}
          id="login-password"
          name="password"
          type="password"
          className="ax-input"
          autoComplete="current-password"
          dir="ltr"
          required
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? "login-error" : undefined}
        />
      </div>
      <button type="submit" className="ax-btn ax-btn-primary login-submit" disabled={pending}>
        {pending ? t("signingIn") : t("signIn")}
      </button>
    </form>
  );
}
