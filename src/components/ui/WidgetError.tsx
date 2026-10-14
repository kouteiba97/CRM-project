"use client";

import { useTransition } from "react";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

/** DS › ErrorState inside a widget: one failing section never blanks the page. */
export function WidgetError({ title }: { title: string }) {
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <section className="ax-card card" aria-label={title}>
      <div className="ax-empty" role="alert">
        <span className="tile danger" aria-hidden>
          <CircleAlert className="ax-icon" />
        </span>
        <h3>{t("widgetErrorTitle")}</h3>
        <p>{t("widgetErrorBody")}</p>
        <div className="ax-row">
          <button
            type="button"
            className="ax-btn ax-btn-secondary ax-btn-sm"
            aria-busy={pending}
            onClick={() => start(() => router.refresh())}
          >
            {pending && <span className="ax-spinner" aria-hidden />}
            {t("retry")}
          </button>
        </div>
      </div>
    </section>
  );
}
