export const THEME_COOKIE = "theme";
export const SIDEBAR_COOKIE = "sidebar";
export type ThemePref = "light" | "dark" | "system";

/** Light is the default theme; dark is opt-in; "system" follows prefers-color-scheme. */
export function parseTheme(value: string | undefined): ThemePref {
  return value === "dark" || value === "system" ? value : "light";
}
