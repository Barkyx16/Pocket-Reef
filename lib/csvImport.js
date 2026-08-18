// ─────────────────────────────────────────────────────────────────────────────
// Bringing an existing log in.
//
// Import accepts a Pocket Reef JSON export and nothing else, which serves
// exactly one person: somebody who already used Pocket Reef. Everybody else
// arrives with years of readings in a spreadsheet or another app's export, and
// the app's answer is "type them in again". Nobody does. They keep the
// spreadsheet, log in two places for a fortnight, and stop.
//
// Every analysis this app has added — trends, forecasts, stability,
// correlation, cadence — is worthless on a fortnight of data and valuable on
// three years of it. The history is the product. This reads the shape people
// actually have: a header row, a date column, and a column per parameter.
//
// It is deliberately forgiving about headers ("NO3", "Nitrate (ppm)", "nitrate"
// all match) and completely unforgiving about data: a cell it cannot read
// becomes a skipped value with a reason, never a zero.
// ─────────────────────────────────────────────────────────────────────────────

import { activeParams } from "./targets";
import { validateParam } from "../data/waterParams";
import { dayKey } from "./day";

// The names these columns actually turn up under. Order matters only in that
// the first match wins, so the more specific aliases come first.
const ALIASES = {
  ammonia: ["ammonia", "nh3", "nh4", "tan"],
  nitrite: ["nitrite", "no2"],
  nitrate: ["nitrate", "no3"],
  phosphate: ["phosphate", "po4"],
  ph: ["ph"],
  gh: ["gh", "hardness", "generalhardness", "dgh"],
  kh: ["kh", "carbonatehardness"],
  alk: ["alk", "alkalinity", "dkh", "kh"],
  calcium: ["calcium", "ca"],
  magnesium: ["magnesium", "mg"],
  salinity: ["salinity", "sg", "specificgravity", "salt"],
  temp: ["temp", "temperature", "tempf", "tempc"],
};

const DATE_ALIASES = ["date", "day", "when", "timestamp", "datetime", "testdate"];

const normalise = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// A small CSV reader. Handles quoted fields containing commas and doubled
// quotes, which is the one piece of CSV that a naive split breaks on and that
// every spreadsheet export produces.
export function parseCsv(text = "") {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  const src = String(text).replace(/\r\n?/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { pushField(); continue; }
    if (c === "\n") { pushRow(); continue; }
    field += c;
  }
  // Trailing content without a newline is still a row; a trailing newline isn't.
  if (field.length || row.length) pushRow();
  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ""));
}

// Dates arrive in whatever the exporting app felt like. ISO is preferred;
// D/M/Y is ambiguous with M/D/Y and is resolved the American way only when the
// first number can't be a month, which is the best anyone can do without asking.
export function parseDate(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const slash = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/);
  if (slash) {
    let [, a, b, y] = slash;
    a = Number(a); b = Number(b);
    const year = String(y).length === 2 ? 2000 + Number(y) : Number(y);
    // If the first field can't be a month it must be the day.
    const month = a > 12 ? b : a;
    const day = a > 12 ? a : b;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const parsed = new Date(s);
  // Local, so a date the exporting app wrote as a local day doesn't shift by
  // one on the way in.
  if (!Number.isNaN(parsed.getTime())) return dayKey(parsed);
  return null;
}

// Which column is which, from the header row.
export function mapColumns(header = [], waterType = "fresh") {
  const keys = activeParams(waterType).map((p) => p.key);
  const map = { date: -1, params: {} };

  header.forEach((raw, i) => {
    const h = normalise(raw);
    if (!h) return;
    if (map.date === -1 && DATE_ALIASES.includes(h)) { map.date = i; return; }
    for (const key of keys) {
      if (map.params[key] != null) continue;
      const aliases = ALIASES[key] || [key];
      // Exact match, or the header starts with the alias — "nitrate(ppm)"
      // normalises to "nitrateppm" and should still match.
      if (aliases.some((a) => h === a || h.startsWith(a))) { map.params[key] = i; return; }
    }
  });

  return map;
}

// The whole job: text in, water-test entries plus a report out.
//
// Nothing is written here. The caller shows the report, the keeper confirms,
// and only then does anything land in the tank — importing years of somebody
// else's data silently is not a thing to do on a tap.
export function importWaterTests(text, { waterType = "fresh", existing = [] } = {}) {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return { ok: false, reason: "That doesn't look like a CSV — expected a header row and at least one reading.", entries: [] };
  }

  const header = rows[0];
  const map = mapColumns(header, waterType);
  const paramKeys = Object.keys(map.params);

  if (map.date === -1) {
    return { ok: false, reason: "No date column found. Name one of the columns \"Date\".", entries: [] };
  }
  if (!paramKeys.length) {
    return { ok: false, reason: `No parameter columns recognised. Expected names like ${activeParams(waterType).slice(0, 3).map((p) => p.label).join(", ")}.`, entries: [] };
  }

  const params = activeParams(waterType);
  const seen = new Set((existing || []).map((t) => t && t.date));
  const entries = [];
  const skipped = [];
  let duplicates = 0;

  rows.slice(1).forEach((row, n) => {
    const line = n + 2; // 1-indexed, plus the header
    const date = parseDate(row[map.date]);
    if (!date) { skipped.push({ line, reason: `Couldn't read the date "${row[map.date] || ""}"` }); return; }
    if (seen.has(date)) { duplicates++; return; }

    const values = {};
    // Whether this row already explained itself. A row whose only cell was
    // unreadable would otherwise be reported twice — once for the cell and
    // again for the row — which reads as two problems.
    let explained = false;
    paramKeys.forEach((key) => {
      const cell = row[map.params[key]];
      if (cell == null || String(cell).trim() === "") return;
      // Strip units people leave in the cell: "12 ppm", "8.4 dKH".
      //
      // The stripped text is then checked for actually being a number. Without
      // that, "banana" strips to "" and Number("") is 0 — which is finite, and
      // would have imported a fabricated zero for every unreadable cell. A
      // zero ammonia reading that nobody took is the worst possible import bug:
      // it reads as good news.
      const stripped = String(cell).replace(/[^0-9.-]/g, "");
      const num = Number(stripped);
      if (!/^-?\d*\.?\d+$/.test(stripped) || !Number.isFinite(num)) {
        skipped.push({ line, reason: `${key} "${cell}" isn't a number` });
        explained = true;
        return;
      }
      const p = params.find((x) => x.key === key);
      const check = validateParam(p, num);
      // An impossible value is dropped, not imported and not fatal — one bad
      // cell in 2013 shouldn't cost you the other 900 readings.
      if (!check.ok) { skipped.push({ line, reason: `${p.label} ${num} is out of range` }); explained = true; return; }
      values[key] = num;
    });

    if (!Object.keys(values).length) {
      if (!explained) skipped.push({ line, reason: "No readable readings on this row" });
      return;
    }
    seen.add(date);
    entries.push({ date, water: waterType, values });
  });

  // Newest first, matching how the app stores them everywhere else.
  entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return {
    ok: entries.length > 0,
    entries,
    matched: paramKeys,
    unmatched: header.filter((h, i) => i !== map.date && !Object.values(map.params).includes(i) && String(h).trim() !== ""),
    skipped,
    duplicates,
    reason: entries.length ? null : "Nothing importable found — every row was unreadable or already logged.",
    summary: `${entries.length} reading${entries.length === 1 ? "" : "s"} ready${duplicates ? `, ${duplicates} already logged` : ""}${skipped.length ? `, ${skipped.length} skipped` : ""}.`,
  };
}
