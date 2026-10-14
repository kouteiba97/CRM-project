# Layout

Desktop-first, verified at **1920×1080** and **1366×768**, responsive down to 360px phones.

## App shell

| Region | Size | Rules |
|---|---|---|
| Sidebar | `sidebar-width` 232px expanded · `sidebar-collapsed` 56px | Expanded ≥ `bp-xl` (1280); collapsed by default between `bp-lg` and `bp-xl`; off-canvas sheet below `bp-md`. User toggle `[` persists. `z-sidebar`. |
| Top bar | `topbar-height` 48px | Breadcrumbs left; global search, quick-create, notifications, user right. Sticky. |
| Page header | `page-header-height` 56px min | Title + meta + actions; sticky under the top bar with `shadow-sm` once scrolled. |
| Toolbar | 44px (28px controls + `space-2` padding) | Search, filter chips, sort, view and density. Replaced by the bulk bar when rows are selected. |
| Content | fluid, max `content-max` 1600px | Padding-x `space-6` (≥ `bp-xl`), `space-5` (`bp-lg`), `space-4` (< `bp-md`). Tables and boards may opt into full width. |

At 1366×768 the usable content area is ~1100×660 with the sidebar expanded: a list page must show at least 12 rows at Default density without scrolling (header 104px + toolbar 44px + 12 × 40px rows + pager 44px).

## Grids

- **Dashboard:** 12 columns, gutter `space-6` (≥ `bp-2xl`), `space-5` (`bp-xl`), `space-4` below. KPI strip 4-up → 2-up below `bp-xl` → 1-up below `bp-sm`. Cards are 4/4/4 at 1920, 6/6 + 12 at 1366, 12 below `bp-lg`.
- **Record pages** (client, project, lead): left rail 320px + fluid main at ≥ `bp-xl`; the rail stacks above the tabs below it.
- **Settings and long forms:** single column, max `form-max` 720px, section headings `section-heading` with `space-8` between sections.

## Forms

- Labels above controls; one column by default. Two columns (gap `space-3`) only for short, related pairs: first/last name, amount/currency, start/due date.
- Field vertical gap `space-4`; group related fields under a `section-heading` with a one-line description.
- Control widths match content (amount 160, date 160, phone 200); text fields fill the column.
- Action bar at the bottom of page forms (sticky when the form exceeds the viewport): Cancel (secondary) · Save (primary) right-aligned. Modal and drawer footers follow the same order.

## Density

Two table densities, chosen per list and remembered per user: **Default** (`row-default` 40px) and **Compact** (`row-compact` 32px, for 100+ records). Two-line entity cells use `row-comfortable` 48px. Never introduce a third density or "comfortable" whitespace modes.

## Overlays

| Overlay | Widths | Use |
|---|---|---|
| Modal | `modal-sm` 400 · `modal-md` 560 · `modal-lg` 800 | Confirmations, short forms, line-item editor. Max-height 85vh. |
| Drawer | `drawer-sm` 400 · `drawer-md` 560 · `drawer-lg` 760 | Quick create, record preview, document/PDF preview. Full height, right side. |
| Command palette | `command-palette` 640 | Global search and commands, 15vh from top. |
| Menus/popovers | min 200, max 320 | Dropdowns, selects, date pickers. |

## Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| ≥ `bp-2xl` 1600 | Everything docked; drawers sit beside content without a scrim where marked non-modal. |
| `bp-xl` 1280 | Expanded sidebar; dashboard 2–3 columns; low-priority table columns hide. |
| `bp-lg` 1024 | Collapsed sidebar; record rails stack; kanban scrolls horizontally with snap. |
| `bp-md` 768 | Off-canvas sidebar; page actions collapse into a "More" menu except the primary. |
| `bp-sm` 640 | Tables become stacked cards; drawers and modals go full screen; touch targets 44px; toolbar becomes a Filter button opening a sheet. |
