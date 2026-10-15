"use client";

import { useState, useTransition } from "react";
import {
  Ban,
  Check,
  CircleAlert,
  Download,
  Ellipsis,
  FileText,
  FolderKanban,
  Mail,
  Paperclip,
  Pencil,
  Wallet,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { sendInvoiceReminder } from "@/app/actions";
import { Menu } from "@/components/shell/Menu";
import { useToast } from "@/components/shell/Toasts";
import { Modal } from "@/components/ui/Modal";
import type { Locale } from "@/lib/format";
import type { DocumentKind } from "@/lib/documents";
import { convertQuotation, markDocumentSent, setInvoiceState, setQuotationStatus } from "./actions";
import { PaymentModal } from "./PaymentModal";

export type DocActionsProps = {
  kind: DocumentKind;
  id: string;
  number: string;
  status: string;
  state: string;
  clientName: string;
  clientId: string;
  recipient: string | null;
  balanceMinor: number;
  totalMinor: number;
  currency: string;
  locale: Locale;
  convertedInvoiceId: string | null;
  sendSubject: string;
  sendMessage: string;
};

/**
 * Record actions (DS › Quotations & invoices / Payments): Edit (drafts), Send (the one confirmation
 * step), Record payment, Send reminder, Download PDF / Print, Void · Accept / Decline · Convert to invoice
 * · Create project. Reversible changes get an Undo toast instead of a confirmation.
 */
export function DocumentActions(p: DocActionsProps) {
  const t = useTranslations("documents.actions");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();
  const [modal, setModal] = useState<"send" | "pay" | null>(null);
  const base = p.kind === "invoice" ? "/invoices" : "/quotations";
  const isDraft = p.state === "draft";
  const issuedInvoice = p.kind === "invoice" && !["draft", "void"].includes(p.state);

  const run = (
    fn: () => Promise<{ from: string }>,
    ok: string,
    undo: (from: string) => Promise<unknown>,
  ) =>
    start(async () => {
      try {
        const res = await fn();
        toast({
          tone: "success",
          title: ok,
          action: {
            label: tc("undo"),
            run: () => void undo(res.from).then(() => router.refresh()),
          },
        });
      } catch {
        toast({ tone: "danger", title: t("failed") });
      }
    });

  const convert = () =>
    start(async () => {
      try {
        const res = await convertQuotation(p.id);
        if (res.number) toast({ tone: "success", title: t("converted", { number: res.number }) });
        router.push(`/invoices/${res.id}/edit`);
      } catch {
        toast({ tone: "danger", title: t("failed") });
      }
    });

  const reminder = () =>
    start(async () => {
      try {
        await sendInvoiceReminder(p.id);
        toast({ tone: "success", title: t("reminderLogged", { number: p.number }) });
      } catch {
        toast({ tone: "danger", title: t("failed") });
      }
    });

  return (
    <div className="doc-actions">
      {isDraft && (
        <Link className="ax-btn ax-btn-secondary ax-btn-sm" href={`${base}/${p.id}/edit`}>
          <Pencil className="ax-icon" aria-hidden />
          {t("edit")}
        </Link>
      )}
      <button
        type="button"
        className="ax-btn ax-btn-secondary ax-btn-sm"
        onClick={() => window.print()}
      >
        <Download className="ax-icon" aria-hidden />
        {t("download")}
      </button>
      {p.kind === "quotation" && p.status === "sent" && (
        <>
          <button
            type="button"
            className="ax-btn ax-btn-secondary ax-btn-sm"
            onClick={() =>
              run(
                () => setQuotationStatus(p.id, "declined"),
                t("declined", { number: p.number }),
                (from) => setQuotationStatus(p.id, from),
              )
            }
          >
            <X className="ax-icon" aria-hidden />
            {t("markDeclined")}
          </button>
          <button
            type="button"
            className="ax-btn ax-btn-secondary ax-btn-sm"
            onClick={() =>
              run(
                () => setQuotationStatus(p.id, "accepted"),
                t("accepted", { number: p.number }),
                (from) => setQuotationStatus(p.id, from),
              )
            }
          >
            <Check className="ax-icon" aria-hidden />
            {t("markAccepted")}
          </button>
        </>
      )}
      {p.kind === "quotation" && p.status === "accepted" && (
        <>
          <Link
            className="ax-btn ax-btn-secondary ax-btn-sm"
            href={`/projects?new=1&client=${p.clientId}`}
          >
            <FolderKanban className="ax-icon" aria-hidden />
            {t("createProject")}
          </Link>
          {p.convertedInvoiceId ? (
            <Link
              className="ax-btn ax-btn-secondary ax-btn-sm"
              href={`/invoices/${p.convertedInvoiceId}`}
            >
              <FileText className="ax-icon" aria-hidden />
              {t("openInvoice")}
            </Link>
          ) : (
            <button type="button" className="ax-btn ax-btn-primary ax-btn-sm" onClick={convert}>
              <FileText className="ax-icon" aria-hidden />
              {t("convert")}
            </button>
          )}
        </>
      )}
      {issuedInvoice && p.balanceMinor > 0 && (
        <button
          type="button"
          className="ax-btn ax-btn-primary ax-btn-sm"
          onClick={() => setModal("pay")}
        >
          <Wallet className="ax-icon" aria-hidden />
          {t("recordPayment")}
        </button>
      )}
      {(isDraft || p.state === "sent" || p.state === "viewed") && p.status !== "paid" && (
        <button
          type="button"
          className={`ax-btn ${isDraft ? "ax-btn-primary" : "ax-btn-secondary"} ax-btn-sm`}
          onClick={() => setModal("send")}
        >
          <Mail className="ax-icon" aria-hidden />
          {isDraft ? t("send") : t("sendAgain")}
        </button>
      )}
      {p.kind === "invoice" && p.state !== "void" && (
        <Menu
          triggerClassName="ax-btn ax-btn-tertiary ax-btn-sm ax-btn-icon"
          triggerLabel={tc("more")}
          trigger={<Ellipsis className="ax-icon" aria-hidden />}
        >
          {p.status === "overdue" && (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="ax-menu-item menu-btn"
              onClick={reminder}
            >
              <Mail className="ax-icon" aria-hidden />
              {t("sendReminder")}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="ax-menu-item menu-btn is-danger"
            onClick={() =>
              run(
                () => setInvoiceState(p.id, "void"),
                t("voided", { number: p.number }),
                (from) => setInvoiceState(p.id, from),
              )
            }
          >
            <Ban className="ax-icon" aria-hidden />
            {t("void")}
          </button>
        </Menu>
      )}
      {modal === "send" && <SendModal {...p} onClose={() => setModal(null)} />}
      {modal === "pay" && (
        <PaymentModal
          invoice={{
            id: p.id,
            number: p.number,
            clientName: p.clientName,
            balanceMinor: p.balanceMinor,
            currency: p.currency,
          }}
          locale={p.locale}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

/** DS: "Send" opens a modal with recipient, subject, message and the attached PDF — the one confirmation step. */
function SendModal(p: DocActionsProps & { onClose: () => void }) {
  const t = useTranslations("documents.send");
  const toast = useToast();
  const [to, setTo] = useState(p.recipient ?? "");
  const [subject, setSubject] = useState(p.sendSubject);
  const [message, setMessage] = useState(p.sendMessage);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () => {
    if (!/^\S+@\S+\.\S+$/.test(to.trim())) return setError(t("recipientError"));
    start(async () => {
      try {
        await markDocumentSent(p.kind, p.id, { recipient: to.trim(), subject, message });
        // Delivery: hand the message to the user's mail app (no outgoing mail service is connected yet).
        window.location.href = `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
        toast({ tone: "success", title: t("sent", { number: p.number, to: to.trim() }) });
        p.onClose();
      } catch {
        setError(t("failed"));
      }
    });
  };
  return (
    <Modal
      title={t("title", { number: p.number })}
      submitLabel={t("submit")}
      pending={pending}
      onSubmit={submit}
      onClose={p.onClose}
    >
      <div className="ax-field">
        <label className="ax-label" htmlFor="send-to">
          {t("recipient")}
        </label>
        <input
          id="send-to"
          className="ax-input"
          type="email"
          dir="ltr"
          value={to}
          aria-invalid={error === t("recipientError") ? true : undefined}
          aria-describedby={error ? "send-err" : undefined}
          onChange={(e) => setTo(e.target.value)}
          autoFocus
        />
      </div>
      <div className="ax-field">
        <label className="ax-label" htmlFor="send-subject">
          {t("subject")}
        </label>
        <input
          id="send-subject"
          className="ax-input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>
      <div className="ax-field">
        <label className="ax-label" htmlFor="send-message">
          {t("message")}
        </label>
        <textarea
          id="send-message"
          className="ax-input"
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
      <div className="ax-file attach">
        <Paperclip className="ax-icon" aria-hidden />
        <span className="ax-mono ax-ltr">{p.number}.pdf</span>
      </div>
      <p className="ax-banner info">
        <Mail className="ax-icon" aria-hidden />
        {t("mailAppNote")}
      </p>
      {error && (
        <span className="ax-error" id="send-err" role="alert">
          <CircleAlert className="ax-icon" aria-hidden />
          {error}
        </span>
      )}
    </Modal>
  );
}
