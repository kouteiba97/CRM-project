"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { AuthNotice } from "@/components/auth/AuthCard";
import { useToast } from "@/components/shell/Toasts";
import { describedBy, Field } from "@/components/ui/FormDrawer";
import { Modal } from "@/components/ui/Modal";
import { deleteAccount, requestEmailChange, sendSetPasswordLink } from "./account-actions";

/** POST to our own JSON route (same-origin; see lib/session-proof.ts). */
async function post<T>(url: string, body: unknown = {}): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

// ── Email ────────────────────────────────────────────────────────────────────────────────
export function EmailForm({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const t = useTranslations("settings.account");
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await requestEmailChange(next, password);
      if (!res.ok) return setError(res.error);
      setSentTo(res.email);
      setOpen(false);
      setPassword("");
    });
  };

  return (
    <section className="ax-card ax-card-body settings-section" aria-labelledby="em-title">
      <h2 id="em-title" className="rail-title">
        {t("emailTitle")}
      </h2>
      <p className="ax-help">
        {t.rich("emailCurrent", { email, b: (c) => <b dir="ltr">{c}</b> })}
      </p>
      {sentTo && (
        <AuthNotice tone="success">{t.rich("emailSent", { email: sentTo, b: (c) => <b dir="ltr">{c}</b> })}</AuthNotice>
      )}
      {!hasPassword && <p className="ax-banner info">{t("emailNeedsPassword")}</p>}
      {open ? (
        <form className="settings-form" onSubmit={submit} noValidate>
          <Field
            id="em-new"
            label={t("newEmail")}
            required
            error={error && ["invalid", "taken", "same"].includes(error) ? t(`emailError_${error}`) : null}
            optionalLabel=""
          >
            <input
              id="em-new"
              type="email"
              dir="ltr"
              autoComplete="email"
              className="ax-input"
              value={next}
              autoFocus
              aria-invalid={error && ["invalid", "taken", "same"].includes(error) ? true : undefined}
              onChange={(e) => {
                setNext(e.target.value);
                setError(null);
              }}
            />
          </Field>
          <Field
            id="em-password"
            label={t("currentPassword")}
            required
            error={error === "current_wrong" ? t("error_current_wrong") : null}
            optionalLabel=""
          >
            <PasswordInput
              id="em-password"
              autoComplete="current-password"
              value={password}
              invalid={error === "current_wrong"}
              aria-describedby={describedBy("em-password", error === "current_wrong" ? "x" : null)}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
            />
          </Field>
          {error === "mail" && <AuthNotice tone="error">{t("error_mail")}</AuthNotice>}
          <div className="settings-actions">
            <button type="button" className="ax-btn ax-btn-tertiary ax-btn-sm" onClick={() => setOpen(false)}>
              {t("cancel")}
            </button>
            <button type="submit" className="ax-btn ax-btn-primary ax-btn-sm" aria-busy={pending} disabled={pending}>
              {pending && <span className="ax-spinner" aria-hidden />}
              {t("sendLink")}
            </button>
          </div>
        </form>
      ) : (
        hasPassword && (
          <div>
            <button type="button" className="ax-btn ax-btn-secondary ax-btn-sm" onClick={() => setOpen(true)}>
              {t("changeEmail")}
            </button>
          </div>
        )
      )}
    </section>
  );
}

