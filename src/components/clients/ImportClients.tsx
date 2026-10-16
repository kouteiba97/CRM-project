"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AuthNotice } from "@/components/auth/AuthCard";
import { autoMap, IMPORT_FIELDS, parseCsv, rowToClient, type ImportField, type Mapping } from "@/lib/import";
import { importClients, type ImportResult } from "./import-actions";

const MAX_BYTES = 5 * 1024 * 1024;

/** `/clients/import`: pick a CSV or Excel file, check the columns, import. */
export function ImportClients() {
  const t = useTranslations("clients.import");
  const [headers, setHeaders] = useState<string[] | null>(null);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  const read = async (file: File) => {
    setError(null);
    setResult(null);
    if (file.size > MAX_BYTES) return setError(t("tooBig"));
    try {
      let table: string[][];
      if (/\.xlsx$/i.test(file.name)) {
        // First sheet only; dates become YYYY-MM-DD, everything else plain text.
        const { readSheet } = await import("read-excel-file/browser");
        const sheet = await readSheet(file);
        table = sheet.map((r) =>
          r.map((c: unknown) => (c === null || c === undefined ? "" : c instanceof Date ? c.toISOString().slice(0, 10) : String(c))),
        );
      } else {
        table = parseCsv(await file.text());
      }
      if (table.length < 2) return setError(t("empty"));
      setFileName(file.name);
      setHeaders(table[0]!);
      setRows(table.slice(1));
      setMapping(autoMap(table[0]!));
    } catch {
      setError(t("unreadable"));
    }
  };

  const checked = rows.map((r) => rowToClient(r, mapping));
  const valid = checked.filter((c) => c.ok).length;

  if (result) {
    return (
      <div className="ax-card ax-card-body settings-section">
        <AuthNotice tone="success">{t("done", { created: result.created })}</AuthNotice>
        {result.skipped.length > 0 && (
          <>
            <p>{t("skippedTitle", { count: result.skipped.length })}</p>
            <ul className="import-skipped">
              {result.skipped.slice(0, 50).map((s) => (
                <li key={s.row}>{t("skippedRow", { row: s.row + 1, reason: t(`reason_${s.reason}`) })}</li>
              ))}
            </ul>
          </>
        )}
        <div className="settings-seg">
          <Link className="ax-btn ax-btn-primary ax-btn-sm" href="/clients">
            {t("seeClients")}
          </Link>
          <button type="button" className="ax-btn ax-btn-tertiary ax-btn-sm" onClick={() => (setResult(null), setHeaders(null))}>
            {t("another")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-stack">
      <section className="ax-card ax-card-body settings-section" aria-labelledby="imp-file">
        <h2 id="imp-file" className="rail-title">
          {t("step1")}
        </h2>
        <p className="ax-help">{t("fileHelp")}</p>
        <div className="settings-seg">
          <label className="ax-btn ax-btn-secondary ax-btn-sm">
            <FileSpreadsheet className="ax-icon" aria-hidden />
            {fileName || t("choose")}
            <input
              type="file"
              className="sr-only"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => e.target.files?.[0] && void read(e.target.files[0])}
            />
          </label>
          <a className="ax-btn ax-btn-tertiary ax-btn-sm" href="/templates/clients-import.csv" download>
            <Download className="ax-icon" aria-hidden />
            {t("template")}
          </a>
        </div>
        {error && <AuthNotice tone="error">{error}</AuthNotice>}
      </section>

      {headers && (
        <section className="ax-card ax-card-body settings-section" aria-labelledby="imp-map">
          <h2 id="imp-map" className="rail-title">
            {t("step2")}
          </h2>
          <p className="ax-help">{t("mapHelp")}</p>
          <div className="import-map">
            {IMPORT_FIELDS.map((field: ImportField) => (
              <div key={field} className="ax-field">
                <label className="ax-label" htmlFor={`map-${field}`}>
                  {t(`field_${field}`)}
                  {field === "name" && (
                    <span className="ax-req" aria-hidden>
                      *
                    </span>
                  )}
                </label>
                <select
                  id={`map-${field}`}
                  className="ax-input"
                  value={mapping[field] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMapping((m) => {
                      const next = { ...m };
                      if (v === "") delete next[field];
                      else next[field] = Number(v);
                      return next;
                    });
                  }}
                >
                  <option value="">{t("ignore")}</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || t("column", { n: i + 1 })}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <h3 className="rail-title">{t("preview")}</h3>
          <div className="table-scroll">
            <table className="ax-table import-preview">
              <caption className="sr-only">{t("preview")}</caption>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">{t("field_name")}</th>
                  <th scope="col">{t("field_email")}</th>
                  <th scope="col">{t("field_city")}</th>
                  <th scope="col">{t("check")}</th>
                </tr>
              </thead>
              <tbody>
                {checked.slice(0, 8).map((c, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{c.ok ? c.client.name : (rows[i]?.[mapping.name ?? -1] ?? "")}</td>
                    <td dir="ltr">{c.ok ? (c.client.email ?? "") : ""}</td>
                    <td>{c.ok ? (c.client.city ?? "") : ""}</td>
                    <td>{c.ok ? t("ok") : t(`reason_${c.reason}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ax-help">{t("summary", { valid, total: rows.length })}</p>
          <div className="settings-actions">
            <button
              type="button"
              className="ax-btn ax-btn-primary ax-btn-sm"
              disabled={pending || valid === 0 || mapping.name === undefined}
              aria-busy={pending}
              onClick={() =>
                start(async () => {
                  try {
                    setResult(await importClients(rows, mapping));
                  } catch {
                    setError(t("failed"));
                  }
                })
              }
            >
              {pending && <span className="ax-spinner" aria-hidden />}
              {t("import", { count: valid })}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export function ImportBack() {
  const t = useTranslations("clients.import");
  return (
    <nav aria-label={t("back")} className="profile-back">
      <Link className="ax-link" href="/clients">
        <ArrowLeft className="ax-icon ax-icon-sm ax-flip" aria-hidden />
        {t("back")}
      </Link>
    </nav>
  );
}
