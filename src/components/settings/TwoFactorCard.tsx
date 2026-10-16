"use client";

import { useState, useTransition } from "react";
import { Download, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { useToast } from "@/components/shell/Toasts";
import { describedBy, Field } from "@/components/ui/FormDrawer";
import { Modal } from "@/components/ui/Modal";
import { beginTwoFactor, confirmTwoFactor, disableTwoFactor, regenerateRecoveryCodes } from "./two-factor-actions";

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const t = useTranslations("settings.twoFactor");
  const [saved, setSaved] = useState(false);
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([`Apex CRM recovery codes\n\n${codes.join("\n")}\n`], { type: "text/plain" }));
    a.download = "apex-crm-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="settings-form">
      <p className="ax-banner warning">{t("codesWarning")}</p>
      <ol className="recovery-codes" dir="ltr">
        {codes.map((c) => (
          <li key={c} className="ax-mono">
            {c}
          </li>
        ))}
      </ol>
      <div className="settings-seg">
        <button type="button" className="ax-btn ax-btn-secondary ax-btn-sm" onClick={download}>
          <Download className="ax-icon" aria-hidden />
          {t("download")}
        </button>
      </div>
      <label className="ax-choice">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        {t("savedThem")}
      </label>
      <div className="settings-actions">
        <button type="button" className="ax-btn ax-btn-primary ax-btn-sm" disabled={!saved} onClick={onDone}>
          {t("done")}
        </button>
      </div>
    </div>
  );
}

export function TwoFactorCard({ enabled, since, hasPassword }: { enabled: boolean; since: string | null; hasPassword: boolean }) {
  const t = useTranslations("settings.twoFactor");
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [setup, setSetup] = useState<{ svg: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [dialog, setDialog] = useState<"off" | "regen" | null>(null);

  const reset = () => {
    setCode("");
    setPassword("");
    setError(null);
  };

  return (
    <section className="ax-card ax-card-body settings-section" aria-labelledby="tf-title">
      <h2 id="tf-title" className="rail-title">
        {t("title")}
      </h2>
      <p className="ax-help">{t("help")}</p>

      {codes ? (
        <RecoveryCodes
          codes={codes}
          onDone={() => {
            setCodes(null);
            router.refresh();
          }}
        />
      ) : enabled ? (
        <>
          <p className="tf-status">
            <ShieldCheck className="ax-icon" aria-hidden />
            {t("on", { date: since ?? "" })}
          </p>
          <div className="settings-seg">
            <button type="button" className="ax-btn ax-btn-secondary ax-btn-sm" onClick={() => (reset(), setDialog("regen"))}>
              {t("newCodes")}
            </button>
            <button type="button" className="ax-btn ax-btn-tertiary ax-btn-sm" onClick={() => (reset(), setDialog("off"))}>
              {t("turnOff")}
            </button>
          </div>
        </>
      ) : setup ? (
        <form
          className="settings-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await confirmTwoFactor(code);
              if (!res.ok) return setError("code");
              setSetup(null);
              setCodes(res.codes);
              toast({ tone: "success", title: t("turnedOn") });
            });
          }}
        >
          <ol className="tf-steps">
            <li>{t("step1")}</li>
            <li>
              {t("step2")}
              {/* A data-URL SVG made on our server: next/image would add nothing here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="tf-qr" alt={t("qrAlt")} src={`data:image/svg+xml;utf8,${encodeURIComponent(setup.svg)}`} width={180} height={180} />
              <span className="ax-help">
                {t("manual")} <code dir="ltr" className="ax-mono tf-secret">{setup.secret}</code>
              </span>
            </li>
            <li>{t("step3")}</li>
          </ol>
          <Field id="tf-code" label={t("code")} required error={error ? t("badCode") : null} optionalLabel="">
            <input
              id="tf-code"
              className="ax-input login-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              maxLength={7}
              value={code}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy("tf-code", error ? "x" : null)}
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
              }}
            />
          </Field>
          <div className="settings-actions">
            <button type="button" className="ax-btn ax-btn-tertiary ax-btn-sm" onClick={() => setSetup(null)}>
              {t("cancel")}
            </button>
            <button type="submit" className="ax-btn ax-btn-primary ax-btn-sm" disabled={pending || code.length < 6}>
              {t("verify")}
            </button>
          </div>
        </form>
      ) : (
        <div>
          <button
            type="button"
            className="ax-btn ax-btn-primary ax-btn-sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                reset();
                const res = await beginTwoFactor();
                if (res.ok) setSetup({ svg: res.svg, secret: res.secret });
              })
            }
          >
            {t("turnOn")}
          </button>
        </div>
      )}

      {dialog && (
        <Modal
          title={dialog === "off" ? t("offTitle") : t("regenTitle")}
          size="sm"
          submitLabel={dialog === "off" ? t("turnOff") : t("newCodes")}
          pending={pending}
          onClose={() => setDialog(null)}
          onSubmit={() =>
            start(async () => {
              if (dialog === "off") {
                const res = await disableTwoFactor(password, code);
                if (!res.ok) return setError(res.error);
                setDialog(null);
                toast({ tone: "success", title: t("turnedOff") });
                router.refresh();
              } else {
                const res = await regenerateRecoveryCodes(code);
                if (!res.ok) return setError("code");
                setDialog(null);
                setCodes(res.codes);
              }
            })
          }
        >
          <div className="settings-form">
            <p>{dialog === "off" ? t("offBody") : t("regenBody")}</p>
            {dialog === "off" && hasPassword && (
              <Field id="tf-password" label={t("password")} required error={error === "password" ? t("badPassword") : null} optionalLabel="">
                <PasswordInput
                  id="tf-password"
                  autoComplete="current-password"
                  value={password}
                  invalid={error === "password"}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
            )}
            <Field
              id="tf-dialog-code"
              label={dialog === "off" ? t("codeOrRecovery") : t("code")}
              required
              error={error === "code" ? t("badCode") : null}
              optionalLabel=""
            >
              <input
                id="tf-dialog-code"
                className="ax-input login-code"
                autoComplete="one-time-code"
                dir="ltr"
                maxLength={40}
                value={code}
                aria-invalid={error === "code" ? true : undefined}
                onChange={(e) => setCode(e.target.value)}
              />
            </Field>
          </div>
        </Modal>
      )}
    </section>
  );
}
