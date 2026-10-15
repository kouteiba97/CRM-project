"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import {
  BellRing,
  CircleAlert,
  Ellipsis,
  FolderKanban,
  FileText,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import type { Due } from "@/lib/due";
import { formatter, type Locale } from "@/lib/format";
import { LEAD_STAGES } from "@/lib/status";
import { Menu } from "@/components/shell/Menu";
import { useToast } from "@/components/shell/Toasts";
import { Priority } from "@/components/ui/Priority";
import { moveLead } from "./actions";
import { LOST_REASONS, OPEN_STAGES, parseAmount } from "./schema";

export type LeadCardView = {
  id: string;
  title: string;
  stage: string;
  who: string | null;
  hue: number;
  initials: string;
  valueMinor: number;
  currency: string;
  valueText: string;
  priority: string;
  due: Due | null;
  lostReason: string | null;
};

type Stage = (typeof LEAD_STAGES)[number];
type Pos = { stage: string; index: number };
export type Pending = { kind: "won" | "lost"; id: string; to: Pos; prev: Pos };

const COLLAPSED = new Set<string>(["won", "lost"]);

/** Moves `id` into `stage` at `index`; other columns keep their order. */
function place(cards: LeadCardView[], id: string, stage: string, index: number) {
  const card = cards.find((c) => c.id === id);
  if (!card) return cards;
  const rest = cards.filter((c) => c.id !== id);
  const col = rest.filter((c) => c.stage === stage);
  col.splice(Math.max(0, Math.min(index, col.length)), 0, { ...card, stage });
  return [...rest.filter((c) => c.stage !== stage), ...col];
}
const positionOf = (cards: LeadCardView[], id: string): Pos => {
  const card = cards.find((c) => c.id === id)!;
  return {
    stage: card.stage,
    index: cards.filter((c) => c.stage === card.stage).findIndex((c) => c.id === id),
  };
};

/**
 * DS › KanbanBoard: open stages as 272px columns (count + total), Won/Lost as 120px summaries.
 * Drag and drop, or keyboard: Space picks up, ←/→ change column, ↑/↓ reorder, Space drops, Esc cancels,
 * each step announced. Every card also has "Move to…". No confirmation dialogs: Undo in the toast.
 */
