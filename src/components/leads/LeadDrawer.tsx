"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { CircleAlert, TriangleAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/shell/Toasts";
import { CURRENCIES } from "@/components/clients/schema";
import { createLead, updateLead } from "./actions";
import {
  leadFieldErrors,
  leadSchema,
  OPEN_STAGES,
  PRIORITY_LEVELS,
  type LeadField,
  type LeadFieldErrors,
  type LeadFormValues,
} from "./schema";

type Opt = { value: string; label: string };

const pad = (n: number) => String(n).padStart(2, "0");
/** Tomorrow 10:00 local, as a `datetime-local` value: every open lead should have a follow-up. */
function tomorrowAt10() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * DS › Drawer quick create (`drawer-sm`, modal) for a lead; with `edit` it edits one. Same validation flow as
 * the client drawer: on blur, then on every change; ⌘/Ctrl+Enter submits; Esc asks before discarding edits.
 */
export function LeadDrawer({
  clients,
  owners,
  initial,
  closeHref,
  edit,
}: {
  clients: (Opt & { currency: string | null })[];
  owners: Opt[];
  initial: LeadFormValues;
  closeHref: string;
  edit?: { id: string };
}) {
  const t = useTranslations("leads.form");
  const te = useTranslations("leads.errors");
  const tl = useTranslations("leads");
  const ts = useTranslations("status");
  const tc = useTranslations("common");
  const tch = useTranslations("channel");
  const router = useRouter();
  const toast = useToast();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  const start0 = edit ? initial : { ...initial, followUpAt: initial.followUpAt || tomorrowAt10() };
  const [values, setValues] = useState<LeadFormValues>(start0);
  const [errors, setErrors] = useState<LeadFieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<LeadField, boolean>>>({});
  const [formError, setFormError] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [pending, start] = useTransition();
  const dirty = (Object.keys(start0) as LeadField[]).some((k) => values[k] !== start0[k]);

  useEffect(() => {
    opener.current = document.activeElement;
    panel.current?.querySelector<HTMLElement>("input")?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const close = () => {
    router.replace(closeHref, { scroll: false });
    (opener.current as HTMLElement | null)?.focus?.();
  };
  const requestClose = () => (dirty && !pending ? setConfirmDiscard(true) : close());

  /** `datetime-local` has no zone; send it as an ISO instant from the browser's clock. */
  const payload = (v: LeadFormValues) => ({
    ...v,
    followUpAt: v.followUpAt ? new Date(v.followUpAt).toISOString() : "",
  });

  const validate = (name: LeadField, next: LeadFormValues) => {
    const res = leadSchema.safeParse(payload(next));
    const all = res.success ? {} : leadFieldErrors(res.error);
    setErrors((e) => ({
      ...e,
      [name]: all[name],
      ...(name === "clientId" ? { prospectCompany: all.prospectCompany } : {}),
    }));
  };
  const set = (name: LeadField, value: string) => {
    const next = { ...values, [name]: value };
    // Picking a client brings its currency along.
    if (name === "clientId") {
      const c = clients.find((x) => x.value === value);
      if (c?.currency && (CURRENCIES as readonly string[]).includes(c.currency))
        next.currency = c.currency;
    }
    setValues(next);
    setConfirmDiscard(false);
    if (touched[name] || errors[name] || name === "clientId") validate(name, next);
  };
  const blur = (name: LeadField) => {
    setTouched((x) => ({ ...x, [name]: true }));
    if (values[name] !== "" || errors[name]) validate(name, values);
  };

  const focusFirstError = (errs: LeadFieldErrors) => {
    const first = (Object.keys(start0) as LeadField[]).find((k) => errs[k]);
    if (first) panel.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (pending) return;
    setFormError(false);
    const res = leadSchema.safeParse(payload(values));
    if (!res.success) {
      const errs = leadFieldErrors(res.error);
      setErrors(errs);
      focusFirstError(errs);
      return;
    }
    start(async () => {
      try {
        const out = edit
          ? await updateLead(edit.id, payload(values))
          : await createLead(payload(values));
        if (!out.ok) {
          setErrors(out.fieldErrors);
          if (out.formError) setFormError(true);
          focusFirstError(out.fieldErrors);
          return;
        }
        toast(
          edit
            ? { tone: "success", title: t("updated", { title: out.title }) }
            : {
                tone: "success",
                title: t("created", { title: out.title }),
                action: { label: tc("open"), run: () => router.push(`/leads/${out.id}`) },
              },
        );
        close();
      } catch {
        setFormError(true);
      }
    });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (confirmDiscard) setConfirmDiscard(false);
      else requestClose();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    } else if (e.key === "Tab") {
      const list = Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  };

  const fieldShell = (
    name: LeadField,
    label: string,
    control: React.ReactNode,
    opts: { required?: boolean; help?: string } = {},
  ) => {
    const id = `ld-${name}`;
    const err = errors[name];
    return (
      <div className="ax-field">
        <label className="ax-label" htmlFor={id}>
          {label}
          {opts.required ? (
            <span className="ax-req" aria-hidden>
              *
            </span>
          ) : (
            <span className="ax-opt">{t("optional")}</span>
          )}
        </label>
        {control}
        {err ? (
          <span className="ax-error" id={`${id}-err`}>
            <CircleAlert className="ax-icon" aria-hidden />
            {te(err as never)}
          </span>
        ) : opts.help ? (
          <span className="ax-help" id={`${id}-help`}>
            {opts.help}
          </span>
        ) : null}
      </div>
    );
  };
  const describedBy = (name: LeadField, help?: boolean) =>
    errors[name] ? `ld-${name}-err` : help ? `ld-${name}-help` : undefined;

  const input = (
    name: LeadField,
    label: string,
    opts: {
      required?: boolean;
      type?: string;
      ltr?: boolean;
      help?: string;
      inputMode?: "decimal";
    } = {},
  ) =>
    fieldShell(
      name,
      label,
      <input
        id={`ld-${name}`}
        name={name}
        className="ax-input"
        type={opts.type ?? "text"}
        dir={opts.ltr ? "ltr" : undefined}
        inputMode={opts.inputMode}
        value={values[name]}
        required={opts.required}
        autoComplete="off"
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={describedBy(name, !!opts.help)}
        onChange={(e) => set(name, e.target.value)}
        onBlur={() => blur(name)}
      />,
      opts,
    );

  const select = (
    name: LeadField,
    label: string,
    options: Opt[],
    opts: { required?: boolean } = { required: true },
  ) =>
    fieldShell(
      name,
      label,
      <select
        id={`ld-${name}`}
        name={name}
        className="ax-input"
        value={values[name]}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={describedBy(name)}
        onChange={(e) => set(name, e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>,
      opts,
    );

  return (
    <div className="drawer-layer" onKeyDown={onKeyDown}>
      <div className="ax-scrim drawer-scrim" aria-hidden onClick={requestClose} />
      <div
        ref={panel}
        className="ax-drawer drawer-panel drawer-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="ax-drawer-head">
          <h2 id={titleId}>{edit ? t("editTitle") : tl("newLead")}</h2>
          <button
            type="button"
            className="ax-btn ax-btn-tertiary ax-btn-sm ax-btn-icon"
            aria-label={tc("close")}
            onClick={requestClose}
          >
            <X className="ax-icon" aria-hidden />
          </button>
        </div>
        <form className="drawer-form" noValidate onSubmit={submit} inert={pending}>
          <div className="ax-drawer-body">
            {formError && (
              <div className="ax-banner danger" role="alert">
                <CircleAlert className="ax-icon" aria-hidden />
                {t("failed")}
              </div>
            )}
            {input("title", t("title"), { required: true })}
            {select("clientId", t("client"), [{ value: "", label: t("newProspect") }, ...clients], {
              required: false,
            })}
            {!values.clientId && (
              <>
                {input("prospectCompany", t("prospectCompany"), { required: true })}
                {input("prospectName", t("prospectName"))}
              </>
            )}
            <div className="nc-grid">
              {input("value", t("value"), {
                ltr: true,
                inputMode: "decimal",
                help: t("valueHelp"),
              })}
              {select(
                "currency",
                t("currency"),
                CURRENCIES.map((c) => ({ value: c, label: c })),
              )}
            </div>
            <div className="nc-grid">
              {select(
                "priority",
                t("priority"),
                PRIORITY_LEVELS.map((p) => ({ value: p, label: ts(`priority.${p}`) })),
              )}
              {!edit &&
                select(
                  "stage",
                  t("stage"),
                  OPEN_STAGES.map((s) => ({ value: s, label: ts(`lead.${s}`) })),
                )}
            </div>
            {input("expectedCloseDate", t("expectedClose"), { type: "date" })}
            {owners.length > 0 && select("ownerId", t("owner"), owners)}
            {input("source", t("source"), { help: t("sourceHelp") })}
            {!edit && (
              <fieldset className="nc-section">
                <legend className="nc-legend">{t("firstFollowUp")}</legend>
                <div className="nc-grid">
                  {input("followUpAt", t("followUpAt"), { type: "datetime-local" })}
                  {select(
                    "followUpChannel",
                    t("channel"),
                    (["call", "email", "meeting"] as const).map((c) => ({
                      value: c,
                      label: tch(c),
                    })),
                  )}
                </div>
              </fieldset>
            )}
          </div>
          <div className="ax-drawer-foot">
            {confirmDiscard ? (
              <div className="ax-banner warning discard" role="alert">
                <TriangleAlert className="ax-icon" aria-hidden />
                <span>{t("discardQuestion")}</span>
                <button
                  type="button"
                  className="ax-btn ax-btn-secondary ax-btn-xs"
                  onClick={() => setConfirmDiscard(false)}
                >
                  {t("keepEditing")}
                </button>
                <button type="button" className="ax-btn ax-btn-danger ax-btn-xs" onClick={close}>
                  {t("discard")}
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="ax-btn ax-btn-secondary ax-btn-sm"
                  onClick={requestClose}
                >
                  {tc("cancel")}
                </button>
                <button
                  type="submit"
                  className="ax-btn ax-btn-primary ax-btn-sm"
                  aria-busy={pending}
                >
                  {pending && <span className="ax-spinner" aria-hidden />}
                  {pending ? t("saving") : t(edit ? "save" : "create")}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
