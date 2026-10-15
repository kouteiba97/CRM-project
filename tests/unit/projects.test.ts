import { describe, expect, it } from "vitest";
import { emptyProjectValues, projectSchema } from "@/components/projects/schema";
import { progressOf } from "@/lib/progress";

const base = emptyProjectValues({ currency: "EUR", name: "Portal", clientId: "6f1c1c4e-2d55-4f6a-9a51-6a3f8d7b2c11" });

describe("projectSchema", () => {
  it("accepts a minimal project and parses the budget to minor units", () => {
    const res = projectSchema.safeParse({ ...base, budget: "9 500,00" });
    expect(res.success).toBe(true);
    expect(res.data?.budget).toBe(950000);
  });

  it("requires a client", () => {
    const res = projectSchema.safeParse({ ...base, clientId: "" });
    expect(res.error?.issues.map((i) => i.message)).toContain("client");
  });

  it("refuses a deadline before the start date", () => {
    const res = projectSchema.safeParse({ ...base, startDate: "2026-11-10", deadline: "2026-11-01" });
    expect(res.error?.issues[0]).toMatchObject({ path: ["deadline"], message: "deadlineBeforeStart" });
    expect(projectSchema.safeParse({ ...base, startDate: "2026-11-10", deadline: "2026-11-10" }).success).toBe(true);
  });

  it("only takes full http(s) repository links", () => {
    expect(projectSchema.safeParse({ ...base, repoUrl: "github.com/x" }).success).toBe(false);
    expect(projectSchema.safeParse({ ...base, repoUrl: "https://github.com/x" }).success).toBe(true);
  });
});

describe("progressOf", () => {
  it("uses tasks when there are any, otherwise milestones", () => {
    expect(progressOf({ tasksTotal: 4, tasksDone: 1, milestonesTotal: 3, milestonesDone: 3 })).toBe(0.25);
    expect(progressOf({ tasksTotal: 0, tasksDone: 0, milestonesTotal: 4, milestonesDone: 2 })).toBe(0.5);
    expect(progressOf({ tasksTotal: 0, tasksDone: 0, milestonesTotal: 0, milestonesDone: 0 })).toBe(0);
  });
});
