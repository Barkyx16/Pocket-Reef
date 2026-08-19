import { Dimensions } from "react-native";
import SPECIES from "./data/speciesData";
import { getCompatibility } from "./data/compatibility";
import { DISEASES, getDisease, getDiseasesForSpecies, SYMPTOMS, getDiseasesBySymptom } from "./data/fishHealth";
import { PARAMS, assessParam, validateParam } from "./data/waterParams";
import { ACHIEVEMENTS } from "./data/achievements";
import { TROUBLESHOOTING } from "./data/troubleshooting";
import { TREATMENTS, getTreatment, getTreatableDiseases } from "./data/treatments";
import { activeParams } from "./lib/targets";
import { allTasks, sortedByUrgency } from "./lib/upkeep";
import { dayKey as localDayKey, instantOf as localInstantOf } from "./lib/day";
import { formatVolume, formatTempRange } from "./lib/units";

// Launch-time snapshot. Correct for one-off calculations that don't need to
// survive rotation; anything that lays out should use useWindowDimensions.
export const { width: SCREEN_WIDTH } = Dimensions.get("window");

export { SPECIES, getCompatibility, DISEASES, getDisease, getDiseasesForSpecies, SYMPTOMS, getDiseasesBySymptom, PARAMS, assessParam, validateParam, ACHIEVEMENTS, TROUBLESHOOTING, TREATMENTS, getTreatment, getTreatableDiseases };

const byName = Object.fromEntries(SPECIES.map((s) => [s.name, s]));
export function getSpecies(name) {
  return byName[name] || null;
}

// ── Personalization: "what fits my tank" (the ZIP→zone analog) ───────────────
export function speciesFitsTank(species, gallons) {
  if (!gallons) return true;
  return species.minGallons <= gallons;
}

// ── "Should this fish go in this tank?" ──────────────────────────────────────
//
// One verdict, used both by the species detail screen and by the moment of
// adding. The detail screen has always answered this; the "+" on a species card
// did not, so the common path — browse the catalog, tap the plus — added a Blue
// Tang to a 20 gallon tank in silence and only complained afterwards, on Home,
// under "tank warnings". By then the fish has usually been bought.
//
// `severity` separates the two kinds of no: "blocked" is physically impossible
// (wrong water type), "warn" is a bad idea the keeper is still allowed to make
// — a quarantine tank is deliberately undersized, and an app that refuses to
// record what's actually in the tank is an app people stop telling the truth to.
export function assessAddition(name, { tank = [], tankGallons = 0, tankWater = null } = {}) {
  const s = getSpecies(name);
  if (!s) return { ok: true, severity: "ok", reason: "" };

  const others = tank.filter((n) => n !== name);
  // The declared type when there is one, falling back to what's swimming.
  const water = tankWater || (others.length ? (getSpecies(others[0]) || {}).water : null);

  if (water && water !== s.water) {
    return {
      ok: false,
      severity: "blocked",
      title: "Wrong water type",
      reason: `${s.name} is a ${s.water === "salt" ? "saltwater" : "freshwater"} species and this is a ${water === "salt" ? "saltwater" : "freshwater"} tank. They can't share water.`,
    };
  }

  if (tankGallons && s.minGallons > tankGallons) {
    return {
      ok: false,
      severity: "warn",
      title: "Bigger tank needed",
      reason: `${s.name} needs at least ${formatVolume(s.minGallons)} and this tank is ${formatVolume(tankGallons)}. Cramped fish grow slowly, foul the water faster, and turn on each other.`,
    };
  }

  const clash = others
    .map((n) => ({ n, c: getCompatibility(name, n) }))
    .find((x) => x.c.level === "avoid");
  if (clash) {
    return {
      ok: false,
      severity: "warn",
      title: `Conflicts with ${clash.n}`,
      reason: clash.c.reason,
    };
  }

  // A schooling fish added alone is the quietest mistake in the hobby: nothing
  // looks wrong, the fish is simply stressed for the rest of its life.
  if (s.minGroup > 1) {
    return {
      ok: true,
      severity: "note",
      title: "Keep them in a group",
      reason: `${s.name} needs at least ${s.minGroup} together — kept alone they hide, stop eating, and colour down.`,
    };
  }

  return { ok: true, severity: "ok", reason: "" };
}

// ── Tank health: warnings for the currently stocked list ─────────────────────
// Mirrors the garden conflict checker — combines compatibility, group minimums,
// a rough bioload estimate, and tank-size fit into one actionable list.
export function getTankWarnings(gallons, stockedNames = [], quantities = {}) {
  const stocked = stockedNames.map(getSpecies).filter(Boolean);
  const warnings = [];

  // Water-type mixing (fatal) + pairwise compatibility conflicts.
  for (let i = 0; i < stocked.length; i++) {
    for (let j = i + 1; j < stocked.length; j++) {
      const c = getCompatibility(stocked[i].name, stocked[j].name);
      if (c.level === "avoid") warnings.push({ level: "avoid", text: `${stocked[i].name} + ${stocked[j].name}: ${c.reason}` });
      else if (c.level === "caution") warnings.push({ level: "caution", text: `${stocked[i].name} + ${stocked[j].name}: ${c.reason}` });
    }
  }

  // Tank too small for a species.
  stocked.forEach((s) => {
    if (gallons && s.minGallons > gallons) {
      warnings.push({ level: "avoid", text: `${s.name} needs at least ${formatVolume(s.minGallons)} — your tank is ${formatVolume(gallons)}.` });
    }
  });

  // Rough bioload: sum of adult inches (× how many you keep) vs the old
  // "inch per gallon" guideline.
  if (gallons) {
    const inches = Math.round(stocked.reduce((sum, s) => sum + (s.adultInches || 0) * (quantities[s.name] || 1) * bioWeight(s), 0) * 10) / 10;
    if (inches > gallons) {
      warnings.push({ level: "caution", text: `Stocking looks heavy (~${inches}" of fish for ${formatVolume(gallons)}) — watch water quality closely.` });
    }
  }

  // Schooling shortfall — only once the keeper has set a count (an explicit
  // quantity below the species' group minimum), so untouched tanks stay quiet.
  stocked.forEach((s) => {
    const q = quantities[s.name];
    if (s.minGroup > 1 && q != null && q < s.minGroup) {
      warnings.push({ level: "caution", text: `You keep ${q} ${s.name} — a group of ${s.minGroup}+ keeps this schooling species calm and confident.` });
    }
  });

  return warnings;
}

// Bioload / stocking level — a rough capacity gauge using the classic
// "inch of fish per gallon" guideline. Returns a percentage and status band.
// Bioload weight by kind — corals add essentially no waste; inverts (shrimp,
// snails, crabs) far less than a fish of the same length. Fish are the baseline.
// How much a species counts toward the stocking budget. Corals add none,
// inverts a fraction, fish the full length. Exported because the stocking
// planner needs the identical rule — two copies of it agreed today and had
// nothing keeping them in step.
export const bioWeight = (s) => (s && s.kind === "coral" ? 0 : s && s.kind === "invert" ? 0.3 : 1);

export function getBioload(gallons, stockedNames = [], quantities = {}) {
  const stocked = stockedNames.map(getSpecies).filter(Boolean);
  const inches = stocked.reduce((sum, s) => sum + (s.adultInches || 0) * (quantities[s.name] || 1) * bioWeight(s), 0);
  const capacity = gallons || 1;
  const pct = Math.min(200, Math.round((inches / capacity) * 100));
  const level = pct <= 70 ? "Comfortable" : pct <= 100 ? "Getting full" : "Overstocked";
  const color = pct <= 70 ? "#38e1c6" : pct <= 100 ? "#ffd86b" : "#ff7b7b";
  return { inches: Math.round(inches * 10) / 10, capacity, pct, level, color };
}

// How much stocking headroom is left, and roughly how many more fish fit — a
// simple planner built on the "inch per gallon" guideline and current bioload.
export function getStockingRoom(gallons, stockedNames = [], quantities = {}) {
  if (!gallons) return null;
  const bio = getBioload(gallons, stockedNames, quantities);
  const roomInches = Math.max(0, Math.round((gallons - bio.inches) * 10) / 10);
  return {
    roomInches,
    pct: bio.pct,
    inches: bio.inches,
    small: Math.floor(roomInches / 2),   // ~2" nano fish
    medium: Math.floor(roomInches / 4),  // ~4" community fish
    full: bio.pct >= 100,
  };
}

// "Recommended for your tank" — species that FIT the tank, match its water type,
// and are compatible (no conflicts) with everything already stocked. The direct
// payoff of the compatibility engine. Sorts easy/peaceful species first.
export function getRecommended(gallons, stockedNames = [], limit = 8, tankWater = null) {
  const stocked = stockedNames.map(getSpecies).filter(Boolean);
  const waterType = stocked.length ? stocked[0].water : tankWater;
  const results = [];
  for (const s of SPECIES) {
    if (stockedNames.includes(s.name)) continue;
    if (gallons && s.minGallons > gallons) continue;
    if (waterType && s.water !== waterType) continue;
    let ok = true;
    for (const st of stocked) {
      if (getCompatibility(s.name, st.name).level === "avoid") { ok = false; break; }
    }
    if (ok) results.push(s);
  }
  // Rank: species that get along *excellently* with the whole stock first, then
  // peaceful/easy picks. A species that only triggers a "caution" with something
  // already stocked is still shown, just below the clean matches.
  const cautionCount = (s) => stocked.reduce((n, st) => n + (getCompatibility(s.name, st.name).level === "caution" ? 1 : 0), 0);
  const score = (s) => (cautionCount(s) === 0 ? 4 : -2 * cautionCount(s)) + (s.temperament === "peaceful" ? 2 : s.temperament === "semi-aggressive" ? 1 : 0) + (s.careLevel === "Easy" ? 1 : 0);
  results.sort((a, b) => score(b) - score(a));
  return results.slice(0, limit);
}

// Overall one-word status for the tank, for the Home summary.
export function getTankStatus(gallons, stockedNames = [], quantities = {}) {
  const w = getTankWarnings(gallons, stockedNames, quantities);
  if (w.some((x) => x.level === "avoid")) return { label: "Needs attention", color: "#ff7b7b" };
  if (w.some((x) => x.level === "caution")) return { label: "Watch closely", color: "#ffd86b" };
  if (!stockedNames.length) return { label: "Empty", color: "#8fb8cf" };
  return { label: "Thriving", color: "#38e1c6" };
}

