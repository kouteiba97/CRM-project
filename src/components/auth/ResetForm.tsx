"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { describedBy, Field } from "@/components/ui/FormDrawer";
import { resetPassword, type ResetState } from "./actions";
import { AuthNotice } from "./AuthCard";
import { PasswordInput } from "./PasswordInput";

const INITIAL: ResetState = { error: null };

export function ResetForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(resetPassword, INITIAL);
  const first = useRef<HTMLInputElement>(null);
  const confirm = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.error === "mismatch") confirm.current?.focus();
    else if (state.error === "too_short") first.current?.focus();
  }, [state]);

  if (state.error === "expired") {
    return (
      <div className="login-form">
        <AuthNotice tone="error">{t("reset_expired")}</AuthNotice>
        <Link href="/forgot-password" className="ax-btn ax-btn-primary login-submit">
          {t("reset_new_link")}
        </Link>
      </div>
    );
  }

  const pwError = state.error === "too_short" ? t("signup_password_too_short") : null;
  const confirmError = state.error === "mismatch" ? t("reset_mismatch") : null;

  return (
    <form action={action} className="login-form" noValidate>
      <input type="hidden" name="token" value={token} />
      <Field
        id="reset-password"
        label={t("newPassword")}
        required
        error={pwError}
        help={t("passwordHelp")}
        optionalLabel={t("optional")}
      >
        <PasswordInput
          ref={first}
          id="reset-password"
          name="password"
          autoComplete="new-password"
          autoFocus
          maxLength={200}
          invalid={Boolean(pwError)}
          aria-describedby={describedBy("reset-password", pwError, t("passwordHelp"))}
        />
      </Field>
      <Field id="reset-confirm" label={t("confirmPassword")} required error={confirmError} optionalLabel={t("optional")}>
        <PasswordInput
          ref={confirm}
          id="reset-confirm"
          name="confirm"
          autoComplete="new-password"
          maxLength={200}
          invalid={Boolean(confirmError)}
          aria-describedby={describedBy("reset-confirm", confirmError)}
        />
      </Field>
      <button type="submit" className="ax-btn ax-btn-primary login-submit" disabled={pending}>
        {pending ? t("saving") : t("reset_submit")}
      </button>
    </form>
  );
}
