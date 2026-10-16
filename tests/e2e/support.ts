import AxeBuilder from "@axe-core/playwright";
import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const unique = (tag: string) => `${tag}.${Date.now()}${Math.floor(Math.random() * 1e4)}@example.test`;

export async function expectAccessible(page: Page) {
  const axe = await new AxeBuilder({ page }).analyze();
  const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
}

/** The newest link the app emailed to `to` (dev outbox, used while SMTP is not set up). */
export async function lastLink(request: APIRequestContext, to: string, subject: RegExp) {
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

export async function signUp(page: Page, email: string, password: string, name = "Lina Test") {
  await page.goto("/en/signup");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.locator("#signup-password").fill(password);
  await page.getByLabel("Company name").fill("Lina Studio");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/en$/);
}

