import { notFound } from "next/navigation";
import { ArrowLeft, BellRing, Check, Clock, Wallet } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getInvoiceReminders } from "@/db/queries/payments";
import { reminderSchedule } from "@/lib/reminders";
import { ReminderButton } from "@/components/dashboard/ReminderButton";
import { isUuid } from "@/db/queries/clients";
import {
  getDocumentActivity,
  getInvoice,
  getInvoicePayments,
  getQuotation,
} from "@/db/queries/documents";
import type { DocumentKind } from "@/lib/documents";
import { formatter, type Locale } from "@/lib/format";
import { can } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { Timeline } from "@/components/activity/Timeline";
import { RecordCrumb } from "@/components/shell/Crumbs";
import { EmptyState } from "@/components/ui/Card";
import { PaymentSummary } from "@/components/ui/PaymentSummary";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { asLocale, fromParty, getDocLabels, linesAndTotals, toParty } from "./doc-data";
import { DocFrame } from "./DocFrame";
import { DocumentActions } from "./DocumentActions";
import { DocumentView, type DocData } from "./DocumentView";

export async function loadDocumentForMeta(kind: DocumentKind, id: string) {
  if (!isUuid(id)) return null;
  const session = await getSession();
  const rec =
    kind === "invoice"
      ? await getInvoice(session.workspaceId, id)
      : await getQuotation(session.workspaceId, id);
  return rec ? { number: rec.doc.number } : null;
}

/**
 * Invoice / quotation record: the document exactly as exported (in its own language) in the PDF frame,
 * with actions above and, beside it, the PaymentSummary + payments (invoices) and the timeline.
 */
