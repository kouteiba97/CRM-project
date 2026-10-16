"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { describedBy, Field } from "@/components/ui/FormDrawer";
import { acceptInvite, signupFromInvite, type InviteSignupState } from "@/components/settings/team-actions";
import { logout } from "./actions";
import { AuthNotice } from "./AuthCard";
import { PasswordInput } from "./PasswordInput";

export function AcceptInvite({ token, workspace }: { token: string; workspace: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="login-form">
      {error && <AuthNotice tone="error">{t("invite_expired")}</AuthNotice>}
      <button
        type="button"
        className="ax-btn ax-btn-primary login-submit"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await acceptInvite(token);
            if (!res.ok) return setError(res.error);
            router.push("/");
            router.refresh();
          })
        }
      >
        {t("invite_join", { workspace })}
      </button>
    </div>
  );
}

export function SignOutToAccept() {
  const t = useTranslations("auth");
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="ax-btn ax-btn-secondary login-submit"
      disabled={pending}
      onClick={() => start(() => logout())}
    >
      {t("invite_sign_out")}
    </button>
  );
}

const INITIAL: InviteSignupState = { error: null, name: "" };

/** No account yet for the invited address: name + password, and you're in. */
export function InviteSignupForm({ token, email }: { token: string; email: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(signupFromInvite, INITIAL);
  const nameErr = state.error === "name" ? t("signup_name_required") : null;
  const pwErr = state.error === "password" ? t("signup_password_too_short") : null;
  return (
    <form action={action} className="login-form" noValidate>
      {state.error === "expired" && <AuthNotice tone="error">{t("invite_expired")}</AuthNotice>}
      {state.error === "taken" && <AuthNotice tone="error">{t("signup_email_taken")}</AuthNotice>}
      <input type="hidden" name="token" value={token} />
      <Field id="inv-email-ro" label={t("email")} optionalLabel="">
        <input id="inv-email-ro" className="ax-input" dir="ltr" value={email} readOnly autoComplete="username" />
      </Field>
      <Field id="inv-name" label={t("name")} required error={nameErr} optionalLabel="">
        <input
          id="inv-name"
          name="name"
          className="ax-input"
          autoComplete="name"
          autoFocus
          maxLength={100}
          defaultValue={state.name}
          aria-invalid={nameErr ? true : undefined}
          aria-describedby={describedBy("inv-name", nameErr)}
        />
      </Field>
      <Field id="inv-password" label={t("password")} required error={pwErr} help={t("passwordHelp")} optionalLabel="">
        <PasswordInput
          id="inv-password"
          name="password"
          autoComplete="new-password"
          maxLength={200}
          invalid={Boolean(pwErr)}
          aria-describedby={describedBy("inv-password", pwErr, t("passwordHelp"))}
        />
      </Field>
      <button type="submit" className="ax-btn ax-btn-primary login-submit" disabled={pending}>
        {pending ? t("creating") : t("invite_create_join")}
      </button>
    </form>
  );
}
