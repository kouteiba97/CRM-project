import { sql } from "drizzle-orm";
import { bigint, integer, pgView, text, uuid } from "drizzle-orm/pg-core";

/**
 * Display status of an invoice, derived from its lifecycle state, received payments and due date.
 * Paid / Partially paid / Overdue are never stored, so they cannot go stale.
 */
export const invoiceBalances = pgView("invoice_balances", {
  invoiceId: uuid("invoice_id").notNull(),
  workspaceId: uuid("workspace_id").notNull(),
  paidMinor: bigint("paid_minor", { mode: "number" }).notNull(),
  balanceMinor: bigint("balance_minor", { mode: "number" }).notNull(),
  displayStatus: text("display_status").notNull(),
  daysOverdue: integer("days_overdue").notNull(),
}).as(sql`
  select
    i.id as invoice_id,
    i.workspace_id,
    coalesce(p.paid, 0)::bigint as paid_minor,
    (i.total_minor - coalesce(p.paid, 0))::bigint as balance_minor,
    case
      when i.state = 'void' then 'void'
      when i.state = 'draft' then 'draft'
      when i.total_minor - coalesce(p.paid, 0) <= 0 then 'paid'
      when i.due_date < current_date then 'overdue'
      when coalesce(p.paid, 0) > 0 then 'partially_paid'
      else i.state::text
    end as display_status,
    case
      when i.state in ('sent', 'viewed')
        and i.total_minor - coalesce(p.paid, 0) > 0
        and i.due_date < current_date
      then current_date - i.due_date
      else 0
    end as days_overdue
  from invoices i
  left join (
    select invoice_id, sum(amount_minor) as paid
    from payments
    where status = 'received'
    group by invoice_id
  ) p on p.invoice_id = i.id
  where i.archived_at is null
`);

/** Quotations still Sent after their validity date display as Expired. */
export const quotationDisplayStatus = pgView("quotation_display_status", {
  quotationId: uuid("quotation_id").notNull(),
  workspaceId: uuid("workspace_id").notNull(),
  displayStatus: text("display_status").notNull(),
}).as(sql`
  select
    q.id as quotation_id,
    q.workspace_id,
    case
      when q.status = 'sent' and q.valid_until < current_date then 'expired'
      else q.status::text
    end as display_status
  from quotations q
  where q.archived_at is null
`);
