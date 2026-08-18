import { instantOf } from "./day";
// ─────────────────────────────────────────────────────────────────────────────
// Quarantine, as a protocol rather than a countdown.
//
// The card runs a 21-day timer per arrival and says nothing else. Twenty-one
// days is the right number and the timer is the least useful part of it: the
// point of quarantine is not that time passes, it's that somebody looks at the
// fish every day and knows what they're looking for. A keeper watching an
// empty countdown learns nothing, misses the flick-and-scratch on day three
// that is the whole reason for the exercise, and graduates a fish carrying ich
// into a display tank on day twenty-two.
//
// So this turns the timer into a programme: what to watch for, when each risk
// window opens and closes, and an explicit set of criteria that must be true
// before an animal is allowed into the display.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_DAYS = 21;

// What actually happens across a quarantine, and when. The windows are the
// parasite life cycles that make 21 days the number rather than 14.
export const PHASES = [
  {
    id: "settle",
    from: 1,
    to: 3,
    label: "Settling in",
    watch: ["Hiding and refusing food is normal for a day or two", "Breathing hard or gasping is not — check ammonia first"],
    doing: "Leave the lights off or dim. Don't feed heavily; uneaten food in a bare QT fouls fast.",
  },
  {
    id: "watch",
    from: 4,
    to: 10,
    label: "The window things show up in",
    watch: ["White spots like grains of salt", "Flicking or scraping against surfaces", "Clamped fins, cloudy eyes, frayed edges", "Still not eating by day 5"],
    doing: "Test ammonia daily — a bare tank has little biological filtration and ammonia is the most common thing that kills a quarantined fish. This is the window where ich and velvet appear.",
  },
  {
    id: "confirm",
    from: 11,
    to: 17,
    label: "Second cycle",
    watch: ["Spots returning after seeming to clear — this is the parasite's second generation, not a relapse", "Weight loss despite eating"],
    doing: "Keep watching. Most people relax here and this is exactly when a missed parasite comes back around.",
  },
  {
    id: "clear",
    from: 18,
    to: DEFAULT_DAYS,
    label: "Clearing",
    watch: ["Eating well and holding condition", "No marks, no scratching, no clamped fins for a full week"],
    doing: "If it's been clean through the whole second cycle, it's ready. Match temperature and salinity before moving it.",
  },
];

export const phaseFor = (day) => PHASES.find((p) => day >= p.from && day <= p.to) || PHASES[PHASES.length - 1];

const dayOf = (d) => instantOf(d);

// Day 1 is the day it went in, not the day after.
export function dayNumber(startDate, now = Date.now()) {
  const start = dayOf(startDate);
  if (Number.isNaN(start)) return null;
  return Math.max(1, Math.floor((now - start) / 86400000) + 1);
}

// Everything that must be true before a fish goes into the display. These are
// checked off by the keeper, not by the clock — a fish that stopped eating on
// day 19 is not ready on day 21, and the app should say so rather than
// congratulate them.
export const CRITERIA = [
  { id: "time", label: `Full ${DEFAULT_DAYS} days completed`, auto: true },
  { id: "eating", label: "Eating well for the last week" },
  { id: "marks", label: "No spots, film or damaged fins" },
  { id: "behaviour", label: "No flicking, scratching or hiding" },
  { id: "breathing", label: "Breathing normally, not rapid" },
];

export function assessArrival(item = {}, { now = Date.now(), days = DEFAULT_DAYS } = {}) {
  const day = dayNumber(item.startDate, now);
  if (day == null) return { ok: false, reason: "That start date couldn't be read." };

  const checks = item.checks || {};
  const timeDone = day >= days;
  const met = CRITERIA.filter((c) => (c.auto ? timeDone : Boolean(checks[c.id])));
  const outstanding = CRITERIA.filter((c) => !(c.auto ? timeDone : Boolean(checks[c.id])));

  return {
    ok: true,
    day,
    days,
    daysLeft: Math.max(0, days - day),
    phase: phaseFor(Math.min(day, days)),
    pct: Math.min(100, Math.round((day / days) * 100)),
    criteria: CRITERIA.map((c) => ({ ...c, met: c.auto ? timeDone : Boolean(checks[c.id]) })),
    met: met.length,
    outstanding,
    // The whole point: time alone is not clearance.
    ready: outstanding.length === 0,
    overdue: day > days && outstanding.length > 0,
    headline: outstanding.length === 0
      ? "Clear to move into the display."
      : timeDone
        ? `${days} days done, but ${outstanding.length} check${outstanding.length === 1 ? "" : "s"} still outstanding.`
        : `Day ${day} of ${days} — ${phaseFor(day).label.toLowerCase()}.`,
  };
}
