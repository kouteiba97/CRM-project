"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { CircleAlert, TriangleAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * DS › Drawer for create/edit forms (modal): scrim + focus trap, focus on the first field, Esc closes
 * (asks inline before discarding edits), ⌘/Ctrl+Enter submits, Cancel · primary in the footer.
 * The form owns its fields and validation; this owns the mechanics.
 */
export function FormDrawer({
  title,
  size = "md",
  dirty,
  pending,
  submitLabel,
  savingLabel,
  discardQuestion,
  formError,
  onSubmit,
  onClose,
  footerStart,
  children,
}: {
  title: string;
  size?: "sm" | "md";
  dirty: boolean;
  pending: boolean;
  submitLabel: string;
  savingLabel: string;
  discardQuestion: string;
  formError?: string | null;
  onSubmit: () => void;
  onClose: () => void;
  /** A destructive or secondary action at the far start of the footer (e.g. Delete). */
  footerStart?: ReactNode;
  children: ReactNode;
}) {
  const tc = useTranslations("common");
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    opener.current = document.activeElement;
    panel.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const close = () => {
    onClose();
    (opener.current as HTMLElement | null)?.focus?.();
  };
  const requestClose = () => (dirty && !pending ? setConfirmDiscard(true) : close());

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (confirmDiscard) setConfirmDiscard(false);
      else requestClose();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!pending) onSubmit();
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

  return (
    <div className="drawer-layer" onKeyDown={onKeyDown}>
      <div className="ax-scrim drawer-scrim" aria-hidden onClick={requestClose} />
      <div
        ref={panel}
        className={`ax-drawer drawer-panel${size === "sm" ? " drawer-sm" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="ax-drawer-head">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="ax-btn ax-btn-tertiary ax-btn-sm ax-btn-icon"
            aria-label={tc("close")}
            onClick={requestClose}
          >
            <X className="ax-icon" aria-hidden />
          </button>
        </div>
        <form
          className="drawer-form"
          noValidate
          inert={pending}
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (!pending) onSubmit();
          }}
        >
          <div className="ax-drawer-body">
            {formError && (
              <div className="ax-banner danger" role="alert">
                <CircleAlert className="ax-icon" aria-hidden />
                {formError}
              </div>
            )}
            {children}
          </div>
          <div className="ax-drawer-foot">
            {confirmDiscard ? (
              <div className="ax-banner warning discard" role="alert">
                <TriangleAlert className="ax-icon" aria-hidden />
                <span>{discardQuestion}</span>
                <button
                  type="button"
                  className="ax-btn ax-btn-secondary ax-btn-xs"
                  onClick={() => setConfirmDiscard(false)}
                >
                  {tc("keepEditing")}
                </button>
                <button type="button" className="ax-btn ax-btn-danger ax-btn-xs" onClick={close}>
                  {tc("discard")}
                </button>
              </div>
            ) : (
              <>
                {footerStart && <div className="foot-start">{footerStart}</div>}
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
                  {pending ? savingLabel : submitLabel}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

/** Label (+ required star / "Optional"), the control, then the error or help line, wired with aria-describedby. */
export function Field({
  id,
  label,
  required,
  error,
  help,
  optionalLabel,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string | null;
  help?: string;
  optionalLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="ax-field">
      <label className="ax-label" htmlFor={id}>
        {label}
        {required ? (
          <span className="ax-req" aria-hidden>
            *
          </span>
        ) : (
          <span className="ax-opt">{optionalLabel}</span>
        )}
      </label>
      {children}
      {error ? (
        <span className="ax-error" id={`${id}-err`}>
          <CircleAlert className="ax-icon" aria-hidden />
          {error}
        </span>
      ) : help ? (
        <span className="ax-help" id={`${id}-help`}>
          {help}
        </span>
      ) : null}
    </div>
  );
}

/** aria-describedby for a Field's control. */
export const describedBy = (id: string, error?: string | null, help?: string) =>
  error ? `${id}-err` : help ? `${id}-help` : undefined;
