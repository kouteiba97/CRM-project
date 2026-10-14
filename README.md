# Apex CRM

The operating system of an independent software developer: clients, leads, projects, tasks, quotations,
invoices, payments and follow-ups. Trilingual from day one — English, Français, العربية (RTL).

- **Design system:** https://claude.ai/artifact/7viSXoAQnVPH9boX8LpvfJ — single source of truth (see `design-system/SOURCE.md`).
- **Screens:** https://claude.ai/artifact/JuvhNDHmNu5bXYhBwdH6Aq

## Stack

Next.js (App Router) · React · TypeScript · next-intl · Drizzle ORM on Neon Postgres · plain CSS from DS tokens
(`ax-*` classes, no Tailwind) · Lucide icons · Vitest · Playwright + axe.

## Getting started

```bash
npm install
cp .env.example .env.local   # set DATABASE_URL (Neon project "apex-crm", branch "dev")
npm run db:migrate
npm run db:seed              # dev data, dates relative to today
npm run dev                  # http://localhost:3000 → /fr, /en or /ar
```

Phase 1 has no sign-in yet: `src/lib/session.ts` resolves the seeded owner (`owner@apex.test`).
Auth.js arrives with the Login screen; every query is already scoped by `workspace_id`.

## Scripts

| | |
|---|---|
| `npm run tokens` | Regenerate `src/styles/tokens.css` from `design-system/tokens.json` |
| `npm run lint` | ESLint + Stylelint (raw hex / named colours are rejected outside tokens) |
| `npm run typecheck` | `tsc --noEmit` (run `npx next typegen` first on a fresh clone) |
| `npm test` | Unit tests: Intl output vs the DS Languages table, status vocabulary, catalogue parity |
| `npm run test:e2e` | Playwright on installed Edge: 3 locales × 2 themes + axe, responsive widths, shortcuts |
| `npm run db:generate` / `db:migrate` / `db:seed` | Drizzle migrations and seed |

## Conventions

- Money is integer minor units + ISO currency; KPIs never sum across currencies.
- Statuses are stable enum codes; words come from `messages/*.json › status` (DS fixed vocabulary).
  Paid / Partially paid / Overdue are derived in the `invoice_balances` view, never stored.
- All numbers and dates go through `src/lib/format.ts` (`en-GB`, `fr-FR`, `ar-DZ`, Latin digits).
- Logical CSS only; IDs, phones and e-mails inside Arabic text are wrapped in `.ax-ltr`.
