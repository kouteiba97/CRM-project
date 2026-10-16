import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const LOCALES = [
  { code: "en", dir: "ltr", title: "Dashboard" },
  { code: "fr", dir: "ltr", title: "Tableau de bord" },
  { code: "ar", dir: "rtl", title: "لوحة التحكم" },
] as const;
const THEMES = ["light", "dark"] as const;
const WIDTHS = [1920, 1366, 1024, 768, 360];

for (const loc of LOCALES) {
  for (const theme of THEMES) {
    test(`dashboard ${loc.code} ${theme}: direction, language, a11y`, async ({ page, context }) => {
      await context.addCookies([{ name: "theme", value: theme, url: "http://localhost:3000" }]);
      await page.goto(`/${loc.code}`);
      const html = page.locator("html");
      await expect(html).toHaveAttribute("lang", loc.code);
      await expect(html).toHaveAttribute("dir", loc.dir);
      await expect(html).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(loc.title);
      await expect(page.locator(".ax-kpi")).toHaveCount(4);

      // DS › Languages: Latin digits everywhere.
      expect(await page.locator("body").innerText()).not.toMatch(/[٠-٩۰-۹]/);

      // Sidebar sits on the inline-start side: left in LTR, right in Arabic.
      const box = (await page.locator(".app-sidebar").boundingBox())!;
      if (loc.dir === "rtl") expect(box.x + box.width).toBeGreaterThan(1366 - 2);
      else expect(box.x).toBeLessThan(2);

      const axe = await new AxeBuilder({ page }).analyze();
      const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);

      await page.screenshot({ path: `screenshots/dashboard-${loc.code}-${theme}.png`, fullPage: true });
    });
  }
}

test("no horizontal scroll at DS widths", async ({ page }) => {
  for (const code of ["fr", "ar"]) {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/${code}`);
      await expect(page.locator(".ax-kpi").first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${code} @ ${width}`).toBeLessThanOrEqual(0);
    }
  }
});

test("KPI strip and Today card fit 1366×768 without scrolling", async ({ page }) => {
  await page.goto("/en");
  const today = page.locator("#today").locator("xpath=ancestor::section[1]");
  await expect(today).toBeVisible();
  const top = (await today.boundingBox())!.y;
  expect(top).toBeLessThan(768);
  expect(await page.locator(".dash-kpis").evaluate((e) => e.getBoundingClientRect().bottom)).toBeLessThan(768);
});

test("[ toggles the sidebar and the choice persists", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en");
  const sidebar = page.locator(".ax-sidebar");
  await expect(sidebar).toHaveJSProperty("offsetWidth", 232);
  // The shortcut only works once the shell has hydrated.
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("[");
  await expect(sidebar).toHaveJSProperty("offsetWidth", 56);
  await page.waitForTimeout(500);
  await page.reload();
  await expect(sidebar).toHaveJSProperty("offsetWidth", 56);
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("[");
  await expect(sidebar).toHaveJSProperty("offsetWidth", 232);
  await page.waitForTimeout(500);
  // Persisting runs outside the state updater: no "Cannot update a component while rendering".
  expect(errors.filter((e) => e.includes("Cannot update a component"))).toEqual([]);
});

test("language switch keeps the current path", async ({ page }) => {
  await page.goto("/en/invoices");
  await page.getByRole("group", { name: "Language" }).getByRole("link", { name: "FR" }).click();
  await expect(page).toHaveURL(/\/fr\/invoices$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Factures");
  await page.getByRole("group", { name: "Langue" }).getByRole("link", { name: "ع" }).click();
  await expect(page).toHaveURL(/\/ar\/invoices$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("G then I goes to invoices; Ctrl+K opens the palette", async ({ page }) => {
  await page.goto("/en");
  await page.locator("body").click({ position: { x: 600, y: 60 } });
  await page.keyboard.press("g");
  await page.keyboard.press("i");
  await expect(page).toHaveURL(/\/en\/invoices$/);
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.type("pay");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en\/payments$/);
});
