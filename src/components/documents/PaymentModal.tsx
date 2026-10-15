"use client";

import { useMemo, useState, useTransition } from "react";
import { CircleAlert, TriangleAlert, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAmount } from "@/components/leads/schema";
import { useToast } from "@/components/shell/Toasts";
import { Modal } from "@/components/ui/Modal";
import { formatter, type Locale } from "@/lib/format";
import { recordPayment } from "./actions";
import { PAYMENT_METHODS } from "./schema";

export type PayableInvoice = {
  id: string;
  number: string;
  clientName: string;
  balanceMinor: number;
  currency: string;
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * DS › Payments › Record payment: pre-fills the balance; partial amounts are fine (the invoice becomes
 * Partially paid); more than the balance warns that the rest is kept as a credit. One idempotency key per
 * opening, so a double submit records one payment. From the Payments list it starts with an invoice picker.
 */
export function PaymentModal({
  invoice,
  invoices,
  locale,
  onClose,
}: {
  invoice?: PayableInvoice;
  invoices?: PayableInvoice[];
  locale: Locale;
  onClose: () => void;
}) {
  const t = useTranslations("documents.pay");
  const tm = useTranslations("clients.method");
  const toast = useToast();
  const f = formatter(locale);
  const key = useMemo(() => crypto.randomUUID(), []);
  const [chosen, setChosen] = useState<PayableInvoice | null>(invoice ?? null);
  const [amount, setAmount] = useState(invoice ? (invoice.balanceMinor / 100).toFixed(2) : "");
  const [paidOn, setPaidOn] = useState(today());
  const [method, setMethod] = useState<string>("bank_transfer");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const minor = parseAmount(amount);
  const over = !!chosen && minor !== null && minor > chosen.balanceMinor;

  const pick = (id: string) => {
    const inv = invoices?.find((i) => i.id === id) ?? null;
    setChosen(inv);
    setAmount(inv ? (inv.balanceMinor / 100).toFixed(2) : "");
    setError(null);
  };

  const submit = () => {
    if (!chosen) return setError(t("invoiceError"));
    if (minor === null || minor <= 0) return setError(t("amountError"));
    if (!paidOn) return setError(t("dateError"));
    start(async () => {
      try {
        const res = await recordPayment(chosen.id, { amount, paidOn, method, reference, key });
        if (!res.ok) return setError(t("failed"));
        toast({
          tone: "success",
          title:
            res.balanceMinor > 0
              ? t("partial", {
                  number: res.number,
                  balance: f.money(res.balanceMinor, chosen.currency),
                })
              : t("paid", { number: res.number }),
        });
        onClose();
      } catch {
        setError(t("failed"));
      }
    });
  };

  return (
    <Modal
      title={t("title")}
      submitLabel={t("submit")}
      pending={pending}
      onSubmit={submit}
      onClose={onClose}
    >
      {invoices && (
        <div className="ax-field">
          <label className="ax-label" htmlFor="pay-invoice">
            {t("invoice")}
          </label>
          <select
            id="pay-invoice"
            className="ax-input"
            value={chosen?.id ?? ""}
            aria-invalid={error === t("invoiceError") ? true : undefined}
            onChange={(e) => pick(e.target.value)}
            autoFocus
          >
            <option value="">{t("chooseInvoice")}</option>
            {invoices.map((i) => (
              <option key={i.id} value={i.id}>
                {i.number} · {i.clientName} · {f.money(i.balanceMinor, i.currency)}
              </option>
            ))}
          </select>
        </div>
      )}
      {chosen && (
        <p className="ax-banner info pay-context">
          <Wallet className="ax-icon" aria-hidden />
          <span>
            <span className="ax-mono ax-ltr">{chosen.number}</span> · {chosen.clientName} ·{" "}
            {t("balance")} <b className="ax-num">{f.money(chosen.balanceMinor, chosen.currency)}</b>
          </span>
        </p>
      )}
      <div className="nc-grid">
        <div className="ax-field">
          <label className="ax-label" htmlFor="pay-amount">
            {t("amount")}
            {chosen ? ` (${chosen.currency})` : ""}
          </label>
          <input
            id="pay-amount"
            className="ax-input ax-num"
            dir="ltr"
            inputMode="decimal"
            value={amount}
            aria-invalid={error === t("amountError") ? true : undefined}
            aria-describedby={over ? "pay-over" : error ? "pay-err" : undefined}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
            autoFocus={!invoices}
          />
        </div>
        <div className="ax-field">
          <label className="ax-label" htmlFor="pay-date">
            {t("date")}
          </label>
          <input
            id="pay-date"
            className="ax-input"
            type="date"
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
          />
        </div>
      </div>
      <div className="nc-grid">
        <div className="ax-field">
          <label className="ax-label" htmlFor="pay-method">
            {t("method")}
          </label>
          <select
            id="pay-method"
            className="ax-input"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {tm(m)}
              </option>
            ))}
          </select>
        </div>
        <div className="ax-field">
          <label className="ax-label" htmlFor="pay-ref">
            {t("reference")} <span className="ax-opt">{t("optional")}</span>
          </label>
          <input
            id="pay-ref"
            className="ax-input"
            dir="ltr"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>
      </div>
      {over && minor !== null && chosen && (
        <p className="pay-warning" id="pay-over" role="status">
          <TriangleAlert className="ax-icon" aria-hidden />
          {t("overpayment", { credit: f.money(minor - chosen.balanceMinor, chosen.currency) })}
        </p>
      )}
      {error && (
        <span className="ax-error" id="pay-err" role="alert">
          <CircleAlert className="ax-icon" aria-hidden />
          {error}
        </span>
      )}
    </Modal>
  );
}
