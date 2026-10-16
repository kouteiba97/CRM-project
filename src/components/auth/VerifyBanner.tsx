"use client";

import { useState, useTransition } from "react";
import { MailWarning } from "lucide-react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/shell/Toasts";
import { resendVerification } from "./actions";

/** Shown in the app until the email is confirmed; password reset depends on that inbox. */
export function VerifyBanner({ email }: { email: string }) {
  const t = useTranslations("auth");
  const toast = useToast();
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);

  return (
    <div className="verify-banner" role="status">
      <MailWarning className="ax-icon" aria-hidden />
      <p>{t.rich("verify_banner", { email, b: (c) => <b dir="ltr">{c}</b> })}</p>
      <button
        type="button"
        className="ax-btn ax-btn-secondary ax-btn-sm"
        disabled={pending || sent}
        onClick={() =>
          start(async () => {
            const { ok } = await resendVerification();
            setSent(ok);
            toast(
              ok
                ? { tone: "success", title: t("verify_resent") }
                : { tone: "danger", title: t("error_too_many_links") },
            );
          })
        }
      >
        {sent ? t("verify_resent_short") : t("verify_resend")}
      </button>
    </div>
  );
}
