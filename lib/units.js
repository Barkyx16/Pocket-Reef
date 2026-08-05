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
