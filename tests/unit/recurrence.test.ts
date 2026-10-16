import { describe, expect, it } from "vitest";
import { addDays, addInterval, daysBetween } from "@/lib/recurrence";

describe("recurrence", () => {
  it("adds months, keeping the day or using the month's last day", () => {
    expect(addInterval("2026-01-15", "monthly")).toBe("2026-02-15");
    expect(addInterval("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(addInterval("2028-01-31", "monthly")).toBe("2028-02-29");
    expect(addInterval("2026-11-30", "quarterly")).toBe("2027-02-28");
    expect(addInterval("2026-12-10", "monthly")).toBe("2027-01-10");
    expect(addInterval("2026-03-31", "yearly")).toBe("2027-03-31");
    expect(addInterval("2026-01-31", "monthly", 2)).toBe("2026-03-31");
  });

  it("counts and adds days across months and years", () => {
    expect(daysBetween("2026-01-01", "2026-01-31")).toBe(30);
    expect(daysBetween("2026-12-20", "2027-01-19")).toBe(30);
    expect(addDays("2026-12-20", 30)).toBe("2027-01-19");
    expect(addDays("2026-03-01", 0)).toBe("2026-03-01");
  });
});
