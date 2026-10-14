"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useTranslations } from "next-intl";

type Toast = {
  id: number;
  tone: "success" | "danger" | "info";
  title: string;
  action?: { label: string; run: () => void };
};
type ToastInput = Omit<Toast, "id">;

const ToastContext = createContext<(t: ToastInput) => void>(() => {});
export const useToast = () => useContext(ToastContext);

/** DS › Interaction › Notifications: bottom end, max 3, 5s (8s with an action), errors persist. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const t = useTranslations("common");

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((x) => x.id !== id)), []);
  const push = useCallback((input: ToastInput) => {
    const id = next.current++;
    setToasts((all) => [...all, { ...input, id }].slice(-3));
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} closeLabel={t("close")} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
  closeLabel,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
  closeLabel: string;
}) {
  useEffect(() => {
    if (toast.tone === "danger") return;
    const timer = setTimeout(() => onDismiss(toast.id), toast.action ? 8000 : 5000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const Icon = toast.tone === "danger" ? CircleAlert : CircleCheck;
  return (
    <div className={`ax-toast ${toast.tone}`} role={toast.tone === "danger" ? "alert" : "status"}>
      <Icon className="ax-icon" aria-hidden />
      <div className="t">{toast.title}</div>
      <div className="ax-toast-actions">
        {toast.action && (
          <button
            type="button"
            className="ax-btn ax-btn-tertiary ax-btn-xs"
            onClick={() => {
              toast.action?.run();
              onDismiss(toast.id);
            }}
          >
            {toast.action.label}
          </button>
        )}
        <button
          type="button"
          className="ax-btn ax-btn-tertiary ax-btn-xs ax-btn-icon"
          aria-label={closeLabel}
          onClick={() => onDismiss(toast.id)}
        >
          <X className="ax-icon" aria-hidden />
        </button>
      </div>
    </div>
  );
}
