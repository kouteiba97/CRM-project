import { describe, expect, it } from "vitest";
import { reminderSchedule } from "@/lib/reminders";

const at = (iso: string) => new Date(`${iso}T10:00:00`);

describe("reminderSchedule (due, +3, +7, +14)", () => {
  it("lists the four dates from the due date", () => {
    const steps = reminderSchedule("2026-10-01", [], at("2026-09-20"));
    expect(steps.map((s) => s.date)).toEqual(["2026-10-01", "2026-10-04", "2026-10-08", "2026-10-15"]);
    expect(steps.every((s) => s.state === "upcoming")).toBe(true);
  });

  it("marks past steps without a reminder as due", () => {
    const steps = reminderSchedule("2026-10-01", [], at("2026-10-09"));
    expect(steps.map((s) => s.state)).toEqual(["due", "due", "due", "upcoming"]);
  });

  it("matches logged reminders to steps in order", () => {
    const steps = reminderSchedule("2026-10-01", [at("2026-10-01"), at("2026-10-05")], at("2026-10-09"));
    expect(steps.map((s) => s.state)).toEqual(["sent", "sent", "due", "upcoming"]);
  });

  it("ignores reminders sent before a step's date", () => {
    const steps = reminderSchedule("2026-10-01", [at("2026-09-28")], at("2026-10-02"));
    expect(steps[0]!.state).toBe("due");
  });

  it("a late reminder catches up: older steps are skipped, not owed", () => {
    const steps = reminderSchedule("2026-10-01", [at("2026-10-09")], at("2026-10-09"));
    expect(steps.map((s) => s.state)).toEqual(["skipped", "skipped", "sent", "upcoming"]);
  });
});
