import { expect, test, type Page } from "@playwright/test";
import { expectAccessible, lastLink, signUp, unique } from "./support";

// Fresh workspaces only: these tests add clients, files and expenses.
test.use({ storageState: { cookies: [], origins: [] } });

async function newClient(page: Page, name: string, email?: string) {
  await page.goto("/en/clients?new=1");
  const dialog = page.getByRole("dialog", { name: "New client" });
  await dialog.getByLabel(/^Name/).fill(name);
  if (email) await dialog.getByLabel(/^Email/).first().fill(email);
  await dialog.getByLabel(/^First name/).fill("Pat");
  await dialog.getByRole("button", { name: "Create client" }).click();
  await expect(dialog).toBeHidden();
  await page.goto(`/en/clients?q=${encodeURIComponent(name)}`);
  await page.locator("main a.row-open").first().click();
  await expect(page).toHaveURL(/\/en\/clients\/[0-9a-f-]{36}/);
  return page.url();
}

test("files: upload to a client, download, refuse disguised HTML, delete", async ({ page }) => {
  await signUp(page, unique("files"), "files-pass-2026");
  const clientUrl = await newClient(page, "File Keeper");
  await page.goto(`${clientUrl}?tab=files`);
  await expectAccessible(page);

  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
  await page.locator('.files-drop input[type="file"]').setInputFiles({ name: "contract.pdf", mimeType: "application/pdf", buffer: pdf });
  await expect(page.locator(".toasts")).toContainText("contract.pdf uploaded");
  const link = page.getByRole("link", { name: "contract.pdf" });
  await expect(link).toBeVisible();
  const res = await page.request.get((await link.getAttribute("href"))!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toContain("attachment");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // An HTML page renamed to .pdf is refused.
  await page
    .locator('.files-drop input[type="file"]')
    .setInputFiles({ name: "evil.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html><script>alert(1)</script></html>") });
  await expect(page.locator(".toasts")).toContainText("evil.pdf: this kind of file is not accepted.");

  await page.getByRole("button", { name: "Delete contract.pdf" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.locator(".toasts")).toContainText("contract.pdf deleted");
  expect((await page.request.get((await link.getAttribute("href").catch(() => null)) ?? "/api/files/00000000-0000-4000-8000-000000000000")).status()).toBe(404);
});

test("expenses: add, filter, edit, and profit in reports", async ({ page }) => {
  await signUp(page, unique("spend"), "spend-pass-2026");
  await page.goto("/en/expenses");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Expenses");
  await expectAccessible(page);
  await page.getByRole("link", { name: "New expense" }).click();
  const drawer = page.getByRole("dialog", { name: "New expense" });
  await drawer.getByRole("button", { name: "Add expense" }).click();
  await expect(drawer.getByText("Fill in this field")).toBeVisible();
  await drawer.locator("#exp-description").fill("Figma subscription");
  await drawer.locator("#exp-amount").fill("45,00");
  await drawer.locator("#exp-category").selectOption("software");
  await drawer.getByRole("button", { name: "Add expense" }).click();
  await expect(page.locator(".toasts")).toContainText("Expense added");
  await expect(page.locator(".expenses-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".expense-totals")).toContainText("45");

  await page.locator("#exp-filter-cat").selectOption("travel");
  await expect(page.locator(".expenses-table")).toHaveCount(0);
  await page.locator("#exp-filter-cat").selectOption("");
  await page.getByRole("link", { name: "Figma subscription" }).click();
  const edit = page.getByRole("dialog", { name: "Edit expense" });
  await edit.locator("#exp-amount").fill("60");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".toasts")).toContainText("Expense saved");

  await page.goto("/en/reports?range=month");
  const profit = page.locator("#rep-profit").locator("xpath=ancestor::section[1]");
  await expect(profit).toContainText("Software & subscriptions");
  await expect(profit).toContainText("60");
});

test("import clients from CSV: columns matched, duplicates and bad rows skipped", async ({ page }) => {
  await signUp(page, unique("import"), "import-pass-2026");
  await page.goto("/en/clients");
  await page.getByRole("link", { name: "Import" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Import clients");
  const csv = [
    "Société;Courriel;Ville;Prénom",
    "Atlas Print;hello@atlas.example;Oran;Samir",
    "Atlas Print;other@atlas.example;Oran;Samir",
    ";nobody@x.example;;",
    "Broken Mail;not-an-email;;",
    '"Nour, Studio";nour@studio.example;Alger;Nour',
  ].join("\r\n");
  await page.locator('input[type="file"]').setInputFiles({ name: "clients.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.locator("#map-name")).toHaveValue("0");
  await expect(page.locator("#map-email")).toHaveValue("1");
  await expect(page.locator("#map-contactFirstName")).toHaveValue("3");
  await expect(page.getByText("3 of 5 rows are ready to import.")).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("button", { name: "Import 3 clients" }).click();
  // The repeated name is caught on the server.
  await expect(page.getByText("2 clients imported.")).toBeVisible();
  await expect(page.getByText("3 rows were skipped:")).toBeVisible();

  await page.goto("/en/clients");
  await expect(page.getByText("Atlas Print")).toBeVisible();
  await expect(page.getByText("Nour, Studio")).toBeVisible();
});

test("notifications: a payment recorded by a colleague reaches the owner's bell", async ({ page, browser, request }) => {
  await signUp(page, unique("boss"), "boss-pass-2026", "Bo Boss", "Bell Studio");
  await newClient(page, "Bell Client");
  const memberEmail = unique("helper");
  await page.goto("/en/settings?tab=team");
  await page.locator("#inv-email").fill(memberEmail);
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.locator(".toasts")).toContainText("Invitation sent");

  const member = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const mp = await member.newPage();
  await mp.goto(await lastLink(request, memberEmail, /invited you to/));
  await mp.locator("#inv-name").fill("Hal Helper");
  await mp.locator("#inv-password").fill("helper-pass-2026");
  await mp.getByRole("button", { name: "Create account and join" }).click();
  await expect(mp).toHaveURL(/\/en$/);

  // Owner sees "Hal Helper joined".
  await page.goto("/en");
  await page.getByRole("button", { name: /^Notifications, \d+ unread$/ }).click();
  await expect(page.getByRole("menuitem", { name: /Hal Helper joined the workspace/ })).toBeVisible();
  await page.getByRole("menuitem", { name: "Mark all read" }).click();
  await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();

  // The member assigns a task to the owner → the owner is told.
  await mp.goto("/en/tasks?new=1");
  const drawer = mp.getByRole("dialog");
  await drawer.getByLabel(/^Title/).fill("Call the printer");
  await drawer.getByLabel(/^Assignee/).selectOption({ label: "Bo Boss" });
  await drawer.getByRole("button", { name: "Create task" }).click();
  await expect(drawer).toBeHidden();
  await page.goto("/en");
  await page.getByRole("button", { name: /^Notifications, 1 unread$/ }).click();
  await expect(page.getByRole("menuitem", { name: /Hal Helper assigned you “Call the printer”/ })).toBeVisible();
  await member.close();
});
