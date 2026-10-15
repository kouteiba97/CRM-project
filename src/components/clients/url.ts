/** Filter/sort/page state lives in the URL. Patch it; changing a filter goes back to page 1. */
export function patchQuery(
  current: URLSearchParams | string,
  patch: Record<string, string | null>,
  { keepPage = false }: { keepPage?: boolean } = {},
): string {
  const next = new URLSearchParams(current.toString());
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === "") next.delete(k);
    else next.set(k, v);
  }
  if (!keepPage && !("page" in patch)) next.delete("page");
  next.delete("new");
  const s = next.toString();
  return s ? `?${s}` : "";
}

export const FILTER_KEYS = ["q", "status", "tag", "owner", "overdue"] as const;

/** Table density is remembered per user (DS › Layout › Density). */
export const DENSITY_COOKIE = "clients_density";
