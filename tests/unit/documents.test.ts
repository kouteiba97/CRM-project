import { describe, expect, it } from "vitest";
import { documentNumber, documentTotals, lineAmount, parsePercent, parseQuantity } from "@/lib/documents";

describe("document totals", () => {
  it("multiplies quantity by rate per line and sums the subtotal", () => {
    expect(lineAmount({ quantity: 40, unitPriceMinor: 4500 })).toBe(180000);
    expect(lineAmount({ quantity: 1.5, unitPriceMinor: 3333 })).toBe(5000); // 4999.5 rounds half up
    const t = documentTotals(
      [
        { quantity: 40, unitPriceMinor: 4500, taxRate: 0 },
        { quantity: 48, unitPriceMinor: 4500, taxRate: 0 },
        { quantity: 1, unitPriceMinor: 84000, taxRate: 0 },
      ],
      0,
    );
    expect(t).toMatchObject({ subtotalMinor: 480000, discountMinor: 0, taxMinor: 0, totalMinor: 480000, rates: [] });
  });

  it("applies the discount before tax", () => {
    // 1000.00 at 19% with a 10% discount: 1000 − 100 + 900 × 19% = 1071.00
    const t = documentTotals([{ quantity: 1, unitPriceMinor: 100000, taxRate: 19 }], 10);
    expect(t).toMatchObject({ subtotalMinor: 100000, discountMinor: 10000, taxMinor: 17100, totalMinor: 107100, rates: [19] });
  });

  it("taxes each line at its own rate", () => {
    const t = documentTotals(
      [
        { quantity: 1, unitPriceMinor: 10000, taxRate: 19 },
        { quantity: 2, unitPriceMinor: 5000, taxRate: 9 },
      ],
      0,
    );
    expect(t.taxMinor).toBe(1900 + 900);
    expect(t.rates).toEqual([19, 9]);
  });

  it("clamps the discount to 0–100%", () => {
    expect(documentTotals([{ quantity: 1, unitPriceMinor: 1000, taxRate: 0 }], 150).totalMinor).toBe(0);
    expect(documentTotals([{ quantity: 1, unitPriceMinor: 1000, taxRate: 0 }], -5).totalMinor).toBe(1000);
  });
});

describe("parsers", () => {
  it.each([["2", 2], ["1.5", 1.5], ["1,5", 1.5], ["0.125", 0.125], ["abc", null], ["-1", null], ["1.2345", null]])(
    "quantity %j → %j",
    (raw, v) => expect(parseQuantity(raw)).toBe(v),
  );
  it.each([["", 0], ["19", 19], ["9,5", 9.5], ["100", 100], ["101", null], ["x", null]])("percent %j → %j", (raw, v) =>
    expect(parsePercent(raw)).toBe(v),
  );
});

describe("documentNumber", () => {
  it("continues the seeded formats", () => {
    expect(documentNumber("invoice", 2026, 144)).toBe("INV-2026-0144");
    expect(documentNumber("quotation", 2026, 34)).toBe("Q-2026-034");
  });
});
