// ─────────────────────────────────────────────────────────────────────────────
// Is this reading plausible *for this tank*?
//
// validateParam already refuses the impossible: a pH of 78, a temperature below
// freezing. That catches the fat-finger that lands three digits off. It cannot
// catch the one that matters more — a reading that is perfectly possible in
// general and absurd for your tank. Nitrate 100 is a real number somebody
// somewhere logs honestly; in a tank that has read 8–12 for four months it is
// a misread colour card or a decimal in the wrong place.
//
// That single bad number then propagates. It skews the average, bends the
// least-squares forecast, becomes the "worst swing" in the stability grade, and
// shows up as a correlation with whatever you happened to do that week. Every
// analysis the app added is downstream of readings being true, and nothing
// checked them against the tank's own history.
//
// The statistics are deliberately robust: median and median-absolute-deviation
// rather than mean and standard deviation, because a mean is dragged toward the
// outlier it's supposed to be detecting.
// ─────────────────────────────────────────────────────────────────────────────

import { NOISE } from "./stability";
import { instantOf } from "./day";
import { records } from "./records";
import { round } from "./num";

const LOOKBACK_DAYS = 120;
const MAX_POINTS = 12;
// Below this there's no "usual" to be unusual against.
const MIN_POINTS = 4;

// 0.6745 scales MAD onto the same footing as a standard deviation for normal
// data, so these read like z-scores.
const MAD_SCALE = 0.6745;
const UNUSUAL_Z = 4;
const SUSPECT_Z = 7;


export function median(values = []) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// A decimal typed one place out is the single most common data-entry error, and
// the one most worth naming explicitly — "did you mean 1.2?" is a much better
// prompt than "that looks unusual".
function decimalSlip(value, typical) {
  if (!typical) return null;
  const ratios = [
    { factor: 10, suggestion: round(value / 10, 4) },
    { factor: 0.1, suggestion: round(value * 10, 4) },
  ];
  for (const r of ratios) {
    const implied = typical * r.factor;
    // A real decimal slip is EXACTLY an order of magnitude out. The tolerance
    // only has to absorb the gap between the median and the value the keeper
    // meant — so it's tight. At 40% this claimed a reading 6.5× the usual was
    // "ten times off", which is both wrong and the kind of wrong that teaches
    // people to stop reading the warnings.
    if (implied && Math.abs(value - implied) / implied < 0.15) return r.suggestion;
  }
  return null;
}

// `p` is a display-unit parameter; `value` is what the keeper typed.
export function checkReading(p, value, waterTests = [], { now = Date.now(), toDisplay = (v) => v } = {}) {
  // `toDisplay` receives the parameter too, because only temperature needs
  // converting and the caller is the only one that knows the keeper's unit.
  const v = Number(value);
  if (!p || value == null || value === "" || Number.isNaN(v)) return { level: "ok" };

  const history = waterTests
    .map((t) => {
      const raw = t && t.values ? t.values[p.key] : undefined;
      if (raw == null || raw === "") return null;
      const time = instantOf(t.date);
      if (Number.isNaN(time)) return null;
      if ((now - time) / 86400000 > LOOKBACK_DAYS) return null;
      const num = Number(toDisplay(raw, p));
      return Number.isFinite(num) ? { v: num, time } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.time - a.time)
    .slice(0, MAX_POINTS);

  if (history.length < MIN_POINTS) return { level: "ok", reason: "not enough history" };

  const values = history.map((h) => h.v);
  const mid = median(values);
  const mad = median(values.map((x) => Math.abs(x - mid)));
  const noise = NOISE[p.key] != null ? NOISE[p.key] : 0;

  // A tank that reads the same number every time has a MAD of zero, which would
  // make every deviation infinitely surprising. The kit's own resolution is the
  // floor: you cannot be more precise than the thing measuring.
  const spread = Math.max(mad, noise, Math.abs(mid) * 0.02);
  const z = spread ? round((MAD_SCALE * Math.abs(v - mid)) / spread, 2) : 0;

  const slip = decimalSlip(v, mid);
  const level = z >= SUSPECT_Z ? "suspect" : z >= UNUSUAL_Z ? "unusual" : "ok";
  if (level === "ok") return { level: "ok", z, median: round(mid, 2), samples: history.length };

  const direction = v > mid ? "higher" : "lower";
  const last = history[0];

  return {
    level,
    z,
    median: round(mid, 2),
    last: round(last.v, 2),
    samples: history.length,
    suggestion: slip,
    title: slip != null ? "Check the decimal point" : `Unusual ${p.label.toLowerCase()} for this tank`,
    message: slip != null
      ? `${v}${p.unit ? ` ${p.unit}` : ""} is ten times off your usual ${round(mid, 2)}. Did you mean ${slip}?`
      : `Your last ${history.length} readings averaged around ${round(mid, 2)}${p.unit ? ` ${p.unit}` : ""}. ${v} is a lot ${direction} — worth a retest before it's stored.`,
  };
}

// Every field at once, worst first. Used at the moment of logging.
export function checkReadings(params = [], vals = {}, waterTests = [], opts = {}) {
  params = records(params);
  waterTests = records(waterTests);

  return params
    .map((p) => ({ p, r: checkReading(p, vals[p.key], waterTests, opts) }))
    .filter((x) => x.r.level !== "ok")
    .map((x) => ({ key: x.p.key, label: x.p.label, unit: x.p.unit, value: vals[x.p.key], ...x.r }))
    .sort((a, b) => b.z - a.z);
}
