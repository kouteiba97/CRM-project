import "server-only";
import { existsSync } from "node:fs";
import type { Browser } from "puppeteer-core";

/**
 * Headless Chromium for PDFs. On Vercel (and other serverless Linux) it comes from
 * @sparticuz/chromium; on a developer machine it uses the installed Edge or Chrome
 * (or CHROME_PATH). The browser is reused between requests while the function stays warm.
 */
const LOCAL_BROWSERS = [
  process.env.CHROME_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

let browser: Promise<Browser> | null = null;

async function launch(): Promise<Browser> {
  const puppeteer = (await import("puppeteer-core")).default;
  const serverless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (serverless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  const executablePath = LOCAL_BROWSERS.find((p): p is string => Boolean(p && existsSync(p)));
  if (!executablePath) throw new Error("No Chrome/Edge found for PDFs. Set CHROME_PATH.");
  return puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox", "--font-render-hinting=none"] });
}

async function getBrowser() {
  browser ??= launch().catch((error) => {
    browser = null;
    throw error;
  });
  const b = await browser;
  if (!b.connected) {
    browser = null;
    return getBrowser();
  }
  return b;
}

/** Prints a page of this app (a signed /print URL) to an A4 PDF. */
export async function renderPdf(url: string): Promise<Buffer> {
  const page = await (await getBrowser()).newPage();
  try {
    await page.emulateMediaType("print");
    // "load" (not network-idle): security software on some machines keeps a long-poll open,
    // which would make "idle" never happen. The page has no late data; fonts are awaited below.
    const res = await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    if (!res?.ok()) throw new Error(`PDF source returned ${res?.status()}`);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}
