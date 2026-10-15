"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Archive, Check, ChevronDown, Ellipsis, Pencil, Plus, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Menu } from "@/components/shell/Menu";
import { useToast } from "@/components/shell/Toasts";
import {
  addMilestone,
  addProjectTask,
  archiveProject,
  restoreProject,
  setMilestoneStatus,
  setProjectStatus,
} from "./actions";
import { PROJECT_FORM_STATUSES } from "./schema";

/** Status menu: change with an Undo toast (no confirmation). */
export function ProjectStatusMenu({
  id,
  name,
  status,
}: {
  id: string;
  name: string;
  status: string;
}) {
  const t = useTranslations("projects.record");
  const ts = useTranslations("status.project");
  const tc = useTranslations("common");
  const toast = useToast();
  const [, start] = useTransition();
  const change = (next: string, undo = false) =>
    start(async () => {
      try {
        const res = await setProjectStatus(id, next);
        if (!undo)
          toast({
            tone: "success",
            title: t("statusChanged", { name, status: ts(next as never) }),
            action: { label: tc("undo"), run: () => change(res.from, true) },
          });
      } catch {
        toast({ tone: "danger", title: t("statusFailed") });
      }
    });
  return (
    <Menu
      align="start"
      triggerClassName="ax-btn ax-btn-secondary ax-btn-sm"
      triggerLabel={t("changeStatus")}
      trigger={
        <>
          {t("status")}
          <ChevronDown className="ax-icon" aria-hidden />
        </>
      }
    >
      {PROJECT_FORM_STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          role="menuitemradio"
          aria-checked={s === status}
          tabIndex={-1}
          className="ax-menu-item menu-btn"
          onClick={() => s !== status && change(s)}
        >
          {ts(s)}
          <Check className="ax-icon ax-check" aria-hidden />
        </button>
      ))}
    </Menu>
  );
}

/** More: Edit (`E`) and Archive (Undo in the toast). */
export function ProjectMoreMenu({ id, name }: { id: string; name: string }) {
  const t = useTranslations("projects.record");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
      if (e.key.toLowerCase() !== "e" || e.metaKey || e.ctrlKey || e.altKey || typing) return;
      if (document.querySelector('[role="dialog"], dialog[open]')) return;
      e.preventDefault();
      router.replace(`/projects/${id}?edit=1`, { scroll: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, router]);

  const archive = () =>
    start(async () => {
      try {
        await archiveProject(id);
        router.push("/projects");
        toast({
          tone: "success",
          title: t("archived", { name }),
          action: {
            label: tc("undo"),
            run: () =>
              void restoreProject(id).then(
                () => router.push(`/projects/${id}`),
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
      triggerClassName="ax-btn ax-btn-tertiary ax-btn-sm ax-btn-icon"
      triggerLabel={tc("more")}
      trigger={<Ellipsis className="ax-icon" aria-hidden />}
    >
      <Link
        role="menuitem"
        tabIndex={-1}
        className="ax-menu-item"
        href={`/projects/${id}?edit=1`}
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

/** Complete / reopen a milestone; Undo restores the previous status. */
export function MilestoneToggle({
  id,
  title,
  status,
}: {
  id: string;
  title: string;
  status: string;
}) {
  const t = useTranslations("projects.milestones");
  const tc = useTranslations("common");
  const toast = useToast();
  const [pending, start] = useTransition();
  const done = status === "completed";
  const run = (next: string, undo = false) =>
    start(async () => {
      try {
        const res = await setMilestoneStatus(id, next);
        if (!undo)
          toast({
            tone: "success",
            title: t(next === "completed" ? "completed" : "reopened", { title }),
            action: { label: tc("undo"), run: () => run(res.from, true) },
          });
      } catch {
        toast({ tone: "danger", title: t("failed") });
      }
    });
  return (
    <button
      type="button"
      className="ax-btn ax-btn-secondary ax-btn-xs"
      aria-busy={pending}
      aria-label={t(done ? "reopenLabel" : "completeLabel", { title })}
      onClick={() => run(done ? "in_progress" : "completed")}
    >
      {done ? (
        <RotateCcw className="ax-icon" aria-hidden />
      ) : (
        <Check className="ax-icon" aria-hidden />
      )}
      {t(done ? "reopen" : "complete")}
    </button>
  );
}

/** Inline add row (DS › TaskList): type, Enter to create; optional date and amount/priority beside it. */
export function InlineAdd({ projectId, kind }: { projectId: string; kind: "milestone" | "task" }) {
  const t = useTranslations(kind === "milestone" ? "projects.milestones" : "projects.tasks");
  const tf = useTranslations("projects.form");
  const tp = useTranslations("status.priority");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [extra, setExtra] = useState(kind === "task" ? "medium" : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError(t("titleRequired"));
    start(async () => {
      const res =
        kind === "milestone"
          ? await addMilestone(projectId, { title, dueDate: date, amount: extra })
          : await addProjectTask(projectId, { title, dueDate: date, priority: extra });
      if (!res.ok) {
        setError(res.error === "amount" ? tf("budgetHelp") : t("titleRequired"));
        return;
      }
      toast({ tone: "success", title: t("added", { title }) });
      setTitle("");
      setDate("");
      setError(null);
      titleRef.current?.focus();
    });
  };

  if (!open)
    return (
      <button
        type="button"
        className="ax-btn ax-btn-tertiary ax-btn-sm inline-add-open"
        onClick={() => setOpen(true)}
      >
        <Plus className="ax-icon" aria-hidden />
        {t("add")}
      </button>
    );
  return (
    <form className="inline-add" onSubmit={submit} aria-label={t("add")}>
      <label className="sr-only" htmlFor={`add-${kind}-title`}>
        {t("titleLabel")}
      </label>
      <input
        ref={titleRef}
        id={`add-${kind}-title`}
        className="ax-input"
        value={title}
        placeholder={t("titlePlaceholder")}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `add-${kind}-err` : undefined}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      />
      <label className="sr-only" htmlFor={`add-${kind}-date`}>
        {t("dateLabel")}
      </label>
      <input
        id={`add-${kind}-date`}
        className="ax-input"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      {kind === "milestone" ? (
        <>
          <label className="sr-only" htmlFor="add-milestone-amount">
            {t("amountLabel")}
          </label>
          <input
            id="add-milestone-amount"
            className="ax-input"
            dir="ltr"
            inputMode="decimal"
            placeholder={t("amountLabel")}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
          />
        </>
      ) : (
        <>
          <label className="sr-only" htmlFor="add-task-priority">
            {t("priorityLabel")}
          </label>
          <select
            id="add-task-priority"
            className="ax-input"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
          >
            {(["urgent", "high", "medium", "low"] as const).map((p) => (
              <option key={p} value={p}>
                {tp(p)}
              </option>
            ))}
          </select>
        </>
      )}
      <button type="submit" className="ax-btn ax-btn-primary ax-btn-sm" aria-busy={pending}>
        {pending && <span className="ax-spinner" aria-hidden />}
        {t("addButton")}
      </button>
      {error && (
        <span className="ax-error inline-add-err" id={`add-${kind}-err`}>
          {error}
        </span>
      )}
    </form>
  );
}
