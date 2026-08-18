// ─────────────────────────────────────────────────────────────────────────────
// Plausibility, for everything that isn't a water reading.
//
// data/waterParams.js has refused impossible readings since early on — a pH of
// 78 never reaches storage. Every other number the app accepts had no such
// check, so a slipped key or a pasted value went straight in:
//
//   • 1e15 ml of medication rendered as "9e+33 ml" — scientific notation in a
//     dosing instruction, which is both unusable and alarming
//   • a dose that size permanently poisons the consumption maths it feeds
//   • 1e15 lb of salt on the shelf gives a run-out date in the year 30,000
//   • 1e15 watts of equipment quotes a running cost in the trillions
//
// None of these crash. They produce confident nonsense, which is worse — the
// app looks like it's working and every figure downstream is wrong.
//
// The ceilings are deliberately generous: the point is to catch a typo, not to
// argue with somebody who genuinely runs a 2,000 gallon system. Anything over
// the limit is rejected as null rather than silently clamped, because a
// clamped value is a number nobody typed presented as one they did.
// ─────────────────────────────────────────────────────────────────────────────

// A positive number inside a plausible ceiling, or null.
export function boundedNumber(value, max, { allowZero = false } = {}) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  if (!allowZero && n === 0) return null;
  if (n > max) return null;
  return n;
}

// The ceilings, each with the real-world thing it's a ceiling on.
export const LIMITS = {
  // A 5kW aquarium heater does not exist; the biggest reef lights are ~1kW.
  watts: 5000,
  // Enough for a full custom build, in any currency.
  price: 1000000,
  // Fifty years of warranty.
  warrantyMonths: 600,
  // The largest recorded aquarium fish is a whale shark at ~400 inches; a home
  // aquarium coral colony tops out far below that.
  sizeInches: 480,
  // A day's dosing on a very large system.
  doseMl: 10000,
  // Public-aquarium scale.
  gallons: 500000,
  // Bulk salt is sold by the pallet; this is well past that.
  stock: 100000,
  // Consuming this much of anything per day is a typo.
  perDay: 10000,
  // Half a pound of salt makes a gallon; nothing sane is above this.
  perGallon: 1000,
};
