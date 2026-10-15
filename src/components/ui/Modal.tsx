"use client";

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * DS › Modal on a native <dialog> (focus trap, Esc, top layer): title + close, body, footer with
 * Cancel · primary. `⌘/Ctrl Enter` submits. It stays open while `pending` until the caller closes it.
 */
export function Modal({
  title,
  size,
  submitLabel,
  pending,
  onSubmit,
  onClose,
  children,
}: {
  title: string;
  size?: "sm";
  submitLabel: string;
  pending?: boolean;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const tc = useTranslations("common");
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // No close() in cleanup: Strict Mode re-runs effects and close() would fire onClose.
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`ax-modal app-modal${size === "sm" ? " sm" : ""}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          if (!pending) onSubmit();
        }
      }}
    >
      <form
        method="dialog"
        noValidate
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (!pending) onSubmit();
        }}
      >
        <div className="ax-modal-head">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="ax-btn ax-btn-tertiary ax-btn-sm ax-btn-icon"
            aria-label={tc("close")}
            onClick={onClose}
          >
            <X className="ax-icon" aria-hidden />
          </button>
        </div>
        <div className="ax-modal-body" inert={pending}>
          {children}
        </div>
        <div className="ax-modal-foot">
          <button type="button" className="ax-btn ax-btn-secondary ax-btn-sm" onClick={onClose}>
            {tc("cancel")}
          </button>
          <button type="submit" className="ax-btn ax-btn-primary ax-btn-sm" aria-busy={pending}>
            {pending && <span className="ax-spinner" aria-hidden />}
            {submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
