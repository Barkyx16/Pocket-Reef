// ─────────────────────────────────────────────────────────────────────────────
// The water you put IN.
//
// getWaterChangeEffect has taken a `sourceValues` argument since it was written
// and nothing has ever passed one. Every water-change prediction in the app has
// therefore assumed the replacement water is pure — which is true for good RODI
// and false for every tap in the country.
//
// The consequence is the single most demoralising experience in the hobby. A
// keeper with 20ppm nitrate out of the tap does water change after water change,
// watches nitrate sit at 20, and concludes they are doing it wrong. The app
// agreed with them: it predicted a drop that was arithmetically impossible.
//
// Recording one test of your source water fixes the predictions and, more
// importantly, explains the floor. "Your tap is the reason" is an answer; "do
// another water change" is not.
// ─────────────────────────────────────────────────────────────────────────────

import { activeParams } from "./targets";
import { assessParam } from "../data/waterParams";
import { todayKey } from "./day";

export const SOURCE_KINDS = [
  { id: "rodi", label: "RODI", blurb: "Reverse osmosis / deionised — usually reads zero across the board." },
  { id: "tap", label: "Tap", blurb: "Straight from the tap, dechlorinated." },
  { id: "well", label: "Well", blurb: "Private supply — often hard, sometimes high in nitrate." },
  { id: "store", label: "Store-bought", blurb: "Pre-mixed or RO water bought by the jug." },
];

export const kindOf = (id) => SOURCE_KINDS.find((k) => k.id === id) || SOURCE_KINDS[1];

// Only the parameters a water change actually dilutes are worth testing in
// source water. Nobody needs to know their tap's alkalinity to predict a
// nitrate drop, and asking for ten readings gets you none.
export const SOURCE_KEYS = ["nitrate", "phosphate", "ph", "gh", "ammonia"];

export function newSourceProfile({ kind = "tap", values = {}, testedAt } = {}) {
  const clean = {};
  Object.keys(values || {}).forEach((k) => {
    const v = Number(values[k]);
    if (SOURCE_KEYS.includes(k) && Number.isFinite(v) && v >= 0) clean[k] = v;
  });
  return {
    kind: kindOf(kind).id,
    values: clean,
    testedAt: testedAt || todayKey(),
  };
}

// The shape core.js's water-change maths expects.
export const sourceValuesFor = (tank = {}) => (tank.sourceWater && tank.sourceWater.values) || {};

// What a water change can and can't achieve, given what's coming out of the tap.
//
// A 100% change lands the tank exactly on the source value, so that IS the
// floor — no schedule reaches below it. Anything at or above the safe range
// means water changes are making the problem no better, and in the worst case
// worse.
export function analyseSource(tank = {}, waterType = "fresh") {
  const profile = tank.sourceWater;
  if (!profile || !Object.keys(profile.values || {}).length) {
    return { ok: false, reason: "Test your tap or RODI water once and Pocket Reef can tell you what your water changes can actually achieve." };
  }

  const params = activeParams(waterType).filter((p) => SOURCE_KEYS.includes(p.key));
  const latest = (tank.waterTests || [])[0];

  const findings = params.map((p) => {
    const source = profile.values[p.key];
    if (source == null) return null;

    const status = assessParam(p, source).status;
    const tankNow = latest && latest.values && latest.values[p.key] != null ? Number(latest.values[p.key]) : null;

    // Above the good band in the source water means changes push the tank
    // toward trouble rather than away from it.
    const harmful = status === "danger" || status === "caution";
    // At or above where the tank currently sits: a change can only dilute
    // toward the source, so it can't help this parameter at all.
    const useless = tankNow != null && source >= tankNow;

    return {
      key: p.key,
      label: p.label,
      unit: p.unit,
      source,
      tankNow,
      floor: source,
      status,
      harmful,
      useless,
      note: harmful
        ? `Your ${kindOf(profile.kind).label.toLowerCase()} water is already ${source}${p.unit ? ` ${p.unit}` : ""} — water changes can never take the tank below that, and will pull it up toward it.`
        : useless
          ? `At ${source}${p.unit ? ` ${p.unit}` : ""}, your source is no cleaner than the tank. Changing water won't move this one.`
          : `Water changes can bring this down toward ${source}${p.unit ? ` ${p.unit}` : ""}, and no further.`,
    };
  }).filter(Boolean);

  const problems = findings.filter((f) => f.harmful || f.useless);

  return {
    ok: true,
    kind: profile.kind,
    kindLabel: kindOf(profile.kind).label,
    testedAt: profile.testedAt,
    findings,
    problems,
    clean: problems.length === 0,
    headline: problems.length === 0
      ? `Your ${kindOf(profile.kind).label.toLowerCase()} water is clean — water changes will do what the app predicts.`
      : problems.length === 1
        ? `${problems[0].label} in your source water is limiting what a water change can do.`
        : `${problems.length} parameters in your source water are limiting your water changes.`,
    // The constructive half. RODI is the answer to a dirty tap and saying so
    // is more useful than repeating that the tap is dirty.
    advice: problems.length && profile.kind !== "rodi"
      ? "An RO/DI unit or store-bought RO water removes this ceiling entirely — it's the usual fix when the tap is the limit."
      : problems.length
        ? "RODI reading above zero usually means exhausted resin or a spent membrane — check your TDS meter."
        : null,
  };
}

// Does the source explain why a parameter won't come down? Used to turn a
// stubborn reading into an answer instead of another water change.
export function explainsStubborn(tank = {}, paramKey) {
  const values = sourceValuesFor(tank);
  const source = values[paramKey];
  if (source == null) return null;
  const latest = (tank.waterTests || [])[0];
  const tankNow = latest && latest.values ? Number(latest.values[paramKey]) : null;
  if (tankNow == null || Number.isNaN(tankNow)) return null;
  // Within 25% of the floor is "as low as it goes" for practical purposes.
  if (tankNow <= source * 1.25) {
    return `This is already about as low as water changes can take it — your source water reads ${source}.`;
  }
  return null;
}
