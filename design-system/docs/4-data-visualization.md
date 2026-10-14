# Data visualization

Charts exist to answer business questions quickly: How much did I earn? What is unpaid? Where is my pipeline? Prefer a number to a chart and a table to a complicated chart.

## Palette

Categorical series in fixed order — never cycled, never re-ordered, never reassigned when filters change (colour follows the entity):

| Slot | Dark | Light | Typical use |
|---|---|---|---|
| `chart-1` teal | `#21a191` | `#1c9e8f` | Primary measure (revenue invoiced) |
| `chart-2` glacier blue | `#3987e5` | `#2a78d6` | Comparison: previous period, forecast, scheduled |
| `chart-3` orange | `#d95926` | `#eb6834` | Expenses, collected late |
| `chart-4` violet | `#9085e9` | `#6250d6` | Fourth series |
| `chart-5` yellow | `#c98500` | `#eda100` | Fifth series |
| `chart-6` magenta | `#d55181` | `#e87ba4` | Sixth series; beyond → "Other" |

Teal and blue lead because they are the brand: most Apex charts are one or two series and read as glacier water. The order was validated with a colour-vision-deficiency check: adjacent pairs ΔE ≥ 13 (OKLab ×100) and normal-vision ΔE ≥ 16.6 in both themes; all dark steps ≥ 3:1 on `surface`. In light theme slots 5–6 are below 3:1 on white, so charts using them carry direct labels or the table view. Scatter-like charts (all pairs compared) use at most the first 3 slots.

- **Sequential** (heatmaps, e.g. activity by weekday): single hue, `accent-secondary-subtle` → `accent-secondary` (glacier blue).
- **Status** in charts (paid / outstanding / overdue) uses status tokens with a texture for overdue and always a legend with words — never series colours.
- Neutral structure: `chart-grid` gridlines, `chart-axis` baseline, `chart-track` unfilled tracks.

## Forms

| Job | Chart |
|---|---|
| Revenue per month | Vertical bars; 2 series max side by side with 2px gap |
| KPI trend | 2px line, optional single-series area at 12% opacity of `chart-1` |
| Pipeline by stage | Horizontal bars in stage order with count + value labels |
| Paid vs unpaid | Single stacked horizontal bar (see PaymentSummary) |
| Time tracked by project | Horizontal bars sorted descending, top 5 + Other |
| A single number | Metric card |

Never: pie/donut charts with more than 3 slices, 3D, dual y-axes, gradients, rainbow scales.

## Anatomy

Container = ChartContainer card. Title names measure + unit. Legend above the plot for ≥ 2 series (and direct labels when ≤ 4). Axis text `caption` in `text-tertiary`, values abbreviated (`14k`) with exact values in tooltips. Gridlines horizontal only. Bars ≤ 24px wide, `radius-xs` data-ends, anchored on the baseline. Lines 2px, points 8px on hover only.

## Interaction

Hover and keyboard focus show a tooltip (`ax-tooltip`) with period + series + exact formatted value; line charts use a vertical crosshair. Range controls (segmented Month/Quarter/Year or DateRange) sit in the card head. Every chart offers "View as table" and CSV download. Clicking a bar navigates to the filtered list (e.g. invoices paid in that month).
