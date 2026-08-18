import { todayKey, instantOf, isValidDayKey } from "./day";
import { boundedNumber, LIMITS } from "./bounds";
import { TEXT_LIMITS, limitText } from "./textLimits";
// ─────────────────────────────────────────────────────────────────────────────
// What's actually on the tank.
//
// The app could size equipment — "a 120 gallon reef wants ~600W of heat and 10x
// turnover" — and that's genuinely useful once, when you're shopping. It had no
// idea what you then bought. So the questions a keeper asks for the next five
// years all went unanswered:
//
//   • which heater is this, and is it still under warranty?
//   • what wattage did I put on the frag tank?
//   • when did I buy this return pump — is it worth servicing or replacing?
//   • what did the build actually cost me?
//
// This is the record. It deliberately does NOT re-implement service intervals:
// upkeep already does that, and a heater's "clean me every 90 days" belongs in
// one place. An item can point at an upkeep task instead.
// ─────────────────────────────────────────────────────────────────────────────

const DAY = 86400000;

// The categories a tank is actually built from, with the icon each gets.
export const CATEGORIES = [
  { id: "filtration", label: "Filtration", emoji: "🌀" },
  { id: "heating", label: "Heating & cooling", emoji: "🌡️" },
  { id: "lighting", label: "Lighting", emoji: "💡" },
  { id: "flow", label: "Flow", emoji: "🌊" },
  { id: "dosing", label: "Dosing & ATO", emoji: "💉" },
  { id: "testing", label: "Testing & control", emoji: "🎯" },
  { id: "other", label: "Other", emoji: "🧰" },
];

export const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

// Common items per category, so adding a heater doesn't start from a blank
// field. Suggestions only — anything can be typed.
export const SUGGESTIONS = {
  filtration: ["Protein skimmer", "Canister filter", "Sump", "Roller mat", "UV steriliser"],
  heating: ["Heater", "Chiller", "Temperature controller"],
  lighting: ["Main light", "Refugium light", "Light timer"],
  flow: ["Return pump", "Powerhead", "Wavemaker"],
  dosing: ["Dosing pump", "ATO", "Kalkwasser reactor", "CO2 regulator"],
  testing: ["pH probe", "Salinity monitor", "Controller", "RODI unit"],
  other: ["Auto feeder", "Stand", "Backup battery"],
};

export function newEquipment({ name, category = "other", brand = "", model = "", installedAt, price = null, warrantyMonths = null, notes = "", watts = null } = {}) {
  const clean = String(name || "").trim();
  if (!clean) return null;
  return {
    id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: limitText(clean, TEXT_LIMITS.name),
    category: CATEGORIES.some((c) => c.id === category) ? category : "other",
    brand: limitText(String(brand || "").trim(), TEXT_LIMITS.name),
    model: limitText(String(model || "").trim(), TEXT_LIMITS.name),
    installedAt: isValidDayKey(installedAt) ? installedAt : todayKey(),
    // A missing price is null, never 0 — zero would claim the item was free and
    // drag the build total down with it.
    price: boundedNumber(price, LIMITS.price, { allowZero: true }),
    warrantyMonths: (() => { const n = boundedNumber(warrantyMonths, LIMITS.warrantyMonths, { allowZero: true }); return n == null ? null : Math.round(n); })(),
    // Power draw, for the running-cost maths. Null rather than 0 for the same
    // reason price is: an unknown wattage falls back to a category estimate,
    // and a zero would claim the thing draws nothing.
    watts: boundedNumber(watts, LIMITS.watts),
    notes: limitText(String(notes || "").trim(), TEXT_LIMITS.shortNote),
  };
}

const dayOf = (d) => instantOf(d);

// How long an item has been running, in the words a keeper would use.
export function ageLabel(item, now = Date.now()) {
  if (!item || !item.installedAt) return null;
  const t = dayOf(item.installedAt);
  if (Number.isNaN(t)) return null;
  const days = Math.max(0, Math.floor((now - t) / DAY));
  if (days < 60) return `${days} days old`;
  const months = Math.round(days / 30.4);
  if (months < 18) return `${months} months old`;
  return `${(days / 365).toFixed(1)} years old`;
}

// Warranty state. The whole reason to record a purchase date is to be told —
// unprompted — that the pump that just died is still covered.
export function warrantyStatus(item, now = Date.now()) {
  if (!item || !item.warrantyMonths || !item.installedAt) return { state: "none" };
  const start = dayOf(item.installedAt);
  if (Number.isNaN(start)) return { state: "none" };

  const end = new Date(start);
  end.setMonth(end.getMonth() + item.warrantyMonths);
  const endsAt = end.getTime();
  const daysLeft = Math.ceil((endsAt - now) / DAY);

  if (daysLeft < 0) return { state: "expired", daysLeft, endsAt };
  // A month's notice is enough to actually make a claim.
  if (daysLeft <= 31) return { state: "ending", daysLeft, endsAt };
  return { state: "active", daysLeft, endsAt };
}

export function warrantyLabel(item, now = Date.now()) {
  const w = warrantyStatus(item, now);
  if (w.state === "none") return null;
  if (w.state === "expired") return "Warranty expired";
  if (w.state === "ending") return `Warranty ends in ${w.daysLeft}d`;
  const months = Math.round(w.daysLeft / 30.4);
  return months >= 2 ? `Under warranty · ${months} months left` : `Under warranty · ${w.daysLeft}d left`;
}

// Grouped for display, in the order the categories are declared so the list
// doesn't reshuffle as items are added.
export function byCategory(items = []) {
  return CATEGORIES
    .map((c) => ({ category: c, items: items.filter((i) => i && i.category === c.id) }))
    .filter((g) => g.items.length);
}

// What the build cost, and what's still covered.
export function equipmentSummary(items = [], now = Date.now()) {
  const priced = items.filter((i) => i && typeof i.price === "number" && !Number.isNaN(i.price));
  const spend = Math.round(priced.reduce((n, i) => n + i.price, 0) * 100) / 100;
  const underWarranty = items.filter((i) => ["active", "ending"].includes(warrantyStatus(i, now).state));
  const endingSoon = items.filter((i) => warrantyStatus(i, now).state === "ending");
  const oldest = items
    .filter((i) => i && i.installedAt && !Number.isNaN(dayOf(i.installedAt)))
    .sort((a, b) => dayOf(a.installedAt) - dayOf(b.installedAt))[0] || null;

  return {
    count: items.length,
    spend,
    // Stated separately so a half-filled record can't imply a complete total.
    priced: priced.length,
    underWarranty: underWarranty.length,
    endingSoon,
    oldest,
  };
}
