import { NextResponse, type NextRequest } from "next/server";
import { devOutbox, mailConfigured } from "@/lib/mail/send";

/**
 * Development outbox: the emails the app would have sent while SMTP is not configured.
 * `?to=` filters by recipient; `?format=json` is what the e2e tests read. Gone in production.
 */
export function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production" || mailConfigured()) {
    return new NextResponse("Not found", { status: 404 });
  }
  const to = req.nextUrl.searchParams.get("to")?.toLowerCase();
  const mails = devOutbox().filter((m) => !to || m.to.toLowerCase() === to);
  if (req.nextUrl.searchParams.get("format") === "json") return NextResponse.json(mails);

  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const rows = mails
    .map(
      (m) => `<details${m === mails[0] ? " open" : ""}><summary><b>${esc(m.subject)}</b> → ${esc(m.to)}
        <small>${esc(new Date(m.at).toLocaleString("en-GB"))}</small></summary>
        <iframe title="${esc(m.subject)}" srcdoc="${esc(m.html)}"></iframe></details>`,
    )
    .join("");
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Dev mailbox · Apex CRM</title>
    <meta name="viewport" content="width=device-width">
    <style>body{font-family:system-ui,sans-serif;margin:24px;color:#13303a;background:#f3f7f8}
    details{background:#fff;border:1px solid #d9e4e7;border-radius:8px;margin:0 0 12px;padding:12px}
    summary{cursor:pointer;display:flex;gap:8px;flex-wrap:wrap;align-items:baseline}
    iframe{width:100%;height:520px;border:0;margin-top:12px}</style></head>
    <body><h1>Dev mailbox</h1><p>Emails the app sent while SMTP is not set up (newest first, kept until the dev server restarts).</p>
    ${rows || "<p>No emails yet.</p>"}</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