// ── Species detail enrichment ────────────────────────────────────────────────
// Contextual care tips derived from a species' own fields (no extra data to
// author) — the reef version of Pocket Planter's per-plant quick tips.
export function getCareTips(s) {
  if (!s) return [];
  const tips = [];
  if (s.minGroup > 1) tips.push(`Keep in a group of ${s.minGroup}+ — this is a social/schooling species that's stressed and skittish when kept alone.`);
  if (s.temperament === "aggressive") tips.push("Aggressive temperament — best kept alone or with very carefully chosen, robust tankmates.");
  else if (s.temperament === "semi-aggressive") tips.push("Semi-aggressive — give it space and add it later so it can't bully established fish.");
  if (s.diet === "herbivore") tips.push("Herbivore — offer algae or marine-based foods and plenty of grazing material.");
  else if (s.diet === "carnivore") tips.push("Carnivore — feed meaty foods like frozen mysis or brine shrimp.");
  else if (s.diet === "photosynthetic") tips.push("Gets most of its energy from light — provide appropriate lighting and stable flow.");
  if (s.kind === "fish" && s.reefSafe === false) tips.push("Not reef-safe — it will nip corals or eat inverts, so keep it in a fish-only setup.");
  if (s.kind === "fish" && s.reefSafe === true) tips.push("Reef-safe — a good citizen in a coral tank.");
  if (s.careLevel === "Advanced") tips.push("Advanced care — best for experienced keepers with a stable, mature system.");
  if (s.adultInches >= 10) tips.push(`Grows large (~${s.adultInches}") — make sure you have the long-term space and filtration.`);
  tips.push(`Give it at least ${formatVolume(s.minGallons)}, held at ${formatTempRange(s.tempMinF, s.tempMaxF)}.`);
  return tips;
}

// ── Tankmate intelligence ────────────────────────────────────────────────────
// Companion-planting for the reef: categorize other species (same water type)
// into great tankmates, keep-an-eye-on, and avoid — the compatibility engine
// applied across the whole catalog. Each list is capped for a tidy UI; "great"
// is ranked peaceful/easy first.
export function getTankmates(name, perCat = 6) {
  const s = getSpecies(name);
  if (!s) return { great: [], caution: [], avoid: [] };
  const great = [], caution = [], avoid = [];
  for (const o of SPECIES) {
    if (o.name === name || o.water !== s.water) continue;
    const level = getCompatibility(name, o.name).level;
    if (level === "excellent") great.push(o.name);
    else if (level === "caution") caution.push(o.name);
    else if (level === "avoid") avoid.push(o.name);
  }
  const score = (n) => { const x = getSpecies(n); return (x.temperament === "peaceful" ? 2 : x.temperament === "semi-aggressive" ? 1 : 0) + (x.careLevel === "Easy" ? 1 : 0); };
  great.sort((a, b) => score(b) - score(a));
  return { great: great.slice(0, perCat), caution: caution.slice(0, perCat), avoid: avoid.slice(0, perCat) };
}

