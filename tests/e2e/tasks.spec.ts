import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const LOCALES = [
  { code: "en", dir: "ltr", title: "Tasks", overdue: "Overdue" },
  { code: "fr", dir: "ltr", title: "Tâches", overdue: "En retard" },
  { code: "ar", dir: "rtl", title: "المهام", overdue: "متأخرة" },
] as const;

async function expectAccessible(page: Page) {
  const axe = await new AxeBuilder({ page }).analyze();
  const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
}
const group = (page: Page, name: RegExp | string) => page.locator(".task-group", { has: page.locator(".task-group-head", { hasText: name }) });
const row = (page: Page, title: string) => page.locator("li.ax-task", { hasText: title });

/** Creates a task through the quick-create drawer. */
async function createTask(page: Page, title: string, opts: { due?: string } = {}) {
  await page.goto("/en/tasks?new=1");
  const dialog = page.getByRole("dialog", { name: "New task" });
  await dialog.getByLabel(/^Title/).fill(title);
  if (opts.due !== undefined) await dialog.getByLabel(/^Due date/).fill(opts.due);
  await dialog.getByRole("button", { name: "Create task" }).click();
  await expect(dialog).toBeHidden();
}

for (const loc of LOCALES) {
  test(`tasks ${loc.code}: grouped by due, overdue first, a11y`, async ({ page }) => {
    await page.goto(`/${loc.code}/tasks`);
    await expect(page.locator("html")).toHaveAttribute("dir", loc.dir);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(loc.title);
    const first = page.locator(".task-group").first();
    await expect(first.locator(".task-group-head")).toContainText(loc.overdue);
    await expect(first).toHaveClass(/is-danger/);
    await expect(first.locator("li.ax-task.is-overdue").first()).toBeVisible();
    // Completed is collapsed by default.
    await expect(page.locator(".task-group").last().locator(".task-group-head button")).toHaveAttribute("aria-expanded", "false");
    expect(await page.locator("body").innerText()).not.toMatch(/[٠-٩۰-۹]/);
    await expectAccessible(page);
    await page.screenshot({ path: `screenshots/tasks-${loc.code}.png`, fullPage: true });
  });
}

test("T opens quick create; validation; the task lands in its group", async ({ page }) => {
  await page.goto("/en/clients");
  await page.locator("body").click({ position: { x: 600, y: 60 } });
  await page.keyboard.press("t");
  await expect(page).toHaveURL(/\/en\/tasks\?new=1$/);
  const dialog = page.getByRole("dialog", { name: "New task" });
  await expect(dialog.getByLabel(/^Title/)).toBeFocused();
  await expectAccessible(page);
  await dialog.getByRole("button", { name: "Create task" }).click();
  await expect(dialog.getByText("Write a title for the task")).toBeVisible();

  const title = `Quick ${Date.now()}`;
  await dialog.getByLabel(/^Title/).fill(title);
  await dialog.getByLabel(/^Project/).selectOption({ label: "Bookstore platform" });
  await dialog.getByLabel(/^Priority/).selectOption({ label: "Urgent" });
  await page.keyboard.press("Control+Enter");
  await expect(dialog).toBeHidden();
  await expect(page.locator(".toasts").getByText(`Task “${title}” created`)).toBeVisible();
  await expect(group(page, "No date").locator("li.ax-task", { hasText: title })).toContainText("Bookstore platform");
});

test("inline add uses the group's date; quick completion with X and Undo", async ({ page }) => {
  const title = `Inline ${Date.now()}`;
  await page.goto("/en/tasks");
  const today = group(page, "Today");
  const add = today.getByLabel("Add a task to Today");
  await add.fill(title);
  await page.keyboard.press("Tab");
  await expect(today.getByLabel("Due date")).toBeFocused();
  await add.press("Enter");
  await expect(today.locator("li.ax-task", { hasText: title })).toContainText("Today");

  await page.goto(`/en/tasks?q=${encodeURIComponent(title)}`);
  const r = row(page, title);
  await r.locator(".task-title").focus();
  await page.keyboard.press("x");
  await expect(r.getByRole("checkbox", { name: /as done/ })).toHaveAttribute("aria-checked", "true");
  await page.locator(".toasts").getByRole("button", { name: "Undo" }).click();
  await page.waitForTimeout(600);
  await page.reload();
  await expect(group(page, "Today").locator("li.ax-task", { hasText: title })).toBeVisible();
});

