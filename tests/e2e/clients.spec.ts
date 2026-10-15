import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const LOCALES = [
  { code: "en", dir: "ltr", title: "Clients", tabs: "Activity", next: "Next follow-up" },
  { code: "fr", dir: "ltr", title: "Clients", tabs: "Activité", next: "Prochaine relance" },
  { code: "ar", dir: "rtl", title: "العملاء", tabs: "النشاط", next: "المتابعة القادمة" },
] as const;

async function expectAccessible(page: Page) {
  const axe = await new AxeBuilder({ page }).analyze();
  const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
}

async function noArabicIndicDigits(page: Page) {
  expect(await page.locator("body").innerText()).not.toMatch(/[٠-٩۰-۹]/);
}

const rows = (page: Page) => page.locator(".clients-table tbody tr");

for (const loc of LOCALES) {
  test(`clients list ${loc.code}: header, table, default sort, a11y`, async ({ page }) => {
    await page.goto(`/${loc.code}/clients`);
    await expect(page.locator("html")).toHaveAttribute("dir", loc.dir);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(loc.title);
    await expect(rows(page).first()).toBeVisible();
    expect(await rows(page).count()).toBeGreaterThanOrEqual(10);

    // DS › Clients: default sort is next follow-up ascending.
    const sorted = page.locator("th[aria-sort]");
    await expect(sorted).toHaveCount(1);
    await expect(sorted).toHaveAttribute("aria-sort", "ascending");
    await expect(sorted).toContainText(loc.next);

    // Outstanding is end-aligned: right in LTR, left in Arabic.
    const align = await page.locator("td.c-money").first().evaluate((el) => getComputedStyle(el).textAlign);
    expect(align).toBe("end");

    await noArabicIndicDigits(page);
    await expectAccessible(page);
    await page.screenshot({ path: `screenshots/clients-${loc.code}.png`, fullPage: true });
  });

  test(`client profile ${loc.code}: rail, KPI strip, tabs, activity timeline, a11y`, async ({ page }) => {
    await page.goto(`/${loc.code}/clients?q=Julien`);
    await rows(page).first().locator("a.row-open").click();
    await expect(page).toHaveURL(new RegExp(`/${loc.code}/clients/[0-9a-f-]{36}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Media Pro");
    await expect(page.locator(".profile-kpis .ax-metric")).toHaveCount(4);
    await expect(page.getByRole("tab")).toHaveCount(7);
    await expect(page.getByRole("tab", { selected: true })).toHaveAttribute("href", /clients\/[0-9a-f-]{36}$/);

    // Contact data is actionable: mailto/tel links and labelled copy buttons, IDs in .ax-ltr.
    await expect(page.locator('.quick-actions a[href^="mailto:"]')).toHaveCount(1);
    await expect(page.locator('.quick-actions a[href^="tel:+"]')).toHaveCount(1);
    await expect(page.locator(".contact-line .ax-ltr").first()).toBeVisible();
    await expect(page.locator(".rail-block button[aria-label]").first()).toBeVisible();

    await noArabicIndicDigits(page);
    await expectAccessible(page);

    await page.getByRole("tab", { name: loc.tabs }).click();
    await expect(page).toHaveURL(/\?tab=activity$/);
    await expect(page.getByRole("tab", { selected: true })).toHaveText(loc.tabs);
    await expect(page.locator("#client-tabpanel .ax-tl-item").first()).toBeVisible();
    await expect(page.locator("#client-tabpanel .composer textarea")).toBeVisible();
    await noArabicIndicDigits(page);
    await expectAccessible(page);
    await page.screenshot({ path: `screenshots/client-profile-${loc.code}.png`, fullPage: true });
  });
}

test("filters live in the URL and narrow the list", async ({ page }) => {
  await page.goto("/en/clients");
  await page.getByRole("button", { name: "Filter by Status" }).click();
  await page.getByRole("menuitemradio", { name: "Prospect" }).click();
  await expect(page).toHaveURL(/status=prospect/);
  await expect(rows(page)).toHaveCount(3);
  for (const badge of await page.locator(".c-status .ax-badge").allInnerTexts()) expect(badge).toContain("Prospect");

  await page.getByRole("link", { name: "Remove Status filter" }).click();
  await expect(page).not.toHaveURL(/status=/);

  await page.getByRole("button", { name: "Has overdue" }).click();
  await expect(page).toHaveURL(/overdue=1/);
  await expect(page.getByRole("button", { name: "Has overdue" })).toHaveAttribute("aria-pressed", "true");
  const overdueCount = await rows(page).count();
  expect(overdueCount).toBeGreaterThan(0);
  expect(overdueCount).toBeLessThan(10);
  await expect(page.locator(".c-money .money.overdue")).toHaveCount(overdueCount);

  await page.goto("/en/clients?tag=publishing");
  await expect(rows(page)).toHaveCount(4);

  await page.goto("/en/clients");
  await page.getByRole("searchbox", { name: /Search clients/ }).fill("Karim");
  await expect(page).toHaveURL(/q=Karim/);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("Librairie El Amel");
  await page.getByRole("searchbox").press("Escape");
  await expect(page).not.toHaveURL(/q=/);

  await page.goto("/en/clients?q=zzzz-no-match");
  await expect(page.getByText("No clients match these filters")).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).first().click();
  await expect(page).toHaveURL(/\/en\/clients$/);
});

test("sorting cycles asc → desc → default and keyboard moves between rows", async ({ page }) => {
  await page.goto("/en/clients");
  const th = page.locator("th", { hasText: "Client" }).first();
  await th.getByRole("link").click();
  await expect(page).toHaveURL(/sort=name/);
  await expect(th).toHaveAttribute("aria-sort", "ascending");
  const names = await page.locator("a.row-open").allInnerTexts();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })));
  await th.getByRole("link").click();
  await expect(page).toHaveURL(/dir=desc/);
  await expect(th).toHaveAttribute("aria-sort", "descending");
  await th.getByRole("link").click();
  await expect(page).toHaveURL(/\/en\/clients$/);

  await page.locator("a.row-open").first().focus();
  await page.keyboard.press("j");
  await expect(page.locator("a.row-open").nth(1)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(page.locator("a.row-open").first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en\/clients\/[0-9a-f-]{36}$/);
});

test("density: Default 40px rows, Compact 32px, remembered", async ({ page }) => {
  await page.goto("/en/clients");
  const statusCell = page.locator("td.c-status").first();
  await page.getByRole("button", { name: "Compact" }).click();
  await expect(page.locator(".clients-table")).toHaveClass(/is-compact/);
  expect(Math.round((await statusCell.boundingBox())!.height)).toBe(32);
  await page.reload();
  await expect(page.getByRole("button", { name: "Compact" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Default" }).click();
  await expect(page.locator(".clients-table")).not.toHaveClass(/is-compact/);
  expect(Math.round((await statusCell.boundingBox())!.height)).toBe(40);
});

test("below 640px the table becomes stacked cards", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/ar/clients");
  const row = rows(page).first();
  await expect(row).toBeVisible();
  expect(await row.evaluate((el) => getComputedStyle(el).display)).toBe("grid");
  expect(await page.locator(".clients-table thead").evaluate((el) => el.getBoundingClientRect().height)).toBeLessThanOrEqual(1);
  await expect(row.locator(".c-status .ax-badge")).toBeVisible();
});

test("no horizontal scroll on list and profile at 360 / 768 / 1366", async ({ page }) => {
  await page.goto("/fr/clients?q=Librairie");
  const profile = await page.locator("a.row-open").first().getAttribute("href");
  for (const code of ["fr", "ar"]) {
    for (const width of [360, 768, 1366]) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of [`/${code}/clients`, profile!.replace(/^\/fr/, `/${code}`), `${profile!.replace(/^\/fr/, `/${code}`)}?tab=invoices`]) {
        await page.goto(path);
        await expect(page.locator("main h1")).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${path} @ ${width}`).toBeLessThanOrEqual(0);
      }
    }
  }
});

