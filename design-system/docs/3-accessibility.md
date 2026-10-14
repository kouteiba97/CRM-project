# Accessibility

Target: **WCAG 2.2 AA** in both themes.

## Contrast (verified)

| Pair | Dark | Light |
|---|---|---|
| `text-primary` on any surface | ≥ 12.8:1 | ≥ 15.0:1 |
| `text-secondary` on any surface | ≥ 7.4 | ≥ 6.4 |
| `text-tertiary` on any surface (incl. hover, selected) | ≥ 5.2 | ≥ 4.5 |
| `accent-text` on any surface / `accent-subtle` | ≥ 9.2 / 8.9 | ≥ 5.1 / 5.1 |
| `accent-secondary-text` on any surface / its subtle | ≥ 7.6 / 8.2 | ≥ 5.2 / 5.2 |
| `on-accent` on `accent-primary` (hover / active) | 8.1 (9.4 / 6.2) | 4.9 (6.1 / 7.5) |
| `on-accent-secondary` on `accent-secondary` | 6.4 | 5.2 |
| `on-danger` on `danger-solid` | 4.8 | 5.6 |
| Status text on its `-subtle` fill | 6.6–8.7 | 4.8–5.2 |
| `border-control` on surfaces (non-text 3:1) | ≥ 3.3 | ≥ 3.2 |
| `focus-ring` on any surface | ≥ 10.1 | ≥ 5.1 |

`text-disabled` is intentionally below 4.5:1 (exempt) and always paired with a disabled state. Light-theme `chart-5` and `chart-6` are below 3:1 against white: charts that use them must show direct labels or a table view.

## Focus

- Visible focus on every interactive element: 2px solid `focus-ring` with 2px offset (or `shadow-focus` on rounded controls); `shadow-focus-danger` on invalid fields and destructive buttons. Never `outline: none` without a replacement.
- Focus is never obscured by sticky headers or toasts (scroll-padding equals the sticky stack height) — WCAG 2.4.11.
- Dialogs and modal drawers trap focus and return it to the trigger. Opening a record from a list and coming back restores the focused row.

## Keyboard

All functionality is keyboard operable: tables are grids with roving focus, kanban supports keyboard moves, date pickers support typed entry and arrow navigation, menus support arrow keys and type-ahead. Drag-and-drop always has a "Move to…" alternative (WCAG 2.5.7).

## Not colour alone

- Status badges: icon or dot + word. Priorities: bar-count glyph + word (glyph alone only with `aria-label` + tooltip). Deltas: arrow + sign + value. Overdue: word + icon + danger colour + left row marker. Payment composition: solid vs hatched segments + legend words + amounts.
- Required fields: asterisk **and** `aria-required`; errors: icon + text + `aria-invalid`.

## Targets & text

- Pointer targets ≥ 24×24px (`hit-min`, WCAG 2.5.8); touch layouts 44px. Dense xs buttons get extra hit padding where neighbours allow.
- Body text never below 12px in the app (11px only for `overline` labels and document print text). Text resizes to 200% without loss; layouts reflow at 320 CSS px.
- Truncated text exposes the full value via tooltip and the record page.

## Semantics

Landmarks: `nav` (sidebar, breadcrumbs), `header`, `main`, `aside` (drawer/rail). Tables use `th` with `scope` and `aria-sort`. Live regions: toasts `role="status"` (errors `role="alert"`), loading regions `aria-busy`. Dialogs `role="dialog"`/`alertdialog` with `aria-labelledby`. Icon-only buttons have `aria-label`. Charts have `role="img"` with a summary label and a table alternative.

## Motion & preferences

Respect `prefers-reduced-motion` (all durations → 0, no shimmer), `prefers-color-scheme` (initial theme), and `forced-colors` (borders stay visible because every container has a real border; hatching keeps overdue segments distinguishable).
