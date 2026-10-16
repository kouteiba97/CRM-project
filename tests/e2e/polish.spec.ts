import { expect, test } from "@playwright/test";
import { expectAccessible } from "./support";

test("clients: hide a column and it stays hidden after reload", async ({ page }) => {
  await page.goto("/en/clients");
  const ownerHeader = page.locator(".clients-table thead th.c-owner");
  await expect(ownerHeader).toBeVisible();
  await page.getByRole("button", { name: "Columns" }).click();
  await page.getByRole("menuitemcheckbox", { name: /Owner/ }).click();
  await expect(ownerHeader).toBeHidden();
  await expect(page.locator(".clients-table tbody td.c-owner").first()).toBeHidden();
  await page.reload();
  await expect(page.locator(".clients-table thead th.c-owner")).toBeHidden();
  // Put it back for the other tests.
  await page.getByRole("button", { name: "Columns" }).click();
  await page.getByRole("menuitemcheckbox", { name: /Owner/ }).click();
  await expect(page.locator(".clients-table thead th.c-owner")).toBeVisible();
});

test("clients: quick look opens over the list and Esc returns to it", async ({ page }) => {
  await page.goto("/en/clients?q=Librairie");
  await page.getByRole("link", { name: "Quick look at Librairie El Amel" }).click();
  const panel = page.getByRole("dialog", { name: "Librairie El Amel" });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Main contact");
  await expect(panel.getByRole("link", { name: "Open full profile" })).toBeVisible();
  await expectAccessible(page);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/en\/clients\?q=Librairie$/);
  await expect(panel).toBeHidden();
});

test.describe("public pages", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const [loc, privacy, terms, dir] of [
    ["en", "Privacy policy", "Terms of use", "ltr"],
    ["fr", "Politique de confidentialité", "Conditions d'utilisation", "ltr"],
    ["ar", "سياسة الخصوصية", "شروط الاستخدام", "rtl"],
  ] as const) {
    test(`privacy and terms ${loc}: public, readable, accessible`, async ({ page }) => {
      await page.goto(`/${loc}/privacy`);
      await expect(page).toHaveURL(new RegExp(`/${loc}/privacy$`));
      await expect(page.locator("html")).toHaveAttribute("dir", dir);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(privacy);
      await expectAccessible(page);
      await page.goto(`/${loc}/terms`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(terms);
      await expectAccessible(page);
      await page.setViewportSize({ width: 360, height: 800 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("sign-up links to the terms; the app is installable", async ({ page, request }) => {
    await page.goto("/en/signup");
    await expect(page.getByRole("link", { name: "Terms of use" })).toHaveAttribute("href", "/en/terms");
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.name).toBe("Apex CRM");
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    expect((await request.get("/sw.js")).status()).toBe(200);
    expect((await request.get("/icons/icon-512.png")).headers()["content-type"]).toBe("image/png");
  });
});