// "More like this" — nearest species by care profile within the same water type
// and kind. Powers the species-detail recommendations.
export function getSimilarSpecies(s, limit = 4) {
  if (!s) return [];
  return SPECIES.filter((o) => o.name !== s.name && o.water === s.water && o.kind === s.kind)
    .map((o) => ({ o, d: Math.abs((o.adultInches || 0) - (s.adultInches || 0)) + (o.temperament !== s.temperament ? 3 : 0) + (o.careLevel !== s.careLevel ? 2 : 0) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.o);
}

// ── Nitrogen cycle status ────────────────────────────────────────────────────
// Reads the latest water test to place a new tank on the cycle: ammonia → nitrite
// → nitrate/cycled. The thing every new aquarist watches obsessively.
export function getCycleStatus(waterTests = []) {
  const latest = waterTests[0];
  if (!latest || !latest.values) {
    return { stage: 0, label: "Not started", guidance: "Begin a fishless cycle: add an ammonia source and test daily. Bacteria take 4–8 weeks to establish.", cycled: false };
  }
  const { ammonia: am, nitrite: ni, nitrate: na } = latest.values;
  if (am != null && ni != null && na != null && am === 0 && ni === 0 && na > 0) {
    return { stage: 3, label: "Cycled ✓", guidance: "Ammonia and nitrite read 0 with nitrate present — your tank is cycled and ready. Add livestock slowly.", cycled: true };
  }
  if (ni != null && ni > 0) {
    return { stage: 2, label: "Nitrite stage", guidance: "Nitrite has appeared — the second bacteria colony is establishing. Keep testing; don't add fish yet.", cycled: false };
  }
  if (am != null && am > 0) {
    return { stage: 1, label: "Ammonia stage", guidance: "Ammonia is present — the first bacteria are colonizing. Nitrite should appear next.", cycled: false };
  }
  return { stage: 0, label: "In progress", guidance: "Keep testing daily until ammonia and nitrite hit 0 and nitrate appears.", cycled: false };
}

// ── Cycling coach ────────────────────────────────────────────────────────────
// getCycleStatus reports which stage you're in. It doesn't tell you what to DO,
// and cycling is where beginners lose fish — usually by adding them during the
// nitrite spike because the ammonia reading looked fine.
//
// This turns the stage plus the reading history into the next concrete action,
// and an honest estimate of time remaining.
const CYCLE_STAGES = [
  {
    stage: 0,
    title: "Start the cycle",
    action: "Add an ammonia source and test daily",
    detail: "Dose ammonia to about 2 ppm, or use a piece of food to rot. Nothing living goes in yet — a fish-in cycle burns gills.",
    typicalDays: 7,
  },
  {
    stage: 1,
    title: "Ammonia stage",
    action: "Keep ammonia topped up and keep testing",
    detail: "The first bacteria are colonizing. Hold ammonia around 2 ppm — let it hit zero now and the colony you're building starves.",
    typicalDays: 14,
  },
  {
    stage: 2,
    title: "Nitrite spike",
    action: "Hold your nerve — do not add fish",
    detail: "Nitrite is more toxic than ammonia and this is the longest stage. This is the exact point most people give up and stock the tank.",
    typicalDays: 21,
  },
  {
    stage: 3,
    title: "Cycled",
    action: "Large water change, then stock slowly",
    detail: "Ammonia and nitrite at zero within 24 hours of dosing, with nitrate present. Change 50% to drop nitrate, then add a few fish at a time.",
    typicalDays: 0,
  },
];

export function getCyclingCoach(waterTests = [], tankCreatedAt = null) {
  const status = getCycleStatus(waterTests);
  const info = CYCLE_STAGES.find((c) => c.stage === status.stage) || CYCLE_STAGES[0];

  // How long has this been going? Prefer the first test, since a tank profile
  // may have been created long before the cycle started.
  const oldest = waterTests.length ? waterTests[waterTests.length - 1].date : tankCreatedAt;
  const daysIn = oldest ? Math.max(0, Math.floor((Date.now() - new Date(oldest).getTime()) / 86400000)) : 0;

  // Cumulative typical duration to the END of the current stage.
  const totalTypical = CYCLE_STAGES.filter((c) => c.stage <= status.stage).reduce((n, c) => n + c.typicalDays, 0);
  const estimateRemaining = status.cycled ? 0 : Math.max(0, totalTypical - daysIn);

  // Tested at all recently? A cycle you're not measuring isn't being managed.
  const lastTest = waterTests[0] ? Math.floor((Date.now() - localInstantOf(waterTests[0].date)) / 86400000) : null;

  return {
    ...status,
    ...info,
    daysIn,
    estimateRemaining,
    // Deliberately soft language downstream — cycles vary enormously with
    // temperature, seeding and source water, and a hard date would be wrong.
    estimateConfident: waterTests.length >= 3,
    lastTestDaysAgo: lastTest,
    needsTest: lastTest == null || lastTest >= 2,
    totalStages: CYCLE_STAGES.length - 1,
  };
}

// ── Fixing a bad pairing ─────────────────────────────────────────────────────
// The compatibility matrix says a pair won't work and then leaves the keeper
// with a fish they've already bought and no idea what to do. This finds
// replacements: species that fill a similar role and DO get along with
// everything else in the tank.
export function getConflictFixes(gallons, stockedNames = [], limit = 3) {
  const stocked = stockedNames.map(getSpecies).filter(Boolean);
  const fixes = [];

  for (let i = 0; i < stocked.length; i++) {
    for (let j = i + 1; j < stocked.length; j++) {
      const c = getCompatibility(stocked[i].name, stocked[j].name);
      if (c.level !== "avoid") continue;

      // Replacing either fish would resolve it — suggest for both, and let the
      // keeper decide which one they're less attached to.
      [[stocked[i], stocked[j]], [stocked[j], stocked[i]]].forEach(([drop, keep]) => {
        const others = stocked.filter((s) => s.name !== drop.name);

        const alternatives = SPECIES.filter((cand) => {
          if (stockedNames.includes(cand.name)) return false;
          if (cand.water !== drop.water) return false;
          if (cand.kind !== drop.kind) return false;
          if (gallons && cand.minGallons > gallons) return false;
          // Similar size bracket, so it fills the same visual role.
          const ratio = (cand.adultInches || 1) / (drop.adultInches || 1);
          if (ratio < 0.5 || ratio > 1.6) return false;
          // And it has to actually work with everything staying.
          //
          // The levels this engine emits are "excellent" | "caution" | "avoid"
          // (see data/compatibility.js). This tested for "great" and "ok",
          // which it has never returned — so the filter matched nothing, the
          // alternatives list was always empty, and getConflictFixes returned
          // an empty array for every tank ever built. The whole function was
          // dead on arrival because of a vocabulary that didn't exist.
          return others.every((o) => getCompatibility(cand.name, o.name).level === "excellent");
        })
          .sort((a, b) => (a.careLevel === "Easy" ? -1 : 1) - (b.careLevel === "Easy" ? -1 : 1))
          .slice(0, limit);

        if (alternatives.length) {
          fixes.push({
            conflict: `${stocked[i].name} + ${stocked[j].name}`,
            reason: c.reason,
            replace: drop.name,
            keeping: keep.name,
            alternatives: alternatives.map((a) => ({ name: a.name, emoji: a.emoji, careLevel: a.careLevel, adultInches: a.adultInches })),
          });
        }
      });
    }
  }

  return fixes;
}

// ── Feeding, sized to the actual stock ───────────────────────────────────────
// The feeding guide was generic. What a keeper needs is how much, how often,
// and what type for THEIR fish — herbivores need grazing material, carnivores
// need protein and fewer feeds, and fry-sized nano fish need more frequent,
// smaller meals than a cichlid.
export function getFeedingPlan(stockedNames = [], quantities = {}) {
  const stocked = stockedNames.map(getSpecies).filter(Boolean).filter((s) => s.kind !== "coral");
  if (!stocked.length) return { ok: false, reason: "Add some stock and Pocket Reef will size your feeding routine.", groups: [] };

  const groups = [];
  const byDiet = {};
  stocked.forEach((s) => {
    const q = quantities[s.name] || 1;
    (byDiet[s.diet] = byDiet[s.diet] || []).push({ species: s, count: q });
  });

  const DIET_ADVICE = {
    herbivore: { food: "Algae wafers, nori, blanched vegetables", note: "Herbivores graze constantly in the wild — leave grazing material in rather than one large meal." },
    carnivore: { food: "Frozen or live meaty foods, quality pellets", note: "Carnivores do better on fewer, larger meals. A fast day each week is normal and healthy." },
    omnivore: { food: "Quality flake or pellet, plus frozen treats", note: "Vary it. A single dry food long-term is the most common cause of dull colour." },
    "filter feeder": { food: "Phytoplankton or powdered filter food", note: "Filter feeders need food in the water column, not on the substrate — target-feed with the pumps off." },
  };

  Object.keys(byDiet).forEach((diet) => {
    const members = byDiet[diet];
    const totalFish = members.reduce((n, m) => n + m.count, 0);
    const advice = DIET_ADVICE[diet] || DIET_ADVICE.omnivore;
    // Small fish have small stomachs and faster metabolisms.
    const avgInches = members.reduce((n, m) => n + (m.species.adultInches || 1) * m.count, 0) / Math.max(1, totalFish);
    const perDay = diet === "carnivore" ? 1 : avgInches < 2 ? 2 : 1;

    groups.push({
      diet,
      fishCount: totalFish,
      species: members.map((m) => ({ name: m.species.name, count: m.count })),
      timesPerDay: perDay,
      food: advice.food,
      note: advice.note,
      portion: "Only what's eaten in about two minutes — uneaten food becomes ammonia.",
    });
  });

  return {
    ok: true,
    groups,
    totalFish: stocked.reduce((n, s) => n + (quantities[s.name] || 1), 0),
    // The one rule that matters more than any schedule.
    goldenRule: "Underfeeding is nearly harmless; overfeeding is the most common cause of a crashed tank.",
  };
}

// ── "Today" action hub ───────────────────────────────────────────────────────
// Combines every signal — overdue maintenance, a due water test, a finished
// quarantine, unfinished care, an incomplete cycle — into one prioritized list
// of what to do right now.
// Which parameter set a tank should be judged by.
//
// Three places derived this independently, and all three got it wrong the same
// way: they read the water type off the FIRST STOCKED SPECIES and fell back to
// "fresh" when the tank was empty. So a saltwater tank with nothing in it yet —
// which is precisely a tank being cycled, when you test every single day — was
// offered the six freshwater parameters. No salinity, no alkalinity, no
// calcium, no magnesium, no phosphate: the readings that matter most during a
// reef cycle could not be entered at all, and the ones that could were graded
// against freshwater ranges.
//
// The declared tank type is the answer whenever there's no stock to read. Stock
// still wins when it exists, because a tank created before the `water` field
// existed defaults to "fresh" regardless of what's swimming in it, and those
// keepers must not be broken to fix the empty-tank case.
export function resolveWaterType(tank = [], declared = "fresh") {
  const fallback = declared === "salt" ? "salt" : "fresh";
  if (!tank.length) return fallback;
  const first = getSpecies(tank[0]);
  return first && first.water ? first.water : fallback;
}

export function getTodayActions({ tank = [], waterTests = [], maintenance = {}, quarantine = [], careDoneCount = 0, careTotal = 4, reminderPrefs = {}, quantities = {}, waterType = "fresh", treatments = [], upkeep = [] } = {}) {
  // Default parameters only cover `undefined`, not `null`. A partial sync or a
  // hand-edited import can hand us null here, and maintenance[id] on null
  // throws — taking down the Home screen, which is where this is rendered.
  tank = Array.isArray(tank) ? tank : [];
  waterTests = Array.isArray(waterTests) ? waterTests : [];
  quarantine = Array.isArray(quarantine) ? quarantine : [];
  treatments = Array.isArray(treatments) ? treatments : [];
  maintenance = maintenance && typeof maintenance === "object" ? maintenance : {};
  quantities = quantities && typeof quantities === "object" ? quantities : {};
  reminderPrefs = reminderPrefs && typeof reminderPrefs === "object" ? reminderPrefs : {};

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const daysAgo = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  const cadenceDays = (pref) => (pref === "biweekly" ? 14 : pref === "weekly" ? 7 : null); // null = off
  const out = [];

  // Overdue upkeep. This was a hardcoded list of three chores, so an overdue
  // RODI membrane, filter sock or probe calibration — or anything the keeper
  // added themselves — could never reach the Home screen. It now reads the same
  // task list the Upkeep card does, so the two can't disagree.
  //
  // Capped at three: "needs attention" stops being a priority list the moment
  // it becomes a backlog, and the card itself shows the rest in full.
  const overdue = sortedByUrgency(
    allTasks({ water: waterType, upkeep }),
    maintenance
  ).filter((r) => r.status.state === "overdue" && r.task.id !== "waterchange"); // water change is reminder-driven below

  overdue.slice(0, 3).forEach(({ task, status }) => {
    const over = -status.dueIn;
    out.push({ rank: 0, icon: "🔴", to: "log", text: `${cap(task.label)} overdue by ${over} day${over > 1 ? "s" : ""}` });
  });

  if (tank.length) {
    // Water test — honors the user's reminder cadence (default weekly).
    const testDays = cadenceDays(reminderPrefs.waterTest || "weekly");
    const last = waterTests[0];
    if (!last) out.push({ rank: 1, icon: "🧪", to: "log", text: "Log your first water test" });
    else if (testDays != null) { const since = daysAgo(last.date); if (since >= testDays) out.push({ rank: 1, icon: "🧪", to: "log", text: `Test your water — last test ${since} days ago` }); }

    // Water change — honors the user's reminder cadence (default weekly).
    const wcDays = cadenceDays(reminderPrefs.waterChange || "weekly");
    if (wcDays != null) {
      const lastWc = maintenance.waterchange;
      if (!lastWc && waterTests.length) out.push({ rank: 1, icon: "💧", to: "log", text: "Log your first water change" });
      else if (lastWc) { const since = daysAgo(lastWc); if (since >= wcDays) out.push({ rank: since >= wcDays * 2 ? 0 : 1, icon: since >= wcDays * 2 ? "🔴" : "💧", to: "log", text: `Water change due — last one ${since} days ago` }); }
    }

    const cyc = getCycleStatus(waterTests);
    if (waterTests.length && !cyc.cycled) out.push({ rank: 1, icon: "🔄", to: "log", text: `Tank still cycling — ${cyc.label}` });

    // Complete-your-school — a schooling species kept below its group minimum.
    tank.map(getSpecies).filter(Boolean).forEach((s) => {
      const c = quantities[s.name];
      if (s.minGroup > 1 && c != null && c < s.minGroup) {
        out.push({ rank: 2, icon: "🐟", to: "species", text: `Add ${s.minGroup - c} more ${s.name} to complete the school` });
      }
    });
  }
  // Nitrate creeping up on the latest test → nudge a water change.
  if (tank.length && waterTests[0] && waterTests[0].values) {
    // waterType arrives as a parameter; re-deriving it here from stock was how
    // this drifted out of step with the rest of the screen.
    const wt = resolveWaterType(tank, waterType);
    const nP = (activeParams(wt)).find((p) => p.key === "nitrate");
    const nv = waterTests[0].values.nitrate;
    if (nP && nv != null) {
      const st = assessParam(nP, nv).status;
      if (st === "danger") out.push({ rank: 0, icon: "💧", to: "log", text: `Nitrate is high (${nv} ppm) — do a water change` });
      else if (st === "caution") out.push({ rank: 1, icon: "💧", to: "log", text: `Nitrate is creeping up (${nv} ppm) — a water change would help` });
    }
  }
  // Quarantine deliberately produces nothing here. It used to announce a fish
  // "ready to add" on day 21 regardless of what the animal looked like, and
  // lib/quarantine.js now owns the verdict properly — time plus explicit
  // clearance checks. With both running, the hub printed two contradictory
  // lines about the same fish and the reassuring one was the wrong one.
  // lib/todayExtras.js contributes the quarantine actions instead.
  if (tank.length && careDoneCount < careTotal) out.push({ rank: 2, icon: "💧", to: "home", text: `${careTotal - careDoneCount} care task${careTotal - careDoneCount > 1 ? "s" : ""} left today` });
  // Treatment steps due today. These outrank almost everything else — a missed
  // medication day can undo the whole course.
  (treatments || []).forEach((tr) => {
    const prog = getTreatmentProgress(tr.disease, tr.startedAt, tr.doneSteps || []);
    if (!prog) return;
    prog.overdue.forEach((step) => {
      out.push({ rank: 0, icon: "🔴", to: "health", text: `${tr.disease}: "${step.title}" is overdue (day ${step.day})` });
    });
    prog.dueToday.filter((step) => !step.done).forEach((step) => {
      out.push({ rank: 0, icon: "💊", to: "health", text: `${tr.disease} day ${prog.day}: ${step.title}` });
    });
  });

  // A parameter heading out of range. The whole point of forecasting is that
  // this reaches the user BEFORE the reading is bad, so it belongs in Today
  // rather than only on a card they'd have to go looking for.
  getParamForecasts(waterTests, waterType, tank).forEach((f) => {
    if (f.daysToEdge == null) return; // no confident date, no nag
    if (f.daysToEdge <= 14) {
      out.push({
        rank: f.daysToEdge <= 5 ? 0 : 1,
        icon: f.daysToEdge <= 5 ? "🔴" : "📈",
        to: "log",
        text: `${f.label} is ${f.direction} — out of range in about ${f.daysToEdge} day${f.daysToEdge === 1 ? "" : "s"}`,
      });
    }
  });

  return out.sort((a, b) => a.rank - b.rank);
}

// ── Tank age & maturity ──────────────────────────────────────────────────────
// How long a tank has been running, and a plain-language maturity stage. New
// tanks are fragile (still maturing biologically); older ones are stable.
export function getTankMaturity(createdAt) {
  if (!createdAt) return null;
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  if (days < 0) return null;
  let stage, color;
  if (days < 42) { stage = "Maturing"; color = "#ffd86b"; }        // < 6 weeks: cycling/settling
  else if (days < 180) { stage = "Established"; color = "#7ff0dd"; } // 6wk–6mo
  else { stage = "Mature"; color = "#38e1c6"; }                     // 6mo+
  return { days, stage, color };
}

// ── Water-test delta ─────────────────────────────────────────────────────────
// Compares the latest test to the one before it, per parameter — a free,
// at-a-glance "what changed" that complements the premium trend charts.
export function getWaterDelta(waterTests = [], waterType = "fresh") {
  if (waterTests.length < 2) return [];
  const [latest, prev] = waterTests;
  if (!latest.values || !prev.values) return [];
  const params = activeParams(waterType);
  const out = [];
  for (const p of params) {
    const a = latest.values[p.key];
    const b = prev.values[p.key];
    if (a == null || b == null) continue;
    const diff = Math.round((a - b) * 1000) / 1000;
    out.push({ key: p.key, label: p.label, unit: p.unit, value: a, diff, status: assessParam(p, a).status });
  }
  return out;
}

// ── Overall tank health score ────────────────────────────────────────────────
// A single 0–100 score that ties together compatibility, stocking, water
// quality, cycle status, and maintenance currency — with a per-factor breakdown.
export function getTankHealthScore({ tank = [], tankGallons = 0, waterTests = [], maintenance = {}, quantities = {}, waterType: declaredWater = "fresh" } = {}) {
  const factors = [];
  let score = 0;
  let applicable = 0;
  // A factor with nothing to assess is "n/a": it scores nothing AND counts for
  // nothing. Awarding points for an absence is how an empty, never-tested tank
  // used to report 73% health — full marks for having no fish to conflict, plus
  // half marks for three things that had never been measured.
  const add = (label, state, weight, detail) => {
    if (state === "n/a") {
      factors.push({ label, state, detail, weight });
      return;
    }
    applicable += weight;
    if (state === true) score += weight;
    else if (state === "partial") score += weight / 2;
    // weight travels with the factor so getHealthImprovements can price the
    // remaining points without re-deriving them.
    factors.push({ label, state, detail, weight });
  };

  // Compatibility (25)
  let avoid = false, caution = false;
  for (let i = 0; i < tank.length; i++)
    for (let j = i + 1; j < tank.length; j++) {
      const lvl = getCompatibility(tank[i], tank[j]).level;
      if (lvl === "avoid") avoid = true; else if (lvl === "caution") caution = true;
    }
  add("Compatibility", tank.length < 2 ? "n/a" : avoid ? false : caution ? "partial" : true, 25,
    tank.length < 2 ? "Needs 2+ species" : avoid ? "Conflicts present" : caution ? "Minor cautions" : "All get along");

  // Stocking / bioload (20)
  const bio = getBioload(tankGallons, tank, quantities);
  add("Stocking level", !tank.length ? "n/a" : bio.pct <= 85 ? true : bio.pct <= 100 ? "partial" : false, 20, tank.length ? bio.level : "Nothing stocked yet");

  // Water quality from the latest test (25)
  const latest = waterTests[0];
  const waterType = resolveWaterType(tank, declaredWater);
  if (latest && latest.values) {
    const params = activeParams(waterType);
    let danger = false, cautionP = false, any = false;
    for (const p of params) {
      if (latest.values[p.key] != null) {
        any = true;
        // Grade against what this tank actually keeps, so a Discus tank at 84°F
        // isn't marked down for being exactly right.
        const s = assessParamForStock(p, latest.values[p.key], tank).status;
        if (s === "danger") danger = true; else if (s === "caution") cautionP = true;
      }
    }
    add("Water quality", any ? (danger ? false : cautionP ? "partial" : true) : "n/a", 25, any ? (danger ? "Out of range" : cautionP ? "Watch a value" : "All in range") : "No recent test");
  } else {
    add("Water quality", "n/a", 25, "No test logged yet");
  }

  // Cycle (15)
  const cyc = getCycleStatus(waterTests);
  add("Cycle", waterTests.length ? cyc.cycled : "n/a", 15, cyc.label);

  // Maintenance currency (15)
  const MTASKS = [{ id: "waterchange", days: 7 }, { id: "filterclean", days: 30 }, { id: "gravelvac", days: 14 }, { id: "glassclean", days: 10 }];
  let overdue = 0, logged = 0;
  for (const tk of MTASKS) {
    const last = maintenance[tk.id];
    if (last) { logged++; const since = Math.floor((Date.now() - new Date(last).getTime()) / 86400000); if (since > tk.days) overdue++; }
  }
  add("Maintenance", logged ? (overdue === 0 ? true : overdue <= 1 ? "partial" : false) : "n/a", 15, logged ? (overdue ? `${overdue} overdue` : "Up to date") : "Not tracked yet");

  // Scored against what can actually be assessed. A brand-new tank with no
  // stock and no tests has nothing to score, so it reports no score at all
  // rather than inventing a number.
  const pct = applicable > 0 ? Math.round((score / applicable) * 100) : null;
  const label = pct == null ? "Not enough to go on"
    : pct >= 85 ? "Thriving" : pct >= 65 ? "Healthy" : pct >= 45 ? "Needs care" : "At risk";
  const color = pct == null ? "#8fb8cf"
    : pct >= 85 ? "#38e1c6" : pct >= 65 ? "#7ff0dd" : pct >= 45 ? "#ffd86b" : "#ff7b7b";
  return { score: pct, label, color, factors, applicable, assessed: applicable > 0 };
}

// ── Achievements ─────────────────────────────────────────────────────────────
// Aggregates signals across ALL tanks + user progress into one state object the
// 62 badge checks read from.
// ── What a water change actually does ────────────────────────────────────────
// The calculator gives a volume. The question a keeper actually has is "will
// that fix my nitrate?" — and the answer is arithmetic they shouldn't have to
// do: swapping X% of the water dilutes anything the tap doesn't contain by X%.
//
// Honest about its limits. Dilution is only valid for what accumulates in the
// water: nitrate, phosphate, ammonia, nitrite. Temperature, pH, salinity,
// alkalinity, calcium and magnesium all depend on what's going IN, so the model
// says nothing about them rather than guessing.
const DILUTES = new Set(["nitrate", "phosphate", "ammonia", "nitrite"]);

export function getWaterChangeEffect({ waterTests = [], waterType = "fresh", percent = 25, sourceValues = {}, stockedNames = [] } = {}) {
  const latest = waterTests[0];
  if (!latest || !latest.values) return { ok: false, reason: "No water test logged yet", changes: [] };

  const pct = Math.max(0, Math.min(100, Number(percent) || 0));
  if (!pct) return { ok: false, reason: "Set a change percentage", changes: [] };

  const params = activeParams(waterType);
  const frac = pct / 100;
  const changes = [];

  params.forEach((p) => {
    if (!DILUTES.has(p.key)) return;
    const before = Number(latest.values[p.key]);
    if (Number.isNaN(before) || latest.values[p.key] == null || latest.values[p.key] === "") return;

    // Replacement water usually isn't pure — tap nitrate is common, and RO is 0.
    // Default to 0 but let the caller say otherwise.
    const source = Number(sourceValues[p.key]);
    const src = Number.isNaN(source) ? 0 : source;

    const after = Math.round((before * (1 - frac) + src * frac) * 100) / 100;
    const beforeStatus = assessParamForStock(p, before, stockedNames).status;
    const afterStatus = assessParamForStock(p, after, stockedNames).status;

    changes.push({
      key: p.key,
      label: p.label,
      unit: p.unit,
      before,
      after,
      drop: Math.round((before - after) * 100) / 100,
      beforeStatus,
      afterStatus,
      // The bit that matters: does this change actually get you back in range?
      fixes: beforeStatus !== "good" && afterStatus === "good",
      stillHigh: afterStatus !== "good",
    });
  });

  return { ok: changes.length > 0, percent: pct, changes, reason: changes.length ? null : "Nothing logged that a water change dilutes" };
}

// Smallest change that brings every diluting parameter back into range.
// Returns null when even a full change wouldn't do it — which is itself the
// answer: the source water or the bioload is the problem, not the schedule.
export function getRecommendedChangePercent({ waterTests = [], waterType = "fresh", sourceValues = {}, stockedNames = [] } = {}) {
  for (let pct = 10; pct <= 90; pct += 5) {
    const res = getWaterChangeEffect({ waterTests, waterType, percent: pct, sourceValues, stockedNames });
    if (!res.ok) return null;
    if (res.changes.every((c) => c.afterStatus === "good")) return pct;
  }
  return null;
}

// ── Treatment progress ───────────────────────────────────────────────────────
// Turns a plan plus a start date into "what do I do today". The stopping-early
// problem is the one this exists to solve: people quit when the symptoms go,
// which for ich is precisely when the parasite has dropped off to breed.
export function getTreatmentProgress(diseaseName, startedAt, doneStepIds = []) {
  const plan = getTreatment(diseaseName);
  if (!plan || !startedAt) return null;

  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return null;

  // Day 1 is the start day, not 24 hours later — that's how the steps read.
  const dayNow = Math.floor((Date.now() - started) / 86400000) + 1;
  const done = new Set(doneStepIds);

  const steps = plan.steps.map((s, i) => {
    const id = `${s.day}-${i}`;
    return {
      ...s,
      id,
      done: done.has(id),
      due: s.day <= dayNow,
      overdue: s.day < dayNow && !done.has(id),
      daysAway: s.day - dayNow,
    };
  });

  const dueToday = steps.filter((s) => s.day === dayNow);
  const overdue = steps.filter((s) => s.overdue);
  const next = steps.find((s) => !s.done);

  const completed = steps.filter((s) => s.done).length;
  const finished = dayNow > plan.durationDays;

  return {
    disease: diseaseName,
    day: Math.max(1, dayNow),
    durationDays: plan.durationDays,
    urgency: plan.urgency,
    keyPoint: plan.keyPoint,
    steps,
    dueToday,
    overdue,
    next: next || null,
    completed,
    total: steps.length,
    pct: steps.length ? Math.round((completed / steps.length) * 100) : 0,
    // Past the end date but with steps outstanding — the exact failure mode
    // that lets an infection come back.
    finished,
    abandonedEarly: finished && completed < steps.length,
    daysRemaining: Math.max(0, plan.durationDays - dayNow + 1),
  };
}

// ── Parameter forecasting ────────────────────────────────────────────────────
// Every water test is already stored; nothing ever looked forward. A keeper who
// tests weekly can see nitrate at 20, then 30, then 40 and still not register
// that they're eight days from trouble — the numbers are individually fine, and
// only the slope is alarming.
//
// This fits a simple least-squares trend per parameter and projects when it
// crosses out of its safe band. Deliberately conservative:
//   * At least MIN_POINTS readings, or noise reads as a trend.
//   * Readings older than MAX_AGE_DAYS are ignored — a reading from three
//     months ago says nothing about this week.
//   * A forecast further out than HORIZON_DAYS isn't shown; predicting two
//     months ahead from four data points is fiction.
//   * A weak fit (low R²) is reported as a trend but never as a countdown.
const FORECAST_MIN_POINTS = 3;
const FORECAST_MAX_AGE_DAYS = 60;
const FORECAST_HORIZON_DAYS = 45;
const FORECAST_MIN_FIT = 0.5;

function leastSquares(points) {
  const n = points.length;
  const sx = points.reduce((a, p) => a + p.x, 0);
  const sy = points.reduce((a, p) => a + p.y, 0);
  const mx = sx / n, my = sy / n;
  let num = 0, den = 0;
  points.forEach((p) => { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; });
  if (den === 0) return null;
  const slope = num / den;
  const intercept = my - slope * mx;
  // R²: how much of the variation the line actually explains.
  let ssRes = 0, ssTot = 0;
  points.forEach((p) => { ssRes += (p.y - (slope * p.x + intercept)) ** 2; ssTot += (p.y - my) ** 2; });
  const fit = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
  return { slope, intercept, fit };
}

// Returns one forecast per parameter that has enough data, newest-first input.
export function getParamForecasts(waterTests = [], waterType = "fresh", stockedNames = []) {
  const params = activeParams(waterType);
  const now = Date.now();
  const out = [];

  params.forEach((p) => {
    const points = [];
    waterTests.forEach((t) => {
      const v = t && t.values ? t.values[p.key] : undefined;
      if (v == null || v === "") return;
      const num = Number(v);
      if (Number.isNaN(num)) return;
      const ageDays = (now - localInstantOf(t.date)) / 86400000;
      if (!(ageDays >= 0) || ageDays > FORECAST_MAX_AGE_DAYS) return;
      points.push({ x: -ageDays, y: num }); // x = days relative to now
    });

    if (points.length < FORECAST_MIN_POINTS) return;

    const fitted = leastSquares(points);
    if (!fitted) return;

    // Per-week change is what a keeper can actually reason about.
    const perWeek = Math.round(fitted.slope * 7 * 100) / 100;
    const latest = points.reduce((a, b) => (b.x > a.x ? b : a));
    const current = latest.y;

    // Where's the edge? Use the stock-aware window when there is one.
    const assessed = assessParamForStock(p, current, stockedNames);
    const lo = assessed.source === "stock" ? assessed.lo : p.good[0];
    const hi = assessed.source === "stock" ? assessed.hi : p.good[1];

    let daysToEdge = null, direction = null;
    if (Math.abs(perWeek) > 0.001 && assessed.status === "good") {
      const edge = fitted.slope > 0 ? hi : lo;
      const days = (edge - current) / fitted.slope;
      if (days > 0 && days <= FORECAST_HORIZON_DAYS && fitted.fit >= FORECAST_MIN_FIT) {
        daysToEdge = Math.round(days);
        direction = fitted.slope > 0 ? "rising" : "falling";
      }
    }

    // Flat enough not to matter — don't manufacture a story from noise.
    const meaningful = Math.abs(perWeek) >= (p.good[1] - p.good[0]) * 0.05;
    if (!meaningful && daysToEdge == null) return;

    out.push({
      key: p.key,
      label: p.label,
      unit: p.unit,
      current,
      perWeek,
      trend: perWeek > 0 ? "up" : perWeek < 0 ? "down" : "flat",
      fit: Math.round(fitted.fit * 100) / 100,
      confident: fitted.fit >= FORECAST_MIN_FIT,
      daysToEdge,
      direction,
      status: assessed.status,
      n: points.length,
    });
  });

  // Most urgent first: an imminent crossing beats a vague drift.
  out.sort((a, b) => {
    if (a.daysToEdge != null && b.daysToEdge != null) return a.daysToEdge - b.daysToEdge;
    if (a.daysToEdge != null) return -1;
    if (b.daysToEdge != null) return 1;
    return Math.abs(b.perWeek) - Math.abs(a.perWeek);
  });
  return out;
}

// ── "How do I raise my score?" ───────────────────────────────────────────────
// getTankHealthScore already reports WHICH factors are down, but a number with
// no next step is just a grade. This turns the same factors into ranked, costed
// actions — "log a water test: +25" — so the score becomes something a keeper
// can act on rather than something they're judged by.
//
// Ranked by points available, because the biggest win should be the first
// suggestion. Ties break toward the cheapest action.
const IMPROVEMENT_HINTS = {
  "Water quality": { action: "Log a water test", to: "log", effort: 1, why: "A current reading is the single biggest part of the score." },
  "Cycle": { action: "Track your nitrogen cycle", to: "log", effort: 1, why: "Ammonia and nitrite at zero with nitrate present means the tank is ready." },
  "Maintenance": { action: "Log your maintenance", to: "log", effort: 1, why: "Water changes, filter cleans and gravel vacs all count here." },
  "Stocking": { action: "Review your stock", to: "tank", effort: 2, why: "Overstocking or an incompatible pairing pulls this down." },
  "Compatibility": { action: "Check the compatibility matrix", to: "tank", effort: 2, why: "A conflicting pair is worth fixing before it costs you a fish." },
  "Tank size": { action: "Check your tank size fits your stock", to: "tank", effort: 3, why: "A fish that outgrows the tank can't be fixed later with maintenance." },
};

export function getHealthImprovements(healthScore, limit = 3) {
  if (!healthScore || !Array.isArray(healthScore.factors)) return [];

  const out = [];
  healthScore.factors.forEach((f) => {
    // state === true means full marks already — nothing to suggest.
    if (f.state === true) return;

    // "n/a" is the most actionable state of all: the factor isn't being tracked,
    // so starting to track it is the single biggest thing the keeper can do.
    // "partial" credit earns roughly half, so only half the points remain.
    const available = f.state === "partial" ? Math.round((f.weight || 0) / 2) : (f.weight || 0);
    if (available <= 0) return;

    const hint = IMPROVEMENT_HINTS[f.label];
    out.push({
      label: f.label,
      points: available,
      detail: f.detail || "",
      action: hint ? hint.action : `Improve ${String(f.label).toLowerCase()}`,
      why: hint ? hint.why : "",
      to: hint ? hint.to : "tank",
      effort: hint ? hint.effort : 2,
    });
  });

  out.sort((a, b) => b.points - a.points || a.effort - b.effort);
  return out.slice(0, limit);
}

export function buildAchievementStats({ tanks = [], activeDays = [], xp = 0, wishlist = [], gameStats = {} } = {}) {
  // Default parameters only cover `undefined`, not `null` — and a null here
  // used to throw on wishlist.length, which takes the whole Profile tab down.
  // Normalize before anything reads them.
  // The array being valid isn't enough — a single null or non-object ENTRY
  // (a partial sync, a hand-edited import) used to throw on t.stock and take
  // the whole Profile tab with it. Drop bad entries rather than trusting them.
  tanks = (Array.isArray(tanks) ? tanks : []).filter((t) => t && typeof t === "object");
  activeDays = Array.isArray(activeDays) ? activeDays : [];
  wishlist = Array.isArray(wishlist) ? wishlist : [];
  gameStats = gameStats && typeof gameStats === "object" ? gameStats : {};
  xp = Number(xp) || 0;

  const allNames = new Set();
  tanks.forEach((t) => (t.stock || []).forEach((n) => allNames.add(n)));
  const species = [...allNames].map(getSpecies).filter(Boolean);
  const has = (re) => species.some((s) => re.test(s.name));
  const kinds = new Set(species.map((s) => s.kind));

  const maxTank = tanks.reduce((m, t) => Math.max(m, (t.stock || []).length), 0);

  // Stats for the features added since the last achievement pass — treatments,
  // reef dosing, forecasting and the stocking planner had no representation at
  // all, so none of that work fed the progression loop.
  const allTreatments = tanks.flatMap((t) => t.treatments || []);
  const treatmentsStarted = allTreatments.length;
  // A course counts as completed only when every step is ticked — the whole
  // point of the treatment feature is not stopping when symptoms clear.
  const treatmentsCompleted = allTreatments.filter((tr) => {
    const prog = getTreatmentProgress(tr.disease, tr.startedAt, tr.doneSteps || []);
    return prog && prog.completed === prog.total && prog.total > 0;
  }).length;
  const reefChemTests = tanks.reduce((n, t) => n + (t.waterTests || []).filter((w) => w.values && (w.values.alk != null || w.values.calcium != null || w.values.magnesium != null)).length, 0);
  // Tanks with enough history for a real trend.
  const forecastable = tanks.filter((t) => (t.waterTests || []).length >= 3).length;
  const tanksWithNotes = tanks.filter((t) => (t.notes || "").trim().length > 0).length;
  const fullSchools = tanks.reduce((n, t) => {
    const q = t.quantities || {};
    return n + (t.stock || []).filter((name) => {
      const sp = getSpecies(name);
      return sp && sp.minGroup > 1 && (q[name] || 0) >= sp.minGroup;
    }).length;
  }, 0);
  const tests = tanks.reduce((s, t) => s + (t.waterTests || []).length, 0);
  const journal = tanks.reduce((s, t) => s + (t.journal || []).length, 0);
  const photos = tanks.reduce((s, t) => s + (t.journal || []).filter((e) => e.photo).length, 0);
  const costs = tanks.reduce((s, t) => s + (t.costs || []).length, 0);
  const spend = tanks.reduce((s, t) => s + (t.costs || []).reduce((a, c) => a + (Number(c.amount) || 0), 0), 0);
  const maintTypes = new Set();
  tanks.forEach((t) => Object.keys(t.maintenance || {}).forEach((k) => maintTypes.add(k)));
  const quarantine = tanks.some((t) => (t.quarantine || []).length > 0);
  const cycled = tanks.some((t) => getCycleStatus(t.waterTests || []).cycled);

  // Perfect water: any logged test with every provided reading "good".
  let perfect = false;
  for (const t of tanks) {
    const params = activeParams(t.water || "fresh");
    for (const test of t.waterTests || []) {
      const provided = params.filter((p) => test.values && test.values[p.key] != null);
      if (provided.length >= 3 && provided.every((p) => assessParam(p, test.values[p.key]).status === "good")) { perfect = true; break; }
    }
    if (perfect) break;
  }

  // Largest conflict-free tank.
  let cf = 0;
  for (const t of tanks) {
    const st2 = t.stock || [];
    let avoid = false;
    for (let i = 0; i < st2.length && !avoid; i++)
      for (let j = i + 1; j < st2.length; j++)
        if (getCompatibility(st2[i], st2[j]).level === "avoid") { avoid = true; break; }
    if (!avoid) cf = Math.max(cf, st2.length);
  }

  const fresh = species.some((s) => s.water === "fresh");
  const salt = species.some((s) => s.water === "salt");

  // Oldest running tank, in days — powers the "veteran" longevity badges.
  const tankAgeDays = tanks.reduce((m, t) => {
    if (!t.createdAt) return m;
    const d = Math.floor((Date.now() - new Date(t.createdAt).getTime()) / 86400000);
    return Math.max(m, d);
  }, 0);

  // Quantity-aware signals: a full shoal (a schooling species kept at its group
  // minimum), a big school (10+ of one species), and a documented tank (notes).
  let shoal = false, bigSchool = false, fullShoals = 0;
  tanks.forEach((t) => {
    const q = t.quantities || {};
    (t.stock || []).forEach((n) => {
      const sp = getSpecies(n);
      const c = q[n] || 1;
      if (sp && sp.minGroup > 1 && c >= sp.minGroup) { shoal = true; fullShoals++; }
      if (c >= 10) bigSchool = true;
    });
  });
  const documented = tanks.some((t) => t.notes && t.notes.trim());
  const feedings = tanks.reduce((s, t) => s + (t.feedings || []).length, 0);
  // Aquascaper: a single tank holding fish, inverts AND coral together.
  const trifecta = tanks.some((t) => {
    const ks = new Set((t.stock || []).map(getSpecies).filter(Boolean).map((s) => s.kind));
    return ks.has("fish") && ks.has("invert") && ks.has("coral");
  });
  // A single test measuring 5+ parameters, and a well-stocked nano (≤10 gal).
  const fullPanel = tanks.some((t) => (t.waterTests || []).some((w) => w.values && Object.values(w.values).filter((v) => v != null).length >= 5));
  const nanoMaster = tanks.some((t) => t.gallons <= 10 && (t.stock || []).length >= 3);
  // Reef chemist: a single test that measured alkalinity, calcium AND magnesium.
  const reefChem = tanks.some((t) => (t.waterTests || []).some((w) => w.values && w.values.alk != null && w.values.calcium != null && w.values.magnesium != null));

  // ── Signals from the record types added since the original set ────────────
  //
  // Ninety-six achievements, and not one of them knew about source water, a
  // light schedule, the shelf, an observation log or a quarantine seen through
  // properly. Achievements are how this app teaches its own depth — a keeper
  // discovers half the feature set by reading what they haven't earned yet —
  // so a scoreboard frozen five rounds ago is depth nobody finds.
  const sourceTested = tanks.some((t) => t.sourceWater && Object.keys(t.sourceWater.values || {}).length);
  const lightScheduled = tanks.some((t) => t.lightSchedule && (t.lightSchedule.on || t.lightSchedule.off));
  const shelfStocked = tanks.reduce((n, t) => n + (t.inventory || []).length, 0);
  const observations = tanks.reduce((n, t) => n + Object.values(t.observations || {}).reduce((m, l) => m + (l || []).length, 0), 0);
  // A measured animal: two sizes recorded for the same species is the point at
  // which growth stops being a feeling.
  const growthTracked = tanks.some((t) =>
    Object.values(t.observations || {}).some((l) => (l || []).filter((o) => o && o.size > 0).length >= 2));
  const observationPhotos = tanks.reduce((n, t) =>
    n + Object.values(t.observations || {}).reduce((m, l) => m + (l || []).filter((o) => o && o.photo).length, 0), 0);
  // Quarantine cleared on the checks, not merely on the calendar.
  const quarantineCleared = tanks.some((t) => (t.quarantine || []).some((q) => {
    const c = q && q.checks;
    return c && ["eating", "marks", "behaviour", "breathing"].every((k) => c[k]);
  }));
  const gearWatts = tanks.some((t) => (t.equipment || []).some((e) => e && e.watts > 0));
  const medsLogged = tanks.reduce((n, t) => n + (t.medDoses || []).length, 0);
  const longHistory = tanks.some((t) => (t.waterTests || []).length >= 100);

  const st = {
    sourceTested, lightScheduled, shelfStocked, observations, growthTracked,
    observationPhotos, quarantineCleared, gearWatts, medsLogged, longHistory,
    treatmentsStarted, treatmentsCompleted, reefChemTests, forecastable, tanksWithNotes, fullSchoolsCount: fullSchools,
    species: allNames.size, maxTank, tanks: tanks.length, tests, journal, photos, costs, spend,
    maint: maintTypes.size, quarantine, cycled, perfect,
    wishlist: wishlist.length, tankAgeDays, shoal, bigSchool, documented, fullShoals, feedings, reefChem, trifecta, fullPanel, nanoMaster,
    fish: kinds.has("fish"), invert: kinds.has("invert"), coral: kinds.has("coral"),
    corals: species.filter((s) => s.kind === "coral").length,
    fresh, salt, both: fresh && salt,
    streak: getStreak(activeDays), level: levelFromXp(xp).level, xp,
    gameStreak: gameStats.streak || 0, gameBlitz: gameStats.blitz || 0,
    cf, big: tanks.some((t) => t.gallons >= 55), huge: tanks.some((t) => t.gallons >= 100),
    clown: has(/clownfish/i), betta: has(/betta/i), tang: has(/tang/i), angelfish: has(/angel/i),
    cichlid: has(/cichlid|ram\b|oscar|discus|acara|severum|kribensis|apistogramma/i), pleco: has(/pleco/i),
    gourami: has(/gourami|paradise fish/i), tetra: has(/tetra/i), rasbora: has(/rasbora/i),
    rainbow: has(/rainbowfish/i), goby: has(/goby|firefish/i), wrasse: has(/wrasse/i), blenny: has(/blenny/i),
    cardinal: has(/cardinalfish/i), damsel: has(/damsel|chromis/i),
    shrimp: has(/shrimp/i), snail: has(/snail/i), crab: has(/crab/i), star: has(/starfish|star$/i),
  };
  return st;
}

// Grades every achievement against the current stats.
//
// Split from the stats construction above so a test can diff the keys the
// checks READ against the keys actually produced — a misspelled stat name
// otherwise makes an achievement silently unearnable, and nothing in normal
// use reveals it.
export function getAchievements(input = {}) {
  const st = buildAchievementStats(input);
  return ACHIEVEMENTS.map((a) => ({ ...a, earned: !!a.check(st) }));
}

// ── Tank parameter window ────────────────────────────────────────────────────
// The overlapping temperature & pH range that keeps EVERY stocked species happy
// — the intersection of their individual tolerances. If the ranges don't overlap
// the stock is fundamentally mismatched (flagged so the keeper can rehome).
// ── Stock-aware parameter grading ────────────────────────────────────────────
// Generic safe ranges are the right default, but they're wrong for a specific
// tank more often than you'd think. 84°F is ideal for Discus and lethal for a
// goldfish; pH 8.2 suits Rift Lake cichlids and cooks a cardinal tetra. Grading
// every tank against one range means the app tells a Discus keeper their
// perfect water is too warm — which is worse than saying nothing.
//
// Where the stock defines a tighter window (temperature and pH), grade against
// THAT. Everything else — ammonia, nitrite, nitrate — is a water-quality
// measure with no species opinion, so the generic range stands.
const STOCK_GRADED = { temp: ["tempLo", "tempHi"], ph: ["phLo", "phHi"] };

export function assessParamForStock(param, value, stockedNames = []) {
  const generic = assessParam(param, value);
  const keys = STOCK_GRADED[param.key];
  if (!keys || generic.status === "none") return generic;

  const window = getTankParamWindow(stockedNames);
  // No stock, or a stock whose ranges don't overlap at all — the tank has a
  // bigger problem than this reading, and an impossible window would grade
  // everything as bad. Fall back to the generic verdict.
  if (!window) return generic;
  if (param.key === "temp" && !window.tempOk) return generic;
  if (param.key === "ph" && !window.phOk) return generic;

  const lo = window[keys[0]];
  const hi = window[keys[1]];
  if (typeof lo !== "number" || typeof hi !== "number") return generic;

  const v = Number(value);
  if (Number.isNaN(v)) return generic;

  // Inside every stocked species' range.
  if (v >= lo && v <= hi) return { status: "good", source: "stock", lo, hi };

  // A small margin outside is a caution, not an emergency — fish tolerate a
  // little drift, and crying danger over half a degree trains people to ignore
  // the app.
  const margin = param.key === "temp" ? 2 : 0.3;
  if (v >= lo - margin && v <= hi + margin) return { status: "caution", source: "stock", lo, hi };

  return { status: "danger", source: "stock", lo, hi };
}

export function getTankParamWindow(stockedNames = []) {
  const st = stockedNames.map(getSpecies).filter(Boolean);
  if (!st.length) return null;
  const tempLo = Math.max(...st.map((s) => s.tempMinF));
  const tempHi = Math.min(...st.map((s) => s.tempMaxF));
  const phLo = Math.max(...st.map((s) => s.phMin));
  const phHi = Math.min(...st.map((s) => s.phMax));
  const tempOk = tempLo <= tempHi;
  const phOk = phLo <= phHi;
  return { tempLo, tempHi, phLo, phHi, tempOk, phOk, ok: tempOk && phOk };
}

// ── Water-test statistics ────────────────────────────────────────────────────
// Free per-parameter averages plus how often the keeper actually tests — the
// analytical companion to the premium trend charts.
export function getWaterStats(waterTests = [], waterType = "fresh") {
  if (!waterTests.length) return null;
  const params = activeParams(waterType);
  const averages = params.map((p) => {
    const vals = waterTests.filter((t) => t.values && t.values[p.key] != null).map((t) => Number(t.values[p.key]));
    if (!vals.length) return null;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { key: p.key, label: p.label, unit: p.unit, avg: Math.round(avg * 100) / 100, status: assessParam(p, avg).status, n: vals.length };
  }).filter(Boolean);
  const dates = waterTests.map((t) => t.date).filter(Boolean).sort();
  let cadence = null;
  if (dates.length >= 2) {
    let gaps = 0, cnt = 0;
    for (let i = 1; i < dates.length; i++) { const d = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000; if (d >= 0) { gaps += d; cnt++; } }
    if (cnt) cadence = Math.round((gaps / cnt) * 10) / 10;
  }
  return { count: waterTests.length, averages, cadence };
}

// ── Weekly activity ──────────────────────────────────────────────────────────
// A quick "what you did this week" roll-up for the active tank — the recent
// slice of the habit loop, shown on Home.
export function getWeeklyActivity({ waterTests = [], journal = [], activeDays = [] } = {}) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 6); // today + previous 6 = 7-day window
  const cutKey = localDayKey(cutoff);
  const within = (d) => typeof d === "string" && d.slice(0, 10) >= cutKey;
  return {
    tests: waterTests.filter((t) => within(t.date)).length,
    journal: journal.filter((e) => within(e.date)).length,
    activeDays: activeDays.filter((d) => within(d)).length,
  };
}

