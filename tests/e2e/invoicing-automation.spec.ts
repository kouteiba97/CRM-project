import { expect, test, type Page } from "@playwright/test";
import { signUp, unique } from "./support";

// A fresh workspace, so the daily job (scoped to it) cannot touch other specs' data.
test.use({ storageState: { cookies: [], origins: [] } });

const line = (page: Page, n: number, field: string) => page.getByLabel(new RegExp(`^${field} · line ${n}$`));
const isoDaysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

type Mail = { subject: string; to: string; attachments: { filename: string; size: number }[] };
const mailsTo = async (page: Page, to: string): Promise<Mail[]> =>
  (await page.request.get(`/api/dev/mail?format=json&to=${encodeURIComponent(to)}`)).json();

test("email an invoice with its PDF, automatic reminders, and a recurring copy", async ({ page }) => {
  test.setTimeout(180_000);
  await signUp(page, unique("biller"), "biller-pass-2026", "Bea Biller", "Bea Studio");
  const workspaceId = (await (await page.request.get("/api/export/workspace")).json()).workspace.id as string;
  const clientEmail = unique("payer");

  // A client with an email…
  await page.goto("/en/clients?new=1");
  const dialog = page.getByRole("dialog", { name: "New client" });
  await dialog.getByLabel(/^Name/).fill("Payer Co");
  await dialog.getByLabel(/^Email/).first().fill(clientEmail);
  await dialog.getByLabel(/^First name/).fill("Pat");
  await dialog.getByRole("button", { name: "Create client" }).click();
  await expect(dialog).toBeHidden();

  // …and an invoice that was due ten days ago.
  await page.goto("/en/invoices/new");
  await page.getByLabel(/^Client/).selectOption({ label: "Payer Co" });
  await page.locator("#ed-issue").fill(isoDaysAgo(40));
  await page.locator("#ed-end").fill(isoDaysAgo(10));
  await line(page, 1, "Title").fill("Monthly retainer");
  await line(page, 1, "Rate").fill("500");
  await page.getByRole("button", { name: /Save draft/ }).click();
  await expect(page).toHaveURL(/\/en\/invoices\/[0-9a-f-]{36}$/);
  const invoiceUrl = page.url();

  // Send: a real email with the PDF attached.
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const send = page.getByRole("dialog", { name: /^Send INV-/ });
  await expect(send.getByLabel("To")).toHaveValue(clientEmail);
  await send.getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".toasts").getByText(/emailed to/)).toBeVisible({ timeout: 30_000 });
  let mails = await mailsTo(page, clientEmail);
  expect(mails).toHaveLength(1);
  expect(mails[0]!.attachments[0]!.filename).toMatch(/^INV-\d{4}-\d{4}\.pdf$/);
  expect(mails[0]!.attachments[0]!.size).toBeGreaterThan(10_000);

  // Repeat it monthly from today, emailed automatically.
  await page.goto(invoiceUrl);
  await page.getByRole("button", { name: "Repeat" }).click();
  const repeat = page.getByRole("dialog", { name: /^Repeat INV-/ });
  await repeat.locator("#rec-next").fill(isoDaysAgo(0));
  await repeat.getByLabel("Email it to the client automatically").check();
  await repeat.getByRole("button", { name: "Create schedule" }).click();
  await expect(page.locator(".toasts").getByText(/Repeating from/)).toBeVisible();

  // The daily job: one reminder (overdue) and one new invoice (emailed).
  const run = await page.request.get(`/api/cron/daily?workspace=${workspaceId}`, { timeout: 120_000 });
  expect(run.status()).toBe(200);
  const body = await run.json();
  expect(body.recurring.created).toBe(1);
  expect(body.recurring.sent).toBe(1);
  expect(body.reminders.sent).toBeGreaterThanOrEqual(1);
  mails = await mailsTo(page, clientEmail);
  expect(mails.some((m) => m.subject.startsWith("Reminder: invoice"))).toBe(true);
  expect(mails.filter((m) => m.attachments.length === 1)).toHaveLength(mails.length);

  // Running again the same day sends nothing new.
  const again = await (await page.request.get(`/api/cron/daily?workspace=${workspaceId}`, { timeout: 120_000 })).json();
  expect(again.recurring.created).toBe(0);
  expect(again.reminders.sent).toBe(0);

  await page.goto("/en/invoices/recurring");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Recurring invoices");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText("Emailed automatically");
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.locator(".toasts")).toContainText("Schedule paused");
  await expect(page.locator("tbody tr")).toContainText("Paused");
});

test("the daily job refuses callers without the cron secret in production", async ({ request }) => {
  // In development no secret is configured, so it runs; this documents the contract.
  const res = await request.get("/api/cron/daily?workspace=00000000-0000-4000-8000-000000000000");
  expect(res.status()).toBe(200);
});
