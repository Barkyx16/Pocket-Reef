// Unit formatting — a module singleton (same pattern as i18n). Components call
// the formatters; App holds a `unit` state that flips this and forces a re-render
// on change, so no prop-threading is needed. Data is stored in °F / gallons
// internally; these convert for display.
let unit = "imperial"; // "imperial" | "metric"

export function setUnit(u) {
  if (u === "imperial" || u === "metric") unit = u;
}
export function getUnit() {
  return unit;
}

export function fToC(f) {
  return Math.round((Number(f) - 32) * (5 / 9));
}
export function formatTemp(f) {
  return unit === "metric" ? `${fToC(f)}°C` : `${f}°F`;
}
export function formatTempRange(a, b) {
  return unit === "metric" ? `${fToC(a)}–${fToC(b)}°C` : `${a}–${b}°F`;
}
export function formatVolume(gallons) {
  return unit === "metric" ? `${Math.round(gallons * 3.785)} L` : `${gallons} gal`;
}

export function cToF(c) {
  return Math.round(((Number(c) * 9) / 5 + 32) * 10) / 10;
}

// ── Temperature in the logging surfaces ──────────────────────────────────────
//
// The catalog honoured the metric setting (species cards, care sheets) but the
// water-test form did not: its temperature field came straight from PARAMS,
// hard-coded to °F with a "72–80°F" placeholder and a 72–80 grading band. So a
// keeper on metric read their species care range in °C, then logged the reading
// in °F — and if they typed what their thermometer actually said, 26, the app
// graded a perfectly warm tank as dangerously cold.
//
// Readings stay stored in °F so every existing entry, trend and forecast keeps
// working; conversion happens at the edges.
export const tempUnitLabel = () => (unit === "metric" ? "°C" : "°F");

// Stored °F -> what the field should show.
export function tempToDisplay(f) {
  if (f == null || f === "") return f;
  return unit === "metric" ? fToC(f) : f;
}

// What the user typed -> °F for storage.
export function tempFromInput(v) {
  if (v == null || v === "") return v;
  return unit === "metric" ? cToF(v) : Number(v);
}

// Converts a whole parameter definition for display when it measures
// temperature. Everything else passes through untouched.
export function localiseParam(p) {
  if (!p || p.key !== "temp" || unit !== "metric") return p;
  const good = [fToC(p.good[0]), fToC(p.good[1])];
  const caution = [fToC(p.caution[0]), fToC(p.caution[1])];
  return { ...p, unit: "°C", good, caution, ideal: `${good[0]}–${good[1]}°C` };
}
