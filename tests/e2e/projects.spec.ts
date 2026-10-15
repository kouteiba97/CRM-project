import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const LOCALES = [
  { code: "en", dir: "ltr", title: "Projects" },
  { code: "fr", dir: "ltr", title: "Projets" },
  { code: "ar", dir: "rtl", title: "المشاريع" },
] as const;

async function expectAccessible(page: Page) {
  const axe = await new AxeBuilder({ page }).analyze();
  const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
}
const noIndicDigits = async (page: Page) => expect(await page.locator("body").innerText()).not.toMatch(/[٠-٩۰-۹]/);
const rows = (page: Page) => page.locator(".projects-table tbody tr");

/** Creates a project through the drawer and opens its record. */
async function createProject(page: Page, name: string) {
  await page.goto("/en/projects?new=1");
  const dialog = page.getByRole("dialog", { name: "New project" });
  await dialog.getByLabel(/^Name/).fill(name);
  await dialog.getByLabel(/^Client/).selectOption({ label: "Media Pro" });
  await dialog.getByLabel(/^Budget/).fill("10 000");
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(dialog).toBeHidden();
  await page.locator(".toasts").getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
}

for (const loc of LOCALES) {
  test(`projects ${loc.code}: list and record, a11y`, async ({ page }) => {
    await page.goto(`/${loc.code}/projects`);
    await expect(page.locator("html")).toHaveAttribute("dir", loc.dir);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(loc.title);
    expect(await rows(page).count()).toBeGreaterThanOrEqual(3);
    await expect(page.locator(".projects-table [role=progressbar]").first()).toBeVisible();
    await noIndicDigits(page);
    await expectAccessible(page);
    await page.screenshot({ path: `screenshots/projects-${loc.code}.png`, fullPage: true });

    await page.goto(`/${loc.code}/projects?q=PRJ-012`);
    await page.locator("a.row-open").first().click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bookstore platform");
    await expect(page.locator(".project-kpis .ax-metric")).toHaveCount(4);
    await expect(page.getByRole("tab")).toHaveCount(6);
    await expect(page.locator(".project-steps .ax-step")).toHaveCount(3);
    await expect(page.locator(".project-steps .ax-step.done")).toHaveCount(1);
    await expect(page.locator(".pay-summary")).toBeVisible();
    await noIndicDigits(page);
    await expectAccessible(page);
    await page.getByRole("tab").nth(2).click();
    await expect(page).toHaveURL(/tab=milestones/);
    await expectAccessible(page);
  });
}

test("list: filters and sort in the URL", async ({ page }) => {
  await page.goto("/en/projects");
  await expect(page.locator("th[aria-sort]")).toContainText("Deadline");
  await page.getByRole("button", { name: "Filter by Status" }).click();
  await page.getByRole("menuitemradio", { name: "At risk" }).click();
  await expect(page).toHaveURL(/status=at_risk/);
  for (const s of await page.locator(".projects-table .c-status").allInnerTexts()) expect(s).toContain("At risk");

  await page.goto("/en/projects");
  await page.getByRole("button", { name: "Filter by Client" }).click();
  await page.getByRole("menuitemradio", { name: "Librairie El Amel" }).click();
  await expect(page).toHaveURL(/client=/);
  await expect(rows(page).first()).toContainText("Bookstore platform");

  await page.goto("/en/projects");
  const th = page.locator("th", { hasText: "Progress" });
  await th.getByRole("link").click();
  await expect(page).toHaveURL(/sort=progress$/);
  await th.getByRole("link").click();
  await expect(page).toHaveURL(/sort=progress&dir=desc/);
  const pcts = (await page.locator(".progress-cell .ax-num").allInnerTexts()).map((v) => Number(v.replace(/\D/g, "")));
  expect(pcts).toEqual([...pcts].sort((a, b) => b - a));
});

test("P opens New project; validation; created with the next code", async ({ page }) => {
  await page.goto("/en/clients");
  await page.locator("body").click({ position: { x: 600, y: 60 } });
  await page.keyboard.press("p");
  await expect(page).toHaveURL(/\/en\/projects\?new=1$/);
  const dialog = page.getByRole("dialog", { name: "New project" });
  await expect(dialog.getByLabel(/^Name/)).toBeFocused();
  await expectAccessible(page);
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(dialog.getByText("Choose the client this project is for")).toBeVisible();
  await expect(dialog.getByLabel(/^Name/)).toBeFocused();

  const name = `Portal ${Date.now()}`;
  await dialog.getByLabel(/^Name/).fill(name);
  await dialog.getByLabel(/^Client/).selectOption({ label: "Librairie El Amel" });
  await expect(dialog.getByLabel(/^Currency/)).toHaveValue("DZD");
  await dialog.getByLabel(/^Start date/).fill("2026-11-10");
  await dialog.getByLabel(/^Deadline/).fill("2026-11-01");
  await dialog.getByLabel(/^Deadline/).blur();
  await expect(dialog.getByText("The deadline must be on or after the start date")).toBeVisible();
  await dialog.getByLabel(/^Deadline/).fill("2027-01-31");
  await dialog.getByLabel(/^Repository/).fill("github.com/x");
  await dialog.getByLabel(/^Repository/).blur();
  await expect(dialog.getByText("Enter a full link starting with https://")).toBeVisible();
  await dialog.getByLabel(/^Repository/).fill("https://github.com/apex/portal");
  await page.keyboard.press("Control+Enter");
  await expect(dialog).toBeHidden();
  const toast = page.locator(".toasts").getByText(new RegExp(`Project PRJ-\\d{3} created — ${name}`));
  await expect(toast).toBeVisible();
  await page.locator(".toasts").getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  await expect(page.locator(".project-meta")).toContainText(/PRJ-\d{3}/);
  await expect(page.locator(".project-meta a.repo")).toHaveAttribute("href", "https://github.com/apex/portal");
});

