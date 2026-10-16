import { describe, expect, it } from "vitest";
import { localeOf, safeCallback } from "@/lib/auth-redirect";

describe("safeCallback", () => {
  it("keeps same-site paths inside a locale", () => {
    expect(safeCallback("/en/clients", "en")).toBe("/en/clients");
    expect(safeCallback("/ar/invoices?status=overdue", "fr")).toBe("/ar/invoices?status=overdue");
    expect(safeCallback("/fr", "fr")).toBe("/fr");
  });

  it("falls back home for anything off-site or odd", () => {
    for (const raw of [
      undefined,
      null,
      42,
      "",
      "https://evil.example/x",
      "//evil.example/x",
      "/\\evil.example",
      "/de/clients",
      "/api/auth/signout",
      "clients",
    ]) {
      expect(safeCallback(raw, "en")).toBe("/en");
    }
  });

  it("never loops back to the login page", () => {
    expect(safeCallback("/fr/login", "fr")).toBe("/fr");
    expect(safeCallback("/fr/login?callbackUrl=%2Ffr", "fr")).toBe("/fr");
    expect(safeCallback("/fr/loginx", "fr")).toBe("/fr/loginx");
  });
});

describe("localeOf", () => {
  it("reads the locale segment", () => {
    expect(localeOf("/ar/clients")).toBe("ar");
    expect(localeOf("/en")).toBe("en");
    expect(localeOf("/clients")).toBeNull();
    expect(localeOf("/")).toBeNull();
  });
});
