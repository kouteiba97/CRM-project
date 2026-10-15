import { dirOf, formatter, type Locale } from "@/lib/format";
import type { DocumentKind } from "@/lib/documents";

/** Labels in the document's own language (DS › Languages: documents render in the client's document language). */
export type DocLabels = {
  invoice: string;
  quotation: string;
  issued: string;
  due: string;
  validUntil: string;
  billedTo: string;
  from: string;
  project: string;
  paymentDetails: string;
  reference: string;
  description: string;
  qty: string;
  unit: string;
  rate: string;
  amount: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  paidToDate: string;
  amountDue: string;
  terms: string;
  notes: string;
  legal: string;
  draftWatermark: string;
  stamps: Record<string, string>;
};

export type DocParty = {
  name: string;
  lines: (string | null | undefined)[];
  ids?: [string, string | null | undefined][];
};

export type DocData = {
  kind: DocumentKind;
  number: string;
  status: string;
  issueDate: string;
  /** Due date (invoice) or valid-until (quotation). */
  endDate: string | null;
  currency: string;
  from: DocParty;
  to: DocParty;
  iban?: string | null;
  project?: string | null;
  lines: {
    title: string;
    detail?: string | null;
    quantity: number;
    unit?: string | null;
    unitPriceMinor: number;
    amountMinor: number;
  }[];
  subtotalMinor: number;
  discountPct: number;
  discountMinor: number;
  taxMinor: number;
  taxRates: number[];
  totalMinor: number;
  paidMinor?: number;
  notes?: string | null;
  terms?: string | null;
};

/** As many decimals as the quantity has (1, 1.5, 0.125), never trailing zeros. */
const decimals = (q: number) => Math.min(3, String(q).split(".")[1]?.length ?? 0);

const STAMP_CLASS: Record<string, string> = {
  paid: "paid",
  overdue: "overdue",
  accepted: "paid",
  declined: "overdue",
};

/**
 * DS › InvoiceDocument: header (from + title/number/dates + status stamp in words), parties, line items,
 * totals (Amount due on the fill band), terms/notes and legal identifiers. Paper uses the fixed `doc-*`
 * tokens in both themes; Arabic documents mirror fully. Drafts carry a DRAFT watermark.
 */
export function DocumentView({
  data,
  labels,
  language,
}: {
  data: DocData;
  labels: DocLabels;
  language: Locale;
}) {
  const f = formatter(language);
  const n = (minor: number) => f.number(minor / 100, 2);
  const money = (minor: number) => f.money(minor, data.currency);
  const showStamp = data.status !== "sent" && data.status !== "viewed";
  const paid = data.paidMinor ?? 0;
  const ids = (data.from.ids ?? []).filter(([, v]) => v);
  const pct = (v: number) => f.number(v, Number.isInteger(v) ? 0 : 2);

  return (
    <article
      className={`ax-doc doc${data.status === "draft" ? " is-draft" : ""}`}
      lang={language}
      dir={dirOf(language)}
      data-watermark={labels.draftWatermark}
      aria-label={`${data.kind === "invoice" ? labels.invoice : labels.quotation} ${data.number}`}
    >
      <div className="ax-doc-head">
        <div className="doc-from">
          <div className="doc-brand" dir="auto">
            {data.from.name}
          </div>
          {data.from.lines.filter(Boolean).map((l, i) => (
            <div key={i} className="muted" dir="auto">
              {l}
            </div>
          ))}
        </div>
        <div className="doc-title">
          <h2 className="doc-h">{data.kind === "invoice" ? labels.invoice : labels.quotation}</h2>
          <div className="muted">
            <span className="doc-number ax-ltr">{data.number}</span>
            <br />
            {labels.issued} {f.date(data.issueDate)}
            {data.endDate && (
              <>
                {" · "}
                {data.kind === "invoice" ? labels.due : labels.validUntil} {f.date(data.endDate)}
              </>
            )}
          </div>
          {showStamp && labels.stamps[data.status] && (
            <div className="doc-stamp-wrap">
              <span className={`ax-doc-stamp ${STAMP_CLASS[data.status] ?? "draft"}`}>
                {labels.stamps[data.status]}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="ax-doc-parties">
        <div>
          <div className="lbl">{labels.billedTo}</div>
          <b dir="auto">{data.to.name}</b>
          {data.to.lines.filter(Boolean).map((l, i) => (
            <div key={i} className="muted" dir="auto">
              <span className={l?.includes("@") ? "ax-ltr" : undefined}>{l}</span>
            </div>
          ))}
          {(data.to.ids ?? [])
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="muted">
                {k} <span className="ax-ltr">{v}</span>
              </div>
            ))}
        </div>
        <div>
          {data.project && (
            <>
              <div className="lbl">{labels.project}</div>
              {data.project}
            </>
          )}
        </div>
        <div>
          <div className="lbl">{labels.paymentDetails}</div>
          {data.iban && (
            <div className="muted">
              IBAN <span className="ax-ltr">{data.iban}</span>
            </div>
          )}
          <div className="muted">
            {labels.reference} <span className="ax-ltr">{data.number}</span>
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th className="doc-idx">#</th>
            <th>{labels.description}</th>
            <th className="num">{labels.qty}</th>
            <th className="num">{labels.rate}</th>
            <th className="num">
              {labels.amount} ({data.currency})
            </th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>
                <b>{l.title}</b>
                {l.detail && <div className="muted">{l.detail}</div>}
              </td>
              <td className="num">
                {f.number(l.quantity, decimals(l.quantity))}
                {l.unit ? ` ${l.unit}` : ""}
              </td>
              <td className="num">{n(l.unitPriceMinor)}</td>
              <td className="num">{n(l.amountMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ax-doc-totals">
        <div className="r">
          <span className="muted">{labels.subtotal}</span>
          <span>{n(data.subtotalMinor)}</span>
        </div>
        {data.discountMinor > 0 && (
          <div className="r">
            <span className="muted">
              {labels.discount} ({pct(data.discountPct)}%)
            </span>
            <span>− {n(data.discountMinor)}</span>
          </div>
        )}
        <div className="r">
          <span className="muted">
            {labels.tax}
            {data.taxRates.length === 1
              ? ` (${pct(data.taxRates[0]!)}%)`
              : data.taxRates.length === 0
                ? " (0%)"
                : ""}
          </span>
          <span>{n(data.taxMinor)}</span>
        </div>
        <div className="r total">
          <span>{labels.total}</span>
          <span>{money(data.totalMinor)}</span>
        </div>
        {data.kind === "invoice" && (
          <>
            {paid > 0 && (
              <div className="r">
                <span className="muted">{labels.paidToDate}</span>
                <span>− {n(paid)}</span>
              </div>
            )}
            <div className="r due">
              <span>{labels.amountDue}</span>
              <span>{money(data.totalMinor - paid)}</span>
            </div>
          </>
        )}
      </div>

      <div className="ax-doc-foot">
        <div>
          {data.terms && (
            <>
              <div className="lbl">{labels.terms}</div>
              <p className="doc-text">{data.terms}</p>
            </>
          )}
          {data.notes && (
            <>
              <div className="lbl">{labels.notes}</div>
              <p className="doc-text">{data.notes}</p>
            </>
          )}
        </div>
        <div className="doc-legal">
          {ids.length > 0 && (
            <>
              <div className="lbl">{labels.legal}</div>
              {ids.map(([k, v]) => (
                <div key={k}>
                  {k} <span className="ax-ltr">{v}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </article>
  );
}
