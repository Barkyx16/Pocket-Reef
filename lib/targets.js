import { PARAMS } from "../data/waterParams";
import { localiseParam } from "./units";

// ─────────────────────────────────────────────────────────────────────────────
// Per-tank parameter targets.
//
// The app graded every reading against one hardcoded band per water type. For
// nitrate on a reef that band is 0–20 "good". But an SPS-dominant tank is run
// at 2–5, a mixed reef around 10, an LPS/softie tank happily at 20, and a
// fish-only system at 40 with nothing wrong. One band tells three of those four
// keepers their healthy tank is out of range — and once an app is wrong about
// your water, you stop believing the rest of it.
//
// So: the built-in ranges become the *default*, not the law. A tank can carry
// its own targets, and everything downstream — the grade on the tile, trends,
// the health score, the "needs attention" list — reads through here.
//
// Targets are stored per tank, keyed by parameter, and only for the parameters
// actually customised. An empty `targets` object behaves exactly as before,
// which is what keeps this invisible to anyone who doesn't want it.
// ─────────────────────────────────────────────────────────────────────────────

// A few named starting points, because "type your own numbers for ten
// parameters" is a worse first experience than "pick the tank you're running".
// These are conventional hobby targets, not invented ones.
export const PRESETS = {
  salt: [
    {
      id: "mixed", label: "Mixed reef", blurb: "LPS, softies and a few SPS — the common reef",
      targets: { nitrate: { good: [2, 10], caution: [0, 20] }, phosphate: { good: [0.02, 0.08], caution: [0, 0.15] }, alk: { good: [8, 9.5], caution: [7.5, 11] } },
    },
    {
      id: "sps", label: "SPS dominant", blurb: "Low nutrients, tight alkalinity — stability is everything",
      targets: { nitrate: { good: [2, 5], caution: [0, 10] }, phosphate: { good: [0.02, 0.05], caution: [0, 0.08] }, alk: { good: [7.5, 8.5], caution: [7, 9] }, calcium: { good: [420, 450], caution: [400, 470] } },
    },
    {
      id: "lps", label: "LPS / softies", blurb: "Forgiving corals that like a little more food in the water",
      targets: { nitrate: { good: [5, 20], caution: [0, 30] }, phosphate: { good: [0.03, 0.1], caution: [0, 0.2] }, alk: { good: [8, 11], caution: [7, 12] } },
    },
    {
      id: "fowlr", label: "Fish only", blurb: "No corals — nutrients matter far less",
      targets: { nitrate: { good: [0, 40], caution: [0, 80] }, phosphate: { good: [0, 0.5], caution: [0, 1] } },
    },
  ],
  fresh: [
    {
      id: "community", label: "Community", blurb: "The standard mixed tropical tank",
      targets: {},
    },
    {
      id: "planted", label: "Planted", blurb: "Plants use nitrate — a little is fuel, not pollution",
      targets: { nitrate: { good: [5, 30], caution: [0, 50] }, ph: { good: [6.2, 7.5], caution: [5.5, 8.0] } },
    },
    {
      id: "cichlid", label: "African cichlid", blurb: "Hard, alkaline water by design",
      targets: { ph: { good: [7.8, 8.6], caution: [7.4, 9.0] }, gh: { good: [10, 20], caution: [8, 25] } },
    },
    {
      id: "shrimp", label: "Shrimp / soft water", blurb: "Soft, acidic, and very sensitive to nitrate",
      targets: { nitrate: { good: [0, 20], caution: [0, 30] }, ph: { good: [6.0, 7.0], caution: [5.5, 7.4] }, gh: { good: [4, 8], caution: [3, 10] } },
    },
  ],
};

export const getPresets = (waterType) => PRESETS[waterType] || PRESETS.fresh;

// The built-in definition for a parameter, used as the fallback and as the
// "reset to default" value.
export function builtInParam(waterType, key) {
  const list = PARAMS[waterType] || PARAMS.fresh;
  return list.find((p) => p.key === key) || null;
}

