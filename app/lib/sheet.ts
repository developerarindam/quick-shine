"use client";

// Reading spreadsheets in the browser for the importer.

export type Cell = string | number | boolean | Date | null;
export type Grid = Cell[][];

/** All sheets of an .xlsx, or the single table of a .csv / pasted text. */
export async function readFile(file: File): Promise<{ name: string; rows: Grid }[]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    const sheets = await readXlsxFile(file);
    return sheets.map((s) => ({ name: s.sheet, rows: s.data as Grid }));
  }
  if (/\.xls$/i.test(file.name)) {
    throw new Error("Old .xls files aren't supported — open it and save as .xlsx (or CSV), then upload again.");
  }
  return [{ name: file.name, rows: parseDelimited(await file.text()) }];
}

/** CSV or tab-separated (what you get when copying cells from Excel / Google Sheets). */
export function parseDelimited(text: string): Grid {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const sample = lines.slice(0, 5).join("\n");
  const delim = (sample.match(/\t/g)?.length || 0) >= (sample.match(/,/g)?.length || 0) ? "\t" : ",";
  const out: Grid = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === delim) {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    out.push(cells.map((c) => c.trim()));
  }
  return out;
}

export const text = (c: Cell) => (c === null || c === undefined ? "" : c instanceof Date ? c.toISOString() : String(c).trim());

/** The header row: the first row with a date-like and a vehicle-like column. */
export function findHeaderRow(rows: Grid) {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const cells = rows[i].map((c) => text(c).toLowerCase());
    if (cells.some((c) => /date/.test(c)) && cells.some((c) => /vehicle|bike|reg|number|no\b/.test(c))) return i;
  }
  return 0;
}

export type FieldKey = "date" | "bikeNumber" | "services" | "cash" | "online" | "collectedBy" | "doneBy" | "remarks";

export const FIELDS: { key: FieldKey; label: string; required?: boolean; match: RegExp }[] = [
  { key: "date", label: "Date", required: true, match: /^date|day/ },
  { key: "bikeNumber", label: "Vehicle number", required: true, match: /vehicle|bike|reg|number|plate/ },
  { key: "services", label: "Services", required: true, match: /service|work|package/ },
  { key: "cash", label: "Cash amount", match: /^cash$|cash amount|cash \(|^cash/ },
  { key: "online", label: "Online amount", match: /online|upi|gpay|phonepe|paytm/ },
  { key: "collectedBy", label: "Collected by", match: /collect|received|payment by/ },
  { key: "doneBy", label: "Done by", match: /done|staff|worker|technician|by$/ },
  { key: "remarks", label: "Remarks", match: /remark|note|comment/ },
];

/** Best-guess column for each field from the header names. */
export function guessColumns(headers: string[]): Partial<Record<FieldKey, number>> {
  const out: Partial<Record<FieldKey, number>> = {};
  const used = new Set<number>();
  for (const f of FIELDS) {
    const idx = headers.findIndex((h, i) => !used.has(i) && f.match.test(h.toLowerCase().trim()));
    if (idx >= 0) {
      out[f.key] = idx;
      used.add(idx);
    }
  }
  return out;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => (y > 1999 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null);
const fullYear = (y: number) => (y < 100 ? 2000 + y : y);

/** yyyy-mm-dd from a sheet cell. Day comes before month (Indian style). */
export function parseDate(c: Cell): string | null {
  if (c instanceof Date) return ymd(c.getFullYear(), c.getMonth() + 1, c.getDate());
  if (typeof c === "number" && c > 30000 && c < 80000) {
    // Excel serial day number
    const d = new Date(Math.round((c - 25569) * 86400000));
    return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = text(c).toLowerCase();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-\s/.]([a-z]{3,})[-\s/.,]*(\d{2,4})$/); // 2-Sep-26, 2 Sep 2026
  if (m) {
    const mi = MONTHS.indexOf(m[2].slice(0, 3));
    return mi >= 0 ? ymd(fullYear(+m[3]), mi + 1, +m[1]) : null;
  }
  m = s.match(/^([a-z]{3,})[\s-](\d{1,2}),?[\s-](\d{2,4})$/); // Sep 2, 2026
  if (m) {
    const mi = MONTHS.indexOf(m[1].slice(0, 3));
    return mi >= 0 ? ymd(fullYear(+m[3]), mi + 1, +m[2]) : null;
  }
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); // 02/09/2026 (day first)
  if (m) return ymd(fullYear(+m[3]), +m[2], +m[1]);
  return null;
}

/** Amount from a cell: "₹1,200" → 1200, blank / text → 0. */
export function parseAmount(c: Cell): number {
  if (typeof c === "number") return c;
  const n = Number(text(c).replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function splitCodes(c: Cell): string[] {
  return text(c)
    .toUpperCase()
    .split(/[+,/&]|\band\b/)
    .map((x) => x.replace(/[^A-Z0-9]/g, ""))
    .filter(Boolean);
}

/** "Chain Clean & Lube" → "CCL" */
export function initials(name: string) {
  return name
    .split(/[\s&+\-]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** Small edit distance for matching names like "Chanan" → "Chandan". */
export function distance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
