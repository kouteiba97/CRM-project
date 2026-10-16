import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const LOCALES = [
  { code: "en", dir: "ltr", invoices: "Invoices", quotations: "Quotations" },
  { code: "fr", dir: "ltr", invoices: "Factures", quotations: "Devis" },
  { code: "ar", dir: "rtl", invoices: "الفواتير", quotations: "عروض الأسعار" },
] as const;

async function expectAccessible(page: Page) {
  const axe = await new AxeBuilder({ page }).analyze();
  const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
}
const noIndicDigits = async (page: Page) => expect(await page.locator("body").innerText()).not.toMatch(/[٠-٩۰-۹]/);
const rows = (page: Page) => page.locator(".documents-table tbody tr");
const line = (page: Page, n: number, field: string) => page.getByLabel(new RegExp(`^${field} · line ${n}$`));

/** Fills a new document's client and one line, saves, and returns to the record. */
async function createDocument(page: Page, kind: "invoices" | "quotations", opts: { client?: string; title: string; rate: string; language?: string }) {
  await page.goto(`/en/${kind}/new`);
  await page.getByLabel(/^Client/).selectOption({ label: opts.client ?? "Media Pro" });
  if (opts.language) await page.getByLabel(/^Document language/).selectOption({ label: opts.language });
  await line(page, 1, "Title").fill(opts.title);
  await line(page, 1, "Rate").fill(opts.rate);
  await page.getByRole("button", { name: /Save draft/ }).click();
  await expect(page).toHaveURL(new RegExp(`/en/${kind}/[0-9a-f-]{36}$`));
}