// ── Journal insights ─────────────────────────────────────────────────────────
// Everything the Journal tab derives from entries alone ({ id, date, text,
// mood, photo }), so the cards stay dumb and this stays testable. All dates are
// "YYYY-MM-DD" strings and are parsed by hand — `new Date("2026-08-04")` is UTC
// midnight, which drifts a day in western timezones.

// The mood palette, in the same order as JournalCard's picker.
export const JOURNAL_MOODS = [
  { mood: "🐠", label: "Fish", color: "#7ff0dd" },
  { mood: "🌱", label: "Growth", color: "#9be89b" },
  { mood: "😍", label: "Wins", color: "#ff9ec9" },
  { mood: "🛠️", label: "Work", color: "#ffd372" },
  { mood: "⚠️", label: "Issues", color: "#ff7b7b" },
];

function ymd(key) {
  const [y, m, d] = String(key).slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function keyOf(date) {
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}
function daysBetween(aKey, bKey) {
  return Math.round((ymd(bKey) - ymd(aKey)) / 86400000);
}

// Headline numbers for the insights card: logging rhythm plus the mood mix.
export function getJournalStats(journal = [], todayKey = getTodayKey()) {
  const dates = [...new Set(journal.map((e) => e.date).filter(Boolean))].sort();
  const monthPrefix = todayKey.slice(0, 7);

  // Longest run of days with no entry at all, between the first and last entry.
  let longestGap = 0;
  for (let i = 1; i < dates.length; i++) {
    longestGap = Math.max(longestGap, daysBetween(dates[i - 1], dates[i]) - 1);
  }

  const counts = {};
  journal.forEach((e) => { counts[e.mood] = (counts[e.mood] || 0) + 1; });
  const moods = JOURNAL_MOODS.map((m) => ({
    ...m,
    count: counts[m.mood] || 0,
    pct: journal.length ? (counts[m.mood] || 0) / journal.length : 0,
  }));

  return {
    total: journal.length,
    photos: journal.filter((e) => e.photo).length,
    // Journaling streak specifically — distinct from the app-wide activity streak.
    streak: getStreak(dates),
    longestStreak: getLongestStreak(dates),
    thisMonth: dates.filter((d) => d.slice(0, 7) === monthPrefix).length,
    longestGap,
    daysSinceLast: dates.length ? daysBetween(dates[dates.length - 1], todayKey) : null,
    firstDate: dates[0] || null,
    moods,
  };
}

// One calendar month as a flat grid: `null` for the leading blanks before the
// 1st, then a cell per day carrying that day's entries and dominant mood.
export function getJournalMonth(journal = [], year, month) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const byDate = {};
  journal.forEach((e) => {
    if (!e.date) return;
    if (e.date.slice(0, 7) !== keyOf(first).slice(0, 7)) return;
    (byDate[e.date] = byDate[e.date] || []).push(e);
  });

  const cells = new Array(first.getDay()).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = keyOf(new Date(year, month, d));
    const entries = byDate[key] || [];
    // A day's colour comes from its most "urgent" mood, so a ⚠️ never hides
    // behind a 😍 logged the same day.
    let mood = null;
    for (let i = JOURNAL_MOODS.length - 1; i >= 0; i--) {
      if (entries.some((e) => e.mood === JOURNAL_MOODS[i].mood)) { mood = JOURNAL_MOODS[i]; break; }
    }
    cells.push({ day: d, date: key, entries, mood });
  }
  return cells;
}

