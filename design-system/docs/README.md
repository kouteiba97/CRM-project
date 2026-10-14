Apex CRM is the operating system of an independent software developer: clients, leads, projects, tasks, quotations, invoices, payments and follow-ups in one dense, fast, dark-first interface. This system is the single source of truth for every screen. Build from its tokens (`tokens.json` → CSS custom properties) and its component classes (`components/bundle.css`, prefix `ax-`); never introduce a colour, size or spacing that is not a token.

## Principles

1. **Information over decoration.** Density is a feature: 40px table rows, 13px table text, a 24px maximum page title. Whitespace separates groups; it is never filler. No hero cards, illustrations, gradients, glows or decorative icons.
2. **Precision.** Numbers are tabular and right-aligned, money always carries its currency and two decimals, dates are unambiguous. Every value the user acts on can be seen exactly (tooltips reveal abbreviated values).
3. **One obvious next action.** Each view has at most one primary (teal) button. Overdue, due-today and unpaid items surface first.
4. **Never colour alone.** Every status, priority, delta and financial state is a word, an icon or a shape first; colour reinforces it.
5. **Keyboard-first, mouse-friendly.** Everything is reachable with the keyboard; nothing essential is hover-only.
6. **Glacier, not neon.** Cold, mineral neutrals tinted blue-green, one glacier-teal action colour, a glacier-blue schedule colour and a glacial green for money that has settled. Red and amber stay rare so they are impossible to miss.

## Content fundamentals

- **Voice:** direct, factual, second person when addressing the user ("You have 2 overdue invoices"), no exclamation marks, no "Oops", no emoji.
- **Casing:** sentence case everywhere (titles, buttons, column headers, menu items). Uppercase only for `overline` labels via CSS.
- **Buttons and menu items** start with a verb: "New invoice", "Send reminder", "Record payment", "Convert to project".
- **Entity names** use the record's own casing; document numbers in `mono`: `INV-2026-0142`, `Q-2026-031`, `PRJ-014`.
- **Money:** currency code or symbol + amount + 2 decimals in tables and documents (`€ 4,800.00`, `DZD 340,000.00`); KPIs may round to whole units (`€ 18,450`) or abbreviate in charts (`14k`) with the exact value in a tooltip. One locale format per workspace (EN: `4,800.00`; FR: `4 800,00`). Negative amounts use a minus sign and the word "Credit"/"Refund".
- **Dates:** `Oct 14, 2026` in UI (`14 Oct 2026` in FR and on documents); input format `DD/MM/YYYY`; times 24h `14:32`. Relative dates ("3 days ago", "Tomorrow") only for the last/next 7 days, with the absolute date in a tooltip. Overdue is stated as words: "Overdue · 12 days".
- **Empty, error and toast copy** say what happened and what to do next in one or two sentences (see EmptyState, ErrorState, Toast).

## Visual foundations

- **Colour — the Glacier palette.** Every neutral carries a cold blue-green cast (deep glacial water in dark, frost in light); there are no pure greys. Light theme is primary (`data-theme="light"`): a pale mint-frost canvas, white cards with soft shadows, deep-teal actions and mint highlights. Dark mirrors it for night work. Layers: `background` (canvas) → `surface` (content, tables, cards, sidebar) → `surface-elevated` (menus, modals, drawers, toasts, with a 1px frost highlight on top in dark). Recessed wells use `surface-sunken`. Interaction fills: `surface-hover`, `surface-active`, `surface-selected` (teal ice). Lines: `border-subtle` < `border-default` < `border-strong`, and `border-control` (3:1 control outlines). Text: `text-primary`, `text-secondary`, `text-tertiary` (all ≥ 4.5:1 on every surface), `text-disabled`.
- **Three hues, three jobs — "teal acts, blue schedules, green settles".**
  - **Glacier teal** `accent-primary` — actions and selection: the primary button, checked controls, selected rows, active tabs, focus (`focus-ring`), links (`accent-text`), revenue in charts (`chart-1`). In dark the teal is bright, so its label is `on-accent` deep-water ink, never white.
  - **Glacier blue** `accent-secondary` — time: milestones, project progress, date ranges, scheduled/sent states (`status-info` aliases it), comparison series (`chart-2`). Text form `accent-secondary-text`, tint `accent-secondary-subtle`.
  - **Glacial green** `status-success` — money and work that has settled: Paid, Won, Completed.
  The neutral bordered control family (`secondary`, `secondary-hover`, `secondary-active`) carries secondary buttons.