for (const loc of LOCALES) {
  test(`invoices & quotations ${loc.code}: lists and a record, a11y`, async ({ page }) => {
    await page.goto(`/${loc.code}/invoices`);
    await expect(page.locator("html")).toHaveAttribute("dir", loc.dir);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(loc.invoices);
    expect(await rows(page).count()).toBeGreaterThanOrEqual(10);
    await expect(page.locator(".documents-table .c-status .ax-badge.danger").first()).toBeVisible();
    await noIndicDigits(page);
    await expectAccessible(page);
    await page.screenshot({ path: `screenshots/invoices-${loc.code}.png`, fullPage: true });

    await page.locator("a.doc-link", { hasText: "0138" }).click();
    await expect(page.locator(".doc")).toBeVisible();
    await expect(page.locator(".pay-summary")).toBeVisible();
    await noIndicDigits(page);
    await expectAccessible(page);

    await page.goto(`/${loc.code}/quotations`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(loc.quotations);
    expect(await rows(page).count()).toBeGreaterThanOrEqual(6);
    await expectAccessible(page);
  });
}

test("invoice list: status groups, client filter and sort in the URL", async ({ page }) => {
  await page.goto("/en/invoices?status=overdue");
  for (const s of await page.locator(".documents-table .c-status").allInnerTexts()) expect(s).toMatch(/^Overdue · \d+ days?$/);
  await page.goto("/en/invoices?status=outstanding");
  for (const s of await page.locator(".documents-table .c-status").allInnerTexts()) expect(s).toMatch(/Sent|Viewed|Partially paid/);

  await page.goto("/en/invoices");
  await page.getByRole("button", { name: "Filter by Client" }).click();
  await page.getByRole("menuitemradio", { name: "Media Pro" }).click();
  await expect(page).toHaveURL(/client=/);
  for (const c of await page.locator(".documents-table .c-client").allInnerTexts()) expect(c).toContain("Media Pro");

  await page.goto("/en/invoices");
  const th = page.locator("th", { hasText: "Amount" });
  await th.getByRole("link").click();
  await expect(page).toHaveURL(/sort=amount$/);
  await th.getByRole("link").click();
  await expect(page).toHaveURL(/sort=amount&dir=desc/);
  const eur = (await page.locator(".documents-table tbody tr", { hasText: "€" }).locator("td.c-money").allInnerTexts()).map((v) => Number(v.replace(/[^\d.]/g, "")));
  expect(eur).toEqual([...eur].sort((a, b) => b - a));
});

test("editor: I opens a new invoice; lines edit inline; totals and preview are live; saved as draft", async ({ page }) => {
  await page.goto("/en/clients");
  await page.locator("body").click({ position: { x: 600, y: 60 } });
  await page.keyboard.press("i");
  await expect(page).toHaveURL(/\/en\/invoices\/new$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("New invoice");
  await expectAccessible(page);

  await page.getByRole("button", { name: /Save draft/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "need attention" })).toBeVisible();
  await expect(page.getByLabel(/^Client/)).toBeFocused();

  await page.getByLabel(/^Client/).selectOption({ label: "Media Pro" });
  await line(page, 1, "Title").fill("Design sprint");
  await line(page, 1, "Qty").fill("2");
  await line(page, 1, "Rate").fill("450");
  await line(page, 1, "Tax %").fill("19");
  await line(page, 1, "Rate").press("Enter");
  await expect(line(page, 2, "Title")).toBeFocused();
  await line(page, 2, "Title").fill("Scratch line");
  await line(page, 2, "Title").press("Control+Backspace");
  await expect(line(page, 2, "Title")).toHaveCount(0);
  await page.getByLabel(/^Discount %/).fill("10");

  const totals = page.locator(".editor-totals");
  await expect(totals).toContainText("€900.00");
  await expect(totals).toContainText("− €90.00");
  await expect(totals).toContainText("€153.90");
  await expect(totals.locator(".total")).toContainText("€963.90");
  const preview = page.locator(".editor-preview .doc");
  await expect(preview).toContainText("Design sprint");
  await expect(preview).toHaveAttribute("lang", "fr");
  await page.getByLabel(/^Document language/).selectOption({ label: "English" });
  await expect(preview).toContainText("Invoice");

  await page.keyboard.press("Control+Enter");
  await expect(page).toHaveURL(/\/en\/invoices\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^INV-\d{4}-\d{4}$/);
  await expect(page.locator(".doc-head .ax-badge")).toHaveText("Draft");
  await expect(page.locator(".doc")).toContainText("Design sprint");
  await expect(page.locator(".doc .r.due")).toContainText("€963.90");
});

test("invoice lifecycle: send, record a partial payment, pay the rest, void with Undo", async ({ page }) => {
  await createDocument(page, "invoices", { title: `Lifecycle ${Date.now()}`, rate: "1000" });
  const recordUrl = page.url();
  await expect(page.getByRole("link", { name: "Edit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Record payment" })).toHaveCount(0);

  await page.getByRole("button", { name: "Send", exact: true }).click();
  const send = page.getByRole("dialog", { name: /^Send INV-/ });
  await expect(send.getByLabel("To")).toHaveValue(/@mediapro\.example$/);
  await expect(send.getByText(/INV-\d{4}-\d{4}\.pdf/)).toBeVisible();
  await expectAccessible(page);
  await send.getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".toasts").getByText(/emailed to/)).toBeVisible();
  await page.goto(recordUrl);
  await expect(page.locator(".doc-head .ax-badge")).toHaveText("Sent");
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);

  // Drafts only: the editor sends sent documents back to the record.
  await page.goto(`${recordUrl}/edit`);
  await expect(page).toHaveURL(recordUrl);

  await page.getByRole("button", { name: "Record payment" }).click();
  const pay = page.getByRole("dialog", { name: "Record payment" });
  await expect(pay.getByLabel(/^Amount/)).toHaveValue("1000.00");
  await pay.getByLabel(/^Amount/).fill("400");
  await pay.getByLabel(/^Reference/).fill("VIR-9001");
  await pay.getByRole("button", { name: "Record payment" }).click();
  await expect(page.locator(".toasts").getByText(/still due/)).toBeVisible();
  await expect(page.locator(".doc-head .ax-badge")).toHaveText("Partially paid");
  await expect(page.locator(".pay-list")).toContainText("VIR-9001");

  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(pay.getByLabel(/^Amount/)).toHaveValue("600.00");
  await pay.getByLabel(/^Amount/).fill("650");
  await expect(pay.getByText(/will be kept as a credit/)).toBeVisible();
  await pay.getByLabel(/^Amount/).fill("600");
  await pay.getByRole("button", { name: "Record payment" }).click();
  await expect(page.locator(".doc-head .ax-badge")).toHaveText("Paid");
  await expect(page.locator(".doc .ax-doc-stamp")).toBeVisible();

  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Void invoice" }).click();
  await expect(page.locator(".doc-head .ax-badge")).toHaveText("Void");
  await page.locator(".toasts").getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".doc-head .ax-badge")).toHaveText("Paid");
});

