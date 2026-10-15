"use client";

import { useEffect, useState, useTransition } from "react";
import { Archive, CalendarClock, Check, Ellipsis, Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Menu } from "@/components/shell/Menu";
import { useToast } from "@/components/shell/Toasts";
import {
  archiveClients,
  completeFollowUp,
  planFollowUp,
  rescheduleFollowUp,
  restoreClients,
  type RecordTarget,
} from "./actions";

/** `datetime-local` value (browser local time) → ISO with offset for the server. */
const toIso = (local: string) => (local ? new Date(local).toISOString() : "");
/** Date → `YYYY-MM-DDTHH:mm` in the browser's local time, for `datetime-local` inputs. */
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function inDays(days: number, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** Record "More" menu: Edit (drawer) and Archive (no confirmation; Undo in the toast). */
export function ProfileMoreMenu({ clientId, name }: { clientId: string; name: string }) {
  const t = useTranslations("clients.record");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();

  // `E` edits the open record (DS › Interaction › Keyboard); ignored while typing or with a dialog open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
      if (e.key.toLowerCase() !== "e" || e.metaKey || e.ctrlKey || e.altKey || typing) return;
      if (document.querySelector('[role="dialog"], dialog[open]')) return;
      e.preventDefault();
      router.replace(`/clients/${clientId}?edit=1`, { scroll: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clientId, router]);

  const archive = () =>
    start(async () => {
      try {
        await archiveClients([clientId]);
        router.push("/clients");
        toast({
          tone: "success",
          title: t("archived", { name }),
          action: {
            label: tc("undo"),
            run: () =>
              void restoreClients([clientId]).then(
                () => router.push(`/clients/${clientId}`),
                () => toast({ tone: "danger", title: t("restoreFailed") }),
              ),
          },
        });
      } catch {
        toast({ tone: "danger", title: t("archiveFailed") });
      }
    });

  return (
    <Menu
      triggerClassName="ax-btn ax-btn-secondary ax-btn-xs ax-btn-icon"
      triggerLabel={tc("more")}
      align="start"
      trigger={<Ellipsis className="ax-icon" aria-hidden />}
    >
      <Link
        role="menuitem"
        tabIndex={-1}
        className="ax-menu-item"
        href={`/clients/${clientId}?edit=1`}
        scroll={false}
      >
        <Pencil className="ax-icon" aria-hidden />
        {t("edit")}
        <kbd className="ax-kbd">E</kbd>
      </Link>
      <div className="ax-menu-sep" role="separator" />
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        className="ax-menu-item menu-btn is-danger"
        onClick={archive}
      >
        <Archive className="ax-icon" aria-hidden />
        {t("archive")}
      </button>
    </Menu>
  );
}

type Mode = "idle" | "reschedule" | "done" | "plan";

/**
 * DS › Follow-ups on the record rail: Reschedule; Done prompts (inline, optional) for the outcome
 * and the next follow-up; with none planned, "Plan follow-up".
 */
export function FollowUpActions({
  target,
  followUp,
}: {
  target: RecordTarget;
  followUp: { id: string; dueAt: string; subject: string } | null;
}) {
  const t = useTranslations("clients.followUp");
  const tch = useTranslations("channel");
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("idle");
  const [pending, start] = useTransition();
  const [when, setWhen] = useState("");
  const [outcome, setOutcome] = useState("");
  const [subject, setSubject] = useState("");
  const [channel, setChannel] = useState("call");
  const [error, setError] = useState<string | null>(null);

  const open = (m: Mode) => {
    setError(null);
    setOutcome("");
    setSubject(m === "plan" ? "" : (followUp?.subject ?? ""));
    setWhen(
      m === "reschedule" && followUp
        ? toLocalInput(new Date(followUp.dueAt))
        : m === "done"
          ? ""
          : toLocalInput(inDays(m === "plan" ? 1 : 7)),
    );
    setMode(m);
  };

  const run = (fn: () => Promise<void>, ok: string) =>
    start(async () => {
      try {
        await fn();
        setMode("idle");
        toast({ tone: "success", title: ok });
      } catch {
        toast({ tone: "danger", title: t("failed") });
      }
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "reschedule" && followUp) {
      if (!when) return setError(t("whenRequired"));
      run(() => rescheduleFollowUp(followUp.id, toIso(when)), t("rescheduled"));
    } else if (mode === "done" && followUp) {
      run(() => completeFollowUp(followUp.id, { outcome, next: toIso(when) }), t("completed"));
    } else if (mode === "plan") {
      if (!subject.trim()) return setError(t("subjectRequired"));
      if (!when) return setError(t("whenRequired"));
      run(() => planFollowUp(target, { subject, channel, dueAt: toIso(when) }), t("planned"));
    }
  };

  if (mode === "idle")
    return (
      <div className="fu-actions">
        {followUp ? (
          <>
            <button
              type="button"
              className="ax-btn ax-btn-secondary ax-btn-xs"
              onClick={() => open("reschedule")}
            >
              <CalendarClock className="ax-icon" aria-hidden />
              {t("reschedule")}
            </button>
            <button
              type="button"
              className="ax-btn ax-btn-secondary ax-btn-xs"
              onClick={() => open("done")}
            >
              <Check className="ax-icon" aria-hidden />
              {t("markDone")}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="ax-btn ax-btn-secondary ax-btn-xs"
            onClick={() => open("plan")}
          >
            <Plus className="ax-icon" aria-hidden />
            {t("plan")}
          </button>
        )}
      </div>
    );

  return (
    <form
      className="fu-form"
      onSubmit={submit}
      aria-label={t(mode === "done" ? "markDone" : mode === "plan" ? "plan" : "reschedule")}
    >
      {mode === "plan" && (
        <>
          <div className="ax-field">
            <label className="ax-label" htmlFor="fu-subject">
              {t("subject")}
            </label>
            <input
              id="fu-subject"
              className="ax-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="fu-channel">
              {t("channel")}
            </label>
            <select
              id="fu-channel"
              className="ax-input"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              {(["call", "email", "meeting"] as const).map((c) => (
                <option key={c} value={c}>
                  {tch(c)}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      {mode === "done" && (
        <div className="ax-field">
          <label className="ax-label" htmlFor="fu-outcome">
            {t("outcome")} <span className="ax-opt">{t("optional")}</span>
          </label>
          <textarea
            id="fu-outcome"
            className="ax-input"
            rows={2}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
          />
        </div>
      )}
      <div className="ax-field">
        <label className="ax-label" htmlFor="fu-when">
          {mode === "done" ? t("nextWhen") : t("when")}
          {mode === "done" && <span className="ax-opt">{t("optional")}</span>}
        </label>
        <input
          id="fu-when"
          className="ax-input"
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />
      </div>
      {error && (
        <span className="ax-error" role="alert">
          {error}
        </span>
      )}
      <div className="fu-form-foot">
        <button
          type="button"
          className="ax-btn ax-btn-secondary ax-btn-xs"
          onClick={() => setMode("idle")}
        >
          {t("cancel")}
        </button>
        <button type="submit" className="ax-btn ax-btn-primary ax-btn-xs" aria-busy={pending}>
          {pending && <span className="ax-spinner" aria-hidden />}
          {t("save")}
        </button>
      </div>
    </form>
  );
}
