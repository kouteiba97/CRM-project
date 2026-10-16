import { expect, test } from "@playwright/test";
import { expectAccessible, lastLink, signUp, unique } from "./support";

// Account settings as a fresh user each time, never the shared seeded owner.
test.use({ storageState: { cookies: [], origins: [] } });

test("change password: wrong current refused, others signed out, notice emailed", async ({ page, browser, request }) => {
  const email = unique("pw");
  await signUp(page, email, "first-pass-2026");
  const other = await browser.newContext({ storageState: await page.context().storageState() });
  const otherPage = await other.newPage();

  await page.goto("/en/settings?tab=account");
  await expectAccessible(page);
  await page.locator("#pw-current").fill("not-it-at-all");
  await page.locator("#pw-new").fill("second-pass-2026");
  await page.locator("#pw-confirm").fill("second-pass-2026");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("The current password is not correct.")).toBeVisible();

  await page.locator("#pw-current").fill("first-pass-2026");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.locator(".toasts")).toContainText("Password changed.");
  // This tab stays signed in…
  await page.goto("/en/clients");
  await expect(page).toHaveURL(/\/en\/clients$/);
  // …the other device does not.
  await otherPage.goto("/en/clients");
  await expect(otherPage).toHaveURL(/\/en\/login\?expired=1$/);
  await other.close();
  const mails: { subject: string }[] = await (await request.get(`/api/dev/mail?format=json&to=${encodeURIComponent(email)}`)).json();
  expect(mails.map((m) => m.subject)).toContain("Your Apex CRM password was changed");
});

test("sign out other devices keeps this one", async ({ page, browser }) => {
  await signUp(page, unique("sessions"), "sessions-pass-26");
  const other = await browser.newContext({ storageState: await page.context().storageState() });
  const otherPage = await other.newPage();
  await page.goto("/en/settings?tab=security");
  await expect(page.getByRole("heading", { name: "Security activity" })).toBeVisible();
  await expect(page.locator(".audit-table")).toContainText("Account created");
  await page.getByRole("button", { name: "Sign out other devices" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sign out other devices" }).click();
  await expect(page.locator(".toasts")).toContainText("Other devices were signed out.");
  await page.goto("/en");
  await expect(page).toHaveURL(/\/en$/);
  // The signed-out device cannot adopt the new session version through Auth.js's own
  // session-update endpoint (it lacks the server's signed proof).
  const { csrfToken } = await (await otherPage.request.get("/api/auth/csrf")).json();
  await otherPage.request.post("/api/auth/session", { data: { csrfToken, data: { svProof: "forged" } } });
  await otherPage.goto("/en");
  await expect(otherPage).toHaveURL(/\/en\/login\?expired=1$/);
  await other.close();
});

test("change email needs the password and a click from the new inbox", async ({ page, request }) => {
  const email = unique("old");
  const next = unique("new");
  await signUp(page, email, "email-pass-2026");
  await page.goto("/en/settings?tab=account");
  await page.getByRole("button", { name: "Change email" }).click();
  await page.locator("#em-new").fill(next);
  await page.locator("#em-password").fill("wrong-password");
  await page.getByRole("button", { name: "Send confirmation link" }).click();
  await expect(page.getByText("The current password is not correct.")).toBeVisible();
  await page.locator("#em-password").fill("email-pass-2026");
  await page.getByRole("button", { name: "Send confirmation link" }).click();
  await expect(page.getByRole("status").filter({ hasText: "We sent a link to" })).toBeVisible();
  // Nothing changes before the click.
  await page.reload();
  await expect(page.locator("#pf-email")).toHaveValue(email);

  await page.goto(await lastLink(request, next, /Confirm your new email/));
  await expect(page.getByText(`Done: you now sign in with ${next}.`)).toBeVisible();
  const oldMails: { subject: string }[] = await (await request.get(`/api/dev/mail?format=json&to=${encodeURIComponent(email)}`)).json();
  expect(oldMails.map((m) => m.subject)).toContain("Your Apex CRM email was changed");

  await page.context().clearCookies();
  await page.goto("/en/login");
  await page.locator("#login-email").fill(next);
  await page.locator("#login-password").fill("email-pass-2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/en$/);
});

test("data exports and account deletion", async ({ page }) => {
  const email = unique("bye");
  await signUp(page, email, "delete-pass-2026");
  const me = await page.request.get("/api/export/me");
  expect(me.headers()["content-disposition"]).toContain("attachment");
  const mine = await me.json();
  expect(mine.user.email).toBe(email);
  expect(JSON.stringify(mine)).not.toContain("passwordHash");
  const ws = await page.request.get("/api/export/workspace");
  expect(ws.status()).toBe(200);
  expect(Object.keys((await ws.json()).data)).toContain("clients");

  await page.goto("/en/settings?tab=account");
  await page.getByRole("button", { name: "Delete my account" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#del-email").fill("someone@else.test");
  await dialog.locator("#del-password").fill("delete-pass-2026");
  await dialog.getByRole("button", { name: "Delete forever" }).click();
  await expect(dialog.getByText("This does not match your email.")).toBeVisible();
  await dialog.locator("#del-email").fill(email);
  await dialog.getByRole("button", { name: "Delete forever" }).click();
  await expect(page).toHaveURL(/\/en\/login\?deleted=1$/);
  await expect(page.getByText("Your account was deleted.")).toBeVisible();

  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill("delete-pass-2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("#login-error")).toBeVisible();
});
