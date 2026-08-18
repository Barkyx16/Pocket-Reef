// ─────────────────────────────────────────────────────────────────────────────
// What your tank does when you do something to it.
//
// lib/waterChanges.js opens by listing the questions a prose journal entry
// can't answer, and the third one is:
//
//     "did the nitrate drop follow the big change, or was that something else?"
//
// That question was never answered. The app records water changes, doses,
// feedings, maintenance and treatments, all dated, and it records water tests,
// also dated, and it has never once put the two together. Every keeper does
// this reconciliation by memory and gets it wrong, because the interesting
// effects are small, delayed, and spread over months.
//
// The method is deliberately blunt and honest: for each event, take the last
// reading before it and the first reading after it, and record the change.
// Repeat across every occurrence and report the pattern only when there is one.
//
// This is association, not causation, and the wording never pretends otherwise.
// It is still the most useful thing the stored data can say.
// ─────────────────────────────────────────────────────────────────────────────

import { activeParams } from "./targets";
import { NOISE } from "./stability";
import { instantOf } from "./day";
import { round } from "./num";

// An effect has to show up this many times before it's a pattern rather than a
// coincidence. Three is the floor; below it a single odd week writes the story.
const MIN_OCCURRENCES = 3;
// How consistent the direction has to be. At 0.7, three of four moving the same
// way counts and two of four does not.
const MIN_AGREEMENT = 0.7;
// A reading taken this long after an event isn't measuring the event any more.
const MAX_LAG_DAYS = 10;
// Events closer together than this can't be told apart by weekly testing.
const MIN_GAP_DAYS = 2;

const timeOf = (d) => instantOf(d);

// Anything with a date that the keeper did on purpose. Journal entries are
// excluded: they're prose, they aren't a consistent action, and treating "saw
// algae" as an intervention would find effects that run backwards.
export function collectEvents(tank = {}) {
  const out = [];
  const push = (type, label, date) => {
    const t = timeOf(date);
    if (!date || Number.isNaN(t)) return;
    out.push({ type, label, date: String(date).slice(0, 10), time: t });
  };

  (tank.waterChanges || []).forEach((w) => push("waterchange", "Water change", w.date));
  (tank.doses || []).forEach((d) => push(`dose:${d.key}`, `${d.key === "alk" ? "Alkalinity" : d.key === "calcium" ? "Calcium" : "Magnesium"} dose`, d.date));
  (tank.feedings || []).forEach((f) => push("feeding", "Feeding", f.date));

  // The maintenance map is { taskId: lastDoneDate } — one date per task, so it
  // contributes at most one occurrence each and can never reach MIN_OCCURRENCES
  // on its own. Included anyway because a task done repeatedly over months
  // still only leaves its latest date, and excluding it would be a silent
  // asymmetry rather than a decision.
  Object.entries(tank.maintenance || {}).forEach(([id, date]) => {
    if (typeof date === "string") push(`upkeep:${id}`, id.replace(/[-_]/g, " "), date);
  });

  return out.sort((a, b) => a.time - b.time);
}

// Groups events of one type, dropping any that follow another too closely to
// be distinguished by the test cadence.
function occurrencesOf(events, type) {
  const list = events.filter((e) => e.type === type);
  const kept = [];
  list.forEach((e) => {
    const prev = kept[kept.length - 1];
    if (prev && (e.time - prev.time) / 86400000 < MIN_GAP_DAYS) return;
    kept.push(e);
  });
  return kept;
}

// The reading immediately before an event, and the first one after it.
//
// Binary search, not a scan. `points` is sorted, and this is called once per
// event occurrence per parameter — on a four-year tank that's ~10 parameters ×
// 3 event types × 200 occurrences, and a linear scan through 200 readings
// inside that made the whole function ~26ms. A frame is 16ms, so the weekly
// review alone dropped a frame every time the tank changed.
function bracket(points, time) {
  let lo = 0;
  let hi = points.length - 1;
  let beforeIdx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].time <= time) { beforeIdx = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  if (beforeIdx < 0 || beforeIdx + 1 >= points.length) return null;
  const before = points[beforeIdx];
  const after = points[beforeIdx + 1];
  const lagDays = (after.time - time) / 86400000;
  if (lagDays > MAX_LAG_DAYS) return null;
  return { before, after, lagDays: round(lagDays, 1) };
}

