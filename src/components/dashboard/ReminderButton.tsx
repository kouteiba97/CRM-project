"use client";

import { useTransition } from "react";
import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { sendInvoiceReminder } from "@/app/actions";
import { useToast } from "@/components/shell/Toasts";

export function ReminderButton({ invoiceId, number }: { invoiceId: string; number: string }) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const toast = useToast();
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      try {
        const res = await sendInvoiceReminder(invoiceId);
        toast({ tone: "success", title: t("reminderLogged", { number: res.number }) });
      } catch {
        toast({ tone: "danger", title: t("reminderFailed"), action: { label: tc("retry"), run: send } });
      }
    });

  return (
    <button
      type="button"
      className="ax-btn ax-btn-secondary ax-btn-xs"
      aria-busy={pending}
      aria-label={`${t("sendReminder")} · ${number}`}
      onClick={() => !pending && send()}
    >
      {pending ? <span className="ax-spinner" aria-hidden /> : <Send className="ax-icon ax-flip" aria-hidden />}
      <span className="ax-btn-label">{t("sendReminder")}</span>
    </button>
  );
}
