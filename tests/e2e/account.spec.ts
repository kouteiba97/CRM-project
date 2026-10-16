import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Sign-up, email confirmation and password reset, as a brand-new user each time (never the
// seeded owner, whose session the other specs share).
test.use({ storageState: { cookies: [], origins: [] } });

const unique = (tag: string) => `${tag}.${Date.now()}${Math.floor(Math.random() * 1e4)}@example.test`;

async function expectAccessible(page: Page) {
  const axe = await new AxeBuilder({ page }).analyze();
  const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
}

/** The newest link the app emailed to `to` (dev outbox, used while SMTP is not set up). */
async function lastLink(request: APIRequestContext, to: string, subject: RegExp) {
  let link = "";
  await expect(async () => {
    const mails: { subject: string; text: string }[] = await (
      await request.get(`/api/dev/mail?format=json&to=${encodeURIComponent(to)}`)
    ).json();
    const mail = mails.find((m) => subject.test(m.subject));
    expect(mail, `email "${subject}" to ${to}`).toBeTruthy();
    link = mail!.text.match(/https?:\/\/\S+/)![0];
  }).toPass({ timeout: 10_000 });
  return new URL(link).pathname + new URL(link).search;
}

async function signUp(page: Page, email: string, password: string, name = "Lina Test") {
  await page.goto("/en/signup");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.locator("#signup-password").fill(password);
  await page.getByLabel("Company name").fill("Lina Studio");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/en$/);
}

