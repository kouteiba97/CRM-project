# Languages — English, Français, العربية

Apex CRM ships in three languages from day one. Every screen is designed once and must work in all three; Arabic is right-to-left.

## Setting the language

- `<html lang="en|fr|ar" dir="ltr|rtl">`. Arabic sets `dir="rtl"`; English and French `ltr`.
- The language switcher (`ax-lang`, three segments **EN · FR · ع**) lives in Settings › General and in the user menu; the choice persists per user. Default follows the browser, falling back to French.
- Language is independent of the **document language**: a quotation or invoice can be issued in a different language from the UI (client setting "Document language").

## Type

- Latin: Plus Jakarta Sans. Arabic: IBM Plex Sans Arabic (`--font-arabic`, applied automatically under `:lang(ar)`). The `--font-sans` stack includes the Arabic face, so mixed strings render correctly.
- Same size scale in Arabic; line-height +10% (`body-ar` 14/22, `page-title-ar` 24/36). No uppercase, no letter-spacing in Arabic (`overline` labels become normal-case).
- Never shrink Arabic text to fit; let labels wrap or truncate with a tooltip.

## Layout (RTL)

- Use logical CSS only: `margin-inline-start`, `padding-inline`, `border-inline-start`, `inset-inline-start`, `text-align: start|end`. `components/bundle.css` already does.
- The whole layout mirrors: sidebar on the right, primary actions on the left of headers, table columns start from the right, kanban flows right-to-left, drawers open from the left.
- **Mirror** directional icons (`chevron-right`, arrows, "send", breadcrumb separators, back/forward) with `.ax-flip`. **Do not mirror** icons that depict real objects (clock, phone, calendar, check, search). Charts keep time flowing left→right in all three languages; only their legends and titles move to the right in Arabic.
- Progress bars and steppers fill from the start side (right in Arabic).

## Numbers, money, dates

| | English | Français | العربية |
|---|---|---|---|
| Digits | 0–9 | 0–9 | 0–9 (Latin digits, as used in Algerian business documents) |
| Money | €4,800.00 · DZD 340,000.00 | 4 800,00 € · 340 000,00 DA | 4.800,00 € · 340.000,00 د.ج. |
| Date | 14 Oct 2026 | 14 oct. 2026 | 14 أكتوبر 2026 (Maghreb month names: ماي، جوان، جويلية…) |
| Time | 14:32 | 14:32 | 14:32 |
| Relative | 3 days ago | il y a 3 jours | قبل 3 أيام |

- Format with `Intl.NumberFormat` / `Intl.DateTimeFormat` using `en-GB`, `fr-FR` and `ar-DZ` with `numberingSystem: "latn"` — never hand-build number strings. The values above are exactly what these locales produce (Arabic uses the Algerian grouping `4.800,00`).
- Amount columns stay end-aligned (left in Arabic) and tabular.
- Wrap IDs, emails, phones, IBANs and code in `.ax-ltr` (`direction: ltr; unicode-bidi: isolate`) inside Arabic text so they never scramble: `INV-2026-0142`, `+213 550 12 34 56`.

## Copy

- Translate meaning, not words; keep each language's natural length. French runs ~20–30% longer than English: buttons and tabs must allow it (no fixed widths on labels).
- Keep the same tone in all three: direct, factual, no exclamation marks. French uses *vous*. Arabic uses Modern Standard Arabic, formal and concise.
- Status words are fixed vocabulary — always use these:

| EN | FR | AR |
|---|---|---|
| Draft | Brouillon | مسودة |
| Sent | Envoyée | مُرسلة |
| Partially paid | Partiellement payée | مدفوعة جزئياً |
| Paid | Payée | مدفوعة |
| Overdue | En retard | متأخرة |
| Void | Annulée | ملغاة |
| Accepted / Declined / Expired | Acceptée / Refusée / Expirée | مقبول / مرفوض / منتهي الصلاحية |
| New · Contacted · Proposal sent · Negotiation · Won · Lost | Nouveau · Contacté · Devis envoyé · Négociation · Gagné · Perdu | جديد · تم التواصل · تم إرسال العرض · تفاوض · مكسوب · خاسر |
| Urgent · High · Medium · Low | Urgente · Haute · Moyenne · Basse | عاجلة · عالية · متوسطة · منخفضة |
| To do · In progress · In review · Done | À faire · En cours · En revue · Terminé | للإنجاز · قيد التنفيذ · قيد المراجعة · منجز |

- Module names: Dashboard / Tableau de bord / لوحة التحكم · Clients / Clients / العملاء · Leads / Prospects / العملاء المحتملون · Projects / Projets / المشاريع · Tasks / Tâches / المهام · Quotations / Devis / عروض الأسعار · Invoices / Factures / الفواتير · Payments / Paiements / المدفوعات · Follow-ups / Relances / المتابعات · Reports / Rapports / التقارير · Settings / Paramètres / الإعدادات.

## Documents (quotations & invoices)

Documents render in the client's document language. Arabic documents mirror fully (logo top-right, totals bottom-left) and show legal identifiers (NIF, RC, NIS, AI) with Latin digits. Bilingual FR/AR documents are allowed: French primary column, Arabic labels beneath in `doc-faint`.