- **Status.** `status-success`, `status-warning`, `status-danger`, `status-info`, `status-neutral`, each with a `-subtle` background; text on its subtle fill is ≥ 4.8:1 in both themes. Destructive buttons use `danger-solid` + `on-danger`. Never use status colours decoratively or as chart series.
- **Type.** Plus Jakarta Sans (UI) and Geist Mono (IDs, shortcuts), from Google Fonts. Scale: `page-title` 24 · `section-heading` 15 · `card-title` 13/600 · `body` 14 · `body-sm` 13 · `label` 12/500 · `caption` 12 · `overline` 11. Data styles `table`, `money`, `money-lg`, `metric`, `timestamp` all use `font-variant-numeric: tabular-nums`.
- **Spacing.** 4px grid: `space-1` 4 … `space-12` 48. Controls pad `space-3`, cards `space-4`, pages `space-6` (`space-4` on phones), sections `space-6`/`space-8`.
- **Radius.** Soft but disciplined: `radius-xs` 2 (checkboxes, bars), `radius-sm` 6 (badges, chips, tooltips), `radius-md` 8 (buttons, inputs, menus, nav items, kanban cards), `radius-lg` 12 (cards, tables, modals, columns), `radius-xl` 16 (feature panels). Avatars, icon tiles, dots and switches are fully round.
- **Icon tiles.** A 40px round tint (`ax-icon-tile`: mint, blue, green, orange, violet, danger) labels the kind of a KPI or card — always beside its text label, one per card, never as decoration alone. Stage headers use the same tints (`ax-stage`).
- **Elevation.** Borders do most of the work. `shadow-xs` secondary controls · `shadow-sm` kanban cards · `shadow-md` menus, popovers, toasts, a dragged card · `shadow-lg` modals, drawers, command palette. Focus is `focus-ring` (2px outline, 2px offset) or `shadow-focus` on rounded controls.
- **Sizing.** Controls `control-xs` 24 · `control-sm` 28 · `control-md` 32 (default) · `control-lg` 36. Rows `row-compact` 32 · `row-default` 40 · `row-comfortable` 48.
- **Motion.** Functional only: `--duration-fast` 100ms (hover/press), `--duration-base` 160ms (menus, tooltips), `--duration-slow` 220ms (drawers, modals), easing `--ease-standard` `cubic-bezier(0.2, 0, 0, 1)` — defined in `bundle.css`. No bounces, parallax or animated numbers; all motion drops to 0 with `prefers-reduced-motion`.
- **Documents.** Quotations and invoices render on white paper in both themes using the fixed `doc-*` tokens so the preview equals the exported PDF; a 3px `doc-accent` glacier-teal rule crosses the top of every page and colours the document title.

## Iconography

Lucide (ISC licence), 24px viewBox, stroke width 2, round caps and joins, `stroke: currentColor`, no fills. Sizes `icon-xs` 12 (badges) · `icon-sm` 14 (small buttons, inline text) · `icon-md` 16 (default) · `icon-lg` 20 · `icon-xl` 24 (empty states). Icons take the text colour of their context, or `text-tertiary` when leading a label in menus, inputs and nav. Module icons are fixed: Dashboard `layout-dashboard`, Clients `users`, Leads `target`, Projects `folder-kanban`, Tasks `square-check-big`, Quotations `file-text`, Invoices `receipt`, Payments `wallet`, Follow-ups `bell-ring`. Status icons are fixed: success `circle-check`, danger `circle-alert`, warning `triangle-alert`, time `clock`. Icon-only buttons always have an `aria-label` and a tooltip. No emoji, no filled or duotone icons, no other icon sets. There is no logo yet: set the product and workspace name in plain type (`body-strong`) and use an initials avatar.

## Using this system

- Load Plus Jakarta Sans and Geist Mono, the compiled `tokens.css`, then `components/bundle.css`. Set `data-theme="light"` (default) or `"dark"` on `<html>`; follow the OS with `prefers-color-scheme` unless the user picked a theme.
- Compose screens from the component classes documented under Components (`ax-btn`, `ax-input`, `ax-table`, `ax-badge`, `ax-kcard`, …). Each component's README lists its states; implement every listed state.
- Reference tokens as `var(--token-name)`. Layout sizes (`sidebar-width`, `drawer-md`, `modal-md`, `doc-page`, …) and breakpoints (`bp-sm` … `bp-2xl`) are tokens too.
- The product is trilingual — English, Français, العربية (RTL). Every screen must work in all three; see the Languages section.
- The further sections — Layout, Interaction, Accessibility, Data visualization, CRM patterns, Languages — are binding rules, not suggestions.
