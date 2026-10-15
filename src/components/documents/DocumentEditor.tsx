"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { CircleAlert, GripVertical, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { CURRENCIES } from "@/components/clients/schema";
import { parseAmount } from "@/components/leads/schema";
import { useToast } from "@/components/shell/Toasts";
import { documentTotals, parsePercent, parseQuantity, type DocumentKind } from "@/lib/documents";
import { formatter, type Locale } from "@/lib/format";
import { saveDocument } from "./actions";
import { DocFrame } from "./DocFrame";
import { DocumentView, type DocLabels, type DocParty } from "./DocumentView";
import { documentErrors, documentSchema, type DocErrors, type LineDraft } from "./schema";

export type EditorHeader = {
  clientId: string;
  projectId: string;
  issueDate: string;
  endDate: string;
  currency: string;
  language: Locale;
  discountPct: string;
  notes: string;
  terms: string;
  milestoneId: string;
  leadId: string;
};

type ClientOpt = {
  id: string;
  name: string;
  currency: string | null;
  language: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  nif: string | null;
  rc: string | null;
};

let lineSeq = 0;
export const blankLine = (): LineDraft => ({
  key: `l${++lineSeq}`,
  title: "",
  detail: "",
  quantity: "1",
  unit: "",
  unitPrice: "",
  taxRate: "0",
});

/**
 * DS › Quotations & invoices › Editor: form left (client, dates, currency, line items with inline
 * editing, discount, notes, terms) and a live InvoiceDocument preview right at ≥ bp-xl; below it the
 * preview is a tab. `Enter` in a line adds a row, `⌘/Ctrl ⌫` removes it; totals recompute live.
 */