test("C opens the New client drawer; validation; create logs an activity", async ({ page }) => {
  const name = `E2E Studio ${Date.now()}`;
  await page.goto("/en");
  await page.locator("body").click({ position: { x: 600, y: 60 } });
  await page.keyboard.press("c");
  await expect(page).toHaveURL(/\/en\/clients\?new=1$/);
  const dialog = page.getByRole("dialog", { name: "New client" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/^Name/)).toBeFocused();
  await expectAccessible(page);

  // Submit empty: inline errors, focus on the first invalid field.
  await dialog.getByRole("button", { name: "Create client" }).click();
  await expect(dialog.getByLabel(/^Name/)).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByLabel(/^Name/)).toBeFocused();
  await expect(dialog.locator(".ax-error")).toHaveCount(2);

  await dialog.getByLabel(/^Name/).fill(name);
  await dialog.getByLabel(/^Email/).first().fill("not-an-email");
  await dialog.getByLabel(/^Email/).first().blur();
  await expect(dialog.getByText("Enter an email address like name@company.com")).toBeVisible();
  await dialog.getByLabel(/^Email/).first().fill("hello@e2e.example");
  await expect(dialog.getByText("Enter an email address like name@company.com")).toHaveCount(0);
  await dialog.getByLabel(/^Tags/).fill("e2e, agency");
  await dialog.getByLabel(/^First name/).fill("Ines");
  await dialog.getByLabel(/^Last name/).fill("Khelifi");
  await dialog.getByLabel(/^Phone/).last().fill("+213 661 00 00 00");
  await page.keyboard.press("Control+Enter");

  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/en\/clients$/);
  await expect(page.getByRole("status").filter({ hasText: `Client ${name} created` })).toBeVisible();
  await page.getByRole("status").getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  await expect(page.locator(".contact-name")).toContainText("Ines Khelifi");
  await expect(page.locator('.contact-line a[href="tel:+213661000000"]')).toBeVisible();

  // Timeline built from the activities table; the composer logs a note.
  await page.getByRole("tab", { name: "Activity" }).click();
  await expect(page.locator(".ax-tl-item").first()).toContainText(`Client created — ${name}`);
  await page.getByRole("button", { name: "Note" }).click();
  await page.getByRole("textbox", { name: "Details" }).fill("Prefers e-mail before 10:00.");
  await page.getByRole("button", { name: "Log activity" }).click();
  await expect(page.locator(".ax-tl-item").first()).toContainText("Note added");
  await expect(page.locator(".ax-tl-note").first()).toHaveText("Prefers e-mail before 10:00.");
});