// "On this day" — entries from roughly 1/3/6/12/24 months back. A ±3 day window,
// because nobody logs on exact monthly anniversaries.
export function getJournalOnThisDay(journal = [], todayKey = getTodayKey()) {
  const today = ymd(todayKey);
  const out = [];
  [1, 3, 6, 12, 24].forEach((months) => {
    const target = new Date(today.getFullYear(), today.getMonth() - months, today.getDate());
    const hits = journal
      .filter((e) => e.date && Math.abs(daysBetween(e.date, keyOf(target))) <= 3)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    if (hits.length) {
      out.push({
        months,
        label: months === 12 ? "1 year ago" : months === 24 ? "2 years ago" : `${months} month${months === 1 ? "" : "s"} ago`,
        entries: hits,
      });
    }
  });
  return out;
}

// Days elapsed between two entries — the span shown on a before/after compare.
export function journalDaySpan(aDate, bDate) {
  return Math.abs(daysBetween(aDate, bDate));
}

// ── Challenges ───────────────────────────────────────────────────────────────
// Each challenge maps to a detectable `signal` (an action the app can see was
// done today), so it auto-completes and vanishes. A large pool is shuffled
// deterministically by date, so a fresh set appears every 24h. `getDailyChallenges`
// and `getSeasonalChallenges` pick a few with DISTINCT signals so no two overlap.
export const DAILY_CHALLENGES = [
  { id: "d_test1", signal: "test", icon: "🧪", title: "Log a water test" },
  { id: "d_test2", signal: "test", icon: "🔬", title: "Check your water chemistry" },
  { id: "d_test3", signal: "test", icon: "⚗️", title: "Test ammonia, nitrite & nitrate" },
  { id: "d_test4", signal: "test", icon: "📊", title: "Take today's water reading" },
  { id: "d_journal1", signal: "journal", icon: "📓", title: "Write a journal entry" },
  { id: "d_journal2", signal: "journal", icon: "✍️", title: "Note what your tank did today" },
  { id: "d_journal3", signal: "journal", icon: "📷", title: "Add a photo to your journal" },
  { id: "d_journal4", signal: "journal", icon: "📝", title: "Jot down an observation" },
  { id: "d_feed1", signal: "feed", icon: "🍤", title: "Log a feeding" },
  { id: "d_feed2", signal: "feed", icon: "🍽️", title: "Feed your fish a small pinch" },
  { id: "d_feed3", signal: "feed", icon: "🦐", title: "Record what you fed today" },
  { id: "d_care1", signal: "care", icon: "✅", title: "Finish today's care checklist" },
  { id: "d_care2", signal: "care", icon: "💧", title: "Complete your daily care" },
  { id: "d_care3", signal: "care", icon: "🫧", title: "Knock out every care task" },
  { id: "d_maint1", signal: "maintain", icon: "🧰", title: "Log a maintenance task" },
  { id: "d_maint2", signal: "maintain", icon: "🧽", title: "Do a tank chore & log it" },
  { id: "d_maint3", signal: "maintain", icon: "🌀", title: "Vacuum, clean, or service something" },
  { id: "d_change1", signal: "change", icon: "💧", title: "Log a water change" },
  { id: "d_change2", signal: "change", icon: "🔁", title: "Freshen up with a water change" },
  { id: "d_fod1", signal: "fod", icon: "🐟", title: "Meet today's Fish of the Day" },
  { id: "d_fod2", signal: "fod", icon: "✨", title: "Discover the daily featured fish" },
  { id: "d_active1", signal: "active", icon: "🔥", title: "Check in on your reef today" },
  { id: "d_active2", signal: "active", icon: "👀", title: "Log any activity to grow your streak" },
];

