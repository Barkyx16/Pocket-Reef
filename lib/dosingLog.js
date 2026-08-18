import { actualWaterVolume, REEF_TARGETS } from "./dosing";
import { todayKey, instantOf } from "./day";
import { boundedNumber, LIMITS } from "./bounds";
import { fmt } from "./format";
import { TEXT_LIMITS, limitText } from "./textLimits";

// ─────────────────────────────────────────────────────────────────────────────
// Dose logging and consumption.
//
// The app could work out a one-off correction — "you're at 7.2 dKH, add 40ml" —
// and that's the easy half. The half that actually keeps a reef alive is the
// maintenance dose: a growing tank consumes alkalinity and calcium every single
// day, and the number that matters is how fast *your* tank consumes them.
// Nobody can look that up. It can only be measured, from your own tests and
// your own dosing, and the app was throwing away one of the two inputs by never
// recording a dose at all.
//
// The measurement:
//
//     consumption/day = (rise your dosing should have produced − rise actually
//                        observed) ÷ days
//
// If you dosed nothing, that collapses to the plain rate of decline. If your
// tank is stable while you dose 20ml a day, it's consuming exactly what 20ml
// provides. Both are the same equation.
//
// This is deliberately conservative about saying anything at all: a hobby test
// kit has real error, and a confident consumption figure derived from two
// readings a day apart would be noise presented as fact.
// ─────────────────────────────────────────────────────────────────────────────

export const DOSABLE = ["alk", "calcium", "magnesium"];

// How far back to look. Long enough to average out test-kit error, short enough
// that a tank which changed (new corals, a bigger light) isn't judged on how it
// behaved two months ago.
export const WINDOW_DAYS = 45;
// Below this the arithmetic is dominated by kit error rather than by the tank.
export const MIN_SPAN_DAYS = 5;
export const MIN_TESTS = 3;

const DAY = 86400000;
const dayOf = (d) => instantOf(d);

export function newDose({ key, ml, date, note = "" } = {}) {
  if (!DOSABLE.includes(key)) return null;
  // Bounded: a slipped key here doesn't just log a wrong dose, it permanently
  // skews the consumption rate that every future dose is calculated from.
  const amount = boundedNumber(ml, LIMITS.doseMl);
  if (amount == null) return null;
  return {
    id: `d_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    key,
    ml: Math.round(amount * 100) / 100,
    date: date || todayKey(),
    note: limitText(String(note || "").trim(), TEXT_LIMITS.shortNote),
  };
}

// Total ml of one supplement dosed between two dates, inclusive of both ends.
export function dosedBetween(doses = [], key, fromDate, toDate) {
  const from = dayOf(fromDate);
  const to = dayOf(toDate);
  return doses
    .filter((d) => d && d.key === key)
    .filter((d) => {
      const t = dayOf(d.date);
      return !Number.isNaN(t) && t >= from && t <= to;
    })
    .reduce((sum, d) => sum + (Number(d.ml) || 0), 0);
}

// How fast this tank uses one parameter.
//
// Returns { ok, perDay, days, dosedMl, observedChange, expectedRise, samples }
// or { ok: false, reason } when there genuinely isn't enough to say.
export function consumptionRate({ key, waterTests = [], doses = [], ratedGallons, strengthPerUnit, now = Date.now() }) {
  if (!DOSABLE.includes(key)) return { ok: false, reason: "Not a dosable parameter" };

  const strength = Number(strengthPerUnit);
  const volume = actualWaterVolume(ratedGallons);

  const cutoff = now - WINDOW_DAYS * DAY;
  // Oldest first, only tests that actually carry this reading.
  const points = waterTests
    .filter((t) => t && t.values && t.values[key] != null && !Number.isNaN(dayOf(t.date)))
    .filter((t) => dayOf(t.date) >= cutoff)
    .sort((a, b) => dayOf(a.date) - dayOf(b.date));

  if (points.length < MIN_TESTS) {
    return { ok: false, reason: `Log ${MIN_TESTS} tests with ${REEF_TARGETS[key].label.toLowerCase()} to measure this`, samples: points.length };
  }

  const first = points[0];
  const last = points[points.length - 1];
  const days = Math.round((dayOf(last.date) - dayOf(first.date)) / DAY);

  if (days < MIN_SPAN_DAYS) {
    return { ok: false, reason: `Needs at least ${MIN_SPAN_DAYS} days between your first and last test`, samples: points.length, days };
  }

  const observedChange = Number(last.values[key]) - Number(first.values[key]);
  const dosedMl = dosedBetween(doses, key, first.date, last.date);

  // Without a product strength the dosing contribution is unknowable, so the
  // honest answer is the raw decline — and only when nothing was dosed.
  if (!strength || strength <= 0 || !volume) {
    if (dosedMl > 0) {
      return { ok: false, reason: "Enter your product strength so dosing can be accounted for", samples: points.length, days, dosedMl };
    }
    const perDay = Math.round((-observedChange / days) * 1000) / 1000;
    return { ok: perDay > 0, perDay, days, dosedMl: 0, observedChange, expectedRise: 0, samples: points.length, reason: perDay > 0 ? null : "Not consuming — this parameter is holding or rising" };
  }

  const expectedRise = (dosedMl * strength) / volume;
  const perDay = Math.round(((expectedRise - observedChange) / days) * 1000) / 1000;

  return {
    ok: perDay > 0,
    perDay,
    days,
    dosedMl: Math.round(dosedMl * 10) / 10,
    observedChange: Math.round(observedChange * 100) / 100,
    expectedRise: Math.round(expectedRise * 100) / 100,
    samples: points.length,
    reason: perDay > 0 ? null : "Not consuming — this parameter is holding or rising",
  };
}

// The daily dose that holds the parameter steady at its current level.
export function maintenanceDose({ perDay, ratedGallons, strengthPerUnit }) {
  const strength = Number(strengthPerUnit);
  const volume = actualWaterVolume(ratedGallons);
  if (!perDay || perDay <= 0 || !strength || strength <= 0 || !volume) return null;
  const ml = (perDay * volume) / strength;
  return Math.round(ml * 10) / 10;
}

// Plain-English summary. Kept here so the card, the report and any future
// reminder all describe consumption the same way.
export function describeConsumption(key, rate) {
  const t = REEF_TARGETS[key];
  if (!t) return "";
  if (!rate || !rate.ok) return rate && rate.reason ? rate.reason : "Not enough data yet";
  return `Using about ${fmt(rate.perDay)} ${t.unit}/day, measured over ${rate.days} days`;
}

// Doses grouped by day, newest first — what the log actually renders.
export function recentDoseDays(doses = [], limit = 14) {
  const byDay = new Map();
  doses.forEach((d) => {
    if (!d || !d.date) return;
    if (!byDay.has(d.date)) byDay.set(d.date, {});
    const row = byDay.get(d.date);
    row[d.key] = (row[d.key] || 0) + (Number(d.ml) || 0);
  });
  return [...byDay.entries()]
    .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
    .slice(0, limit)
    .map(([date, totals]) => ({ date, totals }));
}

// Did the keeper dose everything they normally dose today? The nudge that stops
// a daily routine quietly lapsing.
export function dosedToday(doses = [], today = todayKey()) {
  const keys = new Set(doses.filter((d) => d && d.date === today).map((d) => d.key));
  return [...keys];
}
