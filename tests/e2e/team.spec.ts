import { expect, test } from "@playwright/test";
import { expectAccessible, lastLink, signUp, unique } from "./support";

test.use({ storageState: { cookies: [], origins: [] } });

test("invite a new person: they join as a member, roles limit what they can do", async ({ page, browser, request }) => {
  const ownerEmail = unique("owner");
  await signUp(page, ownerEmail, "owner-pass-2026", "Nora Owner");
  const inviteeEmail = unique("member");

  await page.goto("/en/settings?tab=team");
  await expectAccessible(page);
  await page.locator("#inv-email").fill(inviteeEmail);
  await page.locator("#inv-role").selectOption("member");
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.locator(".toasts")).toContainText(`Invitation sent to ${inviteeEmail}`);
  await expect(page.getByRole("heading", { name: "Pending invitations" })).toBeVisible();

  // The invitee has no account: the link offers name + password and joins straight away.
  const member = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const mp = await member.newPage();
  await mp.goto(await lastLink(request, inviteeEmail, /invited you to/));
  await expect(mp.getByText("Nora Owner invited you to join Lina Studio as a member.")).toBeVisible();
  await mp.locator("#inv-name").fill("Sam Member");
  await mp.locator("#inv-password").fill("member-pass-2026");
  await mp.getByRole("button", { name: "Create account and join" }).click();
  await expect(mp).toHaveURL(/\/en$/);
  await expect(mp.locator(".ws-row")).toContainText("Lina Studio");
  // No "confirm your email" banner: the invitation link proved the address.
  await expect(mp.locator(".verify-banner")).toHaveCount(0);

  // Members cannot change company details or manage the team.
  await mp.goto("/en/settings?tab=workspace");
  await expect(mp.getByText("Only the workspace owner can change these details.")).toBeVisible();
  await mp.goto("/en/settings?tab=team");
  await expect(mp.locator("#inv-email")).toHaveCount(0);
  const exportRes = await mp.request.get("/api/export/workspace");
  expect(exportRes.status()).toBe(403);

  // Owner promotes them to admin…
  await page.reload();
  await page.getByLabel("Role of Sam Member").selectOption("admin");
  await expect(page.locator(".toasts")).toContainText("Sam Member's role changed");
  await mp.goto("/en/settings?tab=team");
  await expect(mp.locator("#inv-email")).toBeVisible();

  // …then removes them: they end up in an empty workspace of their own.
  await page.reload();
  await page.getByRole("button", { name: "Remove Sam Member" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(page.locator(".toasts")).toContainText("Sam Member was removed");
  await mp.goto("/en/clients");
  await expect(mp.locator(".ws-row")).toContainText("Sam Member");
  await expect(mp.getByText("Librairie El Amel")).toHaveCount(0);
  await member.close();
});

test("an existing user accepts and switches between workspaces", async ({ page, browser, request }) => {
  await signUp(page, unique("host"), "host-pass-2026", "Hana Host");
  const guestEmail = unique("guest");
  const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const gp = await guest.newPage();
  await signUp(gp, guestEmail, "guest-pass-2026", "Gil Guest", "Gil Studio");

  await page.goto("/en/settings?tab=team");
  await page.locator("#inv-email").fill(guestEmail);
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.locator(".toasts")).toContainText("Invitation sent");

  await gp.goto(await lastLink(request, guestEmail, /invited you to/));
  await gp.getByRole("button", { name: "Join Lina Studio" }).click();
  await expect(gp).toHaveURL(/\/en$/);
  await gp.locator(".ws-row").click();
  const switcher = gp.getByRole("menuitemradio");
  await expect(switcher).toHaveCount(2);
  await expect(gp.getByRole("menuitemradio", { checked: true })).toContainText("Lina Studio");
  await gp.getByRole("menuitemradio", { checked: false }).click();
  await expect(gp.locator(".ws-row")).toContainText("Gil Studio");

  // A used invitation link no longer works.
  await gp.goto(await lastLink(request, guestEmail, /invited you to/));
  await expect(gp.getByText("This invitation has expired", { exact: false })).toBeVisible();
  await guest.close();
});

test("the last owner cannot leave or be demoted", async ({ page }) => {
  await signUp(page, unique("solo"), "solo-pass-2026", "Solo Owner");
  await page.goto("/en/settings?tab=team");
  // Alone in the workspace: no Leave button, and no role select on oneself.
  await expect(page.getByRole("button", { name: "Leave this workspace" })).toHaveCount(0);
  await expect(page.getByLabel("Role of Solo Owner")).toHaveCount(0);
});