const SEASONAL_CHALLENGES = {
  summer: [
    { id: "s_su1", signal: "test", icon: "🌡️", title: "Heat check — log your water temp" },
    { id: "s_su2", signal: "change", icon: "💧", title: "Top off & change water in the heat" },
    { id: "s_su3", signal: "feed", icon: "🍤", title: "Feed lightly — warm water needs less" },
    { id: "s_su4", signal: "maintain", icon: "🧰", title: "Clean the filter before summer algae" },
    { id: "s_su5", signal: "journal", icon: "📷", title: "Snap your summer tank in the journal" },
    { id: "s_su6", signal: "care", icon: "☀️", title: "Stay on top of summer care" },
  ],
  fall: [
    { id: "s_fa1", signal: "maintain", icon: "🧰", title: "Deep-clean equipment for fall" },
    { id: "s_fa2", signal: "test", icon: "🧪", title: "Autumn check-up — test your water" },
    { id: "s_fa3", signal: "journal", icon: "📓", title: "Log how your tank's settling in" },
    { id: "s_fa4", signal: "change", icon: "🍂", title: "Refresh your water for fall" },
    { id: "s_fa5", signal: "care", icon: "✅", title: "Keep the daily care steady this fall" },
    { id: "s_fa6", signal: "feed", icon: "🍁", title: "Dial in feeding as it cools" },
  ],
  winter: [
    { id: "s_wi1", signal: "test", icon: "❄️", title: "Winter heater check — log your temp" },
    { id: "s_wi2", signal: "maintain", icon: "🧰", title: "Service your heater & filter" },
    { id: "s_wi3", signal: "care", icon: "✅", title: "Keep the daily care going in winter" },
    { id: "s_wi4", signal: "feed", icon: "🍤", title: "Feed a touch less in cooler water" },
    { id: "s_wi5", signal: "journal", icon: "📓", title: "Note winter changes in your tank" },
    { id: "s_wi6", signal: "change", icon: "🧊", title: "Warm, matched water change in winter" },
  ],
  spring: [
    { id: "s_sp1", signal: "change", icon: "🌱", title: "Spring water change — fight algae" },
    { id: "s_sp2", signal: "test", icon: "🧪", title: "Test as the days get longer" },
    { id: "s_sp3", signal: "journal", icon: "📷", title: "Capture spring growth in your journal" },
    { id: "s_sp4", signal: "maintain", icon: "🧽", title: "Spring-clean the glass & filter" },
    { id: "s_sp5", signal: "feed", icon: "🍤", title: "Ramp feeding as fish get active" },
    { id: "s_sp6", signal: "care", icon: "🌸", title: "Freshen up your daily care routine" },
  ],
};

