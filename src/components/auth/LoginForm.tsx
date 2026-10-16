"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { describedBy, Field } from "@/components/ui/FormDrawer";
import { login, type LoginState } from "./actions";
import { AuthNotice } from "./AuthCard";
import { PasswordInput } from "./PasswordInput";

const INITIAL: LoginState = { error: null, needsCode: false, email: "" };

/**
 * Email + password, then — for accounts with two-step login — the authenticator code. What was
 * typed in the first round is remembered (not shown) so the second round can send it again.
 */
export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(login, INITIAL);
  const [sent, setSent] = useState({ email: "", password: "" });
  // "Back" from the code step dismisses that particular result.
  const [dismissed, setDismissed] = useState<LoginState | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const codeStep = state.needsCode && dismissed !== state;

  useEffect(() => {
    if (state.needsCode) codeRef.current?.focus();
    // A failed attempt (the form reset cleared the password) starts again at the password.
    else if (state.error && state.error !== "missing") passwordRef.current?.focus();
  }, [state]);

  const submit = (fd: FormData) => {
    if (!codeStep) setSent({ email: String(fd.get("email") ?? ""), password: String(fd.get("password") ?? "") });
    action(fd);
  };

  if (codeStep) {
    const codeError = state.error === "2fa_invalid" ? t("error_2fa_invalid") : null;
    return (
      <form action={submit} className="login-form" noValidate>
        {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
        <input type="hidden" name="email" value={sent.email} />
        <input type="hidden" name="password" value={sent.password} />
        <p className="login-lead">{t("code_lead")}</p>
        <Field id="login-code" label={t("code_label")} required error={codeError} help={t("code_help")} optionalLabel="">
          <input
            ref={codeRef}
            id="login-code"
            name="code"
            className="ax-input login-code"
            autoComplete="one-time-code"
            dir="ltr"
            maxLength={40}
            autoFocus
            aria-invalid={codeError ? true : undefined}
            aria-describedby={describedBy("login-code", codeError, t("code_help"))}
          />
        </Field>
        <button type="submit" className="ax-btn ax-btn-primary login-submit" disabled={pending}>
          {pending ? t("signingIn") : t("code_submit")}
        </button>
        <button type="button" className="ax-btn ax-btn-tertiary login-submit" onClick={() => setDismissed(state)}>
          {t("code_back")}
        </button>
      </form>
    );
  }

  const message = state.error && state.error !== "2fa_invalid" ? t(`error_${state.error}`) : null;
  const described = message ? "login-error" : undefined;

  return (
    <form action={submit} className="login-form">
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
          ref={passwordRef}
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
