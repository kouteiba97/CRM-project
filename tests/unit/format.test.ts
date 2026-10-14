import { describe, expect, it } from "vitest";
import { date, dayDiff, money, percent, relativeDay, time } from "@/lib/format";

// Intl inserts invisible marks (RLM in Arabic) and narrow no-break spaces in French; compare visible text.
const visible = (s: string) => s.replace(/[‎‏؜]/g, "").replace(/[  ]/g, " ");

describe("money — DS › Languages table", () => {
  it("EUR", () => {
    expect(visible(money("en", 480000, "EUR"))).toBe("€4,800.00");
    expect(visible(money("fr", 480000, "EUR"))).toBe("4 800,00 €");
    expect(visible(money("ar", 480000, "EUR"))).toBe("4.800,00 €");
  });

  it("DZD", () => {
    expect(visible(money("en", 34000000, "DZD"))).toBe("DZD 340,000.00");
    expect(visible(money("fr", 34000000, "DZD"))).toBe("340 000,00 DA");
    expect(visible(money("ar", 34000000, "DZD"))).toBe("340.000,00 د.ج.");
  });

  it("whole units for KPIs", () => {
    expect(visible(money("en", 1845000, "EUR", { whole: true }))).toBe("€18,450");
  });

  it("never emits Arabic-Indic digits", () => {
    expect(money("ar", 123456789, "EUR")).not.toMatch(/[٠-٩۰-۹]/);
    expect(date("ar", "2026-10-14")).not.toMatch(/[٠-٩۰-۹]/);
  });
});

describe("dates — DS › Languages table", () => {
  it("medium date", () => {
    expect(date("en", "2026-10-14")).toBe("14 Oct 2026");
    expect(date("fr", "2026-10-14")).toBe("14 oct. 2026");
    expect(visible(date("ar", "2026-10-14"))).toBe("14 أكتوبر 2026");
  });

  it("Maghreb month names in Arabic", () => {
    expect(date("ar", "2026-05-14", "monthYear")).toContain("ماي");
    expect(date("ar", "2026-06-14", "monthYear")).toContain("جوان");
    expect(date("ar", "2026-07-14", "monthYear")).toContain("جويلية");
  });

  it("24h time", () => {
    const d = new Date(2026, 9, 14, 14, 32);
    for (const l of ["en", "fr", "ar"] as const) expect(visible(time(l, d))).toBe("14:32");
  });

  it("relative only within 7 days", () => {
    const now = new Date(2026, 9, 14, 12);
    expect(relativeDay("en", "2026-10-11", now)).toBe("3 days ago");
    expect(relativeDay("fr", "2026-10-11", now)).toBe("il y a 3 jours");
    expect(visible(relativeDay("ar", "2026-10-11", now) ?? "")).toBe("قبل 3 أيام");
    expect(relativeDay("en", "2026-10-30", now)).toBeNull();
    expect(dayDiff("2026-10-15", now)).toBe(1);
  });

  it("signed percent for deltas", () => {
    expect(percent("en", 0.12, true)).toBe("+12%");
    expect(visible(percent("fr", -0.08, true))).toBe("-8 %");
  });
});