const SEASON_EMOJI = { summer: "☀️", fall: "🍂", winter: "❄️", spring: "🌱" };
function hashKey(k) { let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0; return h; }
function seededShuffle(arr, seed) {
  const a = [...arr]; let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function pickDistinct(shuffled, count) {
  const out = [], seen = new Set();
  for (const c of shuffled) { if (!seen.has(c.signal)) { out.push(c); seen.add(c.signal); if (out.length >= count) break; } }
  return out;
}
function seasonOf(dateKey) { const m = Number(dateKey.slice(5, 7)); if (m >= 6 && m <= 8) return "summer"; if (m === 12 || m <= 2) return "winter"; if (m >= 3 && m <= 5) return "spring"; return "fall"; }

export function getDailyChallenges(dateKey = getTodayKey(), count = 3) {
  return pickDistinct(seededShuffle(DAILY_CHALLENGES, hashKey(dateKey)), count);
}
export function getSeasonalChallenges(dateKey = getTodayKey(), count = 3) {
  const season = seasonOf(dateKey);
  return { season, label: season.charAt(0).toUpperCase() + season.slice(1), emoji: SEASON_EMOJI[season], items: pickDistinct(seededShuffle(SEASONAL_CHALLENGES[season] || [], hashKey(dateKey) + 777), count) };
}

// ── Fish of the Day ──────────────────────────────────────────────────────────
// A deterministic daily species spotlight — same fish for everyone on a given
// date, a fresh one tomorrow. Drives catalog discovery and a reason to reopen.
export function getFishOfDay(dateKey = getTodayKey(), waterType = null) {
  // Picked from the whole 316-species catalog regardless of the tank, so a reef
  // keeper's "Fish of the Day" was a Zebra Loach more than half the time — a
  // daily recommendation they cannot act on. Narrowing to the tank's water type
  // keeps the feature a suggestion rather than a curiosity.
  const pool = waterType === "salt" || waterType === "fresh"
    ? SPECIES.filter((s) => s.water === waterType)
    : SPECIES;
  const list = pool.length ? pool : SPECIES;
  let h = 0;
  for (let i = 0; i < dateKey.length; i++) h = (h * 31 + dateKey.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

// ── Tip of the Day ───────────────────────────────────────────────────────────
// A rotating piece of aquarium wisdom — a small daily reason to check in.
export const TIPS = [
  "Never change more than ~50% of your water at once — big swings stress fish more than the old water did.",
  "Rinse new filter media in old tank water, never tap water — chlorine kills the beneficial bacteria you're growing.",
  "Feed only what your fish finish in two minutes. Uneaten food is the #1 cause of high nitrate and algae.",
  "Add fish slowly — a few at a time — so your biofilter can grow to handle the extra waste.",
  "Quarantine every new arrival for 2–4 weeks. It's the single best way to keep disease out of your display tank.",
  "Stability beats perfection: a steady 'okay' pH is healthier than one that swings toward 'ideal'.",
  "Top off evaporation with fresh (dechlorinated) water — salt doesn't evaporate, so topping with saltwater raises salinity.",
  "Keep a lid or trim the water line — many fish are accomplished jumpers, especially when newly added.",
  "Test before you dose. Chasing numbers you haven't measured is how reef tanks crash.",
  "A weekly fasting day is good for most fish and keeps your water cleaner.",
  "Turn off the pumps at feeding time so food reaches your fish instead of the filter.",
  "Match new water's temperature and (for reefs) salinity before a change to avoid shocking your livestock.",
  "Algae is a nutrient problem, not a light problem first — check nitrate and phosphate before cutting your photoperiod.",
  "Cycle a new tank fully (ammonia and nitrite reading zero) BEFORE adding fish — it takes 4–8 weeks, and it's worth it.",
  "Buy the biggest tank you can fit and afford — larger volumes are far more forgiving of mistakes.",
];
export function getTipOfDay(dateKey = getTodayKey()) {
  let h = 0;
  for (let i = 0; i < dateKey.length; i++) h = (h * 31 + dateKey.charCodeAt(i)) >>> 0;
  // Offset from the fish hash so the tip and fish don't move in lockstep.
  return TIPS[(h + 7) % TIPS.length];
}

// ── Display helpers ──────────────────────────────────────────────────────────
export function careLevelColor(level) {
  return level === "Easy" ? "#38e1c6" : level === "Moderate" ? "#ffd86b" : "#ff7b7b";
}
export function temperamentColor(t) {
  return t === "peaceful" ? "#38e1c6" : t === "semi-aggressive" ? "#ffd86b" : "#ff7b7b";
}
export function compatColor(level) {
  return level === "excellent" ? "#38e1c6" : level === "caution" ? "#ffd86b" : "#ff7b7b";
}
export function tempRange(s) {
  return formatTempRange(s.tempMinF, s.tempMaxF);
}
export function phRange(s) {
  return `pH ${s.phMin}–${s.phMax}`;
}

export function paramStatusColor(status) {
  return status === "good" ? "#38e1c6" : status === "caution" ? "#ffd86b" : status === "danger" ? "#ff7b7b" : "#a9cfe0";
}

// ── Dates, streaks & XP (the retention loop, mirrors Pocket Planter) ──────────
//
// Local, not UTC. These were `toISOString().slice(0, 10)`, which is the date in
// Greenwich rather than the date on the wall behind the tank — so a keeper in
// California logging at 5pm filed it under tomorrow, and one in New Zealand
// logging at 9am filed it under yesterday. See lib/day.js.
export function getTodayKey() {
  return localDayKey(new Date());
}
function dayKey(d) {
  return localDayKey(d);
}

// Consecutive-day streak ending today (or yesterday, so a fresh morning doesn't
// instantly break it). `activeDays` is an array of "YYYY-MM-DD" strings.
export function getStreak(activeDays = []) {
  const set = new Set(activeDays);
  if (!set.size) return 0;
  const today = new Date();
  let cursor = new Date(today);
  // If today isn't logged yet, allow the streak to count up to yesterday.
  if (!set.has(dayKey(today))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (set.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Longest run of consecutive active days ever — the personal best that survives
// even after a current streak breaks. A gentle "beat your record" nudge.
export function getLongestStreak(activeDays = []) {
  if (!activeDays.length) return 0;
  const days = [...new Set(activeDays)].sort();
  let best = 1, run = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    prev.setDate(prev.getDate() + 1);
    if (dayKey(prev) === days[i]) run++;
    else run = 1;
    if (run > best) best = run;
  }
  return best;
}

// ── Lifetime stats ───────────────────────────────────────────────────────────
// A single roll-up of everything the keeper has done across ALL tanks — the
// "career totals" that make long-term progress feel tangible on the Profile.
export function getLifetimeStats({ tanks = [], activeDays = [] } = {}) {
  const speciesSet = new Set();
  tanks.forEach((t) => (t.stock || []).forEach((n) => speciesSet.add(n)));
  const tests = tanks.reduce((s, t) => s + (t.waterTests || []).length, 0);
  const journal = tanks.reduce((s, t) => s + (t.journal || []).length, 0);
  const photos = tanks.reduce((s, t) => s + (t.journal || []).filter((e) => e.photo).length, 0);
  const spend = tanks.reduce((s, t) => s + (t.costs || []).reduce((a, c) => a + (Number(c.amount) || 0), 0), 0);
  return {
    species: speciesSet.size,
    tanks: tanks.length,
    tests,
    journal,
    photos,
    spend: Math.round(spend),
    daysActive: new Set(activeDays).size,
  };
}

// Gamified levels 1–100 (Pocket Planter style). Cumulative XP to *reach* level L
// grows each level: cost(n→n+1) = 50 + (n-1)*15. Level 100 ≈ 77,700 XP.
export const MAX_LEVEL = 100;
export function xpForLevel(L) {
  const k = Math.max(0, L - 1);
  return 50 * k + 15 * (k * (k - 1) / 2);
}
const RANKS = ["Fry", "Fingerling", "Juvenile", "Fry Master", "Hobbyist", "Aquarist", "Reefer", "Curator", "Specialist", "Reef Master"];
export function rankTitle(level) {
  if (level >= MAX_LEVEL) return "Reef Legend";
  return RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 10))];
}
export function levelFromXp(xp = 0) {
  // XP arrives from a restored backup, a synced profile, or storage written by
  // a build that predates a field — none of which is guaranteed to be a sane
  // number. A NaN made pct and toNext NaN, which renders as "NaN XP to Level 2"
  // above a progress bar of NaN width; a negative made pct -1000%, which is a
  // bar drawn a thousand percent to the left of where it starts.
  xp = Number(xp);
  if (!Number.isFinite(xp) || xp < 0) xp = 0;

  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  const cur = xpForLevel(level);
  const next = level < MAX_LEVEL ? xpForLevel(level + 1) : null;
  const into = xp - cur;
  const span = next != null ? next - cur : 1;
  return {
    level, title: rankTitle(level), xp, into, span,
    pct: next != null ? Math.min(100, (into / span) * 100) : 100,
    toNext: next != null ? Math.max(0, next - xp) : 0,
    nextLevel: level < MAX_LEVEL ? level + 1 : null,
    maxed: level >= MAX_LEVEL,
  };
}

// ── Profile banners ──────────────────────────────────────────────────────────
// A cosmetic banner (gradient) unlocks every 5 levels — worn on the profile card.
// Level 1 has a default so everyone always has one.
export const BANNERS = [
  { id: "reef", level: 1, name: "Open Water", colors: ["#0f3d55", "#0a2c44", "#071d2e"] },
  { id: "tide", level: 5, name: "Tide Pool", colors: ["#0e4a52", "#0a3240", "#071d2e"] },
  { id: "coral", level: 10, name: "Coral Garden", colors: ["#3a1f2e", "#2a1230", "#08202f"] },
  { id: "kelp", level: 15, name: "Kelp Forest", colors: ["#123a2e", "#0c2a2a", "#071d2e"] },
  { id: "lagoon", level: 20, name: "Lagoon", colors: ["#0e4a4a", "#0a3340", "#071d2e"] },
  { id: "sunset", level: 25, name: "Sunset Reef", colors: ["#3a2a12", "#2a1a2e", "#08202f"] },
  { id: "anemone", level: 30, name: "Anemone", colors: ["#3a1230", "#241030", "#08202f"] },
  { id: "abyss", level: 35, name: "The Abyss", colors: ["#0a1a2e", "#08121f", "#050b14"] },
  { id: "aurora", level: 40, name: "Aurora Reef", colors: ["#12324a", "#1a2a52", "#071d2e"] },
  { id: "amber", level: 45, name: "Amber Sea", colors: ["#3a2e12", "#2a2010", "#08202f"] },
  { id: "jade", level: 50, name: "Jade Waters", colors: ["#0e4a3a", "#0a3230", "#071d2e"] },
  { id: "royal", level: 55, name: "Royal Blue", colors: ["#14285a", "#0e1e44", "#071426"] },
  { id: "magenta", level: 60, name: "Magenta Bloom", colors: ["#4a123a", "#301030", "#08202f"] },
  { id: "teal", level: 65, name: "Teal Current", colors: ["#0e5252", "#0a3a3a", "#071d2e"] },
  { id: "ember", level: 70, name: "Ember Coral", colors: ["#4a1f12", "#301810", "#08202f"] },
  { id: "frost", level: 75, name: "Frost Reef", colors: ["#2a4a5a", "#1a3244", "#071d2e"] },
  { id: "violet", level: 80, name: "Violet Deep", colors: ["#2a1a5a", "#1e1240", "#071426"] },
  { id: "gold", level: 85, name: "Golden Reef", colors: ["#4a3a12", "#332810", "#08202f"] },
  { id: "prism", level: 90, name: "Prism Tide", colors: ["#123a5a", "#2a1a4a", "#08202f"] },
  { id: "obsidian", level: 95, name: "Obsidian", colors: ["#1a1a24", "#101018", "#07070c"] },
  { id: "legend", level: 100, name: "Legend", colors: ["#3a2f12", "#4a3a12", "#20320f"] },
];
export function getBanner(id) {
  return BANNERS.find((b) => b.id === id) || BANNERS[0];
}
export function isBannerUnlocked(banner, level) {
  return level >= banner.level;
}

// ── Haptics (mirrors Pocket Planter) ─────────────────────────────────────────
// Re-exported so the existing call sites keep working; the implementation and
// the wider vocabulary live in lib/haptics.js.
export { tapHaptic, selectionHaptic, commitHaptic, successHaptic, warningHaptic, failureHaptic } from "./lib/haptics";
