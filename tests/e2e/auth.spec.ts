import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { DEV_CREDENTIALS } from "../../src/db/dev-credentials";

// These tests start signed out.
test.use({ storageState: { cookies: [], origins: [] } });

const LOCALES = [
  { code: "en", dir: "ltr", title: "Sign in", email: "Email", password: "Password" },
  { code: "fr", dir: "ltr", title: "Connexion", email: "E-mail", password: "Mot de passe" },
  { code: "ar", dir: "rtl", title: "تسجيل الدخول", email: "البريد الإلكتروني", password: "كلمة المرور" },
] as const;

async function expectAccessible(page: Page) {
  const axe = await new AxeBuilder({ page }).analyze();
  const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
}

for (const loc of LOCALES) {
  test(`login ${loc.code}: protected pages redirect, layout, a11y`, async ({ page }) => {
    await page.goto(`/${loc.code}/invoices?status=overdue`);
    await expect(page).toHaveURL(
      (u) =>
        u.pathname === `/${loc.code}/login` &&
        u.searchParams.get("callbackUrl") === `/${loc.code}/invoices?status=overdue`,
    );
    await expect(page.locator("html")).toHaveAttribute("dir", loc.dir);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(loc.title);
    await expect(page.getByLabel(loc.email)).toBeFocused();
    await expect(page.getByLabel(loc.password)).toHaveAttribute("type", "password");
    expect(await page.locator("body").innerText()).not.toMatch(/[٠-٩۰-۹]/);
    await expectAccessible(page);
    await page.screenshot({ path: `screenshots/login-${loc.code}.png`, fullPage: true });
  });
}

test("wrong password shows an error and keeps the email; right one returns to the page asked for", async ({
  page,
}) => {
  await page.goto("/en/clients");
  await expect(page).toHaveURL(/\/en\/login\?callbackUrl=%2Fen%2Fclients$/);
  await page.getByLabel("Email").fill(DEV_CREDENTIALS.email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("#login-error")).toHaveText("Email or password is incorrect.");
  await expect(page.getByLabel("Email")).toHaveValue(DEV_CREDENTIALS.email);
  await expect(page.getByLabel("Password")).toBeFocused();
  await expect(page.getByLabel("Password")).toHaveValue("");

  await page.getByLabel("Password").fill(DEV_CREDENTIALS.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/en\/clients$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Signed in, the login page sends you home.
  await page.goto("/en/login");
  await expect(page).toHaveURL(/\/en$/);

  // Log out from the account menu: back to login, and the app is closed again.
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/en\/login$/);
  await page.goto("/en/clients");
  await expect(page).toHaveURL(/\/en\/login\?callbackUrl=%2Fen%2Fclients$/);
});

test("an off-site callbackUrl is ignored", async ({ page }) => {
  await page.goto("/fr/login?callbackUrl=%2F%2Fevil.example%2Fx");
  await page.getByLabel("E-mail").fill(DEV_CREDENTIALS.email);
  await page.getByLabel("Mot de passe").fill(DEV_CREDENTIALS.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/^http:\/\/localhost:3000\/fr$/);
});

test("anonymous requests are redirected before anything renders", async ({ request }) => {
  const res = await request.get("/en/reports", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toMatch(/\/en\/login\?callbackUrl=%2Fen%2Freports$/);
});

test("no horizontal page scroll on login at 360 / 768 / 1366", async ({ page }) => {
  for (const code of ["fr", "ar"]) {
    for (const width of [360, 768, 1366]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/${code}/login`);
      await expect(page.locator("main h1")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${code} @ ${width}`).toBeLessThanOrEqual(0);
    }
  }
});