// Returns the parameter list a tank should actually be graded against: the
// built-ins with any custom target merged over the top.
//
// The merged entry keeps every other field (label, unit, tip, plausibility) and
// re-derives `ideal` so the placeholder and the reference card can't disagree
// with the range that's really in force — a stale "< 20 ppm" hint under a field
// graded at 5 is worse than no hint.
export function effectiveParams(waterType, targets = {}) {
  const list = PARAMS[waterType] || PARAMS.fresh;
  if (!targets || !Object.keys(targets).length) return list;

  return list.map((p) => {
    const t = targets[p.key];
    if (!t || !validTarget(t)) return p;
    const good = t.good;
    // A custom good band with no custom caution band still needs one, or every
    // reading a hair outside "good" would grade as danger. Widen by the same
    // proportion the built-in used.
    const caution = validRange(t.caution) ? t.caution : derivedCaution(p, good);
    return { ...p, good, caution, ideal: formatIdeal(good, p.unit), custom: true };
  });
}

const validRange = (r) => Array.isArray(r) && r.length === 2 && typeof r[0] === "number" && typeof r[1] === "number" && !Number.isNaN(r[0]) && !Number.isNaN(r[1]) && r[0] <= r[1];
export const validTarget = (t) => !!t && validRange(t.good) && (t.caution === undefined || validRange(t.caution));

// Mirrors how far the built-in caution band sits outside its good band, so a
// custom range inherits the same tolerance rather than an arbitrary one.
function derivedCaution(p, good) {
  const bGood = p.good, bCaution = p.caution;
  const padLo = Math.max(0, bGood[0] - bCaution[0]);
  const padHi = Math.max(0, bCaution[1] - bGood[1]);
  return [Math.max(0, good[0] - padLo), good[1] + padHi];
}

// "8–9.5 dKH", "< 10 ppm", "0 ppm" — matching how the built-ins read.
export function formatIdeal([lo, hi], unit) {
  const u = unit ? ` ${unit}` : "";
  if (lo === hi) return `${lo}${u}`;
  if (lo === 0) return `< ${hi}${u}`;
  return `${lo}–${hi}${u}`;
}

// Only the parameters a tank has actually customised, for the "you've changed
// these" summary and the per-parameter reset.
export function customisedKeys(targets = {}) {
  return Object.keys(targets).filter((k) => validTarget(targets[k]));
}

// Applies a preset, keeping any parameter the keeper has already hand-tuned.
// Someone who set their own alkalinity and then taps "SPS dominant" means
// "everything else like SPS", not "throw away my number".
export function applyPreset(existing = {}, preset) {
  if (!preset || !preset.targets) return existing;
  const next = { ...preset.targets };
  Object.keys(existing).forEach((k) => { if (validTarget(existing[k])) next[k] = existing[k]; });
  return next;
}

// ── The active tank's targets ────────────────────────────────────────────────
//
// Grading happens in fifteen places — the entry tiles, trends, averages, the
// reference card, the health score, the forecast, today's actions, the CSV
// export. Threading a `targets` prop through all of them would touch every
// screen and every core function, and any site that forgot would grade against
// a different range than the one shown to the user, which is worse than not
// having the feature.
//
// So targets follow the same pattern this codebase already uses for language
// and units: one active value, set when the tank changes, read wherever it's
// needed. Only one tank is ever being graded at a time, which is what makes
// this safe rather than a global-state smell.
let activeTargets = {};

export function setActiveTargets(targets) {
  activeTargets = targets && typeof targets === "object" ? targets : {};
}

export const getActiveTargets = () => activeTargets;

// Drop-in replacement for `PARAMS[waterType] || PARAMS.fresh`.
export function activeParams(waterType) {
  return effectiveParams(waterType, activeTargets);
}

// The same list, with temperature converted to the keeper's unit.
//
// Deliberately separate from activeParams: core grades STORED values, which
// are always °F, so localising the band there would compare 78°F against a
// 23–27°C band and mark a healthy tank as freezing. Only surfaces that convert
// the value too — the entry form and the reference card — use this.
export function displayParams(waterType) {
  return activeParams(waterType).map(localiseParam);
}
