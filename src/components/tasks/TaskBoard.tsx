"use client";

import { useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { CalendarClock, Check, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import type { Due } from "@/lib/due";
import { TaskRow } from "@/components/dashboard/TaskCheck";
import { useToast } from "@/components/shell/Toasts";
import { DueLabel } from "@/components/ui/DueLabel";
import { Priority } from "@/components/ui/Priority";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  completeTasks,
  quickAddTask,
  rescheduleTasks,
  restoreDueDates,
  restoreStatuses,
} from "./actions";
import { addDays, isoLocal, nextMonday } from "./schema";

export type TaskView = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due: Due | null;
  overdue: boolean;
  done: boolean;
  project: { id: string; name: string } | null;
  assignee: { name: string; initials: string; hue: number } | null;
};

export type TaskGroupView = {
  key: string;
  label: string;
  rows: TaskView[];
  /** Inline add at the bottom of the group, with the group's default due date / project. */
  add: { dueDate: string; projectId: string } | null;
  collapsed?: boolean;
  danger?: boolean;
};

/**
 * DS › TaskList: grouped rows (32px overline headers with count and collapse toggle), quick completion
 * (click or `X` on a focused row, Undo toast), selection with a bulk bar (reschedule / mark done, Undo),
 * inline add at the bottom of each group (Enter creates, Tab reaches the date).
 */
export function TaskBoard({ groups, editHref }: { groups: TaskGroupView[]; editHref: string }) {
  const t = useTranslations("tasks");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allIds = groups.flatMap((g) => g.rows.map((r) => r.id)).join(",");
  const [key, setKey] = useState(allIds);
  if (key !== allIds) {
    setKey(allIds);
    const visible = new Set(allIds.split(","));
    setSelected((s) => new Set([...s].filter((id) => visible.has(id))));
  }
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // `X` on a focused row completes it (DS › TaskList › Quick completion).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    if (
      e.key.toLowerCase() !== "x" ||
      e.metaKey ||
      e.ctrlKey ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)
    )
      return;
    const row = el.closest<HTMLElement>("li.ax-task");
    const check = row?.querySelector<HTMLButtonElement>(".ax-check-btn");
    if (check) {
      e.preventDefault();
      check.click();
    }
  };

  return (
    <div className="task-board" onKeyDown={onKeyDown}>
      {selected.size > 0 && <BulkBar ids={[...selected]} onClear={() => setSelected(new Set())} />}
      {groups.map((g) => (
        <Group
          key={g.key}
          group={g}
          selected={selected}
          onToggle={toggle}
          editHref={editHref}
          label={t("groupLabel", { group: g.label, count: g.rows.length })}
        />
      ))}
    </div>
  );
}

function Group({
  group,
  selected,
  onToggle,
  editHref,
  label,
}: {
  group: TaskGroupView;
  selected: Set<string>;
  onToggle: (id: string) => void;
  editHref: string;
  label: string;
}) {
  const t = useTranslations("tasks");
  const [open, setOpen] = useState(!group.collapsed);
  const listId = useId();
  if (group.rows.length === 0 && !group.add) return null;
  return (
    <section className={`task-group${group.danger ? " is-danger" : ""}`} aria-label={label}>
      <h2 className="task-group-head">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? (
            <ChevronDown className="ax-icon ax-icon-sm" aria-hidden />
          ) : (
            <ChevronRight className="ax-icon ax-icon-sm ax-flip" aria-hidden />
          )}
          <span className="name">{group.label}</span>
          <span className="ax-count">{group.rows.length}</span>
        </button>
      </h2>
      <div id={listId} hidden={!open}>
        {group.rows.length > 0 && (
          <ul className="task-list">
            {group.rows.map((r) => (
              <TaskRow
                key={r.id}
                id={r.id}
                title={r.title}
                status={r.status}
                overdue={r.overdue}
                initialDone={r.done}
                className={`task-row${selected.has(r.id) ? " is-selected" : ""}`}
                lead={
                  <label className="ax-choice task-select">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => onToggle(r.id)}
                      aria-label={t("select", { title: r.title })}
                    />
                  </label>
                }
              >
                <Priority level={r.priority} compact />
                <Link
                  className="title task-title"
                  href={`${editHref}${editHref.includes("?") ? "&" : "?"}task=${r.id}`}
                  scroll={false}
                >
                  {r.title}
                </Link>
                {r.project && (
                  <Link className="proj" href={`/projects/${r.project.id}?tab=tasks`}>
                    {r.project.name}
                  </Link>
                )}
                {!r.done && r.status !== "todo" && <StatusBadge domain="task" code={r.status} />}
                {r.due && !r.done && <DueLabel due={r.due} />}
                {r.assignee && (
                  <span
                    className="ax-avatar sm"
                    data-hue={r.assignee.hue}
                    title={r.assignee.name}
                    aria-hidden
                  >
                    {r.assignee.initials}
                  </span>
                )}
              </TaskRow>
            ))}
          </ul>
        )}
        {group.add && <InlineAdd group={group} />}
      </div>
    </section>
  );
}

