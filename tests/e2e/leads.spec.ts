import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const LOCALES = [
  { code: "en", dir: "ltr", title: "Leads", won: "Won" },
  { code: "fr", dir: "ltr", title: "Prospects", won: "Gagné" },
  { code: "ar", dir: "rtl", title: "العملاء المحتملون", won: "مكسوب" },
] as const;

async function expectAccessible(page: Page) {
  const axe = await new AxeBuilder({ page }).analyze();
  const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
}

/** Creates a prospect lead through the drawer and lands back on the board. */
async function createLead(page: Page, title: string, stage = "New") {
  await page.goto("/en/leads?new=1");
  const dialog = page.getByRole("dialog", { name: "New lead" });
  await dialog.getByLabel(/^Title/).fill(title);
  await dialog.getByLabel(/^Prospect company/).fill(`${title} SARL`);
  await dialog.getByLabel(/^Value/).fill("4 800,50");
  await dialog.getByLabel(/^Stage/).selectOption({ label: stage });
  await dialog.getByRole("button", { name: "Create lead" }).click();
  await expect(dialog).toBeHidden();
}

const card = (page: Page, title: string) => page.locator(".lead-card", { hasText: title });
const column = (page: Page, name: string) => page.locator(".ax-col", { has: page.getByRole("heading", { name, exact: true }) });

for (const loc of LOCALES) {
  test(`pipeline ${loc.code}: columns, cards, a11y; record a11y`, async ({ page }) => {
    await page.goto(`/${loc.code}/leads`);
    await expect(page.locator("html")).toHaveAttribute("dir", loc.dir);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(loc.title);
    await expect(page.locator(".leads-board .ax-col")).toHaveCount(6);
    await expect(page.locator(".col-collapsed")).toHaveCount(2);
    expect(await page.locator(".lead-card").count()).toBeGreaterThan(5);
    expect(await page.locator("body").innerText()).not.toMatch(/[٠-٩۰-۹]/);
    await expectAccessible(page);
    await page.screenshot({ path: `screenshots/leads-board-${loc.code}.png`, fullPage: true });

    await page.goto(`/${loc.code}/leads?view=table&q=Field`);
    await page.locator("a.row-open").first().click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Field app");
    await expect(page.locator(".lead-steps .ax-step")).toHaveCount(5);
    await expect(page.locator('.lead-steps [aria-current="step"]')).toHaveCount(1);
    expect(await page.locator("body").innerText()).not.toMatch(/[٠-٩۰-۹]/);
    await expectAccessible(page);
  });
}

test("table view: filters and sort live in the URL", async ({ page }) => {
  await page.goto("/en/leads");
  await page.getByRole("link", { name: "Table" }).click();
  await expect(page).toHaveURL(/view=table/);
  await expect(page.locator(".leads-table")).toBeVisible();
  await expect(page.locator("th[aria-sort]")).toContainText("Next follow-up");

  await page.getByRole("button", { name: "Filter by Priority" }).click();
  await page.getByRole("menuitemradio", { name: "Urgent" }).click();
  await expect(page).toHaveURL(/priority=urgent/);
  for (const p of await page.locator(".leads-table tbody .ax-prio").allInnerTexts()) expect(p).toContain("Urgent");

  await page.goto("/en/leads?view=table&stage=won");
  expect(await page.locator(".leads-table tbody tr").count()).toBeGreaterThanOrEqual(2);
  for (const s of await page.locator(".leads-table tbody .c-status").allInnerTexts()) expect(s).toContain("Won");

  await page.goto("/en/leads?view=table");
  const th = page.locator("th", { hasText: "Value" });
  await th.getByRole("link").click();
  await expect(page).toHaveURL(/sort=value$/);
  await th.getByRole("link").click();
  await expect(page).toHaveURL(/sort=value&dir=desc/);
  const values = await page.locator(".leads-table td.c-money").allInnerTexts();
  const nums = values.map((v) => Number(v.replace(/[^\d.]/g, "")));
  expect(nums).toEqual([...nums].sort((a, b) => b - a));

  await page.goto("/en/leads?nofu=1");
  for (const c of await page.locator(".lead-card").all()) await expect(c).toContainText("No follow-up");
});

