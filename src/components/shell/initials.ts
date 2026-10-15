/** "Apex Tech" → "AT"; "Librairie El Amel" → "LE". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Stable avatar tint 1–5 (`data-hue`) so an entity keeps its colour everywhere. */
export function hueOf(key: string): number {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 5) + 1;
}