test("won lead → Convert to project prefills the drawer and links back", async ({ page }) => {
  const title = `Convert ${Date.now()}`;
  await page.goto("/en/leads?new=1");
  const ld = page.getByRole("dialog", { name: "New lead" });
  await ld.getByLabel(/^Title/).fill(title);
  await ld.getByLabel(/^Client/).selectOption({ label: "Creative Studio" });
  await ld.getByLabel(/^Value/).fill("7200");
  await ld.getByLabel(/^Stage/).selectOption({ label: "Negotiation" });
  await ld.getByRole("button", { name: "Create lead" }).click();
  await expect(ld).toBeHidden();

  await page.goto(`/en/leads?q=${encodeURIComponent(title)}`);
  await page.locator(".lead-card", { hasText: title }).locator("button[aria-haspopup=menu]").click();
  await page.getByRole("menuitem", { name: "Won" }).click();
  const won = page.getByRole("dialog", { name: `Mark “${title}” as won` });
  await won.getByRole("button", { name: "Mark as won" }).click();
  await won.getByRole("link", { name: "Convert to project" }).click();

  const dialog = page.getByRole("dialog", { name: "New project" });
  await expect(dialog.getByLabel(/^Name/)).toHaveValue(title);
  await expect(dialog.getByLabel(/^Client/)).toHaveValue(/[0-9a-f-]{36}/);
  await expect(dialog.getByLabel(/^Budget/)).toHaveValue("7200.00");
  await expect(dialog.getByLabel(/^Status/)).toHaveValue("active");
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(dialog).toBeHidden();
  await page.locator(".toasts").getByRole("button", { name: "Open" }).click();
  await expect(page.locator(".project-meta")).toContainText(`From lead ${title}`);
  await expect(page.locator(".project-meta")).toContainText("Creative Studio");
});

test("milestones and tasks: add inline, complete with Undo, Create invoice appears", async ({ page }) => {
  const name = `Delivery ${Date.now()}`;
  await createProject(page, name);
  await page.getByRole("tab", { name: /Milestones/ }).click();
  await page.getByRole("button", { name: "Add milestone" }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Write a title for the milestone")).toBeVisible();
  await page.getByLabel("Milestone title").fill("Design sign-off");
  await page.getByLabel("Amount").fill("2 500");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const row = page.locator(".milestone-list .ms-row", { hasText: "Design sign-off" });
  await expect(row).toContainText("€2,500.00");
  await expect(page.locator(".project-steps .ax-step")).toHaveCount(1);

  await row.getByRole("button", { name: "Mark “Design sign-off” as completed" }).click();
  await expect(row).toContainText("Completed");
  await expect(page.locator(".project-title").getByRole("link", { name: "Create invoice" })).toBeVisible();
  await expect(page.locator(".unbilled")).toContainText("“Design sign-off” is complete and not invoiced yet.");
  await expect(page.locator(".project-kpis")).toContainText("€2,500 / €10,000");
  await page.locator(".toasts").getByRole("button", { name: "Undo" }).click();
  await expect(row).toContainText("Upcoming");
  await expect(page.locator(".project-title").getByRole("link", { name: "Create invoice" })).toHaveCount(0);

  await page.getByRole("tab", { name: /Tasks/ }).click();
  await page.getByRole("button", { name: "Add task" }).click();
  await page.getByLabel("Task title").fill("Send the staging link");
  await page.getByLabel("Priority").selectOption({ label: "High" });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const task = page.locator(".ax-task", { hasText: "Send the staging link" });
  await expect(task).toBeVisible();
  await task.getByRole("checkbox").click();
  await expect(task.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".project-kpis")).toContainText("1 / 1 tasks");
  await expectAccessible(page);
});

test("status change with Undo, E edits, archive with Undo", async ({ page }) => {
  const name = `Lifecycle ${Date.now()}`;
  await createProject(page, name);
  const url = page.url();
  await page.getByRole("button", { name: "Change project status" }).click();
  await page.getByRole("menuitemradio", { name: "On hold" }).click();
  await expect(page.locator(".project-title .ax-badge")).toHaveText("On hold");
  await page.locator(".toasts").getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".project-title .ax-badge")).toHaveText("Planning");

  await page.locator("body").click({ position: { x: 900, y: 70 } });
  await page.keyboard.press("e");
  const dialog = page.getByRole("dialog", { name: "Edit project" });
  await expect(dialog.getByLabel(/^Name/)).toHaveValue(name);
  await expect(dialog.getByLabel(/^Budget/)).toHaveValue("10000.00");
  await dialog.getByLabel(/^Deadline/).fill("2030-06-30");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".project-meta")).toContainText("30 Jun 2030");

  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Archive project" }).click();
  await expect(page).toHaveURL(/\/en\/projects$/);
  await page.locator(".toasts").getByRole("button", { name: "Undo" }).click();
  await expect(page).toHaveURL(url);
});

test("no horizontal page scroll on projects at 360 / 768 / 1366", async ({ page }) => {
  await page.goto("/en/projects?q=PRJ-012");
  const record = (await page.locator("a.row-open").first().getAttribute("href"))!;
  for (const code of ["fr", "ar"]) {
    for (const width of [360, 768, 1366]) {
      await page.setViewportSize({ width, height: 800 });
      const rec = record.replace(/^\/en/, `/${code}`);
      for (const path of [`/${code}/projects`, rec, `${rec}?tab=milestones`, `${rec}?tab=tasks`]) {
        await page.goto(path);
        await expect(page.locator("main h1")).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${path} @ ${width}`).toBeLessThanOrEqual(0);
      }
    }
  }
});
