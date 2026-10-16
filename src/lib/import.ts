/**
 * Client import (pure, shared by the browser preview and the server): reading CSV, guessing
 * which column is which from its header (English, French, Arabic), and turning a row into a
 * client. Excel files are read in the browser into the same rows-of-strings shape.
 */
export const IMPORT_FIELDS = [
  "name",
  "email",
  "phone",
  "website",
  "city",
  "country",
  "status",
  "tags",
  "notes",
  "contactFirstName",
  "contactLastName",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export type Mapping = Partial<Record<ImportField, number>>;

const SYNONYMS: Record<ImportField, string[]> = {
  name: ["name", "company", "client", "organisation", "organization", "nom", "société", "societe", "entreprise", "raison sociale", "الاسم", "الشركة", "العميل"],
  email: ["email", "e-mail", "mail", "courriel", "adresse e-mail", "البريد", "البريد الإلكتروني"],
  phone: ["phone", "telephone", "téléphone", "tel", "tél", "mobile", "portable", "الهاتف", "رقم الهاتف"],
  website: ["website", "web", "site", "site web", "url", "الموقع"],
  city: ["city", "ville", "town", "المدينة"],
  country: ["country", "pays", "البلد", "الدولة"],
  status: ["status", "statut", "état", "etat", "الحالة"],
  tags: ["tags", "tag", "labels", "étiquettes", "etiquettes", "الوسوم"],
  notes: ["notes", "note", "comment", "comments", "commentaire", "remarques", "ملاحظات"],
  contactFirstName: ["first name", "firstname", "contact first name", "prénom", "prenom", "الاسم الأول"],
  contactLastName: ["last name", "lastname", "surname", "contact last name", "nom de famille", "اسم العائلة"],
};

const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ");

/** Best guess of which column holds each field (each column used at most once). */
export function autoMap(headers: string[]): Mapping {
  const used = new Set<number>();
  const map: Mapping = {};
  // Most specific fields first, so "contact first name" is not taken by "name".
  const order: ImportField[] = ["contactFirstName", "contactLastName", "email", "phone", "website", "city", "country", "status", "tags", "notes", "name"];
  for (const field of order) {
    const names = SYNONYMS[field].map(norm);
    const i = headers.findIndex((h, idx) => !used.has(idx) && names.includes(norm(h)));
    if (i >= 0) {
      map[field] = i;
      used.add(i);
    }
  }
  return map;
}

/** RFC 4180 CSV with "," or ";" (whichever the header line uses more), quotes and CRLF. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n/) === -1 ? undefined : src.search(/\r?\n/));
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export type ImportedClient = {
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  country: string | null;
  status: "active" | "prospect" | "inactive";
  tags: string[];
  notes: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
};

const STATUS: Record<string, ImportedClient["status"]> = {
  active: "active", actif: "active", "نشط": "active",
  prospect: "prospect", "عميل محتمل": "prospect", lead: "prospect",
  inactive: "inactive", inactif: "inactive", "غير نشط": "inactive",
};

/** One row → a client, or the reason it is skipped. Values are trimmed and length-limited. */
export function rowToClient(row: string[], map: Mapping): { ok: true; client: ImportedClient } | { ok: false; reason: "no_name" | "bad_email" } {
  const get = (f: ImportField, max = 200) => {
    const i = map[f];
    const v = i === undefined ? "" : (row[i] ?? "").trim();
    return v ? v.slice(0, max) : null;
  };
  const name = get("name");
  if (!name) return { ok: false, reason: "no_name" };
  const email = get("email", 254)?.toLowerCase() ?? null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, reason: "bad_email" };
  const country = get("country", 60);
  return {
    ok: true,
    client: {
      name,
      email,
      phone: get("phone", 40),
      website: get("website", 200),
      city: get("city", 100),
      country: country && /^[a-z]{2}$/i.test(country) ? country.toUpperCase() : null,
      status: STATUS[(get("status", 40) ?? "").toLowerCase()] ?? "active",
      tags: (get("tags", 300) ?? "")
        .split(/[,;|]/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 10),
      notes: get("notes", 2000),
      contactFirstName: get("contactFirstName", 100),
      contactLastName: get("contactLastName", 100),
    },
  };
}
