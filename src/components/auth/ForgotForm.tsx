"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { describedBy, Field } from "@/components/ui/FormDrawer";
import { forgotPassword, type ForgotState } from "./actions";
import { AuthNotice } from "./AuthCard";

const INITIAL: ForgotState = { sent: false, email: "", error: null };

export function ForgotForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(forgotPassword, INITIAL);

  if (state.sent) {
    return (
      <div className="login-form">
        <AuthNotice tone="success">
          {t.rich("forgot_sent", { email: state.email, b: (c) => <b dir="ltr">{c}</b> })}
        </AuthNotice>
        <p className="login-lead">{t("forgot_sent_help")}</p>
        <form action={action}>
          <input type="hidden" name="email" value={state.email} />
          <button type="submit" className="ax-btn ax-btn-secondary login-submit" disabled={pending}>
            {t("forgot_resend")}
          </button>
        </form>
      </div>
    );
  }

  const error =
    state.error === "invalid" ? t("signup_email_invalid") : state.error === "mail" ? t("error_mail") : null;

  return (
    <form action={action} className="login-form" noValidate>
      {state.error === "mail" && <AuthNotice tone="error">{error}</AuthNotice>}
      <Field
        id="forgot-email"
        label={t("email")}
        required
        error={state.error === "invalid" ? error : null}
        optionalLabel={t("optional")}
      >
        <input
          id="forgot-email"
          name="email"
          type="email"
          dir="ltr"
          className="ax-input"
          autoComplete="email"
          autoFocus
          defaultValue={state.email}
          aria-invalid={state.error === "invalid" ? true : undefined}
          aria-describedby={describedBy("forgot-email", state.error === "invalid" ? error : null)}
        />
      </Field>
      <button type="submit" className="ax-btn ax-btn-primary login-submit" disabled={pending}>
        {pending ? t("sending") : t("forgot_submit")}
      </button>
    </form>
  );
}