test("L opens the New lead drawer; validation; amounts accept local formats", async ({ page }) => {
  await page.goto("/en/clients");
  await page.locator("body").click({ position: { x: 600, y: 60 } });
  await page.keyboard.press("l");
  await expect(page).toHaveURL(/\/en\/leads\?new=1$/);
  const dialog = page.getByRole("dialog", { name: "New lead" });
  await expect(dialog.getByLabel(/^Title/)).toBeFocused();
  await expectAccessible(page);
  await dialog.getByRole("button", { name: "Create lead" }).click();
  await expect(dialog.getByLabel(/^Title/)).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByText("Choose a client or enter the prospect company")).toBeVisible();
  await dialog.getByLabel(/^Value/).fill("12,3,4");
  await dialog.getByLabel(/^Value/).blur();
  await expect(dialog.getByText("Enter an amount, e.g. 4800 or 4 800,50")).toBeVisible();

  // Choosing a client removes the prospect requirement and brings the client's currency.
  await dialog.getByLabel(/^Client/).selectOption({ label: "Librairie El Amel" });
  await expect(dialog.getByLabel(/^Prospect company/)).toHaveCount(0);
  await expect(dialog.getByLabel(/^Currency/)).toHaveValue("DZD");
  const title = `Kiosk app ${Date.now()}`;
  await dialog.getByLabel(/^Title/).fill(title);
  await dialog.getByLabel(/^Value/).fill("340.000,00");
  await page.keyboard.press("Control+Enter");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: `Lead ${title} created` })).toBeVisible();
  const c = card(page, title);
  await expect(c).toContainText("DZD");
  await expect(c).toContainText("340,000");
  await expect(c).toContainText("Tomorrow");
});

test("keyboard move with announcements, then Undo", async ({ page }) => {
  const title = `Keyboard ${Date.now()}`;
  await createLead(page, title);
  await page.goto(`/en/leads?q=${encodeURIComponent(title)}`);
  const c = card(page, title);
  await expect(column(page, "New").locator(".lead-card")).toHaveCount(1);
  await c.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("status").first()).toContainText(`Picked up ${title}`);
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("status").first()).toContainText("Contacted, position 1 of 1");
  await expect(column(page, "Contacted").locator(".lead-card")).toHaveCount(1);
  await page.keyboard.press("Space");
  await expect(page.locator(".toasts").getByText(`${title} moved to Contacted`)).toBeVisible();
  await page.reload();
  await expect(column(page, "Contacted").locator(".lead-card")).toHaveCount(1);

  // Esc cancels a pick-up.
  await card(page, title).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(column(page, "Contacted").locator(".lead-card")).toHaveCount(1);

  // Undo puts it back.
  await card(page, title).locator("button[aria-haspopup=menu]").click();
  await page.getByRole("menuitem", { name: "Negotiation" }).click();
  await expect(column(page, "Negotiation").locator(".lead-card")).toHaveCount(1);
  await page.locator(".toasts").getByRole("button", { name: "Undo" }).click();
  await expect(column(page, "Contacted").locator(".lead-card")).toHaveCount(1);
  await page.waitForTimeout(800);
  await page.reload();
  await expect(column(page, "Contacted").locator(".lead-card")).toHaveCount(1);
});

