// ─────────────────────────────────────────────────────────────────────────────
// Stability.
//
// Every grade in this app so far answers "is this number in range". That is the
// beginner's question, and the app answers it well. It is not the question that
// decides whether a reef lives.
//
// A tank sitting at 7.6 dKH for a month is healthy. A tank averaging a perfect
// 8.5 by bouncing 7.4 → 9.6 → 7.8 is burning coral tissue, and every single one
// of those readings grades "Good" — the app would show three green ticks for
// the exact pattern that kills SPS. Its own tip list already says so ("Stability
// beats perfection"), and nothing in the app measured it.
//
// This measures movement rather than position: the largest real change per day,
// against what that parameter can safely move in a day.
// ─────────────────────────────────────────────────────────────────────────────

import { activeParams } from "./targets";
import { dayKey, instantOf } from "./day";

// How much a parameter can safely move in 24 hours. These are hobby consensus
// limits, not derived — alkalinity is the strict one because a fast swing is
// what burns SPS tips, and temperature and salinity matter because osmotic and
// thermal shock are acute rather than cumulative.
//
// Parameters absent from this table are NOT graded for stability, deliberately:
// nitrate swinging 10→25→10 is a water-change schedule, not a hazard. For those
// the level is the risk and the existing grading already covers it.
export const SWING_LIMIT = {
  alk: 0.4,          // dKH per day — the classic "no more than 0.5" rule, tightened
  ph: 0.2,
  temp: 2,           // °F per day
  salinity: 0.001,   // specific gravity
  calcium: 25,       // ppm
  magnesium: 50,     // ppm
  gh: 2,             // dGH, freshwater
};

// Test-kit resolution. A change smaller than this is the kit, not the tank, and
// treating it as a swing would grade every careful keeper as unstable.
export const NOISE = {
  alk: 0.2, ph: 0.1, temp: 1, salinity: 0.0005, calcium: 20, magnesium: 40, gh: 1,
};

const WINDOW_DAYS = 45;
const MIN_READINGS = 3;

const round = (n, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;
const dayOf = (d) => instantOf(d);

// ratio = observed daily movement ÷ what's safe in a day.
// `gradeLabel`, not `label`: this object is spread over a parameter result that
// already has a `label` (the parameter's name), and a plain `label` here
// silently overwrote it — every stability sentence in the app read "Unstable is
// unstable" instead of naming the parameter.
export function gradeFor(ratio) {
  if (ratio < 0.4) return { grade: "rock-solid", gradeLabel: "Rock solid", rank: 3 };
  if (ratio < 0.8) return { grade: "steady", gradeLabel: "Steady", rank: 2 };
  if (ratio < 1.25) return { grade: "swinging", gradeLabel: "Swinging", rank: 1 };
  return { grade: "unstable", gradeLabel: "Unstable", rank: 0 };
}

// One parameter's stability over the window, or null when it can't be judged.
export function paramStability(p, waterTests = [], { now = Date.now(), windowDays = WINDOW_DAYS } = {}) {
  const limit = SWING_LIMIT[p.key];
  if (!limit) return null;

  const points = waterTests
    .map((t) => {
      const v = t && t.values ? t.values[p.key] : undefined;
      if (v == null || v === "" || Number.isNaN(Number(v))) return null;
      const time = dayOf(t.date);
      if (Number.isNaN(time)) return null;
      const ageDays = (now - time) / 86400000;
      if (!(ageDays >= 0) || ageDays > windowDays) return null;
      return { v: Number(v), time };
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);

  if (points.length < MIN_READINGS) return null;

  const values = points.map((x) => x.v);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const spanDays = round((points[points.length - 1].time - points[0].time) / 86400000, 1);

  // The worst real move between consecutive readings, normalised per day.
  //
  // Per day, not per reading: a 0.6 dKH change across a fortnight is drift a
  // tank can absorb, and the same 0.6 overnight is the event that bleaches it.
  // Grading the raw gap would call those identical.
  const noise = NOISE[p.key] || 0;
  let worst = null;
  for (let i = 1; i < points.length; i++) {
    const delta = points[i].v - points[i - 1].v;
    if (Math.abs(delta) <= noise) continue; // inside kit error
    // Two readings on the same day are treated as one day apart; dividing by
    // zero would report an infinite swing for a keeper who tested twice.
    const days = Math.max(1, (points[i].time - points[i - 1].time) / 86400000);
    const perDay = delta / days;
    if (!worst || Math.abs(perDay) > Math.abs(worst.perDay)) {
      worst = {
        perDay: round(perDay, 4),
        from: points[i - 1].v,
        to: points[i].v,
        days: round(days, 1),
        at: dayKey(new Date(points[i].time)),
      };
    }
  }

  // Nothing moved beyond kit error across the whole window — the best possible
  // result, and it must not be mistaken for "no data".
  const perDay = worst ? Math.abs(worst.perDay) : 0;
  const ratio = perDay / limit;
  const g = gradeFor(ratio);

  return {
    key: p.key,
    label: p.label,
    unit: p.unit,
    readings: points.length,
    spanDays,
    mean: round(mean, 2),
    low: round(Math.min(...values), 2),
    high: round(Math.max(...values), 2),
    range: round(Math.max(...values) - Math.min(...values), 2),
    limit,
    perDay: round(perDay, 4),
    ratio: round(ratio, 2),
    worst,
    ...g,
  };
}

// Every gradable parameter, worst first — the one that needs attention should
// not be buried under four that are fine.
export function tankStability(waterTests = [], waterType = "fresh", opts = {}) {
  const params = activeParams(waterType);
  const items = params.map((p) => paramStability(p, waterTests, opts)).filter(Boolean);
  if (!items.length) return { ok: false, items: [], score: null, reason: "Log at least three tests and Pocket Reef can grade how steady this tank is." };

  items.sort((a, b) => b.ratio - a.ratio);

  // One score, weighted so the worst parameter dominates. Averaging would let
  // four steady parameters hide an alkalinity swing, which is precisely the
  // failure this exists to catch.
  const worstRatio = items[0].ratio;
  const meanRatio = items.reduce((n, i) => n + i.ratio, 0) / items.length;
  const blended = worstRatio * 0.6 + meanRatio * 0.4;
  const score = Math.max(0, Math.min(100, Math.round(100 - blended * 55)));

  return { ok: true, items, worst: items[0], score, ...gradeFor(blended) };
}

// The sentence a keeper should read first.
export function stabilityHeadline(result) {
  if (!result || !result.ok) return null;
  const w = result.worst;
  if (w.grade === "rock-solid") return `Every parameter is holding steady — ${result.items.length} graded, none moving fast enough to stress anything.`;
  if (!w.worst) return `${w.label} is steady.`;
  const dir = w.worst.perDay > 0 ? "rose" : "fell";
  const amount = Math.abs(round(w.worst.to - w.worst.from, 2));
  return `${w.label} ${dir} ${amount}${w.unit ? ` ${w.unit}` : ""} in ${w.worst.days === 1 ? "a day" : `${w.worst.days} days`} — ${w.perDay}/day against a safe ${w.limit}/day.`;
}