for (const loc of [
  { code: "en", dir: "ltr", signup: "Create your account", forgot: "Reset your password" },
  { code: "fr", dir: "ltr", signup: "Créer votre compte", forgot: "Réinitialiser le mot de passe" },
  { code: "ar", dir: "rtl", signup: "أنشئ حسابك", forgot: "إعادة تعيين كلمة المرور" },
] as const) {
  test(`sign-up and forgot-password pages ${loc.code}: layout, a11y, no horizontal scroll`, async ({ page }) => {
    for (const [path, title] of [
      ["signup", loc.signup],
      ["forgot-password", loc.forgot],
    ] as const) {
      await page.goto(`/${loc.code}/${path}`);
      await expect(page.locator("html")).toHaveAttribute("dir", loc.dir);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      expect(await page.locator("body").innerText()).not.toMatch(/[٠-٩۰-۹]/);
      await expectAccessible(page);
      for (const width of [360, 768]) {
        await page.setViewportSize({ width, height: 800 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${path} @ ${width}`).toBeLessThanOrEqual(0);
      }
      await page.setViewportSize({ width: 1366, height: 768 });
    }
  });
}

test("sign up: validation, new empty workspace, confirm email, duplicate email", async ({ page, request }) => {
  const email = unique("signup");
  await page.goto("/en/signup");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter your name.")).toBeVisible();
  await expect(page.getByLabel("Your name")).toBeFocused();

  await page.getByLabel("Your name").fill("Lina Test");
  await page.getByLabel("Email").fill("not-an-email");
  await page.locator("#signup-password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter a valid email, like name@company.com.")).toBeVisible();
  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
  await expect(page.getByLabel("Your name")).toHaveValue("Lina Test");

  await signUp(page, email, "lina-pass-2026");
  // A fresh workspace: none of the seeded clients, and the confirm-email banner.
  await expect(page.locator(".app-content")).toContainText("Confirm your email");
  await page.goto("/en/clients");
  await expect(page.getByText("Librairie El Amel")).toHaveCount(0);

  await page.goto(await lastLink(request, email, /Confirm your email/));
  await expect(page.getByText("Your email is confirmed. Thank you!")).toBeVisible();
  await page.goto("/en");
  await expect(page.locator(".verify-banner")).toHaveCount(0);

  // The same email cannot sign up twice.
  await page.context().clearCookies();
  await page.goto("/en/signup");
  await page.getByLabel("Your name").fill("Someone Else");
  await page.getByLabel("Email").fill(email.toUpperCase());
  await page.locator("#signup-password").fill("another-pass-1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("An account already uses this email.", { exact: false })).toBeVisible();
});

test("forgot password: same answer for unknown emails, link works once, other sessions end", async ({
  page,
  browser,
  request,
}) => {
  const email = unique("reset");
  await signUp(page, email, "first-pass-2026");

  // A second device stays signed in with the old password…
  const other = await browser.newContext({ storageState: await page.context().storageState() });
  const otherPage = await other.newPage();
  await otherPage.goto("/en/clients");
  await expect(otherPage).toHaveURL(/\/en\/clients$/);

  await page.context().clearCookies();
  await page.goto("/en/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/en\/forgot-password$/);

  // Unknown address: identical confirmation, and no email goes out.
  const nobody = unique("nobody");
  await page.getByLabel("Email").fill(nobody);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText(`If an account exists for ${nobody}`);
  expect(await (await request.get(`/api/dev/mail?format=json&to=${nobody}`)).json()).toEqual([]);

  await page.goto("/en/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText(`If an account exists for ${email}`);
  const link = await lastLink(request, email, /Reset your Apex CRM password/);

  await page.goto(link);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Choose a new password");
  await expectAccessible(page);
  await page.locator("#reset-password").fill("second-pass-2026");
  await page.locator("#reset-confirm").fill("something-else");
  await page.getByRole("button", { name: "Save password and sign in" }).click();
  await expect(page.getByText("The passwords don't match.")).toBeVisible();
  await page.locator("#reset-password").fill("second-pass-2026");
  await page.locator("#reset-confirm").fill("second-pass-2026");
  await page.getByRole("button", { name: "Save password and sign in" }).click();
  await expect(page).toHaveURL(/\/en$/);
  // Using the reset link proves the inbox, so the email counts as confirmed.
  await expect(page.locator(".verify-banner")).toHaveCount(0);

  // …and is signed out by the reset.
  await otherPage.goto("/en/clients");
  await expect(otherPage).toHaveURL(/\/en\/login\?expired=1$/);
  await expect(otherPage.getByText("You were signed out.", { exact: false })).toBeVisible();
  await other.close();

  // The link is single-use.
  await page.goto(link);
  await expect(page.getByText("This link has expired or was already used.", { exact: false })).toBeVisible();

  // The old password no longer works; the new one does.
  await page.context().clearCookies();
  await page.goto("/en/login");
  await page.getByLabel("Email").fill(email);
  await page.locator("#login-password").fill("first-pass-2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("#login-error")).toHaveText("Email or password is incorrect.");
  await page.locator("#login-password").fill("second-pass-2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/en$/);
});

test("a requested link replaces the previous one; a made-up token is refused", async ({ page, request }) => {
  const email = unique("relink");
  await signUp(page, email, "relink-pass-2026");
  await page.context().clearCookies();

  for (let i = 0; i < 2; i++) {
    await page.goto("/fr/forgot-password");
    await page.getByLabel("E-mail").fill(email);
    await page.getByRole("button", { name: "Envoyer le lien" }).click();
    await expect(page.getByRole("status")).toBeVisible();
  }
  const mails: { subject: string; text: string }[] = await (
    await request.get(`/api/dev/mail?format=json&to=${encodeURIComponent(email)}`)
  ).json();
  const links = mails
    .filter((m) => m.subject.startsWith("Réinitialisez"))
    .map((m) => new URL(m.text.match(/https?:\/\/\S+/)![0]))
    .map((u) => u.pathname + u.search);
  expect(links).toHaveLength(2);
  // Newest first: the older link stopped working when the newer one was issued.
  await page.goto(links[1]!);
  await expect(page.getByText("Ce lien a expiré ou a déjà été utilisé.", { exact: false })).toBeVisible();
  await page.goto(links[0]!);
  await expect(page.locator("#reset-password")).toBeVisible();

  await page.goto("/ar/reset-password?token=not-a-real-token");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("link", { name: "طلب رابط جديد" })).toBeVisible();
});

test("signed-in users skip the guest pages", async ({ page }) => {
  await signUp(page, unique("guest"), "guest-pass-2026");
  for (const path of ["login", "signup", "forgot-password"]) {
    await page.goto(`/en/${path}`);
    await expect(page).toHaveURL(/\/en$/);
  }
});
