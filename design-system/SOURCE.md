# Design system source

The Apex CRM design system lives in the claude.ai artifact
https://claude.ai/artifact/7viSXoAQnVPH9boX8LpvfJ (version `1792012037-99c8`, read 2026-10-14).
It is the single source of truth. Files here are vendored copies — update them from the artifact, never by hand.

| Vendored file | From | Used by |
|---|---|---|
| `tokens.json` | `project/tokens.json` | `scripts/build-tokens.ts` → `src/styles/tokens.css` (generated on `predev`/`prebuild`) |
| `../src/styles/ds/bundle.css` | `project/components/bundle.css` | imported as-is by `src/app/[locale]/layout.tsx` |
| `docs/*.md` | `project/README.md`, `1-layout.md` … `6-languages.md` | reference for building screens |

The generated `tokens.css` was checked declaration-by-declaration against the canvas's compiled
`ds/apexcrm/tokens.css`: identical.

## Where the code follows `bundle.css` over a README

- **Sidebar items**: `bundle.css` styles `ax-nav-item` at 40px / 14px with an `accent-subtle` current state;
  the SidebarNav README says 28px / 13px with `surface-active`. The stylesheet is what ships, so the app uses it.

## Status words not in the fixed vocabulary — please review

The Languages section fixes the words for invoice, quotation, lead, priority and task statuses. StatusBadge also
uses the statuses below, which have no FR/AR words in the DS yet. These are proposals in `messages/*.json`;
once approved they should be added to the DS Languages table.

| Domain | EN | FR (proposed) | AR (proposed) |
|---|---|---|---|
| Invoice | Viewed | Consultée | تم الاطلاع عليها |
| Task | Blocked | Bloquée | متوقفة |
| Payment | Received · Pending · Failed · Refunded | Reçu · En attente · Échoué · Remboursé | مستلَمة · قيد الانتظار · فاشلة · مستردة |
| Project | Planning · Active · On hold · At risk · Completed · Archived | Planification · Actif · En pause · À risque · Terminé · Archivé | تخطيط · نشط · معلّق · في خطر · مكتمل · مؤرشف |
| Client | Active · Prospect · Inactive | Actif · Prospect · Inactif | نشط · محتمل · غير نشط |
| Milestone | Upcoming · In progress · Completed | À venir · En cours · Terminé | قادمة · قيد التنفيذ · مكتملة |

Also proposed (navigation): sidebar group labels **Sales / Delivery / Finance** → *Ventes / Réalisation / Finances* ·
*المبيعات / التنفيذ / المالية*.

## Formatting note

The DS table shows French dinar amounts as `340 000,00 DA`. `Intl.NumberFormat("fr-FR")` prints `DZD`, so
`src/lib/format.ts` swaps in the `fr-DZ` symbol "DA" for DZD only; grouping and decimals still come from `fr-FR`.
Every other value in the table is exactly what `en-GB` / `fr-FR` / `ar-DZ` with `numberingSystem: "latn"`
produce (see `tests/unit/format.test.ts`).