test("drag and drop to Won asks for the final value and offers next steps; Lost needs a reason", async ({ page }) => {
  const stamp = Date.now();
  const a = `Drag win ${stamp}`;
  const b = `Drag lose ${stamp}`;
  await createLead(page, a, "Negotiation");
  await createLead(page, b, "Negotiation");
  // Wide enough that the Won column is on screen (the board scrolls inside its own region).
  await page.setViewportSize({ width: 1680, height: 900 });
  await page.goto(`/en/leads?q=${stamp}`);

  await card(page, a).dragTo(column(page, "Won"));
  const won = page.getByRole("dialog", { name: `Mark “${a}” as won` });
  await expect(won).toBeVisible();
  await expect(won.getByLabel(/Final value/)).toHaveValue("4800.50");
  await won.getByLabel(/Final value/).fill("5000");
  await won.getByRole("button", { name: "Mark as won" }).click();
  await expect(won.getByRole("link", { name: "Convert to project" })).toBeVisible();
  await expect(won.getByRole("link", { name: "Create quotation" })).toHaveAttribute("href", /quotations\?new=1&lead=/);
  await won.getByRole("button", { name: "Later" }).click();
  await expect(column(page, "Won").locator(".ax-count")).toHaveText("1");
  await expect(column(page, "Won")).toContainText("€5,000");

  await card(page, b).locator("button[aria-haspopup=menu]").click();
  await page.getByRole("menuitem", { name: "Lost" }).click();
  const lost = page.getByRole("dialog", { name: `Mark “${b}” as lost` });
  await lost.getByRole("button", { name: "Mark as lost" }).click();
  await expect(lost.getByText("Choose why the lead was lost")).toBeVisible();
  await lost.getByLabel("Reason").selectOption({ label: "Chose a competitor" });
  await lost.getByRole("button", { name: "Mark as lost" }).click();
  await expect(lost).toBeHidden();
  await expect(column(page, "Lost").locator(".ax-count")).toHaveText("1");

  await page.goto(`/en/leads?view=table&q=${stamp}`);
  await page.locator("a.row-open", { hasText: b }).click();
  await expect(page.locator(".rail-dl")).toContainText("Chose a competitor");
  await expectAccessible(page);
});

test("lead record: E edits, follow-up and note, archive with Undo", async ({ page }) => {
  const title = `Record ${Date.now()}`;
  await createLead(page, title);
  await page.goto(`/en/leads?view=table&q=${encodeURIComponent(title)}`);
  await page.locator("a.row-open").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.getByRole("navigation", { name: "Breadcrumbs" }).locator('[aria-current="page"]')).toHaveText(title);
  const url = page.url();

  await page.locator("body").click({ position: { x: 900, y: 120 } });
  await page.keyboard.press("e");
  const dialog = page.getByRole("dialog", { name: "Edit lead" });
  await expect(dialog.getByLabel(/^Title/)).toHaveValue(title);
  await dialog.getByLabel(/^Priority/).selectOption({ label: "Urgent" });
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".rail-dl")).toContainText("Urgent");

  const rail = page.locator(".rail-block", { hasText: "Next follow-up" });
  await expect(rail).toContainText("Tomorrow");
  await rail.getByRole("button", { name: "Done" }).click();
  await rail.getByLabel(/^Outcome/).fill("Sent the brochure.");
  await rail.getByRole("button", { name: "Save" }).click();
  await expect(rail).toContainText("No follow-up");
  await expect(page.locator(".ax-tl-note").first()).toHaveText("Sent the brochure.");

  await page.getByRole("button", { name: "Note" }).click();
  await page.getByRole("textbox", { name: "Details" }).fill("Decision expected next week.");
  await page.getByRole("button", { name: "Log activity" }).click();
  await expect(page.locator(".ax-tl-note").first()).toHaveText("Decision expected next week.");

  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Archive lead" }).click();
  await expect(page).toHaveURL(/\/en\/leads$/);
  await page.locator(".toasts").getByRole("button", { name: "Undo" }).click();
  await expect(page).toHaveURL(url);
});

test("no horizontal page scroll on leads at 360 / 768 / 1366", async ({ page }) => {
  await page.goto("/en/leads?view=table&q=Field");
  const record = (await page.locator("a.row-open").first().getAttribute("href"))!;
  for (const code of ["fr", "ar"]) {
    for (const width of [360, 768, 1366]) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of [`/${code}/leads`, `/${code}/leads?view=table`, record.replace(/^\/en/, `/${code}`)]) {
        await page.goto(path);
        await expect(page.locator("main h1")).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${path} @ ${width}`).toBeLessThanOrEqual(0);
      }
    }
  }
});
