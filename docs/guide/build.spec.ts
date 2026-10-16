import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { test } from "@playwright/test";
import { AR, EN, type Block, type Guide } from "./content";
import { withUpdates } from "./updates";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function img(guide: Guide, name: string) {
  const file = `docs/guide/shots/${guide.lang}/${name}.png`;
  if (!existsSync(file)) return "";
  return `data:image/png;base64,${readFileSync(file).toString("base64")}`;
}

function block(guide: Guide, b: Block): string {
  if ("h" in b) return `<h3>${esc(b.h)}</h3>`;
  if ("p" in b) return `<p>${esc(b.p)}</p>`;
  if ("steps" in b) return `<ol class="steps">${b.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>`;
  if ("bullets" in b) return `<ul>${b.bullets.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`;
  if ("tip" in b) return `<aside class="note tip"><b>${guide.lang === "ar" ? "نصيحة" : "Tip"}</b>${esc(b.tip)}</aside>`;
  if ("warn" in b) return `<aside class="note warn"><b>${guide.lang === "ar" ? "انتبه" : "Good to know"}</b>${esc(b.warn)}</aside>`;
  if ("keys" in b) {
    const head = guide.lang === "ar" ? ["الاختصار", "ما يفعله"] : ["Shortcut", "What it does"];
    return `<table class="keys"><thead><tr><th>${head[0]}</th><th>${head[1]}</th></tr></thead><tbody>${b.keys
      .map(([k, v]) => `<tr><td><kbd dir="ltr">${esc(k)}</kbd></td><td>${esc(v)}</td></tr>`)
      .join("")}</tbody></table>`;
  }
  const src = img(guide, b.shot);
  return src ? `<figure><img src="${src}" alt=""><figcaption>${esc(b.caption)}</figcaption></figure>` : "";
}

function html(guide: Guide) {
  // Chapters are numbered here, so content.ts can add or reorder them freely.
  const title = (t: string, i: number) => `${i + 1}. ${t.replace(/^\d+\.\s*/, "")}`;
  const toc = guide.sections.map((s, i) => `<li>${esc(title(s.title, i))}</li>`).join("");
  const body = guide.sections
    .map((s, i) => `<section><h2 id="${s.id}">${esc(title(s.title, i))}</h2>${s.blocks.map((b) => block(guide, b)).join("\n")}</section>`)
    .join("\n");
  return `<!doctype html><html lang="${guide.lang}" dir="${guide.dir}"><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 18mm 16mm 20mm; }
  :root { --text:#13303a; --muted:#4b6670; --accent:#1f7a6d; --sunken:#f3f7f8; --border:#d9e4e7; --warn:#fff6e0; --tip:#e7f5f2; }
  body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; color: var(--text); font-size: 11pt; line-height: 1.6; margin: 0; }
  .cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
  .cover .brand { display:flex; align-items:center; gap:10px; font-weight:600; font-size:14pt; margin-bottom: 18mm; }
  .cover .logo { width: 40px; height: 40px; border-radius: 10px; background: #dff1ed; color: var(--accent); display:grid; place-items:center; font-weight:700; }
  .cover h1 { font-size: 30pt; line-height: 1.2; margin: 0 0 6mm; }
  .cover p { font-size: 14pt; color: var(--muted); max-width: 140mm; margin: 0 0 12mm; }
  .cover .toc { columns: 2; column-gap: 10mm; list-style: none; padding: 0; color: var(--muted); }
  .cover .toc-title { font-weight: 600; color: var(--text); margin-bottom: 2mm; }
  section { page-break-before: always; }
  h2 { font-size: 18pt; color: var(--accent); border-bottom: 2px solid var(--border); padding-bottom: 2mm; margin: 0 0 4mm; }
  h3 { font-size: 12.5pt; margin: 6mm 0 2mm; }
  p { margin: 0 0 3mm; }
  ul, ol { margin: 0 0 4mm; padding-inline-start: 6mm; }
  li { margin-bottom: 1.5mm; }
  ol.steps { counter-reset: s; list-style: none; padding-inline-start: 0; }
  ol.steps li { counter-increment: s; position: relative; padding-inline-start: 9mm; }
  ol.steps li::before { content: counter(s); position: absolute; inset-inline-start: 0; top: 0.5mm; width: 6mm; height: 6mm; border-radius: 50%;
    background: var(--accent); color: #fff; font-size: 9pt; font-weight: 700; display: grid; place-items: center; }
  figure { margin: 3mm 0 5mm; page-break-inside: avoid; }
  figure img { display: block; max-width: 100%; max-height: 120mm; margin-inline: auto; border: 1px solid var(--border); border-radius: 6px; }
  figcaption { font-size: 9.5pt; color: var(--muted); margin-top: 1.5mm; }
  .note { border-radius: 6px; padding: 3mm 4mm; margin: 3mm 0 4mm; page-break-inside: avoid; }
  .note b { display: block; margin-bottom: 1mm; }
  .tip { background: var(--tip); } .warn { background: var(--warn); }
  table.keys { width: 100%; border-collapse: collapse; margin-top: 4mm; }
  table.keys th, table.keys td { border-bottom: 1px solid var(--border); padding: 2mm; text-align: start; vertical-align: top; }
  kbd { font-family: Consolas, monospace; background: var(--sunken); border: 1px solid var(--border); border-radius: 4px; padding: 0.5mm 2mm; white-space: nowrap; }
  </style></head><body>
  <div class="cover">
    <div class="brand"><span class="logo">A</span>Apex CRM</div>
    <h1>${esc(guide.title)}</h1>
    <p>${esc(guide.subtitle)}</p>
    <div class="toc-title">${esc(guide.tocTitle)}</div>
    <ul class="toc">${toc}</ul>
  </div>
  ${body}
  </body></html>`;
}

for (const guide of [EN, AR].map(withUpdates)) {
  test(`build PDF ${guide.lang}`, async ({ page }) => {
    const source = html(guide);
    // GUIDE_HTML=<dir> also keeps the HTML, to preview the layout without a PDF reader.
    if (process.env.GUIDE_HTML) writeFileSync(`${process.env.GUIDE_HTML}/guide-${guide.lang}.html`, source);
    await page.setContent(source, { waitUntil: "load" });
    await page.pdf({
      path: `docs/Apex-CRM-Guide-${guide.lang.toUpperCase()}.pdf`,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;font-size:8pt;color:#4b6670;text-align:center;font-family:Segoe UI,Tahoma,sans-serif">Apex CRM · <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
      margin: { top: "18mm", bottom: "20mm", left: "16mm", right: "16mm" },
    });
  });
}
