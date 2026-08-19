// ─────────────────────────────────────────────────────────────────────────────
// The water log, as a spreadsheet.
//
// This was built inline in LogTab: parameter labels joined with commas, raw
// stored values, and the whole thing handed to Share.share as a message body.
// Three things wrong with that, in increasing order of how much they matter.
//
//   1. Temperature came out in °F for everybody, because the row used the
//      stored value and the parameter's own label. A keeper reading °C
//      everywhere else in the app exported a file that disagreed with it.
//
//   2. Nothing was escaped. Not a problem today — every label is fixed and
//      every value numeric — but a CSV builder that ignores quoting is one
//      new column away from producing a file that opens misaligned.
//
//   3. It was a message body. Messages truncates, Notes chokes, and the one
//      thing nobody can do with it is open it in a spreadsheet, which is the
//      entire point. Tolerable at sixty water tests; the cap is now a
//      thousand, which is about 60 KB of text.
// ─────────────────────────────────────────────────────────────────────────────

import { localiseParam, tempToDisplay } from "./units";

// RFC 4180: quote anything containing a comma, a quote or a newline, and double
// the quotes inside it.
export function csvCell(value) {
  if (value == null) return "";
  const s = String(value);
  if (!/[",\n\r]/.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

export const csvRow = (cells) => (Array.isArray(cells) ? cells : []).map(csvCell).join(",");

// `params` is the active parameter list for the tank's water type; `tests` are
// the stored readings, newest first, exactly as the app holds them.
export function buildWaterLogCsv(params = [], tests = []) {
  const cols = (Array.isArray(params) ? params : []).map(localiseParam);
  const header = csvRow(["Date", ...cols.map((p) => (p.unit ? `${p.label} (${p.unit})` : p.label))]);

  const rows = (Array.isArray(tests) ? tests : [])
    .filter((t) => t && typeof t === "object")
    .map((t) => {
      const values = t.values && typeof t.values === "object" ? t.values : {};
      return csvRow([
        t.date,
        ...cols.map((p) => {
          const v = values[p.key];
          if (v == null || v === "") return "";
          // Stored in °F; shown in whichever unit the keeper reads.
          return p.key === "temp" ? tempToDisplay(v) : v;
        }),
      ]);
    });

  return [header, ...rows].join("\n");
}
