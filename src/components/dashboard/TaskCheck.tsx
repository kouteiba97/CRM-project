"use client";

import { useOptimistic, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { setTaskStatus } from "@/app/actions";
import { useToast } from "@/components/shell/Toasts";

/**
 * Task row with quick completion. Optimistic: the row updates instantly, the server confirms;
 * on failure it reverts with a danger toast + Retry. Completion is reversible, so: Undo toast, no dialog.
 */
export function TaskRow({
  id,
  title,
  status,
  overdue,
  children,
}: {
  id: string;
  title: string;
  /** Current status, restored by Undo. */
  status: string;
  overdue: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const toast = useToast();
  const [, start] = useTransition();
  const [done, setDone] = useOptimistic(false);

  const apply = (next: boolean) =>
    start(async () => {
      setDone(next);
      try {
        await setTaskStatus(id, next ? "done" : status);
        toast(
          next
            ? { tone: "success", title: t("taskDone"), action: { label: tc("undo"), run: () => apply(false) } }
            : { tone: "info", title: t("taskReopened") },
        );
      } catch {
        toast({ tone: "danger", title: t("taskFailed"), action: { label: tc("retry"), run: () => apply(next) } });
      }
    });

  return (
    <li className={`ax-task dash-task${done ? " is-done" : ""}${overdue && !done ? " is-overdue" : ""}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={t("markDone", { title })}
        className="ax-check-btn"
        onClick={() => apply(!done)}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </button>
      {children}
    </li>
  );
}
