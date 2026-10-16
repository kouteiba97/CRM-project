"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

/**
 * A read-only side panel over a list (`?preview=<id>`): a quick look at one record without
 * leaving the list. Esc, the close button or the backdrop return to the list as it was.
 */
export function PreviewPanel({ title, closeHref, children }: { title: string; closeHref: string; children: ReactNode }) {
  const tc = useTranslations("common");
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // No close() in cleanup: Strict Mode re-runs effects and close() would fire onClose.
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  const close = () => router.replace(closeHref, { scroll: false });
  return (
    <dialog
      ref={ref}
      className="ax-drawer preview-panel"
      aria-labelledby={titleId}
      onClose={close}
      onClick={(e) => e.target === ref.current && close()}
    >
      <div className="preview-inner">
        <header className="preview-head">
          <h2 id={titleId} className="t-section-heading">
            {title}
          </h2>
          <button type="button" className="ax-btn ax-btn-tertiary ax-btn-sm ax-btn-icon" aria-label={tc("close")} onClick={close}>
            <X className="ax-icon" aria-hidden />
          </button>
        </header>
        <div className="preview-body">{children}</div>
      </div>
    </dialog>
  );
}
