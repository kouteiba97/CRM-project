import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { cleanChrome, settle, signIn } from "./helpers";

const OUT = "docs/guide/shots";

for (const locale of ["en", "ar"] as const) {
  test(`capture screens ${locale}`, async ({ browser }) => {
    mkdirSync(`${OUT}/${locale}`, { recursive: true });
    const shot = async (page: Page, name: string) => {
      await settle(page);
      await page.screenshot({ path: `${OUT}/${locale}/${name}.png` });
    };

    // Signed-out screens.
    const guest = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await cleanChrome(guest);
    const g = await guest.newPage();
    for (const [path, name] of [
      ["login", "login"],
      ["signup", "signup"],
      ["forgot-password", "forgot"],
    ] as const) {
      await g.goto(`/${locale}/${path}`);
      await g.locator("input:not([type=hidden])").first().blur();
      await settle(g);
      // Just the card: the rest of the signed-out page is empty background.
      await g.locator(".login-card").screenshot({ path: `${OUT}/${locale}/${name}.png` });
    }
    await guest.close();

    // The app, as the seeded owner.
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await cleanChrome(context);
    const page = await context.newPage();
    await signIn(page, locale);
    await shot(page, "dashboard");

    await page.keyboard.press("Control+k");
    await page.keyboard.type(locale === "ar" ? "Dar" : "Libr");
    await shot(page, "palette");
    await page.keyboard.press("Escape");

    await page.goto(`/${locale}/clients`);
    await shot(page, "clients");
    await page.locator("main a.row-open").first().click();
    await page.waitForURL(new RegExp(`/${locale}/clients/[^/?]+`));
    await shot(page, "client");

    await page.goto(`/${locale}/leads`);
    await shot(page, "leads");
    await page.goto(`/${locale}/projects`);
    await shot(page, "projects");
    await page.goto(`/${locale}/tasks`);
    await shot(page, "tasks");

    await page.goto(`/${locale}/invoices/new`);
    await settle(page);
    const client = page.locator("#ed-client");
    const options = await client.locator("option").evaluateAll((o) =>
      o.map((x) => (x as HTMLOptionElement).value).filter(Boolean),
    );
    if (options[1]) await client.selectOption(options[1]);
    const description = page.locator(".lines-table tbody :is(input, textarea)").first();
    if (await description.count()) {
      await description.fill(locale === "ar" ? "تصميم موقع إلكتروني" : "Website design");
    }
    await shot(page, "editor");

    await page.goto(`/${locale}/invoices?status=partially_paid`);
    await settle(page);
    const partial = page.locator("a.doc-link").first();
    if (await partial.count()) await partial.click();
    else await page.locator("a.doc-link").first().click();
    await page.waitForURL(new RegExp(`/${locale}/invoices/[^/?]+`));
    await shot(page, "invoice");

    await page.goto(`/${locale}/payments`);
    await shot(page, "payments");
    await page.goto(`/${locale}/follow-ups`);
    await shot(page, "followups");
    await page.goto(`/${locale}/reports`);
    await shot(page, "reports");
    await page.goto(`/${locale}/settings?tab=workspace`);
    await shot(page, "settings");
    await context.close();
  });
}
