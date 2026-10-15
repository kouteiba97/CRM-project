"use client";

import { useEffect, useState, useTransition } from "react";
import { Archive, ChevronDown, Ellipsis, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { LEAD_STAGES } from "@/lib/status";
import { Menu } from "@/components/shell/Menu";
import { useToast } from "@/components/shell/Toasts";
import { archiveLead, moveLead, restoreLead } from "./actions";
import { OutcomeDialog, type Pending } from "./LeadsBoard";

type Lead = {
  id: string;
  title: string;
  stage: string;
  valueMinor: number;
  currency: string;
  lostReason: string | null;
};

/** "Move to…" on the record: same rules as the board (Won/Lost ask first, Undo in the toast). */
export function LeadStageMenu({ lead }: { lead: Lead }) {
  const t = useTranslations("leads");
  const ts = useTranslations("status.lead");
  const tc = useTranslations("common");
  const toast = useToast();
  const [, start] = useTransition();
  const [pending, setPending] = useState<Pending | null>(null);

  const move = (
    stage: string,
    extra: { wonValueMinor?: number; lostReason?: string } = {},
    undo = false,
  ) =>
    start(async () => {
      try {
        const res = await moveLead({ id: lead.id, stage, index: 0, ...extra });
        if (undo) return;
        toast({
          tone: "success",
          title: t("moved", { title: lead.title, stage: ts(stage as never) }),
          action: {
            label: tc("undo"),
            run: () =>
              move(
                res.from,
                res.from === "lost" ? { lostReason: lead.lostReason ?? "other" } : {},
                true,
              ),
          },
        });
      } catch {
        toast({ tone: "danger", title: t("moveFailed") });
      }
    });

  const pick = (stage: string) => {
    if (stage === "won" || stage === "lost")
      setPending({
        kind: stage,
        id: lead.id,
        to: { stage, index: 0 },
        prev: { stage: lead.stage, index: 0 },
      });
    else move(stage);
  };

  return (
    <>
      <Menu
        align="start"
        triggerClassName="ax-btn ax-btn-secondary ax-btn-xs"
        triggerLabel={t("moveTo", { title: lead.title })}
        trigger={
          <>
            {t("moveToLabel")}
            <ChevronDown className="ax-icon" aria-hidden />
          </>
        }
      >
        {LEAD_STAGES.filter((s) => s !== lead.stage).map((s) => (
          <button
            key={s}
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="ax-menu-item menu-btn"
            onClick={() => pick(s)}
          >
            {ts(s)}
          </button>
        ))}
      </Menu>
      {pending && (
        <OutcomeDialog
          pending={pending}
          card={lead}
          onCancel={() => setPending(null)}
          onConfirm={(extra) => move(pending.to.stage, extra)}
          onClose={() => setPending(null)}
        />
      )}
    </>
  );
}

/** Record "More": Edit (`E`) and Archive (Undo in the toast, no confirmation). */
export function LeadMoreMenu({ lead }: { lead: Pick<Lead, "id" | "title"> }) {
  const t = useTranslations("leads.record");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
      if (e.key.toLowerCase() !== "e" || e.metaKey || e.ctrlKey || e.altKey || typing) return;
      if (document.querySelector('[role="dialog"], dialog[open]')) return;
      e.preventDefault();
      router.replace(`/leads/${lead.id}?edit=1`, { scroll: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lead.id, router]);

  const archive = () =>
    start(async () => {
      try {
        await archiveLead(lead.id);
        router.push("/leads");
        toast({
          tone: "success",
          title: t("archived", { title: lead.title }),
          action: {
            label: tc("undo"),
            run: () =>
              void restoreLead(lead.id).then(
                () => router.push(`/leads/${lead.id}`),
                () => toast({ tone: "danger", title: t("restoreFailed") }),
              ),
          },
        });
      } catch {
        toast({ tone: "danger", title: t("archiveFailed") });
      }
    });

  return (
    <Menu
      triggerClassName="ax-btn ax-btn-secondary ax-btn-xs ax-btn-icon"
      triggerLabel={tc("more")}
      align="start"
      trigger={<Ellipsis className="ax-icon" aria-hidden />}
    >
      <Link
        role="menuitem"
        tabIndex={-1}
        className="ax-menu-item"
        href={`/leads/${lead.id}?edit=1`}
        scroll={false}
      >
        <Pencil className="ax-icon" aria-hidden />
        {t("edit")}
        <kbd className="ax-kbd">E</kbd>
      </Link>
      <div className="ax-menu-sep" role="separator" />
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        className="ax-menu-item menu-btn is-danger"
        onClick={archive}
      >
        <Archive className="ax-icon" aria-hidden />
        {t("archive")}
      </button>
    </Menu>
  );
}
