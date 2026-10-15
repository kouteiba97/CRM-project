"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/shell/Toasts";
import { describedBy, Field, FormDrawer } from "@/components/ui/FormDrawer";
import { archiveTask, createTask, restoreTask, updateTask } from "./actions";
import {
  TASK_FORM_STATUSES,
  TASK_PRIORITY_LEVELS,
  taskFieldErrors,
  taskFormSchema,
  type TaskField,
  type TaskFieldErrors,
  type TaskFormValues,
} from "./schema";

type Opt = { value: string; label: string };

/** DS › Tasks: `T` quick-create drawer (`drawer-sm`); the same form edits a task (`?task=<id>`). */
export function TaskDrawer({
  initial,
  projects,
  people,
  closeHref,
  edit,
}: {
  initial: TaskFormValues;
  projects: Opt[];
  people: Opt[];
  closeHref: string;
  edit?: { id: string };
}) {
  const t = useTranslations("tasks.form");
  const te = useTranslations("tasks.errors");
  const tt = useTranslations("tasks");
  const ts = useTranslations("status");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<TaskFieldErrors>({});
  const [formError, setFormError] = useState(false);
  const [pending, start] = useTransition();
  const dirty = (Object.keys(initial) as TaskField[]).some((k) => values[k] !== initial[k]);

  const set = (name: TaskField, value: string) => {
    const next = { ...values, [name]: value };
    setValues(next);
    if (errors[name]) {
      const res = taskFormSchema.safeParse(next);
      setErrors((e) => ({
        ...e,
        [name]: res.success ? undefined : taskFieldErrors(res.error)[name],
      }));
    }
  };
  const close = () => router.replace(closeHref, { scroll: false });

  const submit = () => {
    setFormError(false);
    const res = taskFormSchema.safeParse(values);
    if (!res.success) {
      const errs = taskFieldErrors(res.error);
      setErrors(errs);
      const first = (Object.keys(initial) as TaskField[]).find((k) => errs[k]);
      if (first) document.getElementById(`tk-${first}`)?.focus();
      return;
    }
    start(async () => {
      try {
        const out = edit ? await updateTask(edit.id, values) : await createTask(values);
        if (!out.ok) {
          setErrors(out.fieldErrors);
          if (out.formError) setFormError(true);
          return;
        }
        toast({ tone: "success", title: t(edit ? "updated" : "created", { title: out.title }) });
        close();
      } catch {
        setFormError(true);
      }
    });
  };

  const remove = () =>
    start(async () => {
      if (!edit) return;
      try {
        const row = await archiveTask(edit.id);
        close();
        toast({
          tone: "success",
          title: t("deleted", { title: row.title }),
          action: {
            label: tc("undo"),
            run: () => void restoreTask(edit.id).then(() => router.refresh()),
          },
        });
      } catch {
        setFormError(true);
      }
    });

  const err = (name: TaskField) => (errors[name] ? te(errors[name] as never) : null);
  const select = (name: TaskField, label: string, options: Opt[], required = true) => (
    <Field
      id={`tk-${name}`}
      label={label}
      required={required}
      error={err(name)}
      optionalLabel={t("optional")}
    >
      <select
        id={`tk-${name}`}
        name={name}
        className="ax-input"
        value={values[name]}
        aria-describedby={describedBy(`tk-${name}`, err(name))}
        onChange={(e) => set(name, e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );

  return (
    <FormDrawer
      size="sm"
      title={edit ? t("editTitle") : tt("newTask")}
      dirty={dirty}
      pending={pending}
      submitLabel={edit ? t("save") : t("create")}
      savingLabel={t("saving")}
      discardQuestion={t("discardQuestion")}
      formError={formError ? t("failed") : null}
      onSubmit={submit}
      onClose={close}
      footerStart={
        edit ? (
          <button type="button" className="ax-btn ax-btn-danger-ghost ax-btn-sm" onClick={remove}>
            <Trash2 className="ax-icon" aria-hidden />
            {t("delete")}
          </button>
        ) : undefined
      }
    >
      <Field
        id="tk-title"
        label={t("title")}
        required
        error={err("title")}
        optionalLabel={t("optional")}
      >
        <input
          id="tk-title"
          name="title"
          className="ax-input"
          value={values.title}
          autoComplete="off"
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={describedBy("tk-title", err("title"))}
          onChange={(e) => set("title", e.target.value)}
          onBlur={() => {
            if (values.title.trim() === "" && dirty)
              setErrors((x) => ({ ...x, title: "required" }));
          }}
        />
      </Field>
      {select(
        "projectId",
        t("project"),
        [{ value: "", label: t("noProject") }, ...projects],
        false,
      )}
      <div className="nc-grid">
        {select(
          "status",
          t("status"),
          TASK_FORM_STATUSES.map((s) => ({ value: s, label: ts(`task.${s}`) })),
        )}
        {select(
          "priority",
          t("priority"),
          TASK_PRIORITY_LEVELS.map((p) => ({ value: p, label: ts(`priority.${p}`) })),
        )}
      </div>
      <Field
        id="tk-dueDate"
        label={t("dueDate")}
        error={err("dueDate")}
        optionalLabel={t("optional")}
      >
        <input
          id="tk-dueDate"
          name="dueDate"
          className="ax-input"
          type="date"
          value={values.dueDate}
          aria-describedby={describedBy("tk-dueDate", err("dueDate"))}
          onChange={(e) => set("dueDate", e.target.value)}
        />
      </Field>
      {people.length > 0 &&
        select(
          "assigneeId",
          t("assignee"),
          [{ value: "", label: t("unassigned") }, ...people],
          false,
        )}
    </FormDrawer>
  );
}
