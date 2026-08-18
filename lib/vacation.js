// ─────────────────────────────────────────────────────────────────────────────
// Going away.
//
// The most dangerous week a tank has is the one where somebody else is looking
// after it, and the app has nothing to say about it. The keeper writes a text
// message at the airport — "feed them a pinch a day, don't touch anything" —
// and the sitter, who has never kept fish, either underfeeds out of fear or
// dumps a week of food in on day two because the fish "looked hungry".
//
// Everything a sitter needs is already in the record: what's in the tank, what
// it eats, how much, what the tank normally reads, and which signs mean call
// somebody. This assembles it into something that can be handed over, and does
// the one thing keepers reliably get wrong — it tells them to feed LESS while
// they're away, not more.
// ─────────────────────────────────────────────────────────────────────────────

import { getSpecies, getFeedingPlan } from "../core";
import { activeParams } from "./targets";
import { formatVolume } from "./units";

const dayCount = (from, to) => {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 86400000));
};

// A tank can be left completely alone for about this long without harm. Past
// it, somebody has to visit — and the honest advice for a short trip is to do
// nothing at all rather than to arrange clumsy help.
export const SAFE_ALONE_DAYS = 4;

export function buildSitterPlan(tank = {}, { days = 7, sitterName = "", contact = "", waterType = "fresh" } = {}) {
  const stock = tank.stock || [];
  const quantities = tank.quantities || {};
  const species = stock.map(getSpecies).filter(Boolean);
  const feeding = getFeedingPlan(stock, quantities);
  const latest = (tank.waterTests || [])[0];

  // Underfeeding is nearly harmless; overfeeding while nobody is watching the
  // ammonia is how tanks are lost. So the plan is deliberately conservative.
  const normalPerDay = feeding.ok ? Math.max(...feeding.groups.map((g) => g.timesPerDay)) : 1;
  const awayPerDay = days <= SAFE_ALONE_DAYS ? 0 : Math.max(1, Math.min(normalPerDay, 1));
  const feedEveryOtherDay = days > SAFE_ALONE_DAYS && species.every((s) => (s.adultInches || 0) >= 1);

  const params = activeParams(waterType);
  const readings = latest && latest.values
    ? params
        .filter((p) => latest.values[p.key] != null)
        .map((p) => ({ label: p.label, value: latest.values[p.key], unit: p.unit, ideal: p.ideal }))
    : [];

  const doList = [];
  if (days <= SAFE_ALONE_DAYS) {
    doList.push(`Nothing. A healthy tank is fine alone for ${SAFE_ALONE_DAYS} days — no feeding, no topping up, no visits.`);
  } else {
    doList.push(
      feedEveryOtherDay
        ? "Feed every OTHER day, one small pinch. Less is safe; more is not."
        : "Feed once a day, one small pinch — no more than the fish finish in two minutes."
    );
    doList.push("Top up evaporation with fresh tap or RO water only — never salt water, and only back to the marked line.");
    doList.push("Look at the fish for a minute. Count them.");
  }

  // The list that matters more than the do list. Every one of these is a real
  // thing sitters do with good intentions.
  const dontList = [
    "Don't feed extra because they look hungry — they always look hungry.",
    "Don't clean the glass, the filter, or change any water.",
    "Don't turn the lights, heater, or pumps off, or unplug anything to 'give it a rest'.",
    "Don't add anything to the water — no treatments, no conditioner, no top-up chemicals.",
    "Don't net or move any fish, even a sick-looking one.",
  ];

  const callList = [
    "The water has gone cloudy or milky, or smells bad.",
    "A fish is dead, or lying on the bottom breathing hard.",
    "Fish are all at the surface gasping.",
    "The water level has dropped a lot, or there's water on the floor.",
    "Anything has stopped humming — heater, filter or pump gone quiet.",
  ];

  return {
    days,
    sitterName: String(sitterName || "").trim(),
    contact: String(contact || "").trim(),
    unattended: days <= SAFE_ALONE_DAYS,
    tankName: tank.name || "the tank",
    gallons: tank.gallons,
    fish: species.map((s) => ({ name: s.name, emoji: s.emoji, count: quantities[s.name] || 1 })),
    totalFish: species.reduce((n, s) => n + (quantities[s.name] || 1), 0),
    feeding: { normalPerDay, awayPerDay, everyOtherDay: feedEveryOtherDay, food: feeding.ok ? feeding.groups[0].food : "their usual food" },
    readings,
    doList,
    dontList,
    callList,
    headline: days <= SAFE_ALONE_DAYS
      ? `${days} days is inside what a healthy tank handles alone. The safest plan is to do nothing.`
      : `${days} days needs somebody. Here's what to hand them.`,
  };
}

