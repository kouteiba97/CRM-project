import { describe, expect, it } from "vitest";
import { leadSchema, parseAmount } from "@/components/leads/schema";

describe("parseAmount (lead value field)", () => {
  it.each([
    ["4800", 480000],
    ["4800.5", 480050],
    ["4 800,50", 480050],
    ["4 800,50", 480050],
    ["4,800.50", 480050],
    ["4.800,50", 480050],
    ["340.000,00", 34000000],
    ["1,500", 150000],
    ["12,5", 1250],
    ["0", 0],
  ])("%s → %d minor units", (raw, minor) => {
    expect(parseAmount(raw)).toBe(minor);
  });

  it.each(["", "abc", "12,3,4", "-5", "1.2.3,4,5"])("rejects %j", (raw) => {
    expect(parseAmount(raw)).toBeNull();
  });
});

describe("leadSchema", () => {
  const base = {
    title: "Website",
    clientId: "",
    prospectCompany: "",
    prospectName: "",
    value: "",
    currency: "EUR",
    priority: "medium",
    stage: "new",
    expectedCloseDate: "",
    ownerId: "",
    source: "",
    followUpAt: "",
    followUpChannel: "call",
  };

  it("needs a client or a prospect company", () => {
    const res = leadSchema.safeParse(base);
    expect(res.success).toBe(false);
    expect(res.error?.issues[0]?.path).toEqual(["prospectCompany"]);
    expect(leadSchema.safeParse({ ...base, prospectCompany: "Atlas" }).success).toBe(true);
  });

  it("only accepts open stages for a new lead", () => {
    expect(leadSchema.safeParse({ ...base, prospectCompany: "A", stage: "won" }).success).toBe(false);
  });
});