export function DocumentEditor({
  kind,
  docId,
  number,
  initial,
  initialLines,
  clients,
  projects,
  labels,
  from,
  iban,
  cancelHref,
}: {
  kind: DocumentKind;
  docId: string | null;
  number: string | null;
  initial: EditorHeader;
  initialLines: LineDraft[];
  clients: ClientOpt[];
  projects: { id: string; name: string; code: string; clientId: string }[];
  labels: Record<Locale, DocLabels>;
  from: DocParty;
  iban: string | null;
  cancelHref: string;
}) {
  const t = useTranslations("documents.editor");
  const te = useTranslations("documents.errors");
  const td = useTranslations("documents");
  const router = useRouter();
  const toast = useToast();
  const [h, setH] = useState(initial);
  const [lines, setLines] = useState<LineDraft[]>(
    initialLines.length ? initialLines : [blankLine()],
  );
  /** Errors the server returned (e.g. "only drafts can be edited"); field errors are derived live below. */
  const [serverErrors, setServerErrors] = useState<DocErrors>({});
  const [showErrors, setShowErrors] = useState(false);
  const [pending, start] = useTransition();
  const [pane, setPane] = useState<"form" | "preview">("form");
  const table = useRef<HTMLTableSectionElement>(null);
  const focusNext = useRef<{ key: string; field: string } | null>(null);
  const dragFrom = useRef<number | null>(null);
  const formId = useId();

  const payload = useMemo(
    () => ({ kind, ...h, lines: lines.map(({ key: _k, ...l }) => l) }),
    [kind, h, lines],
  );
  // Once the user has tried to save, validate live so messages clear as soon as fields are fixed.
  const liveErrors = useMemo(() => {
    if (!showErrors) return {};
    const res = documentSchema.safeParse(payload);
    return res.success ? {} : documentErrors(res.error);
  }, [payload, showErrors]);
  const errors: DocErrors = { ...liveErrors, ...serverErrors };

  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    table.current
      ?.querySelector<HTMLElement>(`[data-line="${target.key}"][data-field="${target.field}"]`)
      ?.focus();
  }, [lines]);

  const client = clients.find((c) => c.id === h.clientId) ?? null;
  const clientProjects = projects.filter((p) => p.clientId === h.clientId);
  const set = <K extends keyof EditorHeader>(k: K, v: EditorHeader[K]) =>
    setH((x) => ({ ...x, [k]: v }));
  const pickClient = (id: string) => {
    const c = clients.find((x) => x.id === id);
    setH((x) => ({
      ...x,
      clientId: id,
      projectId: projects.some((p) => p.id === x.projectId && p.clientId === id) ? x.projectId : "",
      currency:
        c?.currency && (CURRENCIES as readonly string[]).includes(c.currency)
          ? c.currency
          : x.currency,
      language: (c?.language as Locale | null) ?? x.language,
    }));
  };
  const setLine = (key: string, field: keyof LineDraft, value: string) =>
    setLines((all) => all.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  const addLine = (after?: number) =>
    setLines((all) => {
      const line = blankLine();
      focusNext.current = { key: line.key, field: "title" };
      const next = [...all];
      next.splice(after === undefined ? all.length : after + 1, 0, line);
      return next;
    });
  const removeLine = (index: number) =>
    setLines((all) => {
      if (all.length === 1) return all;
      const prev = all[index - 1] ?? all[index + 1];
      if (prev) focusNext.current = { key: prev.key, field: "title" };
      return all.filter((_, i) => i !== index);
    });
  const move = (from: number, to: number) =>
    setLines((all) => {
      if (to < 0 || to >= all.length) return all;
      const next = [...all];
      const [l] = next.splice(from, 1);
      next.splice(to, 0, l!);
      focusNext.current = { key: l!.key, field: "title" };
      return next;
    });

  const onLineKey = (e: KeyboardEvent<HTMLElement>, index: number) => {
    if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      addLine(index);
    } else if (e.key === "Backspace" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      removeLine(index);
    } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      move(index, index + (e.key === "ArrowUp" ? -1 : 1));
    }
  };

  // Live numbers for the preview and the totals card (invalid cells count as 0 until fixed).
  const parsed = lines.map((l) => ({
    title: l.title || "—",
    detail: l.detail || null,
    quantity: parseQuantity(l.quantity) ?? 0,
    unit: l.unit || null,
    unitPriceMinor: parseAmount(l.unitPrice) ?? 0,
    taxRate: parsePercent(l.taxRate) ?? 0,
  }));
  const discount = parsePercent(h.discountPct) ?? 0;
  const totals = documentTotals(parsed, discount);
  // The form speaks the UI language; only the preview follows the document language.
  const fmt = formatter(useLocale() as Locale);
  const docLabels = labels[h.language];

  const save = () => {
    setServerErrors({});
    const res = documentSchema.safeParse(payload);
    if (!res.success) {
      setShowErrors(true);
      setPane("form");
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(`#${CSS.escape(formId)} [aria-invalid="true"]`)
          ?.focus(),
      );
      return;
    }
    start(async () => {
      const out = await saveDocument(docId, payload);
      if (!out.ok) {
        setServerErrors(out.errors);
        setShowErrors(true);
        return;
      }
      toast({ tone: "success", title: t(docId ? "saved" : "created", { number: out.number }) });
      router.push(`/${kind === "invoice" ? "invoices" : "quotations"}/${out.id}`);
    });
  };

  const err = (key: string) => (errors[key] ? te(errors[key] as never) : null);
  const errorCount = Object.keys(errors).filter((k) => k !== "form").length;
  const cell = (
    l: LineDraft,
    index: number,
    field: keyof LineDraft,
    label: string,
    o: { num?: boolean; mode?: "decimal" } = {},
  ) => {
    const key = `lines.${index}.${field}`;
    return (
      <input
        className={`ax-input li-${field}${o.num ? " ax-num" : ""}`}
        data-line={l.key}
        data-field={field}
        value={l[field]}
        dir={o.num ? "ltr" : undefined}
        inputMode={o.mode}
        aria-label={`${label} · ${t("lineN", { n: index + 1 })}`}
        aria-invalid={errors[key] ? true : undefined}
        title={err(key) ?? undefined}
        onChange={(e) => setLine(l.key, field, e.target.value)}
        onKeyDown={(e) => onLineKey(e, index)}
      />
    );
  };

  return (
    <div className={`editor pane-${pane}`}>
      <div className="ax-segmented editor-tabs" role="group" aria-label={t("view")}>
        <button type="button" aria-pressed={pane === "form"} onClick={() => setPane("form")}>
          {t("form")}
        </button>
        <button type="button" aria-pressed={pane === "preview"} onClick={() => setPane("preview")}>
          {t("preview")}
        </button>
      </div>

      <form
        id={formId}
        className="editor-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          }
        }}
        inert={pending}
      >
        {showErrors && (errorCount > 0 || errors.form) && (
          <div className="ax-banner danger" role="alert">
            <CircleAlert className="ax-icon" aria-hidden />
            {errors.form ? te(errors.form as never) : t("needsAttention", { count: errorCount })}
          </div>
        )}

        <section
          className="ax-card ax-card-body editor-section"
          aria-labelledby={`${formId}-parties`}
        >
          <h2 id={`${formId}-parties`} className="rail-title">
            {t("details")}
          </h2>
          <div className="nc-grid">
            <EField id="ed-client" label={t("client")} error={err("clientId")} required>
              <select
                id="ed-client"
                className="ax-input"
                value={h.clientId}
                aria-invalid={errors.clientId ? true : undefined}
                aria-describedby={errors.clientId ? "ed-client-err" : undefined}
                onChange={(e) => pickClient(e.target.value)}
              >
                <option value="">{t("chooseClient")}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </EField>
            <EField id="ed-project" label={t("project")} optional={t("optional")}>
              <select
                id="ed-project"
                className="ax-input"
                value={h.projectId}
                disabled={!h.clientId}
                onChange={(e) => set("projectId", e.target.value)}
              >
                <option value="">{t("noProject")}</option>
                {clientProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
              </select>
            </EField>
          </div>
          <div className="nc-grid">
            <EField id="ed-issue" label={t("issueDate")} error={err("issueDate")} required>
              <input
                id="ed-issue"
                className="ax-input"
                type="date"
                value={h.issueDate}
                aria-invalid={errors.issueDate ? true : undefined}
                aria-describedby={errors.issueDate ? "ed-issue-err" : undefined}
                onChange={(e) => set("issueDate", e.target.value)}
              />
            </EField>
            <EField
              id="ed-end"
              label={kind === "invoice" ? t("dueDate") : t("validUntil")}
              error={err("endDate")}
              required={kind === "invoice"}
              optional={t("optional")}
            >
              <input
                id="ed-end"
                className="ax-input"
                type="date"
                value={h.endDate}
                aria-invalid={errors.endDate ? true : undefined}
                aria-describedby={errors.endDate ? "ed-end-err" : undefined}
                onChange={(e) => set("endDate", e.target.value)}
              />
            </EField>
          </div>
          <div className="nc-grid">
            <EField id="ed-currency" label={t("currency")} required>
              <select
                id="ed-currency"
                className="ax-input"
                value={h.currency}
                onChange={(e) => set("currency", e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </EField>
            <EField id="ed-lang" label={t("language")} required help={t("languageHelp")}>
              <select
                id="ed-lang"
                className="ax-input"
                value={h.language}
                aria-describedby="ed-lang-help"
                onChange={(e) => set("language", e.target.value as Locale)}
              >
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </EField>
          </div>
        </section>

        <section
          className="ax-card editor-section editor-lines"
          aria-labelledby={`${formId}-lines`}
        >
          <div className="ax-card-head ruled">
            <h2 id={`${formId}-lines`} className="rail-title">
              {t("lineItems")}
            </h2>
            <span className="ax-faint lines-hint">{t("linesHint")}</span>
          </div>
          {errors.lines && <p className="ax-error lines-err">{te(errors.lines as never)}</p>}
          <div className="lines-scroll">
            <table className="ax-table lines-table">
              <thead>
                <tr>
                  <th aria-label={t("reorder")} className="li-handle-col" />
                  <th scope="col">{t("description")}</th>
                  <th scope="col" className="num">
                    {t("qty")}
                  </th>
                  <th scope="col">{t("unit")}</th>
                  <th scope="col" className="num">
                    {t("rate")}
                  </th>
                  <th scope="col" className="num">
                    {t("tax")}
                  </th>
                  <th scope="col" className="num">
                    {t("amount")}
                  </th>
                  <th aria-label={t("actions")} />
                </tr>
              </thead>
              <tbody ref={table}>
                {lines.map((l, i) => (
                  <tr
                    key={l.key}
                    onDragOver={(e: DragEvent) => {
                      if (dragFrom.current !== null) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragFrom.current !== null) move(dragFrom.current, i);
                      dragFrom.current = null;
                    }}
                  >
                    <td className="li-handle-col">
                      <button
                        type="button"
                        className="ax-btn ax-btn-tertiary ax-btn-xs ax-btn-icon li-handle"
                        draggable
                        aria-label={t("moveLine", { n: i + 1 })}
                        title={t("moveHint")}
                        onDragStart={(e) => {
                          dragFrom.current = i;
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onKeyDown={(e) => onLineKey(e, i)}
                      >
                        <GripVertical className="ax-icon" aria-hidden />
                      </button>
                    </td>
                    <td className="li-desc">
                      {cell(l, i, "title", t("lineTitle"))}
                      <input
                        className="ax-input li-detail"
                        data-line={l.key}
                        data-field="detail"
                        value={l.detail ?? ""}
                        placeholder={t("detailPlaceholder")}
                        aria-label={`${t("lineDetail")} · ${t("lineN", { n: i + 1 })}`}
                        onChange={(e) => setLine(l.key, "detail", e.target.value)}
                        onKeyDown={(e) => onLineKey(e, i)}
                      />
                      {errors[`lines.${i}.title`] && (
                        <span className="ax-error">{err(`lines.${i}.title`)}</span>
                      )}
                    </td>
                    <td className="num">
                      {cell(l, i, "quantity", t("qty"), { num: true, mode: "decimal" })}
                    </td>
                    <td>{cell(l, i, "unit", t("unit"))}</td>
                    <td className="num">
                      {cell(l, i, "unitPrice", t("rate"), { num: true, mode: "decimal" })}
                    </td>
                    <td className="num">
                      {cell(l, i, "taxRate", t("tax"), { num: true, mode: "decimal" })}
                    </td>
                    <td className="num li-amount" aria-live="off">
                      {fmt.number((totals.amounts[i] ?? 0) / 100, 2)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ax-btn ax-btn-tertiary ax-btn-xs ax-btn-icon"
                        aria-label={t("removeLine", { n: i + 1 })}
                        disabled={lines.length === 1}
                        onClick={() => removeLine(i)}
                      >
                        <Trash2 className="ax-icon" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lines.some((_, i) =>
            ["quantity", "unitPrice", "taxRate"].some((f) => errors[`lines.${i}.${f}`]),
          ) && <p className="ax-error lines-err">{t("lineNumbersInvalid")}</p>}
          <div className="lines-foot">
            <button
              type="button"
              className="ax-btn ax-btn-secondary ax-btn-sm"
              onClick={() => addLine()}
            >
              <Plus className="ax-icon" aria-hidden />
              {t("addLine")}
            </button>
          </div>
        </section>

        <section
          className="ax-card ax-card-body editor-section editor-totals-wrap"
          aria-labelledby={`${formId}-totals`}
        >
          <h2 id={`${formId}-totals`} className="sr-only">
            {t("totals")}
          </h2>
          <div className="editor-extra">
            <EField
              id="ed-discount"
              label={t("discount")}
              error={err("discountPct")}
              optional={t("optional")}
            >
              <input
                id="ed-discount"
                className="ax-input ax-num"
                dir="ltr"
                inputMode="decimal"
                value={h.discountPct}
                aria-invalid={errors.discountPct ? true : undefined}
                aria-describedby={errors.discountPct ? "ed-discount-err" : undefined}
                onChange={(e) => set("discountPct", e.target.value)}
              />
            </EField>
            <EField id="ed-notes" label={t("notes")} optional={t("optional")}>
              <textarea
                id="ed-notes"
                className="ax-input"
                rows={2}
                value={h.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </EField>
            <EField id="ed-terms" label={t("terms")} optional={t("optional")}>
              <textarea
                id="ed-terms"
                className="ax-input"
                rows={2}
                value={h.terms}
                placeholder={t("termsPlaceholder")}
                onChange={(e) => set("terms", e.target.value)}
              />
            </EField>
          </div>
          <dl className="editor-totals" aria-live="polite">
            <div>
              <dt>{t("subtotal")}</dt>
              <dd>{fmt.money(totals.subtotalMinor, h.currency)}</dd>
            </div>
            {totals.discountMinor > 0 && (
              <div>
                <dt>{t("discount")}</dt>
                <dd>− {fmt.money(totals.discountMinor, h.currency)}</dd>
              </div>
            )}
            <div>
              <dt>{t("taxAmount")}</dt>
              <dd>{fmt.money(totals.taxMinor, h.currency)}</dd>
            </div>
            <div className="total">
              <dt>{t("total")}</dt>
              <dd>{fmt.money(totals.totalMinor, h.currency)}</dd>
            </div>
          </dl>
        </section>

        <div className="editor-actions">
          <Link className="ax-btn ax-btn-secondary ax-btn-sm" href={cancelHref}>
            {t("cancel")}
          </Link>
          <button
            type="submit"
            className="ax-btn ax-btn-primary ax-btn-sm"
            aria-busy={pending}
            title="Ctrl + Enter"
          >
            {pending && <span className="ax-spinner" aria-hidden />}
            {pending ? t("saving") : t("saveDraft")}
          </button>
        </div>
      </form>

      <aside className="editor-preview" aria-label={t("preview")}>
        <DocFrame
          bar={
            <>
              <span className="ax-mono ax-ltr doc-bar-number">{number ?? td("newNumber")}</span>
              <span className="ax-spacer" />
            </>
          }
        >
          <DocumentView
            language={h.language}
            labels={docLabels}
            data={{
              kind,
              number: number ?? "—",
              status: "draft",
              issueDate: h.issueDate || new Date().toISOString().slice(0, 10),
              endDate: h.endDate || null,
              currency: h.currency,
              from,
              iban,
              to: client
                ? {
                    name: client.name,
                    lines: [
                      client.address,
                      [client.city, client.country].filter(Boolean).join(", ") || null,
                      client.email,
                    ],
                    ids: [
                      ["NIF", client.nif],
                      ["RC", client.rc],
                    ],
                  }
                : { name: "—", lines: [] },
              project: projects.find((p) => p.id === h.projectId)?.name ?? null,
              lines: parsed.map((p, i) => ({ ...p, amountMinor: totals.amounts[i] ?? 0 })),
              subtotalMinor: totals.subtotalMinor,
              discountPct: discount,
              discountMinor: totals.discountMinor,
              taxMinor: totals.taxMinor,
              taxRates: totals.rates,
              totalMinor: totals.totalMinor,
              paidMinor: 0,
              notes: h.notes || null,
              terms: h.terms || null,
            }}
          />
        </DocFrame>
      </aside>
    </div>
  );
}

function EField({
  id,
  label,
  error,
  required,
  optional,
  help,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  required?: boolean;
  optional?: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ax-field">
      <label className="ax-label" htmlFor={id}>
        {label}
        {required ? (
          <span className="ax-req" aria-hidden>
            *
          </span>
        ) : optional ? (
          <span className="ax-opt">{optional}</span>
        ) : null}
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