export function LeadsBoard({ initial, currency }: { initial: LeadCardView[]; currency: string }) {
  const t = useTranslations("leads");
  const ts = useTranslations("status.lead");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const f = useMemo(() => formatter(locale), [locale]);
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();

  const [cards, setCards] = useState(initial);
  const [source, setSource] = useState(initial);
  // Server data wins whenever it is re-rendered (after a move is saved, or another refresh).
  if (initial !== source) {
    setSource(initial);
    setCards(initial);
  }

  const [drag, setDrag] = useState<{ id: string; over: Pos | null } | null>(null);
  const [picked, setPicked] = useState<{ id: string; origin: Pos } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [announce, setAnnounce] = useState("");
  const board = useRef<HTMLDivElement>(null);

  // Keep keyboard focus on a picked card when it moves to another column (React remounts it there).
  useEffect(() => {
    if (picked) board.current?.querySelector<HTMLElement>(`[data-card="${picked.id}"]`)?.focus();
  }, [cards, picked]);

  const stageWord = (s: string) => ts(s as never);
  const say = (card: LeadCardView, pos: Pos, all = cards) =>
    t("announceAt", {
      title: card.title,
      stage: stageWord(pos.stage),
      position: pos.index + 1,
      total: all.filter((c) => c.stage === pos.stage).length,
    });

  /** Saves a move already shown on screen; Undo moves it back to `prev`. */
  const persist = (
    snapshot: LeadCardView[],
    card: LeadCardView,
    to: Pos,
    prev: Pos,
    extra: { wonValueMinor?: number; lostReason?: string } = {},
    isUndo = false,
  ) =>
    start(async () => {
      try {
        await moveLead({ id: card.id, stage: to.stage, index: to.index, ...extra });
        if (isUndo || (to.stage === prev.stage && to.index === prev.index)) return;
        toast({
          tone: "success",
          title: t("moved", { title: card.title, stage: stageWord(to.stage) }),
          action: {
            label: tc("undo"),
            run: () => {
              setCards((now) => place(now, card.id, prev.stage, prev.index));
              persist(
                snapshot,
                card,
                prev,
                to,
                prev.stage === "lost" ? { lostReason: card.lostReason ?? "other" } : {},
                true,
              );
            },
          },
        });
      } catch {
        setCards(snapshot);
        toast({ tone: "danger", title: t("moveFailed") });
      }
    });

  const commit = (id: string, to: Pos, extra?: { wonValueMinor?: number; lostReason?: string }) => {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    const prev = positionOf(cards, id);
    const next = place(cards, id, to.stage, to.index);
    setCards(next);
    setAnnounce(say(card, positionOf(next, id), next));
    persist(cards, card, to, prev, extra);
  };

  /** Won and Lost first ask for the final value / the reason (inline form, not a confirmation). */
  const requestMove = (id: string, to: Pos) => {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    if ((to.stage === "won" || to.stage === "lost") && card.stage !== to.stage)
      setPending({ kind: to.stage, id, to, prev: positionOf(cards, id) });
    else commit(id, to);
  };

  // ── Drag & drop ──
  const onDragOver = (e: DragEvent<HTMLElement>, stage: string) => {
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    let index = 0;
    if (!COLLAPSED.has(stage)) {
      const els = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-card]")).filter(
        (el) => el.dataset.card !== drag.id,
      );
      index = els.findIndex((el) => {
        const r = el.getBoundingClientRect();
        return e.clientY < r.top + r.height / 2;
      });
      if (index < 0) index = els.length;
    }
    if (drag.over?.stage !== stage || drag.over.index !== index)
      setDrag({ id: drag.id, over: { stage, index } });
  };
  const onDrop = (e: DragEvent<HTMLElement>, stage: string) => {
    e.preventDefault();
    if (drag?.over && drag.over.stage === stage) requestMove(drag.id, drag.over);
    setDrag(null);
  };

  // ── Keyboard ──
  const onCardKey = (e: KeyboardEvent<HTMLElement>, card: LeadCardView) => {
    if (e.target !== e.currentTarget) return;
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    if (!picked) {
      if (e.key === " ") {
        e.preventDefault();
        const origin = positionOf(cards, card.id);
        setPicked({ id: card.id, origin });
        setAnnounce(t("announcePicked", { title: card.title }) + " " + say(card, origin));
      } else if (e.key === "Enter") {
        e.preventDefault();
        router.push(`/leads/${card.id}`);
      }
      return;
    }
    if (picked.id !== card.id) return;
    const pos = positionOf(cards, card.id);
    const open = OPEN_STAGES as readonly string[];
    let to: Pos | null = null;
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const backward = rtl ? "ArrowRight" : "ArrowLeft";
    if (e.key === forward || e.key === backward) {
      const i = open.indexOf(pos.stage) + (e.key === forward ? 1 : -1);
      const stage = open[i];
      if (stage)
        to = { stage, index: Math.min(pos.index, cards.filter((c) => c.stage === stage).length) };
    } else if (e.key === "ArrowUp") to = { stage: pos.stage, index: Math.max(0, pos.index - 1) };
    else if (e.key === "ArrowDown")
      to = {
        stage: pos.stage,
        index: Math.min(cards.filter((c) => c.stage === pos.stage).length - 1, pos.index + 1),
      };
    else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      setPicked(null);
      setAnnounce(t("announceDropped", { title: card.title }) + " " + say(card, pos));
      persist(
        place(cards, card.id, picked.origin.stage, picked.origin.index),
        card,
        pos,
        picked.origin,
      );
      return;
    } else if (e.key === "Escape") {
      e.preventDefault();
      setCards(place(cards, card.id, picked.origin.stage, picked.origin.index));
      setPicked(null);
      setAnnounce(t("announceCancelled", { title: card.title }));
      return;
    }
    if (to) {
      e.preventDefault();
      const next = place(cards, card.id, to.stage, to.index);
      setCards(next);
      setAnnounce(say(card, positionOf(next, card.id), next));
    }
  };

  const total = (stage: string) => {
    const col = cards.filter((c) => c.stage === stage);
    const main = col.filter((c) => c.currency === currency).reduce((a, c) => a + c.valueMinor, 0);
    const others = col.filter((c) => c.currency !== currency).length;
    return {
      count: col.length,
      text: f.money(main, currency, { whole: true }) + (others ? ` +${others}` : ""),
    };
  };

  return (
    <>
      <div className="sr-only" aria-live="assertive" role="status">
        {announce}
      </div>
      <p className="sr-only" id="board-help">
        {t("boardHelp")}
      </p>
      <div ref={board} className="ax-board leads-board" role="group" aria-label={t("boardLabel")}>
        {LEAD_STAGES.map((stage) => {
          const tot = total(stage);
          const collapsed = COLLAPSED.has(stage);
          const col = cards.filter((c) => c.stage === stage);
          const over = drag?.over?.stage === stage;
          const headId = `col-${stage}`;
          return (
            <section
              key={stage}
              className={`ax-col stage-${stage}${collapsed ? " col-collapsed" : ""}${over ? " is-over" : ""}`}
              aria-labelledby={headId}
              onDragOver={(e) => onDragOver(e, stage)}
              onDrop={(e) => onDrop(e, stage)}
            >
              <div className="ax-col-head">
                <span className={`ax-stage-dot${collapsed ? " filled" : ""}`} aria-hidden />
                <h3 id={headId}>{stageWord(stage)}</h3>
                <span className="ax-count" aria-label={t("countLabel", { count: tot.count })}>
                  {tot.count}
                </span>
                {!collapsed && (
                  <span className="total" suppressHydrationWarning>
                    {tot.text}
                  </span>
                )}
              </div>
              {collapsed ? (
                <div className="col-summary">
                  <span className="total" suppressHydrationWarning>
                    {tot.text}
                  </span>
                  <Link className="ax-link" href={`/leads?view=table&stage=${stage}`}>
                    {t("viewStage")}
                  </Link>
                </div>
              ) : (
                <div className="ax-col-body">
                  <div className="col-list" role="list" aria-labelledby={headId}>
                    {col.map((card, i) => (
                      <FragmentWithPlaceholder
                        key={card.id}
                        show={over && drag?.over?.index === i && drag.id !== card.id}
                      >
                        <Card
                          card={card}
                          picked={picked?.id === card.id}
                          dragging={drag?.id === card.id}
                          onKeyDown={(e) => onCardKey(e, card)}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", card.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDrag({ id: card.id, over: null });
                          }}
                          onDragEnd={() => setDrag(null)}
                          onMove={(s) => requestMove(card.id, { stage: s, index: 0 })}
                        />
                      </FragmentWithPlaceholder>
                    ))}
                    {over &&
                      drag &&
                      (drag.over?.index ?? 0) >= col.filter((c) => c.id !== drag.id).length && (
                        <div className="ax-kcard is-placeholder" aria-hidden />
                      )}
                  </div>
                  {col.length === 0 && !over && <p className="col-empty">{t("emptyColumn")}</p>}
                  <Link
                    className="ax-btn ax-btn-tertiary ax-btn-xs col-add"
                    href={`/leads?new=1&stage=${stage}`}
                    scroll={false}
                  >
                    <Plus className="ax-icon" aria-hidden />
                    {t("addHere", { stage: stageWord(stage) })}
                  </Link>
                </div>
              )}
            </section>
          );
        })}
      </div>
      {pending && (
        <OutcomeDialog
          pending={pending}
          card={cards.find((c) => c.id === pending.id)!}
          onCancel={() => setPending(null)}
          onConfirm={(extra) => {
            commit(pending.id, pending.to, extra);
          }}
          onClose={() => setPending(null)}
        />
      )}
    </>
  );
}