test("Esc with edits asks before discarding the new client", async ({ page }) => {
  await page.goto("/en/clients?new=1");
  const dialog = page.getByRole("dialog", { name: "New client" });
  await dialog.getByLabel(/^Name/).fill("Draft");
  await page.keyboard.press("Escape");
  await expect(dialog.getByText("Discard this new client?")).toBeVisible();
  await dialog.getByRole("button", { name: "Discard" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/en\/clients$/);
});

test("unknown client id is a 404", async ({ page }) => {
  const res = await page.goto("/en/clients/00000000-0000-0000-0000-000000000000");
  expect(res?.status()).toBe(404);
});

test("record breadcrumb: Dashboard › Clients › client name", async ({ page }) => {
  await page.goto("/en/clients?q=Julien");
  await page.locator("a.row-open").first().click();
  const crumbs = page.getByRole("navigation", { name: "Breadcrumbs" });
  await expect(crumbs.locator('[aria-current="page"]')).toHaveText("Media Pro");
  await crumbs.getByRole("link", { name: "Clients" }).click();
  await expect(page).toHaveURL(/\/en\/clients$/);
  await expect(crumbs.locator('[aria-current="page"]')).toHaveText("Clients");
});

test("below 640px filters open in a sheet", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/en/clients");
  await expect(page.getByRole("button", { name: "Filter by Status" })).toBeHidden();
  await page.getByRole("button", { name: "Filters" }).click();
  const sheet = page.getByRole("dialog", { name: "Search and filters" });
  await expect(sheet).toBeVisible();
  await expectAccessible(page);

  await sheet.getByRole("link", { name: "Prospect" }).click();
  await expect(page).toHaveURL(/status=prospect/);
  await expect(sheet.getByRole("link", { name: "Prospect" })).toHaveAttribute("aria-current", "true");
  await sheet.getByRole("switch", { name: "Has overdue" }).click();
  await expect(page).toHaveURL(/overdue=1/);
  await expect(sheet.getByRole("switch", { name: "Has overdue" })).toBeChecked();
  await sheet.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/en\/clients$/);
  await expect(sheet.getByRole("button", { name: /^Show \d+ clients$/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("button", { name: "Filters" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

// The collapsed state comes from the cookie here, so this test never writes the user's saved preference
// (shell.spec owns toggling, which persists to the database shared by parallel workers).
test("collapsed sidebar is accessible", async ({ page, context }) => {
  await context.addCookies([{ name: "sidebar", value: "collapsed", url: "http://localhost:3000" }]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en/clients");
  // The collapsed rail keeps link names (labels are visually hidden, not removed).
  await expect(page.locator(".ax-sidebar")).toHaveJSProperty("offsetWidth", 56);
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Clients" })).toBeVisible();
  await expectAccessible(page);
});

/** Creates a client through the drawer and returns to the list; returns its name. */
async function quickCreate(page: Page, name: string) {
  await page.goto("/en/clients?new=1");
  const dialog = page.getByRole("dialog", { name: "New client" });
  await dialog.getByLabel(/^Name/).fill(name);
  await dialog.getByLabel(/^First name/).fill("Test");
  await dialog.getByRole("button", { name: "Create client" }).click();
  await expect(dialog).toBeHidden();
  return name;
}

test("bulk: select rows, export CSV, archive with Undo", async ({ page }) => {
  const stamp = Date.now();
  const a = await quickCreate(page, `Bulk A ${stamp}`);
  const b = await quickCreate(page, `Bulk B ${stamp}`);
  await page.goto(`/en/clients?q=${stamp}`);
  await expect(rows(page)).toHaveCount(2);

  await page.getByRole("checkbox", { name: `Select ${a}` }).click();
  const bulk = page.getByRole("region", { name: "Bulk actions" });
  await expect(bulk).toContainText("1 selected");
  await page.getByRole("checkbox", { name: "Select all clients on this page" }).click();
  await expect(bulk).toContainText("2 selected");
  await expect(rows(page).first()).toHaveAttribute("aria-selected", "true");

  const download = page.waitForEvent("download");
  await bulk.getByRole("button", { name: "Export CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^clients-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await (await import("node:fs/promises")).readFile((await file.path())!, "utf8");
  expect(csv).toContain(`"${a}"`);
  expect(csv).toContain(`"${b}"`);

  await bulk.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByRole("status").filter({ hasText: "2 clients archived" })).toBeVisible();
  await expect(page.getByText("No clients match these filters")).toBeVisible();
  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(rows(page)).toHaveCount(2);

  // Esc clears a selection made with the keyboard (X toggles the focused row).
  await page.locator("a.row-open").first().focus();
  await page.keyboard.press("x");
  await expect(bulk).toContainText("1 selected");
  await page.keyboard.press("Escape");
  await expect(bulk).toBeHidden();
});

test("record: E edits the client, More › Archive offers Undo", async ({ page }) => {
  const name = await quickCreate(page, `Edit Me ${Date.now()}`);
  await page.goto(`/en/clients?q=${encodeURIComponent(name)}`);
  await page.locator("a.row-open").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  const url = page.url();

  await page.locator("body").click({ position: { x: 900, y: 120 } });
  await page.keyboard.press("e");
  const dialog = page.getByRole("dialog", { name: "Edit client" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/^Name/)).toHaveValue(name);
  await expect(dialog.getByLabel(/^First name/)).toHaveValue("Test");
  await dialog.getByLabel(/^City/).fill("Oran");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: `${name} updated` })).toBeVisible();
  await expect(page.locator(".rail-dl")).toContainText("Oran");

  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Archive client" }).click();
  await expect(page).toHaveURL(/\/en\/clients$/);
  await expect(page.getByRole("status").filter({ hasText: `${name} archived` })).toBeVisible();
  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(page).toHaveURL(url);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
});

test("follow-ups on the rail: plan, reschedule, done with outcome; timeline filters", async ({ page }) => {
  const name = await quickCreate(page, `Follow Me ${Date.now()}`);
  await page.goto(`/en/clients?q=${encodeURIComponent(name)}`);
  await page.locator("a.row-open").first().click();
  const rail = page.locator(".rail-block", { hasText: "Next follow-up" });
  await expect(rail).toContainText("No follow-up planned");

  await rail.getByRole("button", { name: "Plan follow-up" }).click();
  await rail.getByLabel("Subject").fill("Kick-off call");
  await rail.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Follow-up planned" })).toBeVisible();
  await expect(rail).toContainText("Kick-off call");
  await expect(rail).toContainText("Tomorrow");

  await rail.getByRole("button", { name: "Reschedule" }).click();
  await rail.getByLabel("Date and time").fill("2031-03-04T09:30");
  await rail.getByRole("button", { name: "Save" }).click();
  await expect(rail).toContainText("4 Mar · 09:30");
  await expect(rail.locator(".ax-due").first()).toHaveAttribute("title", /4 Mar 2031/);

  await rail.getByRole("button", { name: "Done" }).click();
  await rail.getByLabel(/^Outcome/).fill("Agreed on scope.");
  await rail.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Follow-up completed" })).toBeVisible();
  await expect(rail).toContainText("No follow-up planned");

  await page.getByRole("tab", { name: "Activity" }).click();
  await expect(page.locator(".ax-tl-item").first()).toContainText("Follow-up completed — Kick-off call");
  await expect(page.locator(".ax-tl-note").first()).toHaveText("Agreed on scope.");
  const filters = page.getByRole("navigation", { name: "Filter activity" });
  await filters.getByRole("link", { name: "Calls" }).click();
  await expect(page).toHaveURL(/type=calls/);
  await expect(filters.getByRole("link", { name: "Calls" })).toHaveAttribute("aria-current", "true");
  await expect(page.locator(".ax-tl-item")).toHaveCount(1);
  await filters.getByRole("link", { name: "Notes" }).click();
  await expect(page.getByText("No activity yet.")).toBeVisible();
  await expectAccessible(page);
});
