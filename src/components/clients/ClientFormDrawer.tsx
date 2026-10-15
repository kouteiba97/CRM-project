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
import { useSearchParams } from "next/navigation";
import { CircleAlert, TriangleAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/shell/Toasts";
import { createClient, updateClient } from "./actions";
import {
  CURRENCIES,
  fieldErrors,
  newClientSchema,
  type FieldErrors,
  type NewClientField,
} from "./schema";
import { patchQuery } from "./url";

export type ClientFormValues = Record<NewClientField, string>;
type Values = ClientFormValues;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * DS › Drawer (quick create, modal): `drawer-md`, scrim + focus trap, Esc closes (asks first when
 * there are edits), ⌘/Ctrl+Enter submits. FormValidation: validate on blur, then on every change.
 * Without `edit` it creates a client (`?new=1` on the list); with it, it edits one (`?edit=1` on the profile).
 */
export function ClientFormDrawer({
  owners,
  currentUserId,
  defaultCurrency,
  defaultLanguage,
  edit,
  closeHref,
}: {
  owners: { id: string; name: string }[];
  currentUserId: string;
  defaultCurrency: string;
  defaultLanguage: string;
  edit?: { id: string; values: Values };
  /** Where Cancel/Esc go; defaults to the list without `?new`. */
  closeHref?: string;
}) {
  const t = useTranslations("clients");
  const tn = useTranslations("clients.new");
  const te = useTranslations("clients.errors");
  const ts = useTranslations("status.client");
  const tc = useTranslations("common");
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  const initial: Values = edit?.values ?? {
    name: "",
    kind: "company",
    status: "active",
    email: "",
    phone: "",
    city: "",
    country: "",
    currency: (CURRENCIES as readonly string[]).includes(defaultCurrency) ? defaultCurrency : "EUR",
    documentLanguage: defaultLanguage,
    ownerId: currentUserId,
    tags: "",
    contactFirstName: "",
    contactLastName: "",
    contactJobTitle: "",
    contactEmail: "",
    contactPhone: "",
  };
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<NewClientField, boolean>>>({});
  const [formError, setFormError] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [pending, start] = useTransition();
  const dirty = (Object.keys(initial) as NewClientField[]).some((k) => values[k] !== initial[k]);

  const close = () => {
    router.replace(closeHref ?? `/clients${patchQuery(sp, {}, { keepPage: true })}`, {
      scroll: false,
    });
    (opener.current as HTMLElement | null)?.focus?.();
  };
  const requestClose = () => (dirty && !pending ? setConfirmDiscard(true) : close());

  useEffect(() => {
    opener.current = document.activeElement;
    panel.current?.querySelector<HTMLElement>("input")?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const validateField = (name: NewClientField, next: Values) => {
    const res = newClientSchema.safeParse(next);
    const all = res.success ? {} : fieldErrors(res.error);
    setErrors((e) => ({ ...e, [name]: all[name] }));
  };

  const set = (name: NewClientField, value: string) => {
    const next = { ...values, [name]: value };
    setValues(next);
    setConfirmDiscard(false);
    if (touched[name] || errors[name]) validateField(name, next);
  };
  const blur = (name: NewClientField) => {
    setTouched((x) => ({ ...x, [name]: true }));
    if (values[name] !== "" || errors[name]) validateField(name, values);
  };

  const focusFirstError = (errs: FieldErrors) => {
    const first = (Object.keys(initial) as NewClientField[]).find((k) => errs[k]);
    if (first) panel.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (pending) return;
    setFormError(false);
    const res = newClientSchema.safeParse(values);
    if (!res.success) {
      const errs = fieldErrors(res.error);
      setErrors(errs);
      focusFirstError(errs);
      return;
    }
    start(async () => {
      try {
        const out = edit ? await updateClient(edit.id, values) : await createClient(values);
        if (!out.ok) {
          setErrors(out.fieldErrors);
          if (out.formError) setFormError(true);
          focusFirstError(out.fieldErrors);
          return;
        }
        toast(
          edit
            ? { tone: "success", title: tn("updated", { name: out.name }) }
            : {
                tone: "success",
                title: tn("created", { name: out.name }),
                action: { label: tn("open"), run: () => router.push(`/clients/${out.id}`) },
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

  const field = (
    name: NewClientField,
    label: string,
    opts: {
      required?: boolean;
      type?: string;
      ltr?: boolean;
      help?: string;
      autoComplete?: string;
    } = {},
  ) => {
    const id = `nc-${name}`;
    const err = errors[name];
    const describedBy = err ? `${id}-err` : opts.help ? `${id}-help` : undefined;
    return (
      <div className="ax-field">
        <label className="ax-label" htmlFor={id}>
          {label}
          {opts.required ? (
            <span className="ax-req" aria-hidden>
              *
            </span>
          ) : (
            <span className="ax-opt">{tn("optional")}</span>
          )}
        </label>
        <input
          id={id}
          name={name}
          className="ax-input"
          type={opts.type ?? "text"}
          dir={opts.ltr ? "ltr" : undefined}
          value={values[name]}
          required={opts.required}
          autoComplete={opts.autoComplete ?? "off"}
          aria-invalid={err ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => set(name, e.target.value)}
          onBlur={() => blur(name)}
        />
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

  const select = (
    name: NewClientField,
    label: string,
    options: { value: string; label: string }[],
  ) => (
    <div className="ax-field">
      <label className="ax-label" htmlFor={`nc-${name}`}>
        {label}
      </label>
      <select
        id={`nc-${name}`}
        name={name}
        className="ax-input"
        value={values[name]}
        onChange={(e) => set(name, e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="drawer-layer" onKeyDown={onKeyDown}>
      <div className="ax-scrim drawer-scrim" aria-hidden onClick={requestClose} />
      <div
        ref={panel}
        className="ax-drawer drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="ax-drawer-head">
          <h2 id={titleId}>{edit ? tn("editTitle") : t("newClient")}</h2>
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
                {tn("failed")}
              </div>
            )}
            <fieldset className="nc-section">
              <legend className="nc-legend">{tn("sectionClient")}</legend>
              {field("name", tn("name"), { required: true, autoComplete: "organization" })}
              <div className="nc-grid">
                {select("kind", tn("kind"), [
                  { value: "company", label: tn("kindCompany") },
                  { value: "individual", label: tn("kindIndividual") },
                ])}
                {select(
                  "status",
                  tn("status"),
                  (["active", "prospect", "inactive"] as const).map((s) => ({
                    value: s,
                    label: ts(s),
                  })),
                )}
              </div>
              <div className="nc-grid">
                {field("email", tn("email"), { type: "email", ltr: true })}
                {field("phone", tn("phone"), { type: "tel", ltr: true, help: tn("phoneHelp") })}
              </div>
              <div className="nc-grid">
                {field("city", tn("city"))}
                {field("country", tn("country"), { ltr: true, help: tn("countryHelp") })}
              </div>
              <div className="nc-grid">
                {select(
                  "currency",
                  tn("currency"),
                  CURRENCIES.map((c) => ({ value: c, label: c })),
                )}
                {select("documentLanguage", tn("documentLanguage"), [
                  { value: "fr", label: "Français" },
                  { value: "ar", label: "العربية" },
                  { value: "en", label: "English" },
                ])}
              </div>
              {owners.length > 0 &&
                select(
                  "ownerId",
                  tn("owner"),
                  owners.map((o) => ({ value: o.id, label: o.name })),
                )}
              {field("tags", tn("tags"), { help: tn("tagsHelp") })}
            </fieldset>

            <fieldset className="nc-section">
              <legend className="nc-legend">{tn("sectionContact")}</legend>
              <div className="nc-grid">
                {field("contactFirstName", tn("firstName"), {
                  required: true,
                  autoComplete: "given-name",
                })}
                {field("contactLastName", tn("lastName"), { autoComplete: "family-name" })}
              </div>
              {field("contactJobTitle", tn("jobTitle"))}
              <div className="nc-grid">
                {field("contactEmail", tn("email"), { type: "email", ltr: true })}
                {field("contactPhone", tn("phone"), { type: "tel", ltr: true })}
              </div>
            </fieldset>
          </div>
          <div className="ax-drawer-foot">
            {confirmDiscard ? (
              <div className="ax-banner warning discard" role="alert">
                <TriangleAlert className="ax-icon" aria-hidden />
                <span>{tn(edit ? "discardEditQuestion" : "discardQuestion")}</span>
                <button
                  type="button"
                  className="ax-btn ax-btn-secondary ax-btn-xs"
                  onClick={() => setConfirmDiscard(false)}
                >
                  {tn("keepEditing")}
                </button>
                <button type="button" className="ax-btn ax-btn-danger ax-btn-xs" onClick={close}>
                  {tn("discard")}
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="ax-btn ax-btn-secondary ax-btn-sm"
                  onClick={requestClose}
                >
                  {tn("cancel")}
                </button>
                <button
                  type="submit"
                  className="ax-btn ax-btn-primary ax-btn-sm"
                  aria-busy={pending}
                >
                  {pending && <span className="ax-spinner" aria-hidden />}
                  {pending ? tn("saving") : tn(edit ? "save" : "create")}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
