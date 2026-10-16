import { execFileSync } from "node:child_process";
import { mkdirSync, renameSync, rmSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { DEV_CREDENTIALS } from "../../src/db/dev-credentials";
import { cleanChrome, settle } from "./helpers";

/**
 * Video tours with burned-in captions (no voice), one per language. Recorded by Playwright as
 * WebM, then converted to MP4 with ffmpeg when it is installed (`winget install Gyan.FFmpeg`).
 */
const CAPTIONS = {
  en: {
    login: "Open Apex CRM in your browser and sign in with your email and password.",
    dashboard: "The dashboard is your day at a glance: money in, overdue invoices, tasks and follow-ups.",
    sidebar: "The sidebar opens every module. Press [ to fold it when you need room.",
    search: "Press Ctrl+K to find any client, project or invoice and jump to it.",
    clients: "Clients: search and filter the list, then open a profile.",
    client: "A profile shows contacts, key numbers, documents and the full history.",
    leads: "Leads: one column per stage. Drag a card forward; mark deals won or lost.",
    tasks: "Tasks are grouped by due date. Tick the circle when a task is done.",
    editor: "New invoice: pick the client and add lines. Totals and the preview update as you type.",
    invoice: "From an invoice: send it, record payments, download the PDF.",
    reports: "Reports: invoiced vs collected, who pays late, and why deals are lost.",
    settings: "Settings: your company details are printed on every quotation and invoice.",
    logout: "To leave, open the account menu and choose Log out.",
    forgot: "Forgot your password? Ask for a link: it arrives by email, works once, for 60 minutes.",
    end: "That's the tour. The PDF guide explains every screen step by step.",
  },
  ar: {
    login: "افتح Apex CRM في المتصفح وسجّل الدخول ببريدك الإلكتروني وكلمة المرور.",
    dashboard: "لوحة التحكم تلخّص يومك: الإيرادات، والفواتير المتأخرة، والمهام، والمتابعات.",
    sidebar: "الشريط الجانبي يفتح كل الوحدات. اضغط [ لطيّه عندما تحتاج مساحة أكبر.",
    search: "اضغط Ctrl+K للبحث عن أي عميل أو مشروع أو فاتورة والانتقال إليه.",
    clients: "العملاء: ابحث وصفِّ القائمة، ثم افتح ملف العميل.",
    client: "يعرض الملف جهات الاتصال، والأرقام الأساسية، والمستندات، والسجل الكامل.",
    leads: "العملاء المحتملون: عمود لكل مرحلة. اسحب البطاقة إلى الأمام، وسجّل الصفقة كمكسوبة أو خاسرة.",
    tasks: "المهام مجمّعة حسب تاريخ الاستحقاق. اضغط الدائرة عند إنجاز المهمة.",
    editor: "فاتورة جديدة: اختر العميل وأضف الأسطر. تتحدّث المجاميع والمعاينة أثناء الكتابة.",
    invoice: "من الفاتورة: أرسلها، وسجّل الدفعات، ونزّلها بصيغة PDF.",
    reports: "التقارير: المفوتر مقابل المحصّل، ومن يتأخّر في الدفع، ولماذا تُخسر الصفقات.",
    settings: "الإعدادات: بيانات شركتك تُطبع على كل عرض سعر وفاتورة.",
    logout: "للخروج، افتح قائمة الحساب واختر «تسجيل الخروج».",
    forgot: "نسيت كلمة المرور؟ اطلب رابطًا: يصلك بالبريد، ويعمل مرة واحدة ولمدة 60 دقيقة.",
    end: "انتهت الجولة. يشرح دليل PDF كل شاشة خطوة بخطوة.",
  },
} as const;

async function caption(page: Page, text: string, dir: "ltr" | "rtl", hold = 3800) {
  await page.evaluate(
    ([t, d]) => {
      let el = document.getElementById("tour-caption");
      if (!el) {
        el = document.createElement("div");
        el.id = "tour-caption";
        el.style.cssText =
          "position:fixed;inset-inline:0;bottom:28px;margin:auto;width:max-content;max-width:min(1040px,92vw);z-index:2147483647;" +
          "background:rgba(19,48,58,.92);color:#fff;font:600 24px/1.45 'Segoe UI',Tahoma,sans-serif;padding:14px 24px;" +
          "border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.25);text-align:center;pointer-events:none";
        document.body.appendChild(el);
      }
      el.dir = d!;
      el.textContent = t!;
    },
    [text, dir],
  );
  await page.waitForTimeout(hold);
}

for (const locale of ["en", "ar"] as const) {
  test(`record tour ${locale}`, async ({ browser }) => {
    const dir = locale === "ar" ? "rtl" : "ltr";
    const c = CAPTIONS[locale];
    const raw = `docs/guide/video-raw/${locale}`;
    rmSync(raw, { recursive: true, force: true });
    mkdirSync(raw, { recursive: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: raw, size: { width: 1280, height: 720 } },
    });
    await cleanChrome(context);
    const page = await context.newPage();
    const visit = async (path: string) => {
      await page.goto(`/${locale}${path}`);
      await settle(page);
    };

    await visit("/login");
    await caption(page, c.login, dir, 1500);
    await page.locator("#login-email").pressSequentially(DEV_CREDENTIALS.email, { delay: 45 });
    await page.locator("#login-password").pressSequentially(DEV_CREDENTIALS.password, { delay: 45 });
    await page.waitForTimeout(800);
    await page.locator("form.login-form button[type=submit]").click();
    await page.waitForURL(new RegExp(`/${locale}$`));
    await settle(page);
    await caption(page, c.dashboard, dir, 4500);

    await caption(page, c.sidebar, dir, 1500);
    await page.keyboard.press("[");
    await page.waitForTimeout(1300);
    await page.keyboard.press("[");
    await page.waitForTimeout(1300);

    await caption(page, c.search, dir, 800);
    await page.keyboard.press("Control+k");
    await page.keyboard.type(locale === "ar" ? "Dar" : "Libr", { delay: 120 });
    await page.waitForTimeout(2500);
    await page.keyboard.press("Escape");

    await visit("/clients");
    await caption(page, c.clients, dir);
    await page.locator("main a.row-open").first().click();
    await page.waitForURL(new RegExp(`/${locale}/clients/[^/?]+`));
    await settle(page);
    await caption(page, c.client, dir, 4200);

    await visit("/leads");
    await caption(page, c.leads, dir, 4500);
    await visit("/tasks");
    await caption(page, c.tasks, dir);

    await visit("/invoices/new");
    await caption(page, c.editor, dir, 1200);
    const client = page.locator("#ed-client");
    const values = await client
      .locator("option")
      .evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value).filter(Boolean));
    if (values[1]) await client.selectOption(values[1]);
    const description = page.locator(".lines-table tbody :is(input, textarea)").first();
    if (await description.count()) {
      await description.pressSequentially(locale === "ar" ? "تصميم موقع إلكتروني" : "Website design", { delay: 60 });
    }
    await page.waitForTimeout(2500);

    await visit("/invoices?status=partially_paid");
    await page.locator("a.doc-link").first().click();
    await page.waitForURL(new RegExp(`/${locale}/invoices/[^/?]+`));
    await settle(page);
    await caption(page, c.invoice, dir, 4200);

    await visit("/reports");
    await caption(page, c.reports, dir, 4200);
    await visit("/settings?tab=workspace");
    await caption(page, c.settings, dir);

    await caption(page, c.logout, dir, 1200);
    await page.getByRole("button", { name: locale === "ar" ? "قائمة الحساب" : "Account menu" }).click();
    await page.waitForTimeout(1500);
    await page.getByRole("menuitem", { name: locale === "ar" ? "تسجيل الخروج" : "Log out" }).click();
    await page.waitForURL(new RegExp(`/${locale}/login`));
    // Signing out navigates client-side, so the old caption would otherwise stay up.
    await page.evaluate(() => document.getElementById("tour-caption")?.remove());
    await settle(page);
    await page.locator(".login-label-row a").click();
    await page.waitForURL(new RegExp(`/${locale}/forgot-password`));
    await settle(page);
    await caption(page, c.forgot, dir, 4500);
    await caption(page, c.end, dir, 3500);

    const video = page.video();
    await context.close();
    const webm = await video!.path();
    const out = `docs/Apex-CRM-Tour-${locale.toUpperCase()}`;
    try {
      execFileSync("ffmpeg", [
        "-y", "-loglevel", "error", "-i", webm,
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "24", "-movflags", "+faststart",
        `${out}.mp4`,
      ]);
    } catch {
      renameSync(webm, `${out}.webm`);
    }
    rmSync(raw, { recursive: true, force: true });
  });
}
