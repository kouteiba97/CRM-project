import { describe, expect, it } from "vitest";
import { daysToWeekEnd, dueBucket, isoLocal, nextMonday, taskFormSchema } from "@/components/tasks/schema";

// Local calendar dates (noon avoids any DST edge).
const day = (s: string) => new Date(`${s}T12:00:00`);

describe("dueBucket (Overdue · Today · This week · Later · No date)", () => {
  const wednesday = day("2026-10-14");
  it.each([
    [null, "none"],
    ["2026-10-13", "overdue"],
    ["2026-10-14", "today"],
    ["2026-10-15", "week"],
    ["2026-10-18", "week"], // Sunday ends the ISO week
    ["2026-10-19", "later"],
  ] as const)("%s → %s", (due, bucket) => {
    expect(dueBucket(due, wednesday)).toBe(bucket);
  });

  it("has no 'This week' left on a Sunday", () => {
    const sunday = day("2026-10-18");
    expect(daysToWeekEnd(sunday)).toBe(0);
    expect(dueBucket("2026-10-19", sunday)).toBe("later");
  });
});

describe("nextMonday", () => {
  it.each([
    ["2026-10-14", "2026-10-19"], // Wednesday
    ["2026-10-18", "2026-10-19"], // Sunday → tomorrow
    ["2026-10-19", "2026-10-26"], // Monday → a week later
  ])("%s → %s", (from, to) => {
    expect(isoLocal(nextMonday(day(from)))).toBe(to);
  });
});

describe("taskFormSchema", () => {
  const base = { title: "Call", projectId: "", status: "todo", priority: "medium", dueDate: "", assigneeId: "" };
  it("needs a title and normalises empty optionals to null", () => {
    expect(taskFormSchema.safeParse({ ...base, title: "  " }).error?.issues[0]?.message).toBe("required");
    const ok = taskFormSchema.parse(base);
    expect(ok).toMatchObject({ projectId: null, dueDate: null, assigneeId: null });
  });
});
