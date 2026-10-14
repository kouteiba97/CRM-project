/**
 * design-system/tokens.json → src/styles/tokens.css
 * The DS artifact is the single source of truth; this file is generated, never edited by hand.
 */
import { readFileSync, writeFileSync } from "node:fs";

type Themed = string | Record<string, string>;
type Token = { name: string; value: Themed };
type Family = { tokens: Token[] };
type TypeStyle = {
  name: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: number | string;
  letterSpacing?: string;
};
type Tokens = {
  name: string;
  color: { themes: { id: string }[]; tokens: Token[] };
  shadow: Family;
  type: { families: Record<string, string>; groups: { family: string; styles: TypeStyle[] }[] };
  [family: string]: unknown;
};

const SRC = "design-system/tokens.json";
const OUT = "src/styles/tokens.css";
const tokens = JSON.parse(readFileSync(SRC, "utf8")) as Tokens;
const themes = tokens.color.themes.map((t) => t.id);
const primary = themes[0]!;

const resolve = (v: string) => v.replace(/^\{([A-Za-z0-9_.-]+)\}$/, "var(--$1)");
const pick = (v: Themed, theme: string) =>
  resolve(typeof v === "string" ? v : (v[theme] ?? v[primary] ?? ""));

const themed = [...tokens.color.tokens, ...tokens.shadow.tokens];
const scalarFamilies = ["spacing", "radius", "size", "layout", "icon", "breakpoint", "zIndex"];

const lines: string[] = [`/* ${tokens.name} — generated from tokens.json by scripts/build-tokens.ts. Do not edit. */`];

for (const theme of themes) {
  const selector = theme === primary ? `:root, [data-theme="${theme}"]` : `[data-theme="${theme}"]`;
  lines.push(`${selector} {`);
  if (theme !== primary) lines.push(`  color-scheme: ${theme};`);
  else lines.push(`  color-scheme: ${primary};`);
  for (const t of themed) lines.push(`  --${t.name}: ${pick(t.value, theme)};`);
  lines.push("}");
}

lines.push(":root {");
for (const fam of scalarFamilies) {
  for (const t of (tokens[fam] as Family).tokens) lines.push(`  --${t.name}: ${pick(t.value, primary)};`);
}
for (const [k, v] of Object.entries(tokens.type.families)) lines.push(`  --font-${k}: ${v};`);
lines.push("}");

// Type styles as utility classes: .t-page-title, .t-body, .t-money …
for (const group of tokens.type.groups) {
  for (const s of group.styles) {
    const decl = [
      `font-family: var(--font-${group.family})`,
      `font-size: ${s.fontSize}`,
      `line-height: ${s.lineHeight}`,
      `font-weight: ${s.fontWeight}`,
    ];
    if (s.letterSpacing) decl.push(`letter-spacing: ${s.letterSpacing}`);
    lines.push(`.t-${s.name} { ${decl.join("; ")}; }`);
  }
}

writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`tokens.css: ${themed.length} themed tokens × ${themes.length} themes → ${OUT}`);
