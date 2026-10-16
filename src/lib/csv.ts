/**
 * CSV for spreadsheets. Cells that start with = + - @ (or a tab / carriage return) are prefixed
 * with an apostrophe so Excel and Sheets show them as text instead of running them as formulas
 * (CSV injection).
 */
export function csvCell(value: string | number | null | undefined) {
  let v = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(v) && !/^-?\d+([.,]\d+)?$/.test(v)) v = `'${v}`;
  return `"${v.replace(/"/g, '""')}"`;
}

/** Rows to CSV text with a BOM, so Arabic and accents open correctly in Excel. */
export function toCsv(rows: (string | number | null | undefined)[][]) {
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
