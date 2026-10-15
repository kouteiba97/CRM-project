"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/shell/Toasts";
import { CURRENCIES } from "@/components/clients/schema";
import { describedBy, Field, FormDrawer } from "@/components/ui/FormDrawer";
import { createProject, updateProject } from "./actions";
import {
  PROJECT_FORM_STATUSES,
  projectFieldErrors,
  projectSchema,
  type ProjectField,
  type ProjectFieldErrors,
  type ProjectFormValues,
} from "./schema";

type Opt = { value: string; label: string; currency?: string | null };

/** New project (`?new=1`, also "Convert to project" from a won lead) or edit (`?edit=1` / `E`). */
export function ProjectDrawer({
  clients,
  initial,
  closeHref,
  edit,
  leadTitle,
}: {
  clients: Opt[];
  initial: ProjectFormValues;
  closeHref: string;
  edit?: { id: string };
  /** Shown when converting a lead whose prospect is not a client yet. */
  leadTitle?: string | null;
}) {
  const t = useTranslations("projects.form");
  const te = useTranslations("projects.errors");
  const tp = useTranslations("projects");
  const ts = useTranslations("status.project");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<ProjectFieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<ProjectField, boolean>>>({});
  const [formError, setFormError] = useState(false);
  const [pending, start] = useTransition();
  const dirty = (Object.keys(initial) as ProjectField[]).some((k) => values[k] !== initial[k]);

  const validate = (name: ProjectField, next: ProjectFormValues) => {
    const res = projectSchema.safeParse(next);
    const all = res.success ? {} : projectFieldErrors(res.error);
    setErrors((e) => ({
      ...e,
      [name]: all[name],
      ...(name === "startDate" ? { deadline: all.deadline } : {}),
    }));
  };
  const set = (name: ProjectField, value: string) => {
    const next = { ...values, [name]: value };
    if (name === "clientId") {
      const c = clients.find((x) => x.value === value);
      if (c?.currency && (CURRENCIES as readonly string[]).includes(c.currency) && !values.budget)
        next.currency = c.currency;
    }
    setValues(next);
    if (touched[name] || errors[name]) validate(name, next);
  };
  const blur = (name: ProjectField) => {
    setTouched((x) => ({ ...x, [name]: true }));
    if (values[name] !== "" || errors[name]) validate(name, values);
  };

  const submit = () => {
    setFormError(false);
    const res = projectSchema.safeParse(values);
    if (!res.success) {
      const errs = projectFieldErrors(res.error);
      setErrors(errs);
      focusFirst(errs);
      return;
    }
    start(async () => {
      try {
        const out = edit ? await updateProject(edit.id, values) : await createProject(values);
        if (!out.ok) {
          setErrors(out.fieldErrors);
          if (out.formError) setFormError(true);
          focusFirst(out.fieldErrors);
          return;
        }
        toast(
          edit
            ? { tone: "success", title: t("updated", { name: out.name }) }
            : {
                tone: "success",
                title: t("created", { name: out.name, code: out.code }),
                action: { label: tc("open"), run: () => router.push(`/projects/${out.id}`) },
              },
        );
        router.replace(closeHref, { scroll: false });
      } catch {
        setFormError(true);
      }
    });
  };
  const focusFirst = (errs: ProjectFieldErrors) => {
    const first = (Object.keys(initial) as ProjectField[]).find((k) => errs[k]);
    if (first) document.getElementById(`pj-${first}`)?.focus();
  };

  const err = (name: ProjectField) => (errors[name] ? te(errors[name] as never) : null);
  const input = (
    name: ProjectField,
    label: string,
    o: {
      required?: boolean;
      type?: string;
      ltr?: boolean;
      help?: string;
      inputMode?: "decimal";
    } = {},
  ) => (
    <Field
      id={`pj-${name}`}
      label={label}
      required={o.required}
      error={err(name)}
      help={o.help}
      optionalLabel={t("optional")}
    >
      <input
        id={`pj-${name}`}
        name={name}
        className="ax-input"
        type={o.type ?? "text"}
        dir={o.ltr ? "ltr" : undefined}
        inputMode={o.inputMode}
        value={values[name]}
        autoComplete="off"
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={describedBy(`pj-${name}`, err(name), o.help)}
        onChange={(e) => set(name, e.target.value)}
        onBlur={() => blur(name)}
      />
    </Field>
  );
  const select = (name: ProjectField, label: string, options: Opt[], required = true) => (
    <Field
      id={`pj-${name}`}
      label={label}
      required={required}
      error={err(name)}
      optionalLabel={t("optional")}
    >
      <select
        id={`pj-${name}`}
        name={name}
        className="ax-input"
        value={values[name]}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={describedBy(`pj-${name}`, err(name))}
        onChange={(e) => set(name, e.target.value)}
        onBlur={() => blur(name)}
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
      title={edit ? t("editTitle") : tp("newProject")}
      dirty={dirty}
      pending={pending}
      submitLabel={edit ? t("save") : t("create")}
      savingLabel={t("saving")}
      discardQuestion={t("discardQuestion")}
      formError={formError ? t("failed") : null}
      onSubmit={submit}
      onClose={() => router.replace(closeHref, { scroll: false })}
    >
      {leadTitle && <p className="ax-banner info">{t("fromLead", { title: leadTitle })}</p>}
      {input("name", t("name"), { required: true })}
      {select("clientId", t("client"), [{ value: "", label: t("chooseClient") }, ...clients])}
      {select(
        "status",
        t("status"),
        PROJECT_FORM_STATUSES.map((s) => ({ value: s, label: ts(s) })),
      )}
      <div className="nc-grid">
        {input("startDate", t("startDate"), { type: "date" })}
        {input("deadline", t("deadline"), { type: "date" })}
      </div>
      <div className="nc-grid">
        {input("budget", t("budget"), { ltr: true, inputMode: "decimal", help: t("budgetHelp") })}
        {select(
          "currency",
          t("currency"),
          CURRENCIES.map((c) => ({ value: c, label: c })),
        )}
      </div>
      {input("repoUrl", t("repoUrl"), { ltr: true, type: "url", help: t("repoHelp") })}
      <Field
        id="pj-description"
        label={t("description")}
        error={err("description")}
        optionalLabel={t("optional")}
      >
        <textarea
          id="pj-description"
          name="description"
          className="ax-input"
          rows={3}
          value={values.description}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={describedBy("pj-description", err("description"))}
          onChange={(e) => set("description", e.target.value)}
          onBlur={() => blur("description")}
        />
      </Field>
    </FormDrawer>
  );
}
