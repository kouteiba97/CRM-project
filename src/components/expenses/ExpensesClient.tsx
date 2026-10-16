"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { CURRENCIES } from "@/components/clients/schema";
import { useToast } from "@/components/shell/Toasts";
import { describedBy, Field, FormDrawer } from "@/components/ui/FormDrawer";
import { deleteExpense, saveExpense } from "./actions";

const CATEGORIES = ["software", "equipment", "office", "travel", "marketing", "services", "salaries", "taxes", "other"] as const;
const PERIODS = ["month", "last_month", "year", "all"] as const;
type Option = { value: string; label: string };
type Values = {
  spentOn: string;
  category: string;
  vendor: string;
  description: string;
  amount: string;
  currency: string;
  projectId: string;
  clientId: string;
};

/** Period chips + category filter, kept in the URL like every other list. */
export function ExpensesToolbar({ period, category }: { period: string; category: string }) {
  const t = useTranslations("expenses");
  const router = useRouter();
  const pathname = usePathname();
  const go = (k: string, v: string) => {
    const q = new URLSearchParams(window.location.search);
    if (v) q.set(k, v);
    else q.delete(k);
    router.replace(`${pathname}${q.toString() ? `?${q}` : ""}`, { scroll: false });
  };
  return (
    <div className="list-toolbar expenses-toolbar">
      <div className="ax-seg" role="group" aria-label={t("period")}>
        {PERIODS.map((p) => (
          <button key={p} type="button" aria-pressed={period === p} onClick={() => go("period", p === "month" ? "" : p)}>
            {t(`period_${p}`)}
          </button>
        ))}
      </div>
      <label className="sr-only" htmlFor="exp-filter-cat">
        {t("col_category")}
      </label>
      <select id="exp-filter-cat" className="ax-input expenses-cat" value={category} onChange={(e) => go("category", e.target.value)}>
        <option value="">{t("allCategories")}</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {t(`cat_${c}`)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ExpenseDrawer({
  expense,
  closeHref,
  defaultCurrency,
  projects,
  clients,
}: {
  expense: (Values & { id: string }) | null;
  closeHref: string;
  defaultCurrency: string;
  projects: Option[];
  clients: Option[];
}) {
  const t = useTranslations("expenses");
  const router = useRouter();
  const toast = useToast();
  const [initial] = useState<Values>(
    () =>
      expense ?? {
        spentOn: new Date().toLocaleDateString("sv"),
        category: "other",
        vendor: "",
        description: "",
        amount: "",
        currency: defaultCurrency,
        projectId: "",
        clientId: "",
      },
  );
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const dirty = (Object.keys(initial) as (keyof Values)[]).some((k) => v[k] !== initial[k]);
  const set = (k: keyof Values, value: string) => {
    setV((x) => ({ ...x, [k]: value }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };
  const close = () => router.replace(closeHref, { scroll: false });
  const err = (k: string) => (errors[k] ? t(`error_${errors[k]}` as never) : null);

  const submit = () =>
    start(async () => {
      try {
        const res = await saveExpense(expense?.id ?? null, v);
        if (!res.ok) {
          setErrors(res.errors);
          const first = Object.keys(res.errors)[0];
          if (first) document.getElementById(`exp-${first}`)?.focus();
          return;
        }
        toast({ tone: "success", title: t(expense ? "updated" : "created") });
        close();
      } catch {
        setFailed(true);
      }
    });

  return (
    <FormDrawer
      size="sm"
      title={t(expense ? "editTitle" : "newTitle")}
      dirty={dirty}
      pending={pending}
      submitLabel={t(expense ? "save" : "create")}
      savingLabel={t("saving")}
      discardQuestion={t("discardQuestion")}
      formError={failed ? t("failed") : null}
      onSubmit={submit}
      onClose={close}
      footerStart={
        expense ? (
          <button
            type="button"
            className="ax-btn ax-btn-tertiary ax-btn-sm is-danger"
            onClick={() =>
              start(async () => {
                await deleteExpense(expense.id);
                toast({ tone: "success", title: t("deleted") });
                close();
              })
            }
          >
            <Trash2 className="ax-icon" aria-hidden />
            {t("delete")}
          </button>
        ) : undefined
      }
    >
      <Field id="exp-description" label={t("description")} required error={err("description")} optionalLabel={t("optional")}>
        <input
          id="exp-description"
          className="ax-input"
          value={v.description}
          maxLength={300}
          aria-invalid={err("description") ? true : undefined}
          aria-describedby={describedBy("exp-description", err("description"))}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>
      <div className="nc-grid">
        <Field id="exp-amount" label={t("amount")} required error={err("amount")} optionalLabel={t("optional")}>
          <input
            id="exp-amount"
            className="ax-input num"
            inputMode="decimal"
            dir="ltr"
            value={v.amount}
            aria-invalid={err("amount") ? true : undefined}
            aria-describedby={describedBy("exp-amount", err("amount"))}
            onChange={(e) => set("amount", e.target.value)}
          />
        </Field>
        <Field id="exp-currency" label={t("currency")} required optionalLabel={t("optional")}>
          <select id="exp-currency" className="ax-input" value={v.currency} onChange={(e) => set("currency", e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="nc-grid">
        <Field id="exp-spentOn" label={t("date")} required error={err("spentOn")} optionalLabel={t("optional")}>
          <input id="exp-spentOn" type="date" className="ax-input" value={v.spentOn} onChange={(e) => set("spentOn", e.target.value)} />
        </Field>
        <Field id="exp-category" label={t("col_category")} required optionalLabel={t("optional")}>
          <select id="exp-category" className="ax-input" value={v.category} onChange={(e) => set("category", e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`cat_${c}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field id="exp-vendor" label={t("vendor")} optionalLabel={t("optional")}>
        <input id="exp-vendor" className="ax-input" value={v.vendor} maxLength={120} onChange={(e) => set("vendor", e.target.value)} />
      </Field>
      <Field id="exp-projectId" label={t("project")} optionalLabel={t("optional")}>
        <select id="exp-projectId" className="ax-input" value={v.projectId} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">{t("none")}</option>
          {projects.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>
      <Field id="exp-clientId" label={t("client")} optionalLabel={t("optional")} help={t("clientHelp")}>
        <select id="exp-clientId" className="ax-input" value={v.clientId} onChange={(e) => set("clientId", e.target.value)}>
          <option value="">{t("none")}</option>
          {clients.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
    </FormDrawer>
  );
}