test("bulk reschedule and complete, each with Undo", async ({ page }) => {
  const stamp = Date.now();
  await createTask(page, `Bulk one ${stamp}`);
  await createTask(page, `Bulk two ${stamp}`);
  await page.goto(`/en/tasks?q=${stamp}`);
  await expect(group(page, "No date").locator("li.ax-task")).toHaveCount(2);

  await page.getByRole("checkbox", { name: `Select “Bulk one ${stamp}”` }).check();
  await page.getByRole("checkbox", { name: `Select “Bulk two ${stamp}”` }).check();
  const bulk = page.getByRole("region", { name: "Bulk actions" });
  await expect(bulk).toContainText("2 selected");
  await bulk.getByRole("button", { name: "Tomorrow" }).click();
  await expect(page.locator(".toasts").getByText("2 tasks moved to Tomorrow")).toBeVisible();
  await expect(page.locator("li.ax-task", { hasText: `${stamp}` }).first()).toContainText("Tomorrow");
  await expect(group(page, "No date").locator("li.ax-task")).toHaveCount(0);

  await page.locator(".toasts").getByRole("button", { name: "Undo" }).click();
  await expect(group(page, "No date").locator("li.ax-task")).toHaveCount(2);

  await page.getByRole("checkbox", { name: `Select “Bulk one ${stamp}”` }).check();
  await page.getByRole("checkbox", { name: `Select “Bulk two ${stamp}”` }).check();
  await bulk.getByRole("button", { name: "Mark done" }).click();
  await expect(page.locator(".toasts").getByText("2 tasks completed")).toBeVisible();
  const completed = group(page, "Completed");
  await completed.locator(".task-group-head button").click();
  await expect(completed.locator("li.ax-task.is-done")).toHaveCount(2);
  await page.locator(".toasts").getByRole("button", { name: "Undo" }).click();
  await expect(group(page, "No date").locator("li.ax-task")).toHaveCount(2);
});

test("edit drawer saves changes; Delete offers Undo", async ({ page }) => {
  const title = `Edit ${Date.now()}`;
  await createTask(page, title, { due: "2031-05-20" });
  await page.goto(`/en/tasks?q=${encodeURIComponent(title)}`);
  await row(page, title).locator(".task-title").click();
  const dialog = page.getByRole("dialog", { name: "Edit task" });
  await expect(dialog.getByLabel(/^Title/)).toHaveValue(title);
  await expect(dialog.getByLabel(/^Due date/)).toHaveValue("2031-05-20");
  await dialog.getByLabel(/^Status/).selectOption({ label: "Blocked" });
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();
  await expect(row(page, title).locator(".ax-badge")).toHaveText("Blocked");

  await row(page, title).locator(".task-title").click();
  await page.getByRole("dialog", { name: "Edit task" }).getByRole("button", { name: "Delete" }).click();
  await expect(row(page, title)).toHaveCount(0);
  await page.locator(".toasts").getByRole("button", { name: "Undo" }).click();
  await expect(row(page, title)).toHaveCount(1);
});

test("group by project and status; filters in the URL", async ({ page }) => {
  await page.goto("/en/tasks");
  await page.getByRole("link", { name: "Project", exact: true }).click();
  await expect(page).toHaveURL(/group=project/);
  await expect(group(page, "Bookstore platform").locator("li.ax-task").first()).toBeVisible();
  await expect(page.locator(".task-group-head", { hasText: "No project" })).toBeVisible();

  await page.getByRole("link", { name: "Status", exact: true }).click();
  await expect(page).toHaveURL(/group=status/);
  await expect(group(page, "Blocked")).toHaveClass(/is-danger/);

  await page.goto("/en/tasks?project=none");
  for (const p of await page.locator(".task-group:not(:last-child) li.ax-task .proj").all()) await expect(p).toHaveCount(0);
  await page.goto("/en/tasks");
  await page.getByRole("button", { name: "Filter by Priority" }).click();
  await page.getByRole("menuitemradio", { name: "Urgent" }).click();
  await expect(page).toHaveURL(/priority=urgent/);
  for (const g of await page.locator("li.ax-task:not(.is-done) .ax-prio").all()) await expect(g).toHaveAttribute("aria-label", "Urgent");
});

test("no horizontal page scroll on tasks at 360 / 768 / 1366", async ({ page }) => {
  for (const code of ["fr", "ar"]) {
    for (const width of [360, 768, 1366]) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of [`/${code}/tasks`, `/${code}/tasks?group=project`, `/${code}/tasks?new=1`]) {
        await page.goto(path);
        await expect(page.locator("main h1")).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${path} @ ${width}`).toBeLessThanOrEqual(0);
      }
    }
  }
});
