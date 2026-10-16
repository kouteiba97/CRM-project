import { expect, test } from "@playwright/test";

test("Download PDF returns a real PDF of the invoice; the print view needs a signature", async ({ page }) => {
  await page.goto("/en/invoices?q=0138");
  const href = await page.locator("a.doc-link").first().getAttribute("href");
  const id = href!.split("/").pop()!;
  await page.goto(href!);
  const link = page.getByRole("link", { name: "Download PDF" });
  await expect(link).toHaveAttribute("href", `/api/documents/invoice/${id}/pdf`);

  const res = await page.request.get(`/api/documents/invoice/${id}/pdf`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  expect(res.headers()["content-disposition"]).toContain("INV-");
  const body = await res.body();
  expect(body.subarray(0, 5).toString()).toBe("%PDF-");
  expect(body.length).toBeGreaterThan(10_000);

  // Without (or with a forged) signature the print view does not exist.
  expect((await page.request.get(`/en/print/invoice/${id}`)).status()).toBe(404);
  expect((await page.request.get(`/en/print/invoice/${id}?ws=x&exp=9999999999999&sig=abc`)).status()).toBe(404);
});

test("another workspace's document cannot be downloaded", async ({ page, browser }) => {
  await page.goto("/en/invoices?q=0138");
  const href = await page.locator("a.doc-link").first().getAttribute("href");
  const stranger = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const res = await stranger.request.get(`/api${href!.replace("/en/invoices/", "/documents/invoice/")}/pdf`, { maxRedirects: 0 });
  expect([302, 303, 307, 401, 404]).toContain(res.status());
  await stranger.close();
});
