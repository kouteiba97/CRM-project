import { describe, expect, it } from "vitest";
import { autoMap, parseCsv, rowToClient } from "@/lib/import";

describe("parseCsv", () => {
  it("reads quotes, escaped quotes, CRLF and a BOM", () => {
    const rows = parseCsv('﻿Name,Notes\r\n"Acme, Inc","Said ""hi"""\r\nBeta,\r\n');
    expect(rows).toEqual([
      ["Name", "Notes"],
      ["Acme, Inc", 'Said "hi"'],
      ["Beta", ""],
    ]);
  });

  it("detects semicolons (French Excel) and skips empty lines", () => {
    expect(parseCsv("Nom;Ville\n\nDar El Ilm;Alger\n")).toEqual([
      ["Nom", "Ville"],
      ["Dar El Ilm", "Alger"],
    ]);
  });

  it("keeps line breaks inside quoted cells", () => {
    expect(parseCsv('a,b\n"line 1\nline 2",x')[1]).toEqual(["line 1\nline 2", "x"]);
  });
});

describe("autoMap", () => {
  it("maps English, French and Arabic headers", () => {
    expect(autoMap(["Company", "E-mail", "Phone", "City"])).toEqual({ name: 0, email: 1, phone: 2, city: 3 });
    expect(autoMap(["Société", "Courriel", "Téléphone", "Prénom", "Nom de famille"])).toEqual({
      name: 0,
      email: 1,
      phone: 2,
      contactFirstName: 3,
      contactLastName: 4,
    });
    expect(autoMap(["الاسم", "البريد الإلكتروني", "المدينة"])).toEqual({ name: 0, email: 1, city: 2 });
  });

  it("does not let 'name' steal 'first name'", () => {
    expect(autoMap(["First name", "Name"])).toEqual({ contactFirstName: 0, name: 1 });
  });
});

describe("rowToClient", () => {
  const map = { name: 0, email: 1, country: 2, status: 3, tags: 4 };
  it("normalises a row", () => {
    const r = rowToClient(["  Acme  ", "Hello@Acme.COM", "dz", "Prospect", "vip; agency"], map);
    expect(r).toEqual({
      ok: true,
      client: expect.objectContaining({ name: "Acme", email: "hello@acme.com", country: "DZ", status: "prospect", tags: ["vip", "agency"] }),
    });
  });
  it("skips rows without a name or with a broken email", () => {
    expect(rowToClient(["", "a@b.co"], map)).toEqual({ ok: false, reason: "no_name" });
    expect(rowToClient(["Acme", "not-an-email"], map)).toEqual({ ok: false, reason: "bad_email" });
  });
  it("drops countries that are not 2-letter codes", () => {
    const r = rowToClient(["Acme", "", "Algeria"], map);
    expect(r.ok && r.client.country).toBeNull();
  });
});
