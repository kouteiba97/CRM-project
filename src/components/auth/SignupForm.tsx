"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { describedBy, Field } from "@/components/ui/FormDrawer";
import { signup, type SignupState } from "./actions";
import { AuthNotice } from "./AuthCard";
import { PasswordInput } from "./PasswordInput";

const INITIAL: SignupState = { errors: {}, values: { name: "", email: "", company: "" } };
const ORDER = ["name", "email", "password", "company"] as const;

export function SignupForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(signup, INITIAL);
  const form = useRef<HTMLFormElement>(null);

  // Focus the first field with an error after each failed submit.
  useEffect(() => {
    const first = ORDER.find((k) => state.errors[k]);
    if (first) form.current?.querySelector<HTMLInputElement>(`#signup-${first}`)?.focus();
  }, [state]);

  const err = (k: (typeof ORDER)[number]) => {
    const code = state.errors[k];
    return code ? t(`signup_${k}_${code}`) : null;
  };

  return (
    <form ref={form} action={action} className="login-form" noValidate>
      {state.failed && <AuthNotice tone="error">{t("error_generic")}</AuthNotice>}
      <Field id="signup-name" label={t("name")} required error={err("name")} optionalLabel={t("optional")}>
        <input
          id="signup-name"
          name="name"
          className="ax-input"
          autoComplete="name"
          autoFocus
          maxLength={100}
          defaultValue={state.values.name}
          aria-invalid={err("name") ? true : undefined}
          aria-describedby={describedBy("signup-name", err("name"))}
        />
      </Field>
      <Field id="signup-email" label={t("email")} required error={err("email")} optionalLabel={t("optional")}>
        <input
          id="signup-email"
          name="email"
          type="email"
          dir="ltr"
          className="ax-input"
          autoComplete="email"
          maxLength={254}
          defaultValue={state.values.email}
          aria-invalid={err("email") ? true : undefined}
          aria-describedby={describedBy("signup-email", err("email"))}
        />
      </Field>
      <Field
        id="signup-password"
        label={t("password")}
        required
        error={err("password")}
        help={t("passwordHelp")}
        optionalLabel={t("optional")}
      >
        <PasswordInput
          id="signup-password"
          name="password"
          autoComplete="new-password"
          maxLength={200}
          invalid={Boolean(err("password"))}
          aria-describedby={describedBy("signup-password", err("password"), t("passwordHelp"))}
        />
      </Field>
      <Field id="signup-company" label={t("company")} error={err("company")} optionalLabel={t("optional")}>
        <input
          id="signup-company"
          name="company"
          className="ax-input"
          autoComplete="organization"
          maxLength={120}
          defaultValue={state.values.company}
        />
      </Field>
      <button type="submit" className="ax-btn ax-btn-primary login-submit" disabled={pending}>
        {pending ? t("creating") : t("createAccount")}
      </button>
    </form>
  );
}