function FragmentWithPlaceholder({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <>
      {show && <div className="ax-kcard is-placeholder" aria-hidden />}
      {children}
    </>
  );
}

function Card({
  card,
  picked,
  dragging,
  onKeyDown,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  card: LeadCardView;
  picked: boolean;
  dragging: boolean;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  onDragStart: (e: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onMove: (stage: Stage) => void;
}) {
  const t = useTranslations("leads");
  const ts = useTranslations("status.lead");
  const tc = useTranslations("common");
  const router = useRouter();
  return (
    <div
      className={`ax-kcard lead-card${picked || dragging ? " is-dragging" : ""}`}
      role="listitem"
      tabIndex={0}
      data-card={card.id}
      aria-roledescription={t("cardRole")}
      aria-describedby="board-help"
      aria-label={[card.title, card.who, card.valueText].filter(Boolean).join(" · ")}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, [role=menu]")) return;
        router.push(`/leads/${card.id}`);
      }}
    >
      <div className="kcard-top">
        <Link className="title" href={`/leads/${card.id}`} tabIndex={-1} draggable={false}>
          {card.title}
        </Link>
        <Menu
          triggerClassName="ax-btn ax-btn-tertiary ax-btn-xs ax-btn-icon kcard-menu"
          triggerLabel={t("moveTo", { title: card.title })}
          trigger={<Ellipsis className="ax-icon" aria-hidden />}
        >
          <div className="ax-menu-label">{t("moveToLabel")}</div>
          {LEAD_STAGES.filter((s) => s !== card.stage).map((s) => (
            <button
              key={s}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="ax-menu-item menu-btn"
              onClick={() => onMove(s)}
            >
              {ts(s)}
            </button>
          ))}
        </Menu>
      </div>
      {card.who && (
        <div className="meta">
          <span className="ax-avatar sm sq" data-hue={card.hue} aria-hidden>
            {card.initials}
          </span>
          <span className="who">{card.who}</span>
        </div>
      )}
      <div className="meta">
        <span className="value ax-num">{card.valueText}</span>
        <span className="r">
          {card.due ? (
            <span
              className={`ax-due${card.due.tone === "overdue" ? " overdue" : card.due.tone === "soon" ? " soon" : ""}`}
              title={card.due.absolute}
            >
              {card.due.tone === "overdue" ? (
                <CircleAlert className="ax-icon" aria-hidden />
              ) : (
                <BellRing className="ax-icon" aria-hidden />
              )}
              {card.due.tone === "overdue" ? card.due.label : card.due.label}
            </span>
          ) : (
            !COLLAPSED.has(card.stage) && (
              <span className="ax-due no-fu">
                <TriangleAlert className="ax-icon" aria-hidden />
                {tc("noFollowUp")}
              </span>
            )
          )}
          <Priority level={card.priority} compact />
        </span>
      </div>
    </div>
  );
}

