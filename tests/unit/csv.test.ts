import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";

describe("csv", () => {
  it("quotes and escapes", () => {
    expect(csvCell('Say "hi"')).toBe('"Say ""hi"""');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(42)).toBe('"42"');
  });

  it("neutralises formulas but keeps negative numbers", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("+33 1 23")).toBe('"\'+33 1 23"');
    expect(csvCell("@SUM(A1)")).toBe('"\'@SUM(A1)"');
    expect(csvCell("-12.5")).toBe('"-12.5"');
    expect(csvCell("-cmd")).toBe('"\'-cmd"');
  });

  it("starts with a BOM and uses CRLF", () => {
    expect(toCsv([["a", "b"], ["ج", "é"]])).toBe('﻿"a","b"\r\n"ج","é"');
  });
});
