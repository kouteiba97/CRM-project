"use client";

import { useState, useTransition } from "react";
import { Pause, Play, Repeat, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/shell/Toasts";
import { describedBy, Field } from "@/components/ui/FormDrawer";
import { Modal } from "@/components/ui/Modal";
import { addInterval, type Interval } from "@/lib/recurrence";
import { createRecurring, deleteRecurring, setRecurringActive } from "./recurring-actions";

/** "Repeat" on an invoice: interval, first date, optional end, and whether to email it automatically. */
export function RepeatButton({ invoiceId, issueDate, number }: { invoiceId: string; issueDate: string; number: string }) {
  const t = useTranslations("documents.recurring");
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [interval, setIntervalValue] = useState<Interval>("monthly");
  const [nextDate, setNextDate] = useState(addInterval(issueDate, "monthly"));
  const [endDate, setEndDate] = useState("");
  const [autoSend, setAutoSend] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  return (
    <>
      <button type="button" className="ax-btn ax-btn-secondary ax-btn-sm" onClick={() => setOpen(true)}>
        <Repeat className="ax-icon" aria-hidden />
        {t("repeat")}
      </button>
      {open && (
        <Modal
          title={t("title", { number })}
          submitLabel={t("create")}
          pending={pending}
          onClose={() => setOpen(false)}
          onSubmit={() =>
            start(async () => {
              const res = await createRecurring(invoiceId, { interval, nextDate, endDate, autoSend });
              if (!res.ok) return setErrors(res.errors);
              setOpen(false);
              toast({ tone: "success", title: t("created", { date: nextDate }) });
              router.refresh();
            })
          }
        >
          <div className="settings-form">
            <p className="ax-help">{t("help")}</p>
            <Field id="rec-interval" label={t("interval")} required optionalLabel="">
              <select
                id="rec-interval"
                className="ax-input"
                value={interval}
                onChange={(e) => {
                  const v = e.target.value as Interval;
                  setIntervalValue(v);
                  setNextDate(addInterval(issueDate, v));
                }}
              >
                {(["monthly", "quarterly", "yearly"] as const).map((v) => (
                  <option key={v} value={v}>
                    {t(`every_${v}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="rec-next" label={t("firstDate")} required error={errors.nextDate ? t("invalidDate") : null} optionalLabel="">
              <input id="rec-next" type="date" className="ax-input" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
            </Field>
            <Field
              id="rec-end"
              label={t("endDate")}
              error={errors.endDate ? t(errors.endDate === "before_start" ? "endBeforeStart" : "invalidDate") : null}
              help={t("endHelp")}
              optionalLabel={t("optional")}
            >
              <input
                id="rec-end"
                type="date"
                className="ax-input"
                value={endDate}
                aria-describedby={describedBy("rec-end", errors.endDate, t("endHelp"))}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
            <label className="ax-choice">
              <input type="checkbox" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} />
              {t("autoSend")}
            </label>
            <p className="ax-help">{t(autoSend ? "autoSendOn" : "autoSendOff")}</p>
          </div>
        </Modal>
      )}
    </>
  );
}

export function RecurringRowActions({ id, active }: { id: string; active: boolean }) {
  const t = useTranslations("documents.recurring");
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, done: string) =>
    start(async () => {
      await fn();
      toast({ tone: "success", title: done });
      router.refresh();
    });
  return (
    <span className="rec-actions">
      <button
        type="button"
        className="ax-btn ax-btn-tertiary ax-btn-sm"
        disabled={pending}
        onClick={() => run(() => setRecurringActive(id, !active), t(active ? "paused" : "resumed"))}
      >
        {active ? <Pause className="ax-icon" aria-hidden /> : <Play className="ax-icon" aria-hidden />}
        {t(active ? "pause" : "resume")}
      </button>
      <button
        type="button"
        className="ax-btn ax-btn-tertiary ax-btn-sm ax-btn-icon"
        aria-label={t("delete")}
        disabled={pending}
        onClick={() => run(() => deleteRecurring(id), t("deleted"))}
      >
        <Trash2 className="ax-icon" aria-hidden />
      </button>
    </span>
  );
}
