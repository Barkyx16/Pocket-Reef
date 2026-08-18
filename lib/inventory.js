// ─────────────────────────────────────────────────────────────────────────────
// Consumables, and when you run out.
//
// The app tracks the tank in detail and the shelf not at all. Everything that
// keeps a reef running is bought in bulk and consumed invisibly: salt, RODI
// filters, alkalinity supplement, GFO, carbon, test kits. The failure is always
// the same shape and always on a Sunday — a water change is due, the bucket is
// empty, and the shop is shut. Nothing in the app could have said so, even
// though it already holds the two numbers that predict it: how much you have,
// and how fast you actually use it.
//
// Usage is measured, not guessed. Salt comes from the volume of water actually
// changed; supplements come from the doses actually logged. Where nothing can
// be measured the item falls back to a keeper-stated rate, and where there
// isn't one either it says so rather than inventing a date.
// ─────────────────────────────────────────────────────────────────────────────

import { DOSABLE } from "./dosingLog";
import { todayKey, dayKey, instantOf } from "./day";
import { boundedNumber, LIMITS } from "./bounds";
import { records } from "./records";
import { TEXT_LIMITS, limitText } from "./textLimits";

// A window long enough to average out an irregular month, short enough that a
// tank whose routine changed isn't judged on last season.
const USAGE_WINDOW_DAYS = 60;
// Below this the rate is one or two events extrapolated into a year.
const MIN_EVENTS = 2;
export const LOW_STOCK_DAYS = 14;

