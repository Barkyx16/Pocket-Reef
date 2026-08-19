// ─────────────────────────────────────────────────────────────────────────────
// "What happens if I actually buy these?"
//
// The wishlist has been a filter and a list on Home. It knows what you want and
// has never once told you what it would do to your tank — which is the entire
// reason to keep a wishlist rather than just buying the fish.
//
// Everything needed was already here and never combined: compatibility, bioload,
// minimum tank size, schooling minimums. The app checks all of it one fish at a
// time, against the tank as it is now. Nobody buys one fish at a time. The
// interesting failures are between the things on the list — two wishlist fish
// that each work fine alongside your clownfish and will kill each other — and
// the bioload of the whole basket, which no single-fish check can see.
// ─────────────────────────────────────────────────────────────────────────────

import { SPECIES, getSpecies, getCompatibility, getBioload, getStockingRoom } from "../core";
import { formatVolume } from "./units";

const speciesOf = (n) => getSpecies(n);

// Peaceful and hardy first, aggressive last. This is the oldest piece of advice
// in the hobby and the app has never given it: adding the bully before the
// timid fish means the bully owns the whole tank before anyone else arrives.
const TEMPER_ORDER = { peaceful: 0, "semi-aggressive": 1, aggressive: 2 };
const CARE_ORDER = { Easy: 0, Moderate: 1, Hard: 2 };

export function simulateAdditions(tank = {}, wishNames = [], { quantities = {} } = {}) {
  const current = tank.stock || [];
  const tankGallons = Number(tank.gallons) || 0;
  const tankWater = tank.water || (current.length ? (speciesOf(current[0]) || {}).water : null);

  const wanted = wishNames
    .map((n) => speciesOf(n))
    .filter(Boolean)
    // Something already in the tank isn't an addition.
    .filter((s) => !current.includes(s.name));

  if (!wanted.length) {
    return { ok: false, reason: "Nothing on your wishlist that isn't already in this tank.", items: [], blocked: [], conflicts: [] };
  }

  // How many of each you'd realistically buy: a schooling fish is bought as a
  // school, and simulating one Neon Tetra models a purchase nobody makes.
  const countFor = (s) => Math.max(1, quantities[s.name] || (s.minGroup > 1 ? s.minGroup : 1));

  const items = wanted.map((s) => {
    const count = countFor(s);
    const tooBig = tankGallons > 0 && s.minGallons > tankGallons;
    const wrongWater = tankWater && s.water !== tankWater;

    // Against what's already swimming.
    const existingClashes = current
      .map((n) => ({ with: n, c: getCompatibility(s.name, n) }))
      .filter((x) => x.c.level === "avoid" || x.c.level === "caution");

    // Against the rest of the wishlist — the check nothing in the app did.
    const wishClashes = wanted
      .filter((o) => o.name !== s.name)
      .map((o) => ({ with: o.name, c: getCompatibility(s.name, o.name) }))
      .filter((x) => x.c.level === "avoid" || x.c.level === "caution");

    const blockers = [];
    if (wrongWater) blockers.push({ kind: "water", text: `${s.name} is a ${s.water === "salt" ? "saltwater" : "freshwater"} species.` });
    if (tooBig) blockers.push({ kind: "size", text: `Needs ${formatVolume(s.minGallons)}; this tank is ${formatVolume(tankGallons)}.` });
    existingClashes.filter((x) => x.c.level === "avoid").forEach((x) => blockers.push({ kind: "conflict", text: `Can't live with ${x.with}: ${x.c.reason}` }));
    wishClashes.filter((x) => x.c.level === "avoid").forEach((x) => blockers.push({ kind: "wishconflict", text: `Can't live with ${x.with} — also on your list.` }));

    const cautions = [...existingClashes, ...wishClashes]
      .filter((x) => x.c.level === "caution")
      .map((x) => ({ with: x.with, text: x.c.reason }));

    if (s.minGroup > 1 && count < s.minGroup) {
      cautions.push({ with: null, text: `Wants a group of at least ${s.minGroup}.` });
    }

    return {
      name: s.name,
      emoji: s.emoji,
      count,
      minGallons: s.minGallons,
      temperament: s.temperament,
      careLevel: s.careLevel,
      minGroup: s.minGroup || 1,
      ok: blockers.length === 0,
      blockers,
      cautions,
    };
  });

  const viable = items.filter((i) => i.ok);
  const blocked = items.filter((i) => !i.ok);

  // Bioload of the tank as it would be, not one fish at a time. This is the
  // number a single-species check structurally cannot produce.
  const projectedStock = [...current, ...viable.map((i) => i.name)];
  const projectedQty = { ...(tank.quantities || {}) };
  viable.forEach((i) => { projectedQty[i.name] = i.count; });

  const before = getStockingRoom(tankGallons, current, tank.quantities || {});
  const after = getStockingRoom(tankGallons, projectedStock, projectedQty);
  const loadBefore = getBioload(tankGallons, current, tank.quantities || {});
  const loadAfter = getBioload(tankGallons, projectedStock, projectedQty);

  // The order to buy them in.
  const order = [...viable].sort((a, b) => {
    const t = (TEMPER_ORDER[a.temperament] ?? 1) - (TEMPER_ORDER[b.temperament] ?? 1);
    if (t !== 0) return t;
    const c = (CARE_ORDER[a.careLevel] ?? 1) - (CARE_ORDER[b.careLevel] ?? 1);
    if (c !== 0) return c;
    return a.name.localeCompare(b.name);
  });

  const overstocked = after && after.pct != null ? after.pct > 100 : false;

  return {
    ok: true,
    items,
    viable,
    blocked,
    order,
    totalFish: viable.reduce((n, i) => n + i.count, 0),
    load: { before: loadBefore, after: loadAfter },
    room: { before, after },
    overstocked,
    headline: !viable.length
      ? `None of your ${items.length} wishlist species can go in this tank as it stands.`
      : overstocked
        ? `All ${viable.length} would fit on paper, but together they'd overstock the tank.`
        : `${viable.length} of ${items.length} would work here${blocked.length ? `, ${blocked.length} wouldn't` : ""}.`,
  };
}

// A tank big enough for the whole list, for the "what would I need" answer that
// always follows "it doesn't fit".
export function tankSizeFor(wishNames = []) {
  const wanted = wishNames.map(speciesOf).filter(Boolean);
  if (!wanted.length) return null;
  const biggest = Math.max(...wanted.map((s) => s.minGallons || 0));
  // Inches of adult fish, at the rough gallon-per-inch the rest of the app uses
  // for bioload, so this can't contradict the stocking maths.
  const inches = wanted.reduce((n, s) => n + (s.adultInches || 1) * Math.max(1, s.minGroup > 1 ? s.minGroup : 1), 0);
  return Math.max(biggest, Math.ceil(inches));
}

// Catalog species that would fit the tank AND everything already in it — the
// constructive answer when the wishlist doesn't work out.
export function alternativesFor(tank = {}, limit = 4) {
  const current = tank.stock || [];
  const gallons = Number(tank.gallons) || 0;
  const water = tank.water || (current.length ? (speciesOf(current[0]) || {}).water : null);
  return SPECIES.filter((s) => {
    if (current.includes(s.name)) return false;
    if (water && s.water !== water) return false;
    if (gallons && s.minGallons > gallons) return false;
    return !current.some((n) => getCompatibility(s.name, n).level === "avoid");
  })
    .sort((a, b) => (CARE_ORDER[a.careLevel] ?? 1) - (CARE_ORDER[b.careLevel] ?? 1))
    .slice(0, limit);
}
