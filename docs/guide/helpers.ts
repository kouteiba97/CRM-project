import { expect, type BrowserContext, type Page } from "@playwright/test";
import { DEV_CREDENTIALS } from "../../src/db/dev-credentials";

/** Hides the Next.js dev badge so screenshots look like the real product. */
export async function cleanChrome(context: BrowserContext) {
  await context.addInitScript(() => {
    const style = () => {
      const s = document.createElement("style");
      s.textContent = "nextjs-portal{display:none!important}";
      document.head.appendChild(s);
    };
    if (document.head) style();
    else document.addEventListener("DOMContentLoaded", style);
  });
}

export async function signIn(page: Page, locale: "en" | "ar") {
  await page.goto(`/${locale}/login`);
  await page.locator("#login-email").fill(DEV_CREDENTIALS.email);
  await page.locator("#login-password").fill(DEV_CREDENTIALS.password);
  await page.locator("form.login-form button[type=submit]").click();
  await expect(page).toHaveURL(new RegExp(`/${locale}$`));
}

/** Waits until the page is idle so charts and lists are drawn before a screenshot. */
export async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
}
