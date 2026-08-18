import { todayKey, instantOf } from "./day";
import { boundedNumber, LIMITS } from "./bounds";
import { TEXT_LIMITS, limitText } from "./textLimits";
// ─────────────────────────────────────────────────────────────────────────────
// Water changes, as data.
//
// The water change is the single most important thing a keeper does, and it was
// the one action the app recorded as prose:
//
//     "Water change (~25%, 30 gal)"
//
// — a sentence in the journal. Every other metric got a real record. This one
// couldn't answer any of the questions that actually matter:
//
//   • how much water have I changed this month?
//   • am I keeping to the 10% weekly I said I would?
//   • did the nitrate drop follow the big change, or was that something else?
//
// The maintenance map already tracks *when* the last one happened, which drives
// the due date. This tracks *what* it was, which is a different question and the
// one that turns a habit into evidence.
// ─────────────────────────────────────────────────────────────────────────────

const DAY = 86400000;
const dayOf = (d) => instantOf(d);
const round1 = (n) => Math.round(n * 10) / 10;

export function newWaterChange({ date, pct, gallons, note = "" } = {}) {
  const p = Number(pct);
  const g = boundedNumber(gallons, LIMITS.gallons) ?? NaN;
  // A change with neither a percentage nor a volume is just a tick — the
  // maintenance map already holds that, and an empty record here would only
  // dilute the totals.
  if ((!p || Number.isNaN(p)) && (!g || Number.isNaN(g))) return null;
  return {
    id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    date: date || todayKey(),
    // A percentage above 100 is a typo with an obvious intent, so it clamps.
    // A negative volume has no obvious intent, and clamping it to 0 would store
    // "I changed 0 gallons" — a data point that quietly drags every average
    // down. Unrecorded is the honest answer.
    pct: p > 0 && !Number.isNaN(p) ? round1(Math.min(100, p)) : null,
    gallons: g > 0 && !Number.isNaN(g) ? round1(g) : null,
    note: limitText(String(note || "").trim(), TEXT_LIMITS.shortNote),
  };
}

// Volume moved over a window. Percentages without a volume can't be totalled
// without knowing the tank size at the time, so the caller passes it — and a
// change logged before the tank was resized keeps whatever volume it recorded.
export function volumeIn(changes = [], days = 30, { tankGallons = 0, now = Date.now() } = {}) {
  const cutoff = now - days * DAY;
  return round1(
    changes
      .filter((c) => c && !Number.isNaN(dayOf(c.date)) && dayOf(c.date) >= cutoff)
      .reduce((sum, c) => {
        if (typeof c.gallons === "number") return sum + c.gallons;
        if (typeof c.pct === "number" && tankGallons) return sum + (c.pct / 100) * tankGallons;
        return sum;
      }, 0)
  );
}

// How much of the tank's volume that adds up to — the number keepers actually
// compare against advice like "10% weekly".
export function turnoverIn(changes = [], days = 30, { tankGallons = 0, now = Date.now() } = {}) {
  if (!tankGallons) return null;
  return Math.round((volumeIn(changes, days, { tankGallons, now }) / tankGallons) * 100);
}

// Whether the keeper is holding to their own cadence, judged over a window long
// enough to survive one skipped week.
//
// Deliberately not a score: "you're at 62% adherence" invites gaming a number
// rather than changing water. It reports what happened and lets the keeper
// decide.
export function cadenceCheck(changes = [], { everyDays = 7, days = 28, now = Date.now() } = {}) {
  if (!everyDays) return { ok: true, expected: 0, actual: 0, reason: "No schedule set" };
  const cutoff = now - days * DAY;
  const actual = changes.filter((c) => c && !Number.isNaN(dayOf(c.date)) && dayOf(c.date) >= cutoff).length;
  const expected = Math.floor(days / everyDays);
  return {
    ok: actual >= expected,
    expected,
    actual,
    reason: actual >= expected
      ? `${actual} in the last ${days} days — on track`
      : `${actual} of about ${expected} in the last ${days} days`,
  };
}

// The gap since the last one, which is what the due date is really asking.
export function daysSinceLast(changes = [], now = Date.now()) {
  const dates = changes.map((c) => c && dayOf(c.date)).filter((t) => t && !Number.isNaN(t));
  if (!dates.length) return null;
  return Math.floor((now - Math.max(...dates)) / DAY);
}

// The average size of a change, so "I do 10% weekly" can be checked against
// what was actually done rather than what was intended.
// Windowed to match the volume figures it sits beside. An all-time average
// next to a 30-day volume reads as one statistic and is two.
export function averageChange(changes = [], { tankGallons = 0, days = 30, now = Date.now() } = {}) {
  const cutoff = now - days * DAY;
  const pcts = changes
    .filter((c) => c && !Number.isNaN(dayOf(c.date)) && dayOf(c.date) >= cutoff)
    .map((c) => {
      if (typeof c.pct === "number") return c.pct;
      if (typeof c.gallons === "number" && tankGallons) return (c.gallons / tankGallons) * 100;
      return null;
    })
    .filter((n) => typeof n === "number");
  if (!pcts.length) return null;
  return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
}

export function summarise(changes = [], { tankGallons = 0, everyDays = 7, now = Date.now() } = {}) {
  const list = Array.isArray(changes) ? changes.filter(Boolean) : [];
  return {
    count: list.length,
    last: daysSinceLast(list, now),
    volume30: volumeIn(list, 30, { tankGallons, now }),
    turnover30: turnoverIn(list, 30, { tankGallons, now }),
    average: averageChange(list, { tankGallons, now }),
    cadence: cadenceCheck(list, { everyDays, now }),
  };
}
