// ─────────────────────────────────────────────────────────────────────────────
// Reef supplement dosing.
//
// Alkalinity, calcium and magnesium have been tracked since the reef-chemistry
// batch, but tracking them only tells you something is low. Working out how much
// to add means knowing your product's strength, your real water volume, and
// then doing the arithmetic — which is exactly the moment people guess, and
// guessing alkalinity is how corals get burned.
//
// Everything here is conservative on purpose:
//   * A maximum safe daily change is enforced per parameter. Alkalinity is the
//     dangerous one — a large correction in a single dose can bleach an SPS
//     tank. Big gaps are split across days rather than dosed at once.
//   * Doses are computed from the actual water volume, not the tank's rated
//     size: rock and sand displace roughly 10%, so a "100 gallon" tank holds
//     closer to 90.
//   * Strengths are per-product and must be supplied by the keeper. There is no
//     universal ml-per-gallon, and inventing one would be worse than useless.
// ─────────────────────────────────────────────────────────────────────────────

// Typical reef targets. These are the widely used hobby ranges, and the app
// grades against them elsewhere too.
export const REEF_TARGETS = {
  alk: { label: "Alkalinity", unit: "dKH", min: 8, max: 9, safeDailyRise: 1.4 },
  calcium: { label: "Calcium", unit: "ppm", min: 400, max: 450, safeDailyRise: 50 },
  magnesium: { label: "Magnesium", unit: "ppm", min: 1300, max: 1400, safeDailyRise: 100 },
};

// How much of a rated tank is actually water, once rock and sand are in.
const DISPLACEMENT = 0.9;

export function actualWaterVolume(ratedGallons) {
  const g = Number(ratedGallons) || 0;
  return Math.round(g * DISPLACEMENT * 10) / 10;
}

// Works out a dosing plan to move one parameter to the middle of its target.
//
// `strengthPerUnit` — how much ONE ml of the product raises the parameter in
// one gallon of water. Straight from the product label; there is no default.
//
// Returns { ok, needed, totalMl, days, perDayMl, capped, reason }.
export function planDose({ key, current, ratedGallons, strengthPerUnit, targetOverride }) {
  const target = REEF_TARGETS[key];
  if (!target) return { ok: false, reason: "Unknown parameter" };

  const cur = Number(current);
  if (Number.isNaN(cur)) return { ok: false, reason: "Log a reading first" };

  const strength = Number(strengthPerUnit);
  if (!strength || strength <= 0) {
    return { ok: false, reason: "Enter how much 1 ml raises this in 1 gallon (check the product label)" };
  }

  const volume = actualWaterVolume(ratedGallons);
  if (!volume) return { ok: false, reason: "Set your tank size" };

  const goal = Number(targetOverride) || (target.min + target.max) / 2;
  const needed = Math.round((goal - cur) * 100) / 100;

  if (needed <= 0) {
    return { ok: true, needed: 0, totalMl: 0, days: 0, perDayMl: 0, capped: false, alreadyThere: true, target: goal };
  }

  const totalMl = Math.round((needed / strength / volume) * 100) / 100;

  // Split across days if the correction exceeds what's safe in one go.
  const days = Math.max(1, Math.ceil(needed / target.safeDailyRise));
  const perDayMl = Math.round((totalMl / days) * 100) / 100;

  return {
    ok: true,
    label: target.label,
    unit: target.unit,
    current: cur,
    target: goal,
    needed,
    volume,
    totalMl,
    days,
    perDayMl,
    // Flagged so the UI can explain WHY it's spread out rather than looking broken.
    capped: days > 1,
    safeDailyRise: target.safeDailyRise,
  };
}

// Checks the three reef parameters together and reports what's out of range.
//
// Order matters and is not cosmetic: magnesium holds calcium and alkalinity in
// solution, so correcting Ca or Alk while Mg is low mostly produces precipitate.
// Magnesium is always reported first when it's low.
export function getDosingPlan({ latestValues = {}, ratedGallons, strengths = {} } = {}) {
  const order = ["magnesium", "alk", "calcium"];
  const plans = [];

  order.forEach((key) => {
    const value = latestValues[key];
    if (value == null || value === "") return;
    const target = REEF_TARGETS[key];
    const cur = Number(value);
    if (Number.isNaN(cur)) return;

    const inRange = cur >= target.min && cur <= target.max;
    const plan = planDose({ key, current: cur, ratedGallons, strengthPerUnit: strengths[key] });

    plans.push({
      key,
      label: target.label,
      unit: target.unit,
      current: cur,
      inRange,
      low: cur < target.min,
      high: cur > target.max,
      plan,
    });
  });

  const magLow = plans.find((p) => p.key === "magnesium" && p.low);
  return {
    plans,
    // Surfaced as a warning rather than silently reordering, so the keeper
    // understands the chemistry instead of just following instructions.
    magnesiumFirst: Boolean(magLow && plans.some((p) => (p.key === "alk" || p.key === "calcium") && p.low)),
    anyLow: plans.some((p) => p.low),
    anyHigh: plans.some((p) => p.high),
  };
}
