import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const LOCALES = [
  { code: "en", dir: "ltr", reports: "Reports", settings: "Settings" },
  { code: "fr", dir: "ltr", reports: "Rapports", settings: "Paramètres" },
  { code: "ar", dir: "rtl", reports: "التقارير", settings: "الإعدادات" },
] as const;

async function expectAccessible(page: Page) {
  const axe = await new AxeBuilder({ page }).analyze();
  const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
}

for (const loc of LOCALES) {
  test(`reports & settings ${loc.code}: structure, a11y`, async ({ page }) => {
    await page.goto(`/${loc.code}/reports`);
    await expect(page.locator("html")).toHaveAttribute("dir", loc.dir);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(loc.reports);
    await expect(page.locator(".dash-kpis .ax-kpi")).toHaveCount(4);
    await expect(page.locator("#rep-aging").locator("xpath=ancestor::section[1]").locator(".hbars li")).toHaveCount(5);
    expect(await page.locator("body").innerText()).not.toMatch(/[٠-٩۰-۹]/);
    await expectAccessible(page);
    await page.screenshot({ path: `screenshots/reports-${loc.code}.png`, fullPage: true });

    for (const tab of ["", "?tab=workspace", "?tab=profile"]) {
      await page.goto(`/${loc.code}/settings${tab}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(loc.settings);
      await expect(page.getByRole("tab", { selected: true })).toBeVisible();
      await expectAccessible(page);
    }
  });
}

test("reports: the period switch drives the chart; bars link to filtered lists", async ({ page }) => {
  await page.goto("/en/reports?range=12m");
  await expect(page.getByRole("link", { name: "Last 12 months" })).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: "View as table" }).click();
  await expect(page.locator(".data-table tbody tr")).toHaveCount(12);
  await page.goto("/en/reports?range=quarter");
  await page.getByRole("button", { name: "View as table" }).click();
  expect(await page.locator(".data-table tbody tr").count()).toBeLessThanOrEqual(3);

  await page.goto("/en/reports");
  await page.locator(".hbar-link", { hasText: "1–30 days late" }).click();
  await expect(page).toHaveURL(/\/en\/invoices\?status=overdue&sort=due$/);
  await page.goto("/en/reports");
  await page.locator(".ax-kpi", { hasText: "Win rate" }).click();
  await expect(page).toHaveURL(/\/en\/leads\?view=table&stage=won$/);
});

test("settings: language and theme apply at once and persist", async ({ page }) => {
  await page.goto("/en/settings");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expectAccessible(page);
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.waitForTimeout(400);

  await page.getByRole("navigation", { name: "Language" }).getByRole("link", { name: "Français" }).click();
  await expect(page).toHaveURL(/\/fr\/settings\?tab=general$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Paramètres");
  await page.getByRole("navigation", { name: "Langue" }).getByRole("link", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("settings: company details validate, save, and appear on invoices", async ({ page }) => {
  await page.goto("/en/settings?tab=workspace");
  const iban = page.getByLabel(/^IBAN/);
  const save = page.getByRole("button", { name: "Save changes" });
  await expect(save).toBeDisabled();
  await iban.fill("1234");
  await save.click();
  await expect(page.getByText("Enter an IBAN starting with the country code")).toBeVisible();
  await expect(iban).toBeFocused();
  await iban.fill("dz58 0001 0002 0003 0004 05");
  await save.click();
  await expect(page.locator(".toasts").getByText("Company details saved")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(/^IBAN/)).toHaveValue("DZ58 0001 0002 0003 0004 05");

  await page.goto("/en/invoices?q=0138");
  await page.locator("a.doc-link").first().click();
  await expect(page.locator(".doc")).toContainText("DZ58 0001 0002 0003 0004 05");

  // Put the workspace back as seeded.
  await page.goto("/en/settings?tab=workspace");
  await page.getByLabel(/^IBAN/).fill("");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".toasts").getByText("Company details saved")).toBeVisible();
});

test("settings: profile name saves; email is read-only", async ({ page }) => {
  await page.goto("/en/settings?tab=profile");
  const name = page.getByLabel(/^Name/);
  await expect(page.getByLabel(/^Email/)).toHaveAttribute("readonly", "");
  await name.fill("");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Fill in this field")).toBeVisible();
  await name.fill("Apex Tech");
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
});

test("no horizontal page scroll on reports and settings at 360 / 768 / 1366", async ({ page }) => {
  for (const code of ["fr", "ar"]) {
    for (const width of [360, 768, 1366]) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of [`/${code}/reports`, `/${code}/settings`, `/${code}/settings?tab=workspace`]) {
        await page.goto(path);
        await expect(page.locator("main h1")).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${path} @ ${width}`).toBeLessThanOrEqual(0);
      }
    }
  }
});
