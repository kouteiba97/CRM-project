"use client";

import { useOptimistic, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/shell/Toasts";
import { setClientReminders } from "./actions";

/** DS › Payments › reminders: "switch per client" on the client record. Optimistic, reverts on failure. */
export function ReminderSwitch({ clientId, enabled }: { clientId: string; enabled: boolean }) {
  const t = useTranslations("payments.reminders");
  const toast = useToast();
  const [, start] = useTransition();
  const [on, setOn] = useOptimistic(enabled);
  const toggle = () =>
    start(async () => {
      const next = !on;
      setOn(next);
      try {
        await setClientReminders(clientId, next);
        toast({ tone: "success", title: t(next ? "turnedOn" : "turnedOff") });
      } catch {
        toast({ tone: "danger", title: t("failed") });
      }
    });
  return (
    <div className="rem-switch">
      <label className="ax-choice ax-switch">
        <input
          type="checkbox"
          role="switch"
          checked={on}
          onChange={toggle}
          aria-describedby="rem-switch-help"
        />
        <span>{t("label")}</span>
      </label>
      <span className="ax-help" id="rem-switch-help">
        {t("help")}
      </span>
    </div>
  );
}