export async function DocumentRecordPage({ kind, id }: { kind: DocumentKind; id: string }) {
  if (!isUuid(id)) notFound();
  const session = await getSession();
  const ws = session.workspaceId;
  const rec = kind === "invoice" ? await getInvoice(ws, id) : await getQuotation(ws, id);
  if (!rec) notFound();
  const t = await getTranslations("documents.record");
  const tn = await getTranslations("nav");
  const tp = await getTranslations("clients.profile");
  const tm = await getTranslations("clients.method");
  const ui = (await getLocale()) as Locale;
  const f = formatter(ui);
  const docLang = asLocale(rec.doc.language);
  const labels = await getDocLabels(docLang);
  const tsend = await getTranslations({ locale: docLang, namespace: "documents.send" });
  const now = new Date();
  const base = kind === "invoice" ? "/invoices" : "/quotations";
  const invoice = kind === "invoice" ? (rec as Awaited<ReturnType<typeof getInvoice>>)! : null;
  const quotation =
    kind === "quotation" ? (rec as Awaited<ReturnType<typeof getQuotation>>)! : null;
  const [payments, activity, reminders] = await Promise.all([
    invoice ? getInvoicePayments(ws, id) : Promise.resolve([]),
    getDocumentActivity(ws, kind, id).catch(() => []),
    invoice ? getInvoiceReminders(ws, id).catch(() => []) : Promise.resolve([]),
  ]);
  const unpaid = !!invoice && ["sent", "viewed", "partially_paid", "overdue"].includes(rec.status);
  const schedule =
    invoice && unpaid
      ? reminderSchedule(
          invoice.doc.dueDate,
          reminders.map((r) => r.occurredAt),
          now,
        )
      : [];
  const paid = invoice?.paidMinor ?? 0;
  const balance = invoice ? invoice.balanceMinor : rec.doc.totalMinor;
  const endDate = invoice ? invoice.doc.dueDate : quotation!.doc.validUntil;
  const state = invoice ? invoice.doc.state : quotation!.doc.status;

  const data: DocData = {
    kind,
    number: rec.doc.number,
    status: rec.status,
    issueDate: rec.doc.issueDate,
    endDate,
    currency: rec.doc.currency,
    from: fromParty(session.workspace),
    iban: session.workspace.iban,
    to: toParty(rec),
    project: rec.projectName,
    paidMinor: paid,
    notes: rec.doc.notes,
    terms: rec.doc.terms,
    ...linesAndTotals(rec.lines, rec.doc.discountPct),
  };

  const docTitle = kind === "invoice" ? labels.invoice : labels.quotation;
  return (
    <>
      <RecordCrumb label={rec.doc.number} />
      <nav aria-label={t("back")} className="profile-back no-print">
        <Link className="ax-link" href={base}>
          <ArrowLeft className="ax-icon ax-icon-sm ax-flip" aria-hidden />
          {tn(kind === "invoice" ? "invoices" : "quotations")}
        </Link>
      </nav>
      <header className="pagehead doc-head no-print">
        <h1 className="t-page-title ax-ltr ax-mono-title">{rec.doc.number}</h1>
        <StatusBadge
          domain={kind}
          code={rec.status}
          suffix={
            invoice && rec.status === "overdue"
              ? tp("daysCount", { count: invoice.daysOverdue })
              : undefined
          }
        />
        <span className="meta">
          <Link className="ax-link" href={`/clients/${rec.clientId}`}>
            {rec.clientName}
          </Link>
          {" · "}
          {f.money(rec.doc.totalMinor, rec.doc.currency)}
        </span>
        <div className="actions">
          <DocumentActions
            kind={kind}
            id={id}
            number={rec.doc.number}
            status={rec.status}
            state={state}
            clientName={rec.clientName}
            clientId={rec.clientId}
            recipient={rec.clientEmail}
            balanceMinor={balance}
            totalMinor={rec.doc.totalMinor}
            currency={rec.doc.currency}
            locale={ui}
            convertedInvoiceId={quotation?.doc.convertedInvoiceId ?? null}
            canVoid={can(session.role, "admin")}
            issueDate={rec.doc.issueDate}
            sendSubject={tsend("defaultSubject", {
              doc: docTitle,
              number: rec.doc.number,
              from: session.workspace.name,
            })}
            sendMessage={tsend(
              kind === "invoice" ? "defaultMessageInvoice" : "defaultMessageQuotation",
              {
                client: rec.clientName,
                number: rec.doc.number,
                amount: formatter(docLang).money(rec.doc.totalMinor, rec.doc.currency),
                date: endDate ? formatter(docLang).date(endDate) : "—",
                from: session.workspace.name,
              },
            )}
          />
        </div>
      </header>

      <div className="doc-layout">
        <section className="doc-main" aria-label={t("document")}>
          <DocFrame
            bar={
              <>
                <span className="ax-mono ax-ltr doc-bar-number">{rec.doc.number}</span>
                <StatusBadge domain={kind} code={rec.status} />
                <span className="ax-spacer" />
                <span className="ax-faint doc-lang">
                  {t("language", {
                    language: { en: "English", fr: "Français", ar: "العربية" }[docLang],
                  })}
                </span>
              </>
            }
          >
            <DocumentView data={data} labels={labels} language={docLang} />
          </DocFrame>
        </section>

        <aside className="doc-side no-print" aria-label={t("side")}>
          {invoice && (
            <section className="ax-card ax-card-body rail-block" aria-labelledby="doc-pay">
              <h2 id="doc-pay" className="rail-title">
                <Wallet className="ax-icon ax-icon-sm" aria-hidden />
                {t("payments")}
              </h2>
              {invoice.doc.state === "draft" || invoice.doc.state === "void" ? (
                <p className="ax-faint rail-empty">
                  {t(invoice.doc.state === "draft" ? "notIssued" : "voidNote")}
                </p>
              ) : (
                <PaymentSummary
                  f={f}
                  totals={{
                    currency: invoice.doc.currency,
                    invoicedMinor: invoice.doc.totalMinor,
                    paidMinor: invoice.paidMinor,
                    outstandingMinor:
                      rec.status === "overdue" ? 0 : Math.max(0, invoice.balanceMinor),
                    overdueMinor: rec.status === "overdue" ? invoice.balanceMinor : 0,
                    overdueDays: invoice.daysOverdue,
                  }}
                />
              )}
              {invoice.balanceMinor < 0 && (
                <p className="pay-credit">
                  {t("credit", { amount: f.money(-invoice.balanceMinor, invoice.doc.currency) })}
                </p>
              )}
              {payments.length > 0 && (
                <ul className="pay-list">
                  {payments.map((p) => (
                    <li key={p.id}>
                      <span className="ax-num">{f.date(p.paidOn, "medium")}</span>
                      <span className="ax-faint">
                        {tm(p.method)}
                        {p.reference ? (
                          <>
                            {" · "}
                            <span className="ax-mono ax-ltr">{p.reference}</span>
                          </>
                        ) : null}
                      </span>
                      <b className="ax-num">{f.money(p.amountMinor, p.currency)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {invoice && unpaid && (
            <section className="ax-card ax-card-body rail-block" aria-labelledby="doc-rem">
              <h2 id="doc-rem" className="rail-title">
                <BellRing className="ax-icon ax-icon-sm" aria-hidden />
                {t("reminders")}
              </h2>
              {!invoice.clientReminders && (
                <p className="ax-faint rail-empty">
                  {t("remindersOff")}{" "}
                  <Link className="ax-link" href={`/clients/${rec.clientId}`}>
                    {t("remindersOffLink")}
                  </Link>
                </p>
              )}
              <ol className="rem-list">
                {schedule.map((s) => (
                  <li key={s.offset} className={`rem-${s.state}`}>
                    {s.state === "sent" ? (
                      <Check className="ax-icon ax-icon-sm" aria-hidden />
                    ) : (
                      <Clock className="ax-icon ax-icon-sm" aria-hidden />
                    )}
                    <span className="rem-when">
                      {s.offset === 0 ? t("remDue") : t("remAfter", { days: s.offset })}
                      <span className="ax-faint"> · {f.date(s.date, "medium")}</span>
                    </span>
                    <span className="rem-state">{t(`rem_${s.state}`)}</span>
                  </li>
                ))}
              </ol>
              {schedule.some((s) => s.state === "due") && (
                <ReminderButton invoiceId={id} number={rec.doc.number} />
              )}
              <p className="ax-help">{t("remindersNote")}</p>
            </section>
          )}
          {quotation && (
            <section className="ax-card ax-card-body rail-block" aria-labelledby="doc-q">
              <h2 id="doc-q" className="rail-title">
                {t("details")}
              </h2>
              <dl className="ax-dl rail-dl">
                <div className="dl-row">
                  <dt>{t("validUntil")}</dt>
                  <dd>
                    {quotation.doc.validUntil ? f.date(quotation.doc.validUntil, "medium") : "—"}
                  </dd>
                </div>
                {quotation.doc.convertedInvoiceId && quotation.convertedNumber && (
                  <div className="dl-row">
                    <dt>{t("invoice")}</dt>
                    <dd>
                      <Link
                        className="ax-link ax-mono ax-ltr"
                        href={`/invoices/${quotation.doc.convertedInvoiceId}`}
                      >
                        {quotation.convertedNumber}
                      </Link>
                    </dd>
                  </div>
                )}
                {quotation.doc.leadId && (
                  <div className="dl-row">
                    <dt>{t("lead")}</dt>
                    <dd>
                      <Link className="ax-link" href={`/leads/${quotation.doc.leadId}`}>
                        {t("openLead")}
                      </Link>
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}
          <section className="ax-card activity-card" aria-labelledby="doc-activity">
            <div className="ax-card-head ruled">
              <h2 id="doc-activity" className="rail-title">
                {t("activity")}
              </h2>
            </div>
            {activity.length ? (
              <div className="tl-pad">
                <Timeline items={activity} now={now} currency={rec.doc.currency} grouped={false} />
              </div>
            ) : (
              <EmptyState icon={Wallet} title={t("noActivity")} />
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