/** Won: final value, then the next steps. Lost: the reason (required). Inline form, not a confirmation. */
export function OutcomeDialog({
  pending,
  card,
  onConfirm,
  onCancel,
  onClose,
}: {
  pending: Pending;
  card: Pick<LeadCardView, "id" | "title" | "valueMinor" | "currency">;
  onConfirm: (extra: { wonValueMinor?: number; lostReason?: string }) => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("leads");
  const tc = useTranslations("common");
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState((card.valueMinor / 100).toFixed(2));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending.kind === "won") {
      const minor = parseAmount(value);
      if (minor === null) return setError(t("errorAmount"));
      onConfirm({ wonValueMinor: minor });
      setDone(true);
    } else {
      if (!reason) return setError(t("errorReason"));
      onConfirm({ lostReason: reason });
      onClose();
    }
  };

  const titleId = "outcome-title";
  return (
    <dialog
      ref={ref}
      className="ax-modal sm outcome-dialog"
      aria-labelledby={titleId}
      onClose={onCancel}
    >
      <div className="ax-modal-head">
        <h2 id={titleId}>
          {t(pending.kind === "won" ? "wonTitle" : "lostTitle", { title: card.title })}
        </h2>
      </div>
      {done ? (
        <>
          <div className="ax-modal-body">
            <p>{t("wonNext")}</p>
            <div className="outcome-next">
              <Link
                className="ax-btn ax-btn-secondary ax-btn-sm"
                href={`/projects?new=1&lead=${card.id}`}
              >
                <FolderKanban className="ax-icon" aria-hidden />
                {t("convertToProject")}
              </Link>
              <Link
                className="ax-btn ax-btn-secondary ax-btn-sm"
                href={`/quotations?new=1&lead=${card.id}`}
              >
                <FileText className="ax-icon" aria-hidden />
                {t("createQuotation")}
              </Link>
            </div>
          </div>
          <div className="ax-modal-foot">
            <button
              type="button"
              className="ax-btn ax-btn-primary ax-btn-sm"
              onClick={onClose}
              autoFocus
            >
              {t("later")}
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          <div className="ax-modal-body">
            {pending.kind === "won" ? (
              <div className="ax-field">
                <label className="ax-label" htmlFor="won-value">
                  {t("wonValue", { currency: card.currency })}
                </label>
                <input
                  id="won-value"
                  className="ax-input ax-num"
                  dir="ltr"
                  inputMode="decimal"
                  value={value}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "outcome-err" : undefined}
                  onChange={(e) => setValue(e.target.value)}
                  autoFocus
                />
              </div>
            ) : (
              <div className="ax-field">
                <label className="ax-label" htmlFor="lost-reason">
                  {t("lostReason")}
                </label>
                <select
                  id="lost-reason"
                  className="ax-input"
                  value={reason}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "outcome-err" : undefined}
                  onChange={(e) => setReason(e.target.value)}
                  autoFocus
                >
                  <option value="">{t("chooseReason")}</option>
                  {LOST_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {t(`reason.${r}`)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {error && (
              <span className="ax-error" id="outcome-err">
                <CircleAlert className="ax-icon" aria-hidden />
                {error}
              </span>
            )}
          </div>
          <div className="ax-modal-foot">
            <button type="button" className="ax-btn ax-btn-secondary ax-btn-sm" onClick={onCancel}>
              {tc("cancel")}
            </button>
            <button type="submit" className="ax-btn ax-btn-primary ax-btn-sm">
              {t(pending.kind === "won" ? "markWon" : "markLost")}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
