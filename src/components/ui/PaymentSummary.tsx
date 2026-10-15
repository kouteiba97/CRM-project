import { CircleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Formatter } from "@/lib/format";

export type PaymentTotals = {
  currency: string;
  invoicedMinor: number;
  paidMinor: number;
  /** Issued, unpaid, not yet past due. */
  outstandingMinor: number;
  overdueMinor: number;
  /** Age of the oldest overdue invoice. */
  overdueDays: number;
};

/**
 * DS › PaymentSummary: Amount due headline, a composition bar (paid solid · outstanding solid ·
 * overdue hatched, so it never relies on colour) and legend rows with words and amounts.
 */
export async function PaymentSummary({
  totals,
  f,
  href,
}: {
  totals: PaymentTotals;
  f: Formatter;
  href?: string;
}) {
  const t = await getTranslations("payments.summary");
  const tc = await getTranslations("common");
  const { currency, invoicedMinor, paidMinor, outstandingMinor, overdueMinor } = totals;
  const dueMinor = outstandingMinor + overdueMinor;
  const base = Math.max(paidMinor + dueMinor, 1);
  const pct = (v: number) => `${(v / base) * 100}%`;
  return (
    <div className="pay-summary">
      <div className="pay-head">
        <div className="pay-amount">
          <span className="lbl">{t("amountDue")}</span>
          <span className="val ax-num">{f.money(dueMinor, currency)}</span>
          <span className="ax-faint">
            {t("ofInvoiced", { amount: f.money(invoicedMinor, currency) })}
          </span>
        </div>
      </div>
      <div
        className="ax-paybar"
        role="img"
        aria-label={t("barLabel", {
          paid: f.money(paidMinor, currency),
          outstanding: f.money(outstandingMinor, currency),
          overdue: f.money(overdueMinor, currency),
        })}
      >
        {paidMinor > 0 && <span className="paid" style={{ width: pct(paidMinor) }} />}
        {outstandingMinor > 0 && (
          <span className="pending" style={{ width: pct(outstandingMinor) }} />
        )}
        {overdueMinor > 0 && <span className="overdue" style={{ width: pct(overdueMinor) }} />}
      </div>
      <div className="ax-legend-row">
        <span className="sw sw-paid" aria-hidden />
        {t("paid")}
        <span className="amt">{f.money(paidMinor, currency)}</span>
      </div>
      <div className="ax-legend-row">
        <span className="sw sw-pending" aria-hidden />
        {t("outstanding")}
        <span className="amt">{f.money(outstandingMinor, currency)}</span>
      </div>
      <div className="ax-legend-row">
        <span className="sw sw-overdue" aria-hidden />
        {overdueMinor > 0 ? (
          <span className="pay-overdue">
            <CircleAlert className="ax-icon ax-icon-sm" aria-hidden />
            {tc("overdueDays", { days: totals.overdueDays })}
          </span>
        ) : (
          t("overdue")
        )}
        <span className="amt">{f.money(overdueMinor, currency)}</span>
      </div>
      {href && (
        <a className="ax-link pay-link" href={href}>
          {t("viewInvoices")}
        </a>
      )}
    </div>
  );
}

/** Totals over a list of invoices with their derived display status (issued ones only). */
export function paymentTotals(
  currency: string,
  rows: {
    status: string;
    totalMinor: number;
    paidMinor: number;
    balanceMinor: number;
    daysOverdue: number;
    currency: string;
  }[],
): PaymentTotals {
  const issued = rows.filter(
    (r) => r.currency === currency && !["draft", "void"].includes(r.status),
  );
  return {
    currency,
    invoicedMinor: issued.reduce((a, r) => a + r.totalMinor, 0),
    paidMinor: issued.reduce((a, r) => a + r.paidMinor, 0),
    outstandingMinor: issued
      .filter((r) => r.status !== "overdue")
      .reduce((a, r) => a + Math.max(0, r.balanceMinor), 0),
    overdueMinor: issued
      .filter((r) => r.status === "overdue")
      .reduce((a, r) => a + r.balanceMinor, 0),
    overdueDays: Math.max(0, ...issued.map((r) => r.daysOverdue)),
  };
}
