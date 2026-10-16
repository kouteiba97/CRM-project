import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const LOCALES = [
  { code: "en", dir: "ltr", title: "Payments", followUps: "Follow-ups" },
  { code: "fr", dir: "ltr", title: "Paiements", followUps: "Relances" },
  { code: "ar", dir: "rtl", title: "المدفوعات", followUps: "المتابعات" },
] as const;

async function expectAccessible(page: Page) {
  const axe = await new AxeBuilder({ page }).analyze();
  const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
}
const rows = (page: Page) => page.locator(".payments-table tbody tr");

/** A sent invoice of `amount` for Media Pro; returns its number. */
async function sentInvoice(page: Page, title: string, amount: string) {
  await page.goto("/en/invoices/new");
  await page.getByLabel(/^Client/).selectOption({ label: "Media Pro" });
  await page.getByLabel(/^Title · line 1$/).fill(title);
  await page.getByLabel(/^Rate · line 1$/).fill(amount);
  await page.getByRole("button", { name: /Save draft/ }).click();
  await expect(page).toHaveURL(/\/en\/invoices\/[0-9a-f-]{36}$/);
  const number = (await page.getByRole("heading", { level: 1 }).innerText()).trim();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("dialog", { name: /^Send INV-/ }).getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".toasts").getByText(/emailed to/)).toBeVisible();
  return number;
}

