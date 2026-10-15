"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { CircleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { saveLocale, saveSidebar, saveTheme } from "@/app/actions";
import { CURRENCIES } from "@/components/clients/schema";
import { useToast } from "@/components/shell/Toasts";
import { describedBy, Field } from "@/components/ui/FormDrawer";
import type { Locale } from "@/lib/format";
import { updateProfile, updateWorkspace } from "./actions";
import { profileSchema, settingsErrors, workspaceSchema, type WorkspaceField } from "./schema";

const LANGS: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" },
];

/** Applies the theme before the server confirms (the cookie keeps it across a racing navigation). */
function applyTheme(next: "light" | "dark" | "system") {
  const d = document.documentElement;
  d.dataset.themePref = next;
  d.dataset.theme =
    next === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : next;
  document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
}

function rememberSidebar(state: "auto" | "collapsed" | "expanded") {
  document.cookie = `sidebar=${state}; path=/; max-age=31536000; samesite=lax`;
}

function subscribeTheme(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme-pref"] });
  return () => mo.disconnect();
}

/** DS › Languages: the language switch lives in Settings › General (and the user menu); the choice persists per user. */
export function GeneralSettings({ sidebar }: { sidebar: "auto" | "collapsed" | "expanded" }) {
  const t = useTranslations("settings.general");
  const toast = useToast();
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const pref = useSyncExternalStore(
    subscribeTheme,
    () =>
      (document.documentElement.dataset.themePref as "light" | "dark" | "system" | undefined) ??
      "light",
    () => "light",
  );
  const [side, setSide] = useState(sidebar);

  const setTheme = (next: "light" | "dark" | "system") => {
    applyTheme(next);
    void saveTheme(next).then(() => toast({ tone: "success", title: t("saved") }));
  };

  return (
    <div className="settings-stack">
      <section className="ax-card ax-card-body settings-section" aria-labelledby="set-lang">
        <h2 id="set-lang" className="rail-title">
          {t("language")}
        </h2>
        <p className="ax-help">{t("languageHelp")}</p>
        <nav className="ax-segmented settings-seg" aria-label={t("language")}>
          {LANGS.map((l) => (
            <Link
              key={l.code}
              href={`${pathname}?tab=general`}
              locale={l.code}
              lang={l.code}
              aria-current={l.code === locale ? "true" : undefined}
              onClick={() => void saveLocale(l.code)}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </section>

      <section className="ax-card ax-card-body settings-section" aria-labelledby="set-theme">
        <h2 id="set-theme" className="rail-title">
          {t("theme")}
        </h2>
        <p className="ax-help">{t("themeHelp")}</p>
        <div className="ax-segmented settings-seg" role="group" aria-labelledby="set-theme">
          {(["light", "dark", "system"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={pref === v} onClick={() => setTheme(v)}>
              {t(`theme_${v}`)}
            </button>
          ))}
        </div>
      </section>

      <section className="ax-card ax-card-body settings-section" aria-labelledby="set-side">
        <h2 id="set-side" className="rail-title">
          {t("sidebar")}
        </h2>
        <p className="ax-help">{t("sidebarHelp")}</p>
        <div className="ax-segmented settings-seg" role="group" aria-labelledby="set-side">
          {(["auto", "expanded", "collapsed"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={side === v}
              onClick={() => {
                setSide(v);
                rememberSidebar(v);
                void saveSidebar(v).then(() => {
                  toast({ tone: "success", title: t("saved") });
                  location.reload();
                });
              }}
            >
              {t(`sidebar_${v}`)}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

type FormProps<K extends string> = {
  initial: Record<K, string>;
  readOnly?: boolean;
};

/** Workspace details printed on every quotation and invoice. Owner only. */
export function WorkspaceForm({ initial, readOnly = false }: FormProps<WorkspaceField>) {
  const t = useTranslations("settings.workspace");
  const te = useTranslations("settings.errors");
  const toast = useToast();
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const dirty = (Object.keys(initial) as WorkspaceField[]).some((k) => v[k] !== saved[k]);

  const set = (k: WorkspaceField, value: string) => {
    const next = { ...v, [k]: value };
    setV(next);
    if (errors[k]) {
      const res = workspaceSchema.safeParse(next);
      setErrors((e) => ({ ...e, [k]: res.success ? "" : (settingsErrors(res.error)[k] ?? "") }));
    }
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = workspaceSchema.safeParse(v);
    if (!res.success) {
      const errs = settingsErrors(res.error);
      setErrors(errs);
      document.getElementById(`ws-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    start(async () => {
      const out = await updateWorkspace(v);
      if (!out.ok) {
        setErrors(out.errors);
        return;
      }
      setSaved(v);
      toast({ tone: "success", title: t("saved") });
    });
  };
  const err = (k: string) => (errors[k] ? te(errors[k] as never) : null);
  const input = (
    k: WorkspaceField,
    label: string,
    o: { ltr?: boolean; required?: boolean; help?: string } = {},
  ) => (
    <Field
      id={`ws-${k}`}
      label={label}
      required={o.required}
      error={err(k)}
      help={o.help}
      optionalLabel={t("optional")}
    >
      <input
        id={`ws-${k}`}
        className="ax-input"
        value={v[k]}
        dir={o.ltr ? "ltr" : undefined}
        readOnly={readOnly}
        aria-invalid={errors[k] ? true : undefined}
        aria-describedby={describedBy(`ws-${k}`, err(k), o.help)}
        onChange={(e) => set(k, e.target.value)}
      />
    </Field>
  );

  return (
    <form
      className="ax-card ax-card-body settings-section settings-form"
      onSubmit={submit}
      noValidate
      aria-labelledby="ws-title"
    >
      <h2 id="ws-title" className="rail-title">
        {t("title")}
      </h2>
      <p className="ax-help">{t("help")}</p>
      {readOnly && <p className="ax-banner info">{t("ownerOnly")}</p>}
      {errors.form && (
        <p className="ax-banner danger" role="alert">
          <CircleAlert className="ax-icon" aria-hidden />
          {te(errors.form as never)}
        </p>
      )}
      {input("name", t("name"), { required: true })}
      <Field
        id="ws-address"
        label={t("address")}
        optionalLabel={t("optional")}
        error={err("address")}
      >
        <textarea
          id="ws-address"
          className="ax-input"
          rows={2}
          value={v.address}
          readOnly={readOnly}
          onChange={(e) => set("address", e.target.value)}
        />
      </Field>
      <div className="nc-grid">
        <Field id="ws-defaultCurrency" label={t("currency")} required optionalLabel={t("optional")}>
          <select
            id="ws-defaultCurrency"
            className="ax-input"
            value={v.defaultCurrency}
            disabled={readOnly}
            onChange={(e) => set("defaultCurrency", e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="ws-defaultDocumentLanguage"
          label={t("documentLanguage")}
          required
          optionalLabel={t("optional")}
        >
          <select
            id="ws-defaultDocumentLanguage"
            className="ax-input"
            value={v.defaultDocumentLanguage}
            disabled={readOnly}
            onChange={(e) => set("defaultDocumentLanguage", e.target.value)}
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <h3 className="settings-sub">{t("legal")}</h3>
      <div className="nc-grid">
        {input("nif", "NIF", { ltr: true })}
        {input("rc", "RC", { ltr: true })}
      </div>
      <div className="nc-grid">
        {input("nis", "NIS", { ltr: true })}
        {input("ai", "AI", { ltr: true })}
      </div>
      {input("iban", "IBAN", { ltr: true, help: t("ibanHelp") })}
      {!readOnly && (
        <div className="settings-actions">
          <button
            type="button"
            className="ax-btn ax-btn-secondary ax-btn-sm"
            disabled={!dirty || pending}
            onClick={() => (setV(saved), setErrors({}))}
          >
            {t("reset")}
          </button>
          <button
            type="submit"
            className="ax-btn ax-btn-primary ax-btn-sm"
            aria-busy={pending}
            disabled={!dirty}
          >
            {pending && <span className="ax-spinner" aria-hidden />}
            {t("save")}
          </button>
        </div>
      )}
    </form>
  );
}

export function ProfileForm({ initial, email }: { initial: { name: string }; email: string }) {
  const t = useTranslations("settings.profile");
  const te = useTranslations("settings.errors");
  const toast = useToast();
  const [name, setName] = useState(initial.name);
  const [saved, setSaved] = useState(initial.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = profileSchema.safeParse({ name });
    if (!res.success) {
      setError(settingsErrors(res.error).name ?? "invalid");
      return;
    }
    start(async () => {
      const out = await updateProfile({ name });
      if (!out.ok) return setError(out.errors.name ?? "invalid");
      setSaved(name.trim());
      toast({ tone: "success", title: t("saved") });
    });
  };
  return (
    <form
      className="ax-card ax-card-body settings-section settings-form"
      onSubmit={submit}
      noValidate
      aria-labelledby="pf-title"
    >
      <h2 id="pf-title" className="rail-title">
        {t("title")}
      </h2>
      <Field
        id="pf-name"
        label={t("name")}
        required
        error={error ? te(error as never) : null}
        optionalLabel=""
      >
        <input
          id="pf-name"
          className="ax-input"
          value={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy("pf-name", error)}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
      </Field>
      <Field id="pf-email" label={t("email")} help={t("emailHelp")} optionalLabel="">
        <input
          id="pf-email"
          className="ax-input"
          dir="ltr"
          value={email}
          readOnly
          aria-describedby="pf-email-help"
        />
      </Field>
      <div className="settings-actions">
        <button
          type="submit"
          className="ax-btn ax-btn-primary ax-btn-sm"
          aria-busy={pending}
          disabled={name.trim() === saved}
        >
          {pending && <span className="ax-spinner" aria-hidden />}
          {t("save")}
        </button>
      </div>
    </form>
  );
}
