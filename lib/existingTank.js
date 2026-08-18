// ─────────────────────────────────────────────────────────────────────────────
// Setting up a tank that already exists.
//
// Onboarding asks two questions — how big, fresh or salt — and hands over a
// tank dated today with nothing in it. That's correct for somebody starting
// their first tank and wrong for almost everybody who downloads an aquarium
// app, because people go looking for one when they already have a tank and it
// is already a problem.
//
// For that keeper the app opens on a three-year-old reef presented as brand
// new: "still cycling", "add livestock slowly", a maturity badge reading day 0,
// a health score built on no readings, and a first-run checklist telling them
// to add their first fish. Everything the app says is wrong on day one, which
// is the day it has to earn its place.
//
// This is the short path to an honest starting state: how long it's been
// running, what's in it, and the last set of readings. Three answers, and every
// score, forecast and maturity figure starts from the truth.
// ─────────────────────────────────────────────────────────────────────────────

import { getTodayKey } from "../core";
import { activeParams } from "./targets";

// The ages people actually say out loud, rather than a date picker nobody can
// answer precisely for a tank set up one weekend years ago.
export const AGE_OPTIONS = [
  { id: "new", label: "Just set up", days: 0 },
  { id: "weeks", label: "A few weeks", days: 21 },
  { id: "months", label: "A few months", days: 120 },
  { id: "year", label: "About a year", days: 365 },
  { id: "years", label: "Years", days: 365 * 3 },
];

export const ageOf = (id) => AGE_OPTIONS.find((a) => a.id === id) || AGE_OPTIONS[0];

// An age becomes a createdAt, which is what every maturity calculation reads.
export function createdAtFor(ageId, now = Date.now()) {
  const days = ageOf(ageId).days;
  return new Date(now - days * 86400000).toISOString();
}

// Turns the answers into the patch a tank needs. Returns a partial rather than
// a whole tank so it can be applied to the one that already exists — the app
// has always created a first tank on launch, and replacing it would throw away
// an id other records may already point at.
export function buildSetup({ ageId = "new", gallons, water = "fresh", stock = [], readings = {}, now = Date.now() } = {}) {
  const patch = {};

  if (gallons && Number(gallons) > 0) patch.gallons = Number(gallons);
  if (water === "salt" || water === "fresh") patch.water = water;
  patch.createdAt = createdAtFor(ageId, now);

  if (stock.length) {
    patch.stock = [...stock];
    // Quantities aren't asked for here on purpose. Somebody describing an
    // established tank will not enumerate fourteen tetras, and the stocking
    // maths treats a missing count as one — an undercount that reads as
    // headroom rather than as an overstocked tank.
    patch.quantities = {};
  }

  const params = activeParams(water);
  const values = {};
  params.forEach((p) => {
    const raw = readings[p.key];
    if (raw == null || raw === "") return;
    const num = Number(raw);
    if (Number.isFinite(num)) values[p.key] = num;
  });

  if (Object.keys(values).length) {
    patch.waterTests = [{ date: getTodayKey(), water, values }];
  }

  return patch;
}

// What this tank still needs before the app's analysis means anything, in the
// order that unlocks the most. Honest about what each one buys, because "add
// more data" without a reason is how a setup screen gets abandoned.
export function whatsMissing(tank = {}) {
  const out = [];
  const tests = tank.waterTests || [];

  if (!tank.gallons) out.push({ id: "size", label: "Tank size", why: "Every stocking, dosing and water-change figure is calculated from it." });
  if (!(tank.stock || []).length) out.push({ id: "stock", label: "What's in it", why: "Compatibility, bioload and the feeding plan all need the stock list." });
  if (!tests.length) out.push({ id: "test", label: "A water test", why: "Trends, forecasts and the health score are all built on readings." });
  else if (tests.length < 3) out.push({ id: "tests", label: `${3 - tests.length} more test${3 - tests.length === 1 ? "" : "s"}`, why: "Three readings is where trends, stability and forecasting switch on." });
  if (!(tank.equipment || []).length) out.push({ id: "gear", label: "Your equipment", why: "Warranty tracking and the running-cost estimate come from it." });
  if (!tank.sourceWater || !Object.keys(tank.sourceWater.values || {}).length) {
    out.push({ id: "source", label: "Source water", why: "Without it, every water-change prediction assumes your tap is pure." });
  }
  if (!tank.lightSchedule) out.push({ id: "light", label: "Light schedule", why: "Photoperiod drives algae as much as nutrients do." });

  return out;
}

// A keeper importing years of readings has an established tank whether they
// said so or not, and dating it "today" would contradict their own history.
export function inferCreatedAt(tank = {}) {
  const dates = [
    ...(tank.waterTests || []).map((t) => t && t.date),
    ...(tank.journal || []).map((j) => j && j.date),
  ].filter(Boolean).sort();
  if (!dates.length) return null;
  const oldest = new Date(dates[0]);
  return Number.isNaN(oldest.getTime()) ? null : oldest.toISOString();
}