for (const loc of LOCALES) {
  test(`payments & follow-ups ${loc.code}: lists, a11y`, async ({ page }) => {
    await page.goto(`/${loc.code}/payments`);
    await expect(page.locator("html")).toHaveAttribute("dir", loc.dir);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(loc.title);
    expect(await rows(page).count()).toBeGreaterThanOrEqual(8);
    expect(await page.locator("body").innerText()).not.toMatch(/[٠-٩۰-۹]/);
    await expectAccessible(page);
    await page.screenshot({ path: `screenshots/payments-${loc.code}.png`, fullPage: true });

    await page.goto(`/${loc.code}/follow-ups`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(loc.followUps);
    await expect(page.locator(".fu-group").first()).toHaveClass(/is-danger/);
    await expect(page.locator(".fu-row.is-overdue").first()).toBeVisible();
    expect(await page.locator("body").innerText()).not.toMatch(/[٠-٩۰-۹]/);
    await expectAccessible(page);
    await page.screenshot({ path: `screenshots/followups-${loc.code}.png`, fullPage: true });
  });
}

test("payments: filters and search in the URL; the dashboard period link works", async ({ page }) => {
  await page.goto("/en/payments?q=VIR-1008");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("INV-");

  await page.goto("/en/payments");
  await page.getByRole("button", { name: "Filter by Status" }).click();
  await page.getByRole("menuitemradio", { name: "Received" }).click();
  await expect(page).toHaveURL(/status=received/);
  for (const s of await page.locator(".payments-table .c-status").allInnerTexts()) expect(s).toContain("Received");

  // Dashboard › Revenue KPI links to the payments of the period.
  await page.goto("/en");
  await page.locator(".kpi", { hasText: "Revenue" }).click();
  await expect(page).toHaveURL(/\/en\/payments\?period=month$/);
  await expect(page.locator(".chip-group .ax-chip.is-active").first()).toContainText("This month");
});

test("record a payment from the list, mark it Failed (balance reopens), Undo", async ({ page }) => {
  const stamp = Date.now();
  const number = await sentInvoice(page, `Pay ${stamp}`, "800");
  await page.goto("/en/payments");
  await page.getByRole("button", { name: "Record payment" }).click();
  const dialog = page.getByRole("dialog", { name: "Record payment" });
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(dialog.getByText("Choose the invoice this payment is for")).toBeVisible();
  const option = await dialog.locator("#pay-invoice option", { hasText: number }).getAttribute("value");
  await dialog.getByLabel("Invoice").selectOption(option!);
  await expect(dialog.getByLabel(/^Amount/)).toHaveValue("800.00");
  await dialog.getByLabel(/^Reference/).fill(`REF-${stamp}`);
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(page.locator(".toasts").getByText(`${number} is fully paid`)).toBeVisible();
  await page.goto(`/en/payments?q=REF-${stamp}`);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText(number);

  await rows(page).first().getByRole("button", { name: /Actions for payment/ }).click();
  await page.getByRole("menuitem", { name: "Failed" }).click();
  await expect(rows(page).first().locator(".c-status")).toHaveText("Failed");
  await page.goto(`/en/invoices?q=${number}`);
  await expect(page.locator(".documents-table .c-status").first()).toHaveText("Sent");

  await page.goto(`/en/payments?q=REF-${stamp}`);
  await rows(page).first().getByRole("button", { name: /Actions for payment/ }).click();
  await page.getByRole("menuitem", { name: "Received" }).click();
  await expect(rows(page).first().locator(".c-status")).toHaveText("Received");
});

test("reminder schedule on an overdue invoice; the client switch turns reminders off and on", async ({ page }) => {
  await page.goto("/en/invoices?q=0140");
  await page.locator("a.doc-link").first().click();
  const rem = page.locator(".rail-block", { hasText: "Payment reminders" });
  await expect(rem.locator("li")).toHaveCount(4);
  const sentBefore = await rem.locator("li.rem-sent").count();
  await expect(rem.locator("li.rem-due").first()).toBeVisible();
  await rem.getByRole("button", { name: /Send reminder/ }).click();
  await expect(page.locator(".toasts").getByText(/Reminder (logged|emailed)/)).toBeVisible();
  await page.reload();
  await expect(rem.locator("li.rem-sent")).toHaveCount(sentBefore + 1);
  const invoiceUrl = page.url();

  await page.getByRole("link", { name: "Dar El Ilm" }).first().click();
  const sw = page.getByRole("switch", { name: "Automatic payment reminders" });
  await expect(sw).toBeChecked();
  await sw.click();
  await expect(page.locator(".toasts").getByText("Payment reminders turned off")).toBeVisible();
  await page.goto(invoiceUrl);
  await expect(rem).toContainText("Automatic reminders are off for this client.");
  await page.getByRole("link", { name: "Change in the client’s profile" }).click();
  await page.getByRole("switch", { name: "Automatic payment reminders" }).click();
  await expect(page.locator(".toasts").getByText("Payment reminders turned on")).toBeVisible();
});

test("follow-ups: plan one, reschedule it, complete it with an outcome and a next follow-up", async ({ page }) => {
  const subject = `Call back ${Date.now()}`;
  await page.goto("/en/follow-ups");
  await page.getByRole("link", { name: "New follow-up" }).click();
  const dialog = page.getByRole("dialog", { name: "New follow-up" });
  await expectAccessible(page);
  await dialog.getByRole("button", { name: "Plan follow-up" }).click();
  await expect(dialog.getByText("Write a subject, e.g. Check-in call")).toBeVisible();
  await dialog.getByLabel(/^Subject/).fill(subject);
  await dialog.getByLabel(/^About/).selectOption({ label: "Media Pro" });
  await dialog.getByLabel(/^Channel/).selectOption({ label: "Meeting" });
  await dialog.getByRole("button", { name: "Plan follow-up" }).click();
  await expect(dialog).toBeHidden();
  const row = page.locator(".fu-row", { hasText: subject });
  await expect(row).toContainText("Media Pro");
  await expect(row).toContainText("Tomorrow · 10:00");

  await row.getByRole("button", { name: "Reschedule" }).click();
  await row.getByLabel("Date and time").fill("2031-06-02T15:00");
  await row.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".fu-row", { hasText: subject })).toContainText("2 Jun · 15:00");

  const r = page.locator(".fu-row", { hasText: subject });
  await r.getByRole("button", { name: "Done" }).click();
  await r.getByLabel(/^Outcome/).fill("Signed the order form.");
  await r.getByLabel(/^Next follow-up/).fill("2031-07-01T09:30");
  await r.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".toasts").getByText("Follow-up completed")).toBeVisible();
  await page.locator("summary", { hasText: "Completed recently" }).click();
  await expect(page.locator(".fu-done .fu-row", { hasText: subject })).toContainText("Signed the order form.");
  await expect(page.locator(".fu-group:not(.fu-done) .fu-row", { hasText: subject })).toContainText("1 Jul · 09:30");

  await page.goto("/en/follow-ups?channel=meeting");
  for (const s of await page.locator(".fu-group:not(.fu-done) .fu-subject .sr-only").allInnerTexts()) expect(s).toContain("Meeting");
});

test("no horizontal page scroll on payments and follow-ups at 360 / 768 / 1366", async ({ page }) => {
  for (const code of ["fr", "ar"]) {
    for (const width of [360, 768, 1366]) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of [`/${code}/payments`, `/${code}/follow-ups`, `/${code}/follow-ups?new=1`]) {
        await page.goto(path);
        await expect(page.locator("main h1")).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${path} @ ${width}`).toBeLessThanOrEqual(0);
      }
    }
  }
});