// The handover itself — plain text, because it has to survive a text message,
// a printout stuck to the cabinet, and an email to a neighbour.
export function sitterSheet(plan) {
  if (!plan) return "";
  // The sheet is printed from a plan assembled elsewhere; every list on it is
  // optional, and a missing one should mean an empty section rather than a
  // crash on the way to the printer. Normalising once here beats guarding at
  // each of the eight places a list is read.
  plan = {
    ...plan,
    doList: Array.isArray(plan.doList) ? plan.doList : [],
    dontList: Array.isArray(plan.dontList) ? plan.dontList : [],
    callList: Array.isArray(plan.callList) ? plan.callList : [],
    fish: Array.isArray(plan.fish) ? plan.fish : [],
    readings: Array.isArray(plan.readings) ? plan.readings : [],
  };
  const L = [];
  // A tank name is optional — the sheet still has to print for an unnamed tank
  // rather than throwing on the title line.
  L.push(`${String(plan.tankName || "YOUR TANK").toUpperCase()} — CARE NOTES`);
  L.push(`${plan.days} days${plan.sitterName ? ` · for ${plan.sitterName}` : ""}`);
  if (plan.gallons) L.push(`${formatVolume(plan.gallons)}, ${plan.totalFish} fish`);
  L.push("");

  if (plan.unattended) {
    L.push("NOTHING NEEDS DOING.");
    L.push(`A healthy tank is fine on its own for ${SAFE_ALONE_DAYS} days. Please don't feed it.`);
    L.push("");
  } else {
    L.push("EACH DAY");
    plan.doList.forEach((d) => L.push(`• ${d}`));
    L.push("");
  }

  L.push("PLEASE DON'T");
  plan.dontList.forEach((d) => L.push(`• ${d}`));
  L.push("");

  L.push("CALL ME IF");
  plan.callList.forEach((d) => L.push(`• ${d}`));

  if (plan.contact) {
    L.push("");
    L.push(`Contact: ${plan.contact}`);
  }

  if (plan.fish.length) {
    L.push("");
    L.push("WHAT'S IN THERE");
    plan.fish.forEach((f) => L.push(`• ${f.count > 1 ? `${f.count}× ` : ""}${f.name}`));
  }

  if (plan.readings.length) {
    L.push("");
    L.push("NORMAL READINGS (for reference only — please don't test)");
    plan.readings.forEach((r) => L.push(`• ${r.label}: ${r.value}${r.unit ? ` ${r.unit}` : ""}`));
  }

  L.push("");
  L.push("Thank you — from Pocket Reef");
  return L.join("\n");
}

// What the keeper should do BEFORE they leave. This is the half that actually
// prevents the disaster, and it has to happen days ahead.
export function preparationSteps(tank = {}, days = 7) {
  const steps = [
    { when: "A week before", text: "Do a water change and test everything. Leave with the tank on its best day, not its average one." },
    { when: "A week before", text: "Service anything that's due — filter, skimmer, top-off reservoir. Nothing should come due while you're away." },
    { when: "A week before", text: "Don't add any new fish or corals. A tank settling in is the last thing you want unattended." },
  ];
  if (days > SAFE_ALONE_DAYS) {
    steps.push({ when: "The day before", text: "Pre-portion the food into a labelled box or bag per feed — a sitter given a whole tub will use a whole tub." });
    steps.push({ when: "The day before", text: "Mark the water line on the glass with tape so topping up needs no judgement." });
  }
  steps.push({ when: "The day before", text: "Feed normally, then leave. A fasted day before a trip is fine; a big farewell meal is not." });
  if ((tank.equipment || []).length) {
    steps.push({ when: "The day before", text: "Photograph the equipment and the plug sockets, so anything unplugged by accident can be put back." });
  }
  return steps;
}