/** Bottom-of-group add row: type the title, Enter creates; Tab moves to the (prefilled) due date. */
function InlineAdd({ group }: { group: TaskGroupView }) {
  const t = useTranslations("tasks");
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(group.add!.dueDate);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || pending) return;
    start(async () => {
      try {
        await quickAddTask({ title, dueDate: date, projectId: group.add!.projectId });
        toast({ tone: "success", title: t("added", { title }) });
        setTitle("");
        input.current?.focus();
      } catch {
        toast({ tone: "danger", title: t("addFailed") });
      }
    });
  };
  return (
    <form className="task-add" onSubmit={submit}>
      <Plus className="ax-icon ax-icon-sm" aria-hidden />
      <label className="sr-only" htmlFor={`${id}-t`}>
        {t("addIn", { group: group.label })}
      </label>
      <input
        ref={input}
        id={`${id}-t`}
        className="task-add-title"
        value={title}
        placeholder={t("addPlaceholder")}
        onChange={(e) => setTitle(e.target.value)}
        aria-busy={pending}
      />
      <label className="sr-only" htmlFor={`${id}-d`}>
        {t("dueDate")}
      </label>
      <input
        id={`${id}-d`}
        className="ax-input task-add-date"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
    </form>
  );
}

/** DS › DataTable bulk bar for tasks: reschedule (Today · Tomorrow · Next week · date · No date) or mark done. */
function BulkBar({ ids, onClear }: { ids: string[]; onClear: () => void }) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [date, setDate] = useState("");
  const today = new Date();

  const reschedule = (due: string | null, label: string) =>
    start(async () => {
      try {
        const previous = await rescheduleTasks(ids, due);
        onClear();
        toast({
          tone: "success",
          title: t("rescheduled", { count: previous.length, when: label }),
          action: {
            label: tc("undo"),
            run: () => void restoreDueDates(previous).then(() => router.refresh()),
          },
        });
      } catch {
        toast({ tone: "danger", title: t("bulkFailed") });
      }
    });
  const done = () =>
    start(async () => {
      try {
        const previous = await completeTasks(ids);
        onClear();
        toast({
          tone: "success",
          title: t("completedCount", { count: previous.length }),
          action: previous.length
            ? {
                label: tc("undo"),
                run: () => void restoreStatuses(previous).then(() => router.refresh()),
              }
            : undefined,
        });
      } catch {
        toast({ tone: "danger", title: t("bulkFailed") });
      }
    });

  return (
    <div
      className="ax-bulkbar task-bulkbar"
      role="region"
      aria-label={t("bulkActions")}
      aria-busy={pending}
    >
      <span aria-live="polite">{t("selectedCount", { count: ids.length })}</span>
      <span className="bulk-label">
        <CalendarClock className="ax-icon ax-icon-sm" aria-hidden />
        {t("reschedule")}
      </span>
      <button
        type="button"
        className="ax-btn ax-btn-secondary ax-btn-xs"
        onClick={() => reschedule(isoLocal(today), tc("today"))}
      >
        {tc("today")}
      </button>
      <button
        type="button"
        className="ax-btn ax-btn-secondary ax-btn-xs"
        onClick={() => reschedule(isoLocal(addDays(today, 1)), t("tomorrow"))}
      >
        {t("tomorrow")}
      </button>
      <button
        type="button"
        className="ax-btn ax-btn-secondary ax-btn-xs"
        onClick={() => reschedule(isoLocal(nextMonday(today)), t("nextWeek"))}
      >
        {t("nextWeek")}
      </button>
      <form
        className="bulk-date"
        onSubmit={(e) => {
          e.preventDefault();
          if (date) reschedule(date, date);
        }}
      >
        <label className="sr-only" htmlFor="bulk-date">
          {t("pickDate")}
        </label>
        <input
          id="bulk-date"
          className="ax-input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button type="submit" className="ax-btn ax-btn-secondary ax-btn-xs" disabled={!date}>
          {t("apply")}
        </button>
      </form>
      <button
        type="button"
        className="ax-btn ax-btn-tertiary ax-btn-xs"
        onClick={() => reschedule(null, tc("noDate"))}
      >
        {tc("noDate")}
      </button>
      <span className="ax-spacer" />
      <button type="button" className="ax-btn ax-btn-secondary ax-btn-xs" onClick={done}>
        <Check className="ax-icon" aria-hidden />
        {t("markDone")}
      </button>
      <button type="button" className="ax-btn ax-btn-tertiary ax-btn-xs" onClick={onClear}>
        {t("clearSelection")}
      </button>
    </div>
  );
}
