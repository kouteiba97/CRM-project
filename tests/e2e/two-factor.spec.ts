import { expect, test } from "@playwright/test";
import { Secret, TOTP } from "otpauth";
import { expectAccessible, signUp, unique } from "./support";

test.use({ storageState: { cookies: [], origins: [] } });

const codeFor = (secret: string, offsetSeconds = 0) =>
  new TOTP({ secret: Secret.fromBase32(secret.replace(/\s/g, "")), digits: 6, period: 30 }).generate({
    timestamp: Date.now() + offsetSeconds * 1000,
  });

test("two-step login: set up, sign in with a code or a recovery code, turn off", async ({ page }) => {
  const email = unique("totp");
  await signUp(page, email, "totp-pass-2026");
  await page.goto("/en/settings?tab=security");
  await page.getByRole("button", { name: "Turn on two-step login" }).click();
  const secret = (await page.locator(".tf-secret").innerText()).trim();
  await expect(page.getByRole("img", { name: "QR code to add Apex CRM to your authenticator app" })).toBeVisible();
  await expectAccessible(page);

  await page.locator("#tf-code").fill("000000");
  await page.getByRole("button", { name: "Verify and turn on" }).click();
  await expect(page.getByText("That code didn't work.", { exact: false })).toBeVisible();
  await page.locator("#tf-code").fill(codeFor(secret));
  await page.getByRole("button", { name: "Verify and turn on" }).click();
  await expect(page.locator(".recovery-codes li")).toHaveCount(10);
  const codes = await page.locator(".recovery-codes li").allInnerTexts();
  await expect(page.getByRole("button", { name: "Done" })).toBeDisabled();
  await page.getByLabel("I saved my recovery codes somewhere safe").check();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("On since", { exact: false })).toBeVisible();

  // Sign in again: the password alone is not enough.
  await page.context().clearCookies();
  await page.goto("/en/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill("totp-pass-2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("#login-code")).toBeFocused();
  await page.locator("#login-code").fill("123456");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("That code didn't work. Try the newest code from the app.")).toBeVisible();
  // The code used during setup is already spent; the next one is accepted (clock drift window).
  await page.locator("#login-code").fill(codeFor(secret, 30));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/en$/);

  // A recovery code works once.
  await page.context().clearCookies();
  await page.goto("/en/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill("totp-pass-2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.locator("#login-code").fill(codes[0]!);
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/en$/);
  await page.context().clearCookies();
  await page.goto("/en/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill("totp-pass-2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.locator("#login-code").fill(codes[0]!);
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("That code didn't work.", { exact: false })).toBeVisible();
  await page.locator("#login-code").fill(codes[1]!);
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/en$/);

  // Turning it off needs the password and a code.
  await page.goto("/en/settings?tab=security");
  await page.getByRole("button", { name: "Turn off" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#tf-password").fill("totp-pass-2026");
  await dialog.locator("#tf-dialog-code").fill(codes[2]!);
  await dialog.getByRole("button", { name: "Turn off" }).click();
  await expect(page.locator(".toasts")).toContainText("Two-step login is off.");
  await expect(page.getByRole("button", { name: "Turn on two-step login" })).toBeVisible();
});
