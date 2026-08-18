// ─────────────────────────────────────────────────────────────────────────────
// How often should you actually test?
//
// The app asks for a cadence — weekly, fortnightly — and applies it to
// everything equally. That is how everybody starts and it is wrong in both
// directions at once. On a stocked reef, alkalinity can move from safe to
// coral-burning in four days, so a weekly test finds the damage rather than
// preventing it. Magnesium, meanwhile, barely moves in a month, and testing it
// weekly burns reagent and patience on a number that hasn't changed.
//
// The right interval is a property of the parameter *in your tank*: how fast it
// actually moves, and how much room it has before it's in trouble. Both of
// those are already measured — the first by the stability engine, the second by
// the distance from the current reading to the edge of its safe band.
//
//     days of headroom = distance to the edge ÷ how fast it moves
//     test interval     = half that, so a problem is caught on the way
//
// Halving is the point: sampling at exactly the rate a problem develops means
// finding it once it has arrived.
// ─────────────────────────────────────────────────────────────────────────────

import { activeParams } from "./targets";
import { paramStability, NOISE } from "./stability";
import { instantOf } from "./day";
import { records } from "./records";
import { round } from "./num";

const MIN_INTERVAL = 1;
const MAX_INTERVAL = 30;
// Below this a parameter is treated as not moving; the movement is kit error.
const FLAT_EPSILON = 1e-6;

const clamp = (n) => Math.max(MIN_INTERVAL, Math.min(MAX_INTERVAL, n));

// How often the keeper is testing this parameter at the moment.
export function observedInterval(waterTests = [], key, { now = Date.now(), windowDays = 90 } = {}) {
  waterTests = records(waterTests);

  const times = waterTests
    .filter((t) => t && t.values && t.values[key] != null && t.values[key] !== "")
    .map((t) => instantOf(t.date))
    .filter((t) => !Number.isNaN(t) && (now - t) / 86400000 <= windowDays)
    .sort((a, b) => a - b);
  if (times.length < 2) return null;
  const span = (times[times.length - 1] - times[0]) / 86400000;
  if (span <= 0) return null;
  return round(span / (times.length - 1), 1);
}

export function recommendFor(p, waterTests = [], opts = {}) {
  waterTests = records(waterTests);

  const stability = paramStability(p, waterTests, opts);
  const actual = observedInterval(waterTests, p.key, opts);

  // Parameters the stability engine won't grade (nitrate, phosphate) still get
  // a recommendation — their risk is the level, which changes slowly and
  // predictably, so they're paced off their own rate of change instead.
  const latest = waterTests.find((t) => t && t.values && t.values[p.key] != null && t.values[p.key] !== "");
  const current = latest ? Number(latest.values[p.key]) : null;

  let perDay = stability ? stability.perDay : null;
  if (perDay == null) {
    // Fall back to the mean absolute daily change across the series.
    const pts = waterTests
      .map((t) => {
        const v = t && t.values ? t.values[p.key] : undefined;
        const time = instantOf(t.date);
        return v == null || v === "" || Number.isNaN(time) ? null : { v: Number(v), time };
      })
      .filter(Boolean)
      .sort((a, b) => a.time - b.time);
    if (pts.length >= 3) {
      let total = 0;
      let days = 0;
      for (let i = 1; i < pts.length; i++) {
        total += Math.abs(pts[i].v - pts[i - 1].v);
        days += Math.max(1, (pts[i].time - pts[i - 1].time) / 86400000);
      }
      perDay = days ? total / days : null;
    }
  }

  if (perDay == null || current == null || Number.isNaN(current)) {
    return { key: p.key, label: p.label, unit: p.unit, actual, recommended: null, reason: "Not enough readings yet to pace this one." };
  }

  // Distance to whichever edge of the safe band it's heading for. When it isn't
  // moving, use the nearer edge — an idle parameter still needs an interval.
  const [lo, hi] = p.good;
  const distance = Math.max(0, Math.min(Math.abs(current - lo), Math.abs(hi - current)));

  const noise = NOISE[p.key] != null ? NOISE[p.key] : 0;
  const moving = perDay > Math.max(FLAT_EPSILON, noise / 14);

  let recommended;
  let headroomDays = null;
  if (!moving) {
    // It hasn't moved beyond kit error in the whole window. Test it to confirm
    // that's still true, not to catch a change.
    recommended = MAX_INTERVAL;
  } else {
    headroomDays = distance / perDay;
    recommended = clamp(Math.floor(headroomDays / 2));
  }

  const verdict = actual == null
    ? "unknown"
    : actual > recommended * 1.5
      ? "too-rare"
      : actual < recommended / 2.5
        ? "too-often"
        : "about-right";

  return {
    key: p.key,
    label: p.label,
    unit: p.unit,
    current: round(current, 2),
    perDay: round(perDay, 4),
    headroomDays: headroomDays == null ? null : round(headroomDays, 1),
    recommended,
    actual,
    verdict,
    moving,
    grade: stability ? stability.grade : null,
    reason: !moving
      ? `Hasn't moved beyond test-kit error in weeks — monthly is plenty.`
      : `Moving about ${round(perDay, 3)}${p.unit ? ` ${p.unit}` : ""} a day with ${round(distance, 2)} of room before it leaves the safe range.`,
  };
}

// The whole schedule, most urgent interval first.
export function testSchedule(waterTests = [], waterType = "fresh", opts = {}) {
  waterTests = records(waterTests);

  const params = activeParams(waterType);
  const items = params.map((p) => recommendFor(p, waterTests, opts));
  const usable = items.filter((i) => i.recommended != null);

  if (!usable.length) {
    return { ok: false, items, reason: "A few more tests and Pocket Reef can work out how often each parameter actually needs checking." };
  }

  usable.sort((a, b) => a.recommended - b.recommended);

  const tightest = usable[0];
  const underTested = usable.filter((i) => i.verdict === "too-rare");
  const overTested = usable.filter((i) => i.verdict === "too-often");

  return {
    ok: true,
    items: usable,
    tightest,
    underTested,
    overTested,
    headline: underTested.length
      ? `${underTested[0].label} needs testing every ${underTested[0].recommended} day${underTested[0].recommended === 1 ? "" : "s"} — you're averaging every ${underTested[0].actual}.`
      : overTested.length
        ? `You could ease off ${overTested[0].label}: every ${overTested[0].recommended} days is enough, and you're testing every ${overTested[0].actual}.`
        : `Your testing cadence matches what this tank actually needs.`,
  };
}
