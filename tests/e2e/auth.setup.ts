import { expect, test as setup } from "@playwright/test";
import { DEV_CREDENTIALS } from "../../src/db/dev-credentials";
import { OWNER_STATE } from "../../playwright.config";

setup("sign in as the seeded owner", async ({ page }) => {
  await page.goto("/en/login");
  await page.getByLabel("Email").fill(DEV_CREDENTIALS.email);
  await page.getByLabel("Password", { exact: true }).fill(DEV_CREDENTIALS.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/en$/);
  await page.context().storageState({ path: OWNER_STATE });
});
