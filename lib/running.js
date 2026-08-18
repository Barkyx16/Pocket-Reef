// ─────────────────────────────────────────────────────────────────────────────
// What the tank costs to run.
//
// The cost tracker answers "what have I spent" — a number that only ever goes
// up and that nobody can act on. The question people actually ask, usually
// after an electricity bill, is "what does this thing cost me every month", and
// nothing in the app could answer it. The equipment record knows what's on the
// tank and didn't know what any of it draws.
//
// Wattage is the missing field. With it, the standing cost is arithmetic — and
// unlike the purchase price it's a number a keeper can change, because the two
// biggest draws in almost every tank are the heater and the lights, and both
// have obvious levers.
// ─────────────────────────────────────────────────────────────────────────────

import { CATEGORIES } from "./equipment";
import { dailyHours } from "./lighting";
import { round } from "./num";

// Typical draw by category, used only where the keeper hasn't given a real
// figure. Marked as estimates everywhere they surface — a guessed watt is fine
// for a ballpark and must never be presented as measured.
export const TYPICAL_WATTS = {
  heating: 200,
  lighting: 60,
  flow: 25,
  filtration: 20,
  dosing: 5,
  testing: 5,
  other: 10,
};

// How much of the day each category actually runs. A heater cycles rather than
// running flat out, and treating it as 24/7 overstates the bill by triple.
export const DUTY_CYCLE = {
  // A heater cycles on and off to hold temperature rather than running flat
  // out; treating it as 24/7 overstates the bill by roughly triple.
  heating: 0.3,
  lighting: null, // taken from the light schedule
  flow: 1,
  filtration: 1,
  // A doser runs for seconds a day, and a controller sips.
  dosing: 0.02,
  testing: 1,
  other: 1,
};

// Rough national averages, per kWh, so the card opens with something sensible.
export const DEFAULT_RATE = 0.17;


export function itemDraw(item = {}, { lightHours = null } = {}) {
  const category = item.category || "other";
  const stated = Number(item.watts);
  const watts = Number.isFinite(stated) && stated > 0 ? stated : TYPICAL_WATTS[category] || TYPICAL_WATTS.other;
  const estimated = !(Number.isFinite(stated) && stated > 0);

  let hoursPerDay;
  if (category === "lighting") {
    // A light's duty cycle is its schedule; that's the whole point of tracking
    // the photoperiod, and it makes "cut an hour" a number with a price on it.
    hoursPerDay = lightHours != null ? lightHours : 10;
  } else {
    hoursPerDay = 24 * (DUTY_CYCLE[category] != null ? DUTY_CYCLE[category] : 1);
  }

  const kWhPerMonth = (watts * hoursPerDay * 30.4) / 1000;
  return { watts, estimated, hoursPerDay: round(hoursPerDay, 1), kWhPerMonth: round(kWhPerMonth, 2) };
}

export function runningCost(tank = {}, { rate = DEFAULT_RATE } = {}) {
  const equipment = tank.equipment || [];
  const lightHours = dailyHours(tank.lightSchedule);
  const perKWh = Number(rate) > 0 ? Number(rate) : DEFAULT_RATE;

  if (!equipment.length) {
    return { ok: false, reason: "Add your heater, lights and pumps to the equipment record and Pocket Reef can work out the running cost." };
  }

  const rows = equipment.map((item) => {
    const draw = itemDraw(item, { lightHours });
    return {
      id: item.id,
      name: item.name,
      category: item.category || "other",
      ...draw,
      costPerMonth: round(draw.kWhPerMonth * perKWh, 2),
    };
  });

  rows.sort((a, b) => b.costPerMonth - a.costPerMonth);

  const kWhPerMonth = round(rows.reduce((n, r) => n + r.kWhPerMonth, 0), 2);
  const perMonth = round(rows.reduce((n, r) => n + r.costPerMonth, 0), 2);
  const estimatedCount = rows.filter((r) => r.estimated).length;

  // The lights are the only draw with a lever the keeper can pull today, so
  // their cost per hour of photoperiod is worth stating on its own.
  const lightRows = rows.filter((r) => r.category === "lighting");
  const lightWatts = lightRows.reduce((n, r) => n + r.watts, 0);
  const perLightHour = lightWatts ? round(((lightWatts * 30.4) / 1000) * perKWh, 2) : null;

  return {
    ok: true,
    rows,
    perKWh,
    kWhPerMonth,
    perMonth,
    perYear: round(perMonth * 12, 2),
    estimatedCount,
    // Stated whenever any figure is a guess, so the total is never mistaken
    // for a measured one.
    confidence: estimatedCount === 0 ? "measured" : estimatedCount === rows.length ? "estimated" : "mixed",
    biggest: rows[0] || null,
    perLightHour,
    lightHours,
  };
}

// Total cost of ownership: what it cost to build plus what it's cost to run
// since. The second number overtakes the first faster than anybody expects.
export function ownershipTotal(tank = {}, { rate = DEFAULT_RATE, spent = 0, now = Date.now() } = {}) {
  const running = runningCost(tank, { rate });
  if (!running.ok) return { ok: false, reason: running.reason };

  const start = tank.createdAt ? new Date(tank.createdAt).getTime() : null;
  const months = start && !Number.isNaN(start) ? Math.max(0, (now - start) / (86400000 * 30.4)) : null;
  const electricity = months == null ? null : round(running.perMonth * months, 2);

  return {
    ok: true,
    months: months == null ? null : round(months, 1),
    spent: round(Number(spent) || 0, 2),
    electricity,
    total: electricity == null ? null : round((Number(spent) || 0) + electricity, 2),
    perMonth: running.perMonth,
  };
}

export const categoryLabel = (id) => (CATEGORIES.find((c) => c.id === id) || { label: "Other" }).label;
