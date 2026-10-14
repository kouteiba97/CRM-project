import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import ar from "../../messages/ar.json";
import { STATUS } from "@/lib/status";
import * as enums from "@/db/schema/enums";

const catalogs = { en, fr, ar } as const;

/** DS › Languages › fixed status vocabulary, verbatim. */
const FIXED: Record<string, Record<string, [string, string, string]>> = {
  invoice: {
    draft: ["Draft", "Brouillon", "مسودة"],
    sent: ["Sent", "Envoyée", "مُرسلة"],
    partially_paid: ["Partially paid", "Partiellement payée", "مدفوعة جزئياً"],
    paid: ["Paid", "Payée", "مدفوعة"],
    overdue: ["Overdue", "En retard", "متأخرة"],
    void: ["Void", "Annulée", "ملغاة"],
  },
  quotation: {
    accepted: ["Accepted", "Acceptée", "مقبول"],
    declined: ["Declined", "Refusée", "مرفوض"],
    expired: ["Expired", "Expirée", "منتهي الصلاحية"],
  },
  lead: {
    new: ["New", "Nouveau", "جديد"],
    contacted: ["Contacted", "Contacté", "تم التواصل"],
    proposal_sent: ["Proposal sent", "Devis envoyé", "تم إرسال العرض"],
    negotiation: ["Negotiation", "Négociation", "تفاوض"],
    won: ["Won", "Gagné", "مكسوب"],
    lost: ["Lost", "Perdu", "خاسر"],
  },
  priority: {
    urgent: ["Urgent", "Urgente", "عاجلة"],
    high: ["High", "Haute", "عالية"],
    medium: ["Medium", "Moyenne", "متوسطة"],
    low: ["Low", "Basse", "منخفضة"],
  },
  task: {
    todo: ["To do", "À faire", "للإنجاز"],
    in_progress: ["In progress", "En cours", "قيد التنفيذ"],
    in_review: ["In review", "En revue", "قيد المراجعة"],
    done: ["Done", "Terminé", "منجز"],
  },
};

describe("status vocabulary", () => {
  it("matches the DS fixed vocabulary verbatim", () => {
    for (const [domain, codes] of Object.entries(FIXED)) {
      for (const [code, words] of Object.entries(codes)) {
        (["en", "fr", "ar"] as const).forEach((l, i) => {
          const status = catalogs[l].status as Record<string, Record<string, string>>;
          expect(status[domain]?.[code], `${l} ${domain}.${code}`).toBe(words[i]);
        });
      }
    }
  });

  it("every badge mapping has words in all three languages", () => {
    for (const [domain, codes] of Object.entries(STATUS)) {
      for (const code of Object.keys(codes)) {
        for (const l of ["en", "fr", "ar"] as const) {
          const status = catalogs[l].status as Record<string, Record<string, string>>;
          expect(status[domain]?.[code], `${l} ${domain}.${code}`).toBeTruthy();
        }
      }
    }
  });

  it("every database enum code has a badge mapping", () => {
    const pairs: [keyof typeof STATUS, { enumValues: readonly string[] }][] = [
      ["lead", enums.leadStage],
      ["task", enums.taskStatus],
      ["project", enums.projectStatus],
      ["client", enums.clientStatus],
      ["quotation", enums.quotationStatus],
      ["payment", enums.paymentStatus],
      ["milestone", enums.milestoneStatus],
    ];
    for (const [domain, e] of pairs) for (const v of e.enumValues) expect(STATUS[domain]).toHaveProperty(v);
    for (const v of enums.invoiceState.enumValues) expect(STATUS.invoice).toHaveProperty(v);
  });

  it("message catalogues have identical keys", () => {
    const keys = (o: object, p = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    const base = keys(en).sort();
    expect(keys(fr).sort()).toEqual(base);
    expect(keys(ar).sort()).toEqual(base);
  });
});
