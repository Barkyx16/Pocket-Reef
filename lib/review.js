// ─────────────────────────────────────────────────────────────────────────────
// The weekly review.
//
// Everything in this app reports on right now. Today's actions, the current
// health score, the latest reading, what's overdue. Nothing ever looks back at
// a week and tells you what happened in it — which is the only timescale a reef
// actually moves on, and the reason keepers who journal religiously still can't
// answer "has this month been better or worse than last".
//
// This assembles one: what you did, what moved, what the tank is doing, and the
// single thing most worth attending to next. It reads from the engines rather
// than recomputing anything, so the review can never disagree with the cards.
// ─────────────────────────────────────────────────────────────────────────────

import { activeParams } from "./targets";
import { tankStability } from "./stability";
import { findCorrelations, interpret } from "./correlate";
import { forecastInventory } from "./inventory";
import { NOISE } from "./stability";
import { dayKey, instantOf } from "./day";
import { round } from "./num";

const timeOf = (d) => instantOf(d);
const iso = (ms) => dayKey(new Date(ms));

const countIn = (list, getDate, from, to) =>
  (list || []).filter((x) => {
    const t = timeOf(getDate(x));
    return !Number.isNaN(t) && t >= from && t <= to;
  }).length;

// What to measure this week's movement against.
//
// Preferably the last reading taken BEFORE the window opened, which is the true
// starting value. A keeper who only started logging inside the window has no
// such reading, and refusing to report anything for them would mean the review
// stays empty for exactly the people using it most — so it falls back to the
// earliest reading within the window.
function baselineFor(points, from) {
  let before = null;
  let earliestInside = null;
  points.forEach((p) => {
    if (p.time <= from) { if (!before || p.time > before.time) before = p; }
    else if (!earliestInside || p.time < earliestInside.time) earliestInside = p;
  });
  return before || earliestInside;
}

export function buildReview(tank = {}, { now = Date.now(), days = 7, waterType = "fresh" } = {}) {
  const to = now;
  const from = now - days * 86400000;
  const prevFrom = from - days * 86400000;

  const tests = tank.waterTests || [];
  const activity = {
    tests: countIn(tests, (t) => t.date, from, to),
    waterChanges: countIn(tank.waterChanges, (w) => w.date, from, to),
    doses: countIn(tank.doses, (d) => d.date, from, to),
    feedings: countIn(tank.feedings, (f) => f.date, from, to),
    journal: countIn(tank.journal, (j) => j.date, from, to),
  };
  const prevActivity = {
    tests: countIn(tests, (t) => t.date, prevFrom, from),
    waterChanges: countIn(tank.waterChanges, (w) => w.date, prevFrom, from),
  };

  // What moved, and by how much — only where the movement clears kit error.
  const params = activeParams(waterType);
  const movements = [];
  params.forEach((p) => {
    const points = tests
      .map((t) => {
        const v = t && t.values ? t.values[p.key] : undefined;
        if (v == null || v === "" || Number.isNaN(Number(v))) return null;
        const time = timeOf(t.date);
        return Number.isNaN(time) ? null : { v: Number(v), time };
      })
      .filter(Boolean);
    if (!points.length) return;

    const latest = points.filter((x) => x.time <= to).sort((a, b) => b.time - a.time)[0];
    const opening = baselineFor(points, from);
    if (!latest || !opening || latest.time === opening.time) return;

    const delta = round(latest.v - opening.v, 2);
    const noise = NOISE[p.key] != null ? NOISE[p.key] : 0;
    if (Math.abs(delta) <= noise) return;

    movements.push({
      key: p.key,
      label: p.label,
      unit: p.unit,
      from: opening.v,
      to: latest.v,
      delta,
      direction: delta > 0 ? "up" : "down",
    });
  });
  movements.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const stability = tankStability(tests, waterType, { now });
  const correlations = findCorrelations(tank, waterType, { now });
  const inventory = forecastInventory(tank.inventory || [], tank, { now });

  // One thing to attend to, chosen by what would hurt soonest. Ordered
  // deliberately: something already out of stock stops a water change this
  // weekend, an unstable parameter is damaging tissue now, and a correlation is
  // a thing to understand rather than an emergency.
  let focus = null;
  const outNow = inventory.needs.find((n) => n.state === "out" || n.state === "expired");
  const worstParam = stability.ok ? stability.worst : null;
  const badCorrelation = correlations.map((c) => ({ c, i: interpret(c) })).find((x) => x.i && x.i.tone === "warn");

  if (outNow) {
    focus = { kind: "inventory", text: `${outNow.item.name} — ${outNow.headline.toLowerCase()}. Restock before your next water change.` };
  } else if (worstParam && (worstParam.grade === "unstable" || worstParam.grade === "swinging")) {
    focus = { kind: "stability", text: `${worstParam.label} is ${worstParam.grade === "unstable" ? "unstable" : "swinging"} — moving ${worstParam.perDay}${worstParam.unit ? ` ${worstParam.unit}` : ""} a day against a safe ${worstParam.limit}. Steady beats ideal.` };
  } else if (badCorrelation) {
    focus = { kind: "correlation", text: `${badCorrelation.c.text} ${badCorrelation.i.note}` };
  } else if (inventory.needs.length) {
    focus = { kind: "inventory", text: `${inventory.needs[0].item.name} — ${inventory.needs[0].headline.toLowerCase()}.` };
  } else if (!activity.tests) {
    focus = { kind: "activity", text: `No water test logged in the last ${days} days. Everything else here is built on those readings.` };
  } else if (stability.ok && stability.worst.grade === "rock-solid") {
    focus = { kind: "good", text: "Nothing needs you. Every graded parameter is holding steady and the shelf is stocked." };
  }

  const logged = activity.tests + activity.waterChanges + activity.doses + activity.feedings + activity.journal;

  return {
    from: iso(from),
    to: iso(to),
    days,
    activity,
    // "Quieter than last week" is a fact worth stating; a streak counter is not.
    testTrend: activity.tests === prevActivity.tests ? "same" : activity.tests > prevActivity.tests ? "more" : "fewer",
    movements,
    stability,
    correlations,
    inventory,
    focus,
    empty: logged === 0,
    headline: logged === 0
      ? `Nothing logged in the last ${days} days.`
      : `${activity.tests} test${activity.tests === 1 ? "" : "s"}, ${activity.waterChanges} water change${activity.waterChanges === 1 ? "" : "s"}, ${activity.feedings} feeding${activity.feedings === 1 ? "" : "s"}.`,
  };
}
