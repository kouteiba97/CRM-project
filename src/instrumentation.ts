import type { Instrumentation } from "next";

/**
 * Runs once per server start. In production, refuses to start without the settings the app
 * cannot run safely without, and says which ones are missing (visible in the Vercel logs).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  // `next build` also loads this file; the settings are only required to serve requests.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  // Preview deployments have changing addresses: APP_URL is only required for the real site.
  const live = process.env.VERCEL_ENV ? process.env.VERCEL_ENV === "production" : true;
  const required = ["DATABASE_URL", "AUTH_SECRET", ...(live ? ["APP_URL"] : [])];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}. See DEPLOY.md.`);
  if ((process.env.AUTH_SECRET ?? "").length < 32) throw new Error("AUTH_SECRET must be at least 32 characters.");
  for (const k of ["SMTP_HOST", "CRON_SECRET", "ENCRYPTION_KEY"]) {
    if (!process.env[k]) console.warn(`[config] ${k} is not set — see DEPLOY.md.`);
  }
}

/**
 * Server errors: always logged (Vercel › Logs); also posted to ALERT_WEBHOOK_URL (Slack,
 * Discord, Teams…) and/or emailed to ALERT_EMAIL when set. Request details are reduced to the
 * path so no personal data or tokens leave the app.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const message = err instanceof Error ? err.message : String(err);
  const digest = typeof err === "object" && err && "digest" in err ? String(err.digest) : undefined;
  const path = request.path.split("?")[0];
  const line = `[error] ${request.method} ${path} (${context.routeType}) ${digest ?? ""}: ${message}`;
  console.error(line);
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const tasks: Promise<unknown>[] = [];
  if (process.env.ALERT_WEBHOOK_URL) {
    tasks.push(
      fetch(process.env.ALERT_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: `Apex CRM ${line}`, content: `Apex CRM ${line}` }),
      }),
    );
  }
  if (process.env.ALERT_EMAIL && process.env.SMTP_HOST) {
    const { sendMail } = await import("@/lib/mail/send");
    tasks.push(sendMail({ to: process.env.ALERT_EMAIL, subject: "Apex CRM: server error", text: line, html: `<pre>${line.replace(/</g, "&lt;")}</pre>` }));
  }
  await Promise.allSettled(tasks);
};