// ── Password ─────────────────────────────────────────────────────────────────────────────
export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("settings.account");
  const locale = useLocale();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);
  const [pending, start] = useTransition();

  if (!hasPassword) {
    return (
      <section className="ax-card ax-card-body settings-section" aria-labelledby="pw-title">
        <h2 id="pw-title" className="rail-title">
          {t("passwordTitle")}
        </h2>
        <p className="ax-help">{t("passwordGoogleOnly")}</p>
        {linkSent ? (
          <AuthNotice tone="success">{t("setLinkSent")}</AuthNotice>
        ) : (
          <div>
            <button
              type="button"
              className="ax-btn ax-btn-secondary ax-btn-sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await sendSetPasswordLink();
                  if (res.ok) setLinkSent(true);
                  else toast({ tone: "danger", title: t("error_mail") });
                })
              }
            >
              {t("sendSetLink")}
            </button>
          </div>
        )}
      </section>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setError("too_short");
    if (next !== confirm) return setError("mismatch");
    start(async () => {
      const res = await post<{ ok: boolean; error?: string }>("/api/account/password", { current, next, locale });
      if (!res.ok) return setError(res.error ?? "current_wrong");
      setCurrent("");
      setNext("");
      setConfirm("");
      toast({ tone: "success", title: t("passwordChanged") });
    });
  };
  const msg = (k: string) => (error === k ? t(`error_${k}`) : null);

  return (
    <form className="ax-card ax-card-body settings-section settings-form" onSubmit={submit} noValidate aria-labelledby="pw-title">
      <h2 id="pw-title" className="rail-title">
        {t("passwordTitle")}
      </h2>
      <Field id="pw-current" label={t("currentPassword")} required error={msg("current_wrong")} optionalLabel="">
        <PasswordInput
          id="pw-current"
          autoComplete="current-password"
          value={current}
          invalid={Boolean(msg("current_wrong"))}
          aria-describedby={describedBy("pw-current", msg("current_wrong"))}
          onChange={(e) => {
            setCurrent(e.target.value);
            setError(null);
          }}
        />
      </Field>
      <Field
        id="pw-new"
        label={t("newPassword")}
        required
        error={msg("too_short") ?? msg("same")}
        help={t("passwordHelp")}
        optionalLabel=""
      >
        <PasswordInput
          id="pw-new"
          autoComplete="new-password"
          value={next}
          invalid={Boolean(msg("too_short") ?? msg("same"))}
          aria-describedby={describedBy("pw-new", msg("too_short") ?? msg("same"), t("passwordHelp"))}
          onChange={(e) => {
            setNext(e.target.value);
            setError(null);
          }}
        />
      </Field>
      <Field id="pw-confirm" label={t("confirmPassword")} required error={msg("mismatch")} optionalLabel="">
        <PasswordInput
          id="pw-confirm"
          autoComplete="new-password"
          value={confirm}
          invalid={Boolean(msg("mismatch"))}
          aria-describedby={describedBy("pw-confirm", msg("mismatch"))}
          onChange={(e) => {
            setConfirm(e.target.value);
            setError(null);
          }}
        />
      </Field>
      <p className="ax-help">{t("passwordSignsOut")}</p>
      <div className="settings-actions">
        <button
          type="submit"
          className="ax-btn ax-btn-primary ax-btn-sm"
          aria-busy={pending}
          disabled={pending || !current || !next || !confirm}
        >
          {pending && <span className="ax-spinner" aria-hidden />}
          {t("changePassword")}
        </button>
      </div>
    </form>
  );
}

// ── Sessions ─────────────────────────────────────────────────────────────────────────────
export function SessionsCard() {
  const t = useTranslations("settings.security");
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  return (
    <section className="ax-card ax-card-body settings-section" aria-labelledby="ss-title">
      <h2 id="ss-title" className="rail-title">
        {t("sessionsTitle")}
      </h2>
      <p className="ax-help">{t("sessionsHelp")}</p>
      <div>
        <button type="button" className="ax-btn ax-btn-secondary ax-btn-sm" onClick={() => setConfirming(true)}>
          {t("signOutOthers")}
        </button>
      </div>
      {confirming && (
        <Modal
          title={t("signOutOthersTitle")}
          size="sm"
          submitLabel={t("signOutOthers")}
          pending={pending}
          onClose={() => setConfirming(false)}
          onSubmit={() =>
            start(async () => {
              await post("/api/account/sessions");
              setConfirming(false);
              toast({ tone: "success", title: t("signedOutOthers") });
            })
          }
        >
          <p>{t("signOutOthersBody")}</p>
        </Modal>
      )}
    </section>
  );
}

// ── Delete account ───────────────────────────────────────────────────────────────────────
export function DeleteAccountCard({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const t = useTranslations("settings.account");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ code: string; workspace?: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="ax-card ax-card-body settings-section danger-zone" aria-labelledby="del-title">
      <h2 id="del-title" className="rail-title">
        {t("deleteTitle")}
      </h2>
      <p className="ax-help">{t("deleteHelp")}</p>
      <div>
        <button type="button" className="ax-btn ax-btn-danger ax-btn-sm" onClick={() => setOpen(true)}>
          {t("deleteButton")}
        </button>
      </div>
      {open && (
        <Modal
          title={t("deleteConfirmTitle")}
          size="sm"
          submitLabel={t("deleteForever")}
          pending={pending}
          onClose={() => setOpen(false)}
          onSubmit={() =>
            start(async () => {
              const res = await deleteAccount(typed, password);
              if (res && !res.ok) setError({ code: res.error, workspace: res.workspace });
              else router.refresh();
            })
          }
        >
          <div className="settings-form">
            <p>{t("deleteConfirmBody")}</p>
            {error?.code === "transfer_first" && (
              <AuthNotice tone="error">{t("deleteTransferFirst", { workspace: error.workspace ?? "" })}</AuthNotice>
            )}
            <Field
              id="del-email"
              label={t("deleteTypeEmail", { email })}
              required
              error={error?.code === "confirm" ? t("deleteEmailMismatch") : null}
              optionalLabel=""
            >
              <input
                id="del-email"
                className="ax-input"
                dir="ltr"
                autoComplete="off"
                value={typed}
                aria-invalid={error?.code === "confirm" ? true : undefined}
                onChange={(e) => setTyped(e.target.value)}
              />
            </Field>
            {hasPassword && (
              <Field
                id="del-password"
                label={t("currentPassword")}
                required
                error={error?.code === "current_wrong" ? t("error_current_wrong") : null}
                optionalLabel=""
              >
                <PasswordInput
                  id="del-password"
                  autoComplete="current-password"
                  value={password}
                  invalid={error?.code === "current_wrong"}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}