export function findCorrelations(tank = {}, waterType = "fresh", { now = Date.now(), minOccurrences = MIN_OCCURRENCES } = {}) {
  const events = collectEvents(tank);
  if (!events.length) return [];

  const params = activeParams(waterType);
  const tests = (tank.waterTests || []);
  const types = [...new Set(events.map((e) => e.type))];
  const occurrenceCache = new Map(types.map((t) => [t, occurrencesOf(events, t)]));
  const found = [];

  params.forEach((p) => {
    const points = tests
      .map((t) => {
        const v = t && t.values ? t.values[p.key] : undefined;
        if (v == null || v === "" || Number.isNaN(Number(v))) return null;
        const time = timeOf(t.date);
        return Number.isNaN(time) ? null : { v: Number(v), time, date: String(t.date).slice(0, 10) };
      })
      .filter(Boolean)
      .sort((a, b) => a.time - b.time);

    if (points.length < minOccurrences + 1) return;
    // Below the kit's resolution nothing can be claimed; default generously
    // for parameters with no entry so an unlisted one can't produce noise.
    const noise = NOISE[p.key] != null ? NOISE[p.key] : 0;

    types.forEach((type) => {
      // Cached across parameters: the occurrence list is a property of the
      // event log, not of the parameter being tested, and rebuilding it ten
      // times over was pure repetition.
      const occurrences = occurrenceCache.get(type) || [];
      if (occurrences.length < minOccurrences) return;

      const deltas = [];
      occurrences.forEach((e) => {
        if (e.time > now) return;
        const b = bracket(points, e.time);
        if (!b) return;
        deltas.push({ delta: b.after.v - b.before.v, lagDays: b.lagDays, date: e.date });
      });

      if (deltas.length < minOccurrences) return;

      // Movements inside kit error are counted in the sample but can't vote on
      // direction — otherwise a rounding wobble decides the verdict.
      const real = deltas.filter((d) => Math.abs(d.delta) > noise);
      if (real.length < minOccurrences) return;

      const ups = real.filter((d) => d.delta > 0).length;
      const downs = real.length - ups;
      const agreement = Math.max(ups, downs) / real.length;
      if (agreement < MIN_AGREEMENT) return;

      const direction = ups >= downs ? "up" : "down";
      const agreeing = real.filter((d) => (direction === "up" ? d.delta > 0 : d.delta < 0));
      const meanDelta = round(agreeing.reduce((n, d) => n + d.delta, 0) / agreeing.length, 2);
      if (Math.abs(meanDelta) <= noise) return;

      const label = occurrences[0].label;
      found.push({
        param: p.key,
        paramLabel: p.label,
        unit: p.unit,
        event: type,
        eventLabel: label,
        occurrences: real.length,
        agreeing: agreeing.length,
        agreement: round(agreement, 2),
        direction,
        meanDelta,
        meanLagDays: round(real.reduce((n, d) => n + d.lagDays, 0) / real.length, 1),
        // Strength is how big the effect is relative to what the kit can even
        // see — a 0.3 dKH move is a story, a 3 ppm nitrate move is not.
        strength: noise > 0 ? round(Math.abs(meanDelta) / noise, 2) : Math.abs(meanDelta),
        text: `${p.label} ${direction === "up" ? "rose" : "fell"} ${Math.abs(meanDelta)}${p.unit ? ` ${p.unit}` : ""} on average after ${agreeing.length} of ${real.length} ${label.toLowerCase()}s.`,
      });
    });
  });

  return found.sort((a, b) => b.strength - a.strength);
}

// Turns a finding into something worth acting on, where there is something.
// Most correlations are just the tank working correctly; those say so, because
// confirmation that your routine is doing its job is genuinely useful and
// inventing a warning for it would not be.
export function interpret(f) {
  // A finding without an event isn't interpretable, and reaching into one that
  // has none throws where returning null would simply hide the sentence.
  if (!f || typeof f.event !== "string" || typeof f.param !== "string") return null;
  const expectedGood =
    (f.event === "waterchange" && f.direction === "down" && ["nitrate", "phosphate", "ammonia", "nitrite"].includes(f.param)) ||
    (f.event.startsWith("dose:") && f.direction === "up" && f.event.endsWith(f.param));

  if (expectedGood) return { tone: "good", note: "That's your routine working exactly as intended." };

  if (f.event === "waterchange" && f.direction === "down" && ["alk", "calcium", "magnesium"].includes(f.param)) {
    return { tone: "warn", note: "Your change water is lower in this than your tank — check the salt mix, or match it before the change." };
  }
  if (f.event === "waterchange" && f.direction === "up" && ["nitrate", "phosphate"].includes(f.param)) {
    return { tone: "warn", note: "Fresh water should dilute this, not raise it. Worth testing your source water." };
  }
  if (f.event === "feeding" && f.direction === "up" && ["nitrate", "phosphate", "ammonia"].includes(f.param)) {
    return { tone: "warn", note: "Feeding is measurably loading the tank — smaller portions, or more export." };
  }
  if (f.event.startsWith("dose:") && f.direction === "down") {
    return { tone: "warn", note: "Dosing this and watching it fall means consumption is outrunning the dose." };
  }
  return { tone: "neutral", note: "" };
}