test("quotation: accept with Undo, convert to an invoice, Arabic document mirrors", async ({ page }) => {
  const title = `Quote ${Date.now()}`;
  await createDocument(page, "quotations", { client: "Dar El Ilm", title, rate: "2500", language: "العربية" });
  const quoteUrl = page.url();
  await expect(page.locator(".doc")).toHaveAttribute("dir", "rtl");
  await expect(page.locator(".doc .doc-h")).toHaveText("عرض سعر");
  await expect(page.locator(".doc")).toContainText("2.500,00");

  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("dialog", { name: /^Send Q-/ }).getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".toasts").getByText(/emailed to/)).toBeVisible();
  await page.goto(quoteUrl);
  await page.getByRole("button", { name: "Accepted" }).click();
  await expect(page.locator(".doc-head .ax-badge")).toHaveText("Accepted");
  await page.locator(".toasts").getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".doc-head .ax-badge")).toHaveText("Sent");
  await page.getByRole("button", { name: "Accepted" }).click();
  await expect(page.getByRole("link", { name: "Create project" })).toBeVisible();

  await page.getByRole("button", { name: "Convert to invoice" }).click();
  await expect(page).toHaveURL(/\/en\/invoices\/[0-9a-f-]{36}\/edit$/);
  await expect(line(page, 1, "Title")).toHaveValue(title);
  await expect(line(page, 1, "Rate")).toHaveValue("2500.00");
  await page.getByRole("button", { name: /Save draft/ }).click();
  await expect(page).toHaveURL(/\/en\/invoices\/[0-9a-f-]{36}$/);
  const invoiceNumber = (await page.getByRole("heading", { level: 1 }).innerText()).trim();

  await page.goto(quoteUrl);
  await expect(page.locator(".rail-dl")).toContainText(invoiceNumber);
  await expect(page.getByRole("link", { name: "Open invoice" })).toBeVisible();
});

test("project milestone → Create invoice prefills the line and bills the milestone", async ({ page }) => {
  const name = `Billing ${Date.now()}`;
  await page.goto("/en/projects?new=1");
  const dialog = page.getByRole("dialog", { name: "New project" });
  await dialog.getByLabel(/^Name/).fill(name);
  await dialog.getByLabel(/^Client/).selectOption({ label: "Media Pro" });
  await dialog.getByRole("button", { name: "Create project" }).click();
  await page.locator(".toasts").getByRole("button", { name: "Open" }).click();
  await page.getByRole("tab", { name: /Milestones/ }).click();
  await page.getByRole("button", { name: "Add milestone" }).click();
  await page.getByLabel("Milestone title").fill("Phase 1 delivery");
  await page.getByLabel("Amount").fill("3200");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Mark “Phase 1 delivery” as completed" }).click();
  const projectUrl = page.url();

  await page.locator(".project-title").getByRole("link", { name: "Create invoice" }).click();
  await expect(page).toHaveURL(/\/en\/invoices\/new\?/);
  await expect(line(page, 1, "Title")).toHaveValue("Phase 1 delivery");
  await expect(line(page, 1, "Rate")).toHaveValue("3200.00");
  await expect(page.getByLabel(/^Project/)).not.toHaveValue("");
  await page.getByRole("button", { name: /Save draft/ }).click();
  await expect(page).toHaveURL(/\/en\/invoices\/[0-9a-f-]{36}$/);
  const number = (await page.getByRole("heading", { level: 1 }).innerText()).trim();

  await page.goto(projectUrl);
  await expect(page.locator(".milestone-list .ms-row", { hasText: "Phase 1 delivery" })).toContainText(number);
  await expect(page.locator(".project-title").getByRole("link", { name: "Create invoice" })).toHaveCount(0);
});

test("no horizontal page scroll on documents at 360 / 768 / 1366", async ({ page }) => {
  await page.goto("/en/invoices");
  const record = (await page.locator("a.doc-link", { hasText: "0138" }).getAttribute("href"))!;
  for (const code of ["fr", "ar"]) {
    for (const width of [360, 768, 1366]) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of [`/${code}/invoices`, `/${code}/quotations`, record.replace(/^\/en/, `/${code}`), `/${code}/invoices/new`]) {
        await page.goto(path);
        await expect(page.locator("main h1")).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${path} @ ${width}`).toBeLessThanOrEqual(0);
      }
    }
  }
});
