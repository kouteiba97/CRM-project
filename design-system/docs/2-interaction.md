# Interaction

## Universal states

Every interactive component implements the same state model; component READMEs give the exact tokens.

| State | Visual | Notes |
|---|---|---|
| Default | Resting fill and border | |
| Hover | `surface-hover` (neutral) or the variant's `-hover` token | Pointer only; never the sole way to reveal an action. 100ms. |
| Active / pressed | `surface-active` or `-active` token | |
| Focus-visible | 2px `focus-ring` outline with 2px offset, or `shadow-focus` on rounded controls | Keyboard only (`:focus-visible`); never removed. |
| Selected | `surface-selected` + checked box or check icon | Never colour alone. |
| Disabled | `text-disabled`, sunken fill, not-allowed cursor | Explain why in a tooltip when not obvious (use `aria-disabled` so it stays focusable). |
| Loading | Spinner in buttons, skeletons in regions, indeterminate bar for refresh | Locks the triggering control. |
| Error | `status-danger` border/text + icon + message | Next to the cause. |

## Action hierarchy

- One primary button per view and per dialog. Secondary for alternatives, tertiary for low-emphasis and toolbar actions.
- Destructive actions are worded destructively, use `danger-solid` only at the point of confirmation, and sit apart (far left of footers, last in menus after a separator).
- **Confirm only the irreversible:** delete, void issued documents, send to client, bulk delete. Everything reversible (archive, status change, move lead, complete task) happens immediately with an **Undo** toast.

## Keyboard

| Scope | Keys |
|---|---|
| Global | `⌘K`/`Ctrl K` search & commands · `C` new client · `L` new lead · `I` new invoice · `T` new task · `G` then `D/C/L/P/T/I` go to module · `[` toggle sidebar · `?` shortcut sheet |
| Lists/tables | `↑↓` or `J/K` move · `Enter` open · `X`/`Space` select · `Shift+↑↓` extend · `E` edit · `.` row menu · `/` focus search · `Esc` clear |
| Forms/dialogs | `⌘Enter` submit · `Esc` close (asks before discarding edits) · `Tab` order follows visual order |
| Kanban | `Space` pick up/drop · `←→` column · `↑↓` position · `Esc` cancel |

Shortcuts appear in tooltips and menus (`ax-kbd`), never only in documentation. Single-key shortcuts are disabled while typing in a field.

## Submitting & duplicates

On submit the button enters loading (`aria-busy`, spinner, "Saving…"), its width locks, repeat clicks are ignored, and `⌘Enter` is ignored until the request settles. Payments and invoice sending also send an idempotency key so a retried request cannot create two records.

## Optimistic updates

Status changes, task completion, kanban moves and inline edits update instantly; on server failure the change reverts and a danger toast explains it with Retry.

## Notifications

- Toasts: bottom-right, max 3, concise past tense, auto-dismiss 5s (8s with an action), errors persist.
- Banners: persistent conditions (offline, sync failure, trial/plan notices) under the top bar or at the top of a form.
- Notification centre (bell): follow-ups due, invoices viewed/paid/overdue, quotation accepted. Grouped by day, unread dot + bold title, "Mark all as read".
- Never use modal alerts for information.

## Important status changes

When a record changes state (invoice paid, lead won, project at risk) the badge updates in place with a 160ms crossfade, the activity feed logs a sentence, and a toast confirms the user's own action. Changes made elsewhere (payment webhook) appear via the notification centre and a subtle `accent-subtle` row flash for 1s in visible lists.

## Motion

Durations `--duration-fast` 100ms, `--duration-base` 160ms, `--duration-slow` 220ms, easing `--ease-standard`. Only opacity and transforms (≤ 8px translate). Allowed: menu/tooltip fade, drawer slide, modal rise, kanban drag lift, skeleton shimmer, progress fills. Not allowed: number counters, bouncing, page transitions, decorative loops. `prefers-reduced-motion` removes all transforms.
