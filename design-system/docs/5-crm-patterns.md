# CRM patterns

How the components combine for each module. Component specs live under Components; these are the page recipes.

## Clients

- **List:** PageHeader ("Clients", count, New client) + toolbar (search, Status, Tag, Owner, "Has overdue") + DataTable. Columns: Client (square avatar + name + primary contact) · Status · Open projects · Outstanding (money) · Last contact (relative) · Next follow-up (due styling) · Owner. Default sort next follow-up ascending.
- **Record:** ClientProfile — left rail (identity, quick actions, contacts, details, next follow-up) + main (KPI strip, tabs Overview · Projects · Quotations · Invoices · Payments · Files · Activity). Activity history is a Timeline with a composer for calls, notes and emails.
- Contact data (email, phone) is copyable and actionable (mailto/tel) with icon buttons that have labels.

## Leads

- **Pipeline:** KanbanBoard with stages New → Contacted → Proposal sent → Negotiation → Won / Lost. Column head shows count and total value. Cards: title, client, value, next follow-up, priority.
- Table view (segmented Board/Table) for bulk work; same filters.
- Moving to Won offers "Convert to project" and "Create quotation"; Lost asks for a reason (select). No confirmation dialogs, Undo toast instead.
- A lead with no next follow-up shows "No follow-up" in `status-warning` text — every open lead should have one.

## Projects

- **List:** DataTable — Project · Client · Status · Progress (bar + %) · Next milestone · Deadline (due styling) · Budget used · Billed.
- **Record:** ProjectHeader (status, client, dates, team, repo, stat strip with Progress / Next milestone / Budget / Billing), milestone stepper, tabs Overview · Tasks · Milestones · Files · Invoices · Activity.
- Linked finance is always visible: invoiced, paid and due amounts, each linking to the filtered invoice list. A completed but unbilled milestone surfaces a "Create invoice" primary action.

## Tasks

- TaskList rows with quick completion, priority glyph, project, due date and assignee; group by due (Overdue · Today · This week · Later · No date) by default.
- Overdue tasks: danger date with words + left row marker; they stay at the top until done or rescheduled. Bulk reschedule from the bulk bar.
- Inline creation at the bottom of each group; `T` anywhere opens a quick-create drawer (`drawer-sm`).

## Quotations & invoices

- **List:** DataTable — Number (mono) · Client · Status · Issue date · Due/Valid until · Amount (money) · Balance (money). Overdue rows show "Overdue · N days".
- **Editor:** full page, two panes at ≥ `bp-xl`: form (client, dates, currency, line items table with inline editing, discount, tax, notes, payment schedule) left; live InvoiceDocument preview right in a PDF frame. Below `bp-xl` the preview is a tab.
- Line items: drag handle, description (title + detail), qty, unit, rate, amount (computed, read-only); keyboard `Enter` adds a row, `⌘⌫` removes. Totals recompute live.
- **Sending:** "Send" opens a modal with recipient, subject, message and attached PDF; it is the one confirmation step. Quotation accepted → "Convert to invoice" / "Create project".
- Documents follow the InvoiceDocument layout and the `doc-*` tokens; status stamps are words.

## Payments

- PaymentSummary on invoices, projects and clients with the fixed definitions: Paid, Outstanding (not yet due), Overdue (past due, with age), Partially paid (invoice status), Amount due.
- **List:** DataTable — Date · Client · Invoice · Method · Reference · Amount (money) · Status (Received / Pending / Failed / Refunded).
- "Record payment" modal pre-fills the balance; partial amounts are allowed and set the invoice to Partially paid. Over-payment shows a warning and creates a credit.
- Payment reminders: scheduled automatically (switch per client) at due date, +3, +7, +14 days; each send logs to the Timeline.

## Dashboard

DashboardLayout: KPI strip (Revenue, Outstanding, Overdue, Pipeline) → Today (tasks) · Follow-ups · Overdue invoices → Revenue chart · Pipeline by stage → Recent activity · Upcoming milestones. Every widget is actionable and links to its filtered list.

## Follow-ups

A follow-up is a dated reminder attached to a client or lead (call, email, meeting). It appears in the sidebar count, the dashboard Follow-ups card, the record rail and the notification centre on its date. Due styling: future `text-secondary`, today/tomorrow `status-warning` + clock, overdue `status-danger` + words. Completing one prompts (inline, optional) to log the outcome and set the next follow-up.