const round = (n, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;
const timeOf = (d) => instantOf(d);
const daysBetween = (a, b) => (b - a) / 86400000;

// The kinds worth tracking, and where each one's usage comes from.
export const KINDS = [
  { id: "salt", label: "Salt mix", unit: "lb", icon: "cube-outline", source: "waterchange", per: "gallon", saltwaterOnly: true },
  { id: "rodi", label: "RODI / filters", unit: "gal", icon: "water-outline", source: "waterchange", per: "gallon" },
  { id: "supplement", label: "Supplement", unit: "ml", icon: "flask-outline", source: "dose" },
  { id: "media", label: "Filter media", unit: "units", icon: "layers-outline", source: "manual" },
  { id: "test", label: "Test kit", unit: "tests", icon: "eyedrop-outline", source: "manual" },
  { id: "food", label: "Food", unit: "units", icon: "restaurant-outline", source: "manual" },
];

export const kindOf = (id) => KINDS.find((k) => k.id === id) || KINDS[KINDS.length - 1];

// `perGallon` is how much of this item one gallon of new water consumes — half
// a pound of salt per gallon is the usual mix for 35ppt, and one gallon of RODI
// makes one gallon of water. `doseKey` ties a supplement to the dose log.
export function newInventoryItem({ name, kind = "media", stock = 0, unit, perGallon = null, doseKey = null, perDay = null, expiresAt = null, notes = "" } = {}) {
  const clean = String(name || "").trim();
  if (!clean) return null;
  const k = kindOf(kind);
  return {
    id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: limitText(clean, TEXT_LIMITS.name),
    kind: k.id,
    unit: unit || k.unit,
    stock: boundedNumber(stock, LIMITS.stock, { allowZero: true }) ?? 0,
    perGallon: boundedNumber(perGallon, LIMITS.perGallon),
    doseKey: DOSABLE.includes(doseKey) ? doseKey : null,
    // The manual fallback: what the keeper says they get through in a day.
    perDay: boundedNumber(perDay, LIMITS.perDay),
    expiresAt: expiresAt || null,
    notes: limitText(String(notes || "").trim(), TEXT_LIMITS.shortNote),
    addedAt: todayKey(),
  };
}

// How much of this item the tank has actually got through per day, from the
// logs. Returns null when the record can't support a number — which is a real
// answer and much better than a confident wrong date.
export function measuredRate(item, tank = {}, { now = Date.now(), windowDays = USAGE_WINDOW_DAYS } = {}) {
  if (!item) return null;
  const since = now - windowDays * 86400000;

  if (item.perGallon) {
    const changes = (tank.waterChanges || []).filter((w) => {
      const t = timeOf(w.date);
      return !Number.isNaN(t) && t >= since && t <= now;
    });
    if (changes.length < MIN_EVENTS) return null;
    // A change logged as a percentage still moves real water; without a volume
    // it's converted through the tank's size rather than being dropped.
    const gallons = changes.reduce((n, w) => {
      if (w.gallons) return n + Number(w.gallons);
      if (w.pct && tank.gallons) return n + (Number(w.pct) / 100) * Number(tank.gallons);
      return n;
    }, 0);
    if (!gallons) return null;
    const span = Math.max(1, daysBetween(Math.min(...changes.map((w) => timeOf(w.date))), now));
    return { perDay: round((gallons * item.perGallon) / span, 4), basis: `${changes.length} water changes`, measured: true };
  }

  if (item.doseKey) {
    const doses = (tank.doses || []).filter((d) => {
      const t = timeOf(d.date);
      return d.key === item.doseKey && !Number.isNaN(t) && t >= since && t <= now;
    });
    if (doses.length < MIN_EVENTS) return null;
    const ml = doses.reduce((n, d) => n + Number(d.ml || 0), 0);
    if (!ml) return null;
    const span = Math.max(1, daysBetween(Math.min(...doses.map((d) => timeOf(d.date))), now));
    return { perDay: round(ml / span, 3), basis: `${doses.length} doses`, measured: true };
  }

  if (item.perDay) return { perDay: item.perDay, basis: "your stated rate", measured: false };

  return null;
}

// Stock + rate → when it runs out, and how worried to be.
export function forecastItem(item, tank = {}, opts = {}) {
  const now = opts.now || Date.now();
  const rate = measuredRate(item, tank, { ...opts, now });

  const expired = item.expiresAt && timeOf(item.expiresAt) <= now;
  const expiringSoon = item.expiresAt && !expired && daysBetween(now, timeOf(item.expiresAt)) <= 30;

  const base = {
    item,
    rate,
    expired,
    expiringSoon,
    daysLeft: null,
    runsOutOn: null,
  };

  if (item.stock <= 0) {
    return { ...base, state: "out", headline: "Out of stock" };
  }
  if (expired) {
    // An expired test kit still has liquid in it and will still give you a
    // number. That is the danger, not the shortage.
    return { ...base, state: "expired", headline: `Expired ${item.expiresAt}` };
  }
  if (!rate || !rate.perDay) {
    return {
      ...base,
      state: expiringSoon ? "expiring" : "unknown",
      headline: expiringSoon ? `Expires ${item.expiresAt}` : "Not enough usage logged to predict",
    };
  }

  const daysLeft = Math.floor(item.stock / rate.perDay);
  const runsOutOn = dayKey(new Date(now + daysLeft * 86400000));

  // Expiry beats depletion when it lands first — a year of salt that goes off
  // in three weeks is a three-week problem.
  if (expiringSoon && timeOf(item.expiresAt) < now + daysLeft * 86400000) {
    return { ...base, daysLeft, runsOutOn, state: "expiring", headline: `Expires ${item.expiresAt}, before you'd use it up` };
  }

  const state = daysLeft <= 0 ? "out" : daysLeft <= LOW_STOCK_DAYS ? "low" : "ok";
  return {
    ...base,
    daysLeft,
    runsOutOn,
    state,
    headline: daysLeft <= 0
      ? "Out of stock"
      : `About ${daysLeft} day${daysLeft === 1 ? "" : "s"} left — ${runsOutOn}`,
  };
}

const STATE_RANK = { out: 0, expired: 1, low: 2, expiring: 3, unknown: 4, ok: 5 };

// The whole shelf, most urgent first.
export function forecastInventory(items = [], tank = {}, opts = {}) {
  items = records(items);
  const rows = items.map((i) => forecastItem(i, tank, opts));
  rows.sort((a, b) => {
    const s = STATE_RANK[a.state] - STATE_RANK[b.state];
    if (s !== 0) return s;
    return (a.daysLeft == null ? Infinity : a.daysLeft) - (b.daysLeft == null ? Infinity : b.daysLeft);
  });
  const needs = rows.filter((r) => ["out", "expired", "low", "expiring"].includes(r.state));
  return { rows, needs, shoppingList: needs.map((r) => r.item.name) };
}

// Sensible starting shelf, so nobody types six items from a blank screen. The
// per-gallon figures are the standard ones: ~0.5 lb of salt makes a gallon at
// 35ppt, and a gallon of water needs a gallon of RODI.
export function suggestedItems(waterType = "fresh") {
  const base = [
    { name: "RODI water", kind: "rodi", perGallon: 1, unit: "gal" },
    { name: "Filter floss", kind: "media", unit: "units" },
    { name: "Master test kit", kind: "test", unit: "tests" },
  ];
  if (waterType !== "salt") return base;
  return [
    { name: "Salt mix", kind: "salt", perGallon: 0.5, unit: "lb" },
    ...base,
    { name: "Alkalinity supplement", kind: "supplement", doseKey: "alk", unit: "ml" },
    { name: "Calcium supplement", kind: "supplement", doseKey: "calcium", unit: "ml" },
  ];
}
