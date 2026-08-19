import SPECIES from "../data/speciesData";
import { getCompatibility } from "../data/compatibility";
import { bioWeight } from "../core";
import { formatTemp } from "./units";

// ─────────────────────────────────────────────────────────────────────────────
// Stocking plan generator.
//
// The compatibility engine has only ever been able to answer "is this okay?"
// after the user picks. The far harder question — and the one every beginner
// actually has — is "what should I put in a 29 gallon?". Answering it badly is
// how people end up with a common pleco in a nano and a betta with tiger barbs.
//
// This builds a complete plan the way an experienced keeper would:
//   1. a centrepiece the tank can actually house,
//   2. a schooling group, at its real minimum group size,
//   3. a bottom-dweller or grazer,
//   4. cleanup crew,
// checking every addition against everything already chosen and against the
// bioload budget. If a slot can't be filled without a conflict, it's left empty
// rather than forced — a plan with three good fish beats one with four and a
// fight.
// ─────────────────────────────────────────────────────────────────────────────

// Fish-inch-per-gallon is crude, but it's the same guideline the rest of the app
// uses, so plans and the bioload gauge agree with each other.

// Leave headroom. Filling a tank to 100% of a rough guideline on day one gives
// the keeper nowhere to go and no margin for growth.
const TARGET_LOAD = 0.75;

function load(picks) {
  return picks.reduce((sum, p) => sum + (p.species.adultInches || 0) * p.count * bioWeight(p.species), 0);
}

// Would adding this species conflict with anything already in the plan?
function conflicts(species, picks) {
  return picks.some((p) => {
    const c = getCompatibility(species.name, p.species.name);
    return c.level === "avoid" || c.level === "caution";
  });
}

function eligible(species, { gallons, water, maxCare }) {
  if (species.water !== water) return false;
  if (species.minGallons > gallons) return false;
  if (maxCare === "Easy" && species.careLevel !== "Easy") return false;
  if (maxCare === "Moderate" && species.careLevel === "Advanced") return false;
  return true;
}

// Deterministic shuffle so "regenerate" gives a different plan but the same seed
// always reproduces one — a plan that changes under you on every re-render is
// worse than no plan.
function seededSort(list, seed) {
  const key = (s) => {
    let h = seed;
    for (let i = 0; i < s.name.length; i++) h = (h * 31 + s.name.charCodeAt(i)) % 100000;
    return h;
  };
  return [...list].sort((a, b) => key(a) - key(b));
}

const ROLES = [
  {
    id: "centerpiece",
    label: "Centrepiece",
    why: "One fish with presence that the tank is built around.",
    match: (s) => s.kind === "fish" && s.minGroup <= 1 && (s.adultInches || 0) >= 3,
    count: () => 1,
  },
  {
    id: "school",
    label: "Schooling group",
    why: "Movement and color. Schooling fish are stressed and washed-out kept in ones and twos.",
    match: (s) => s.kind === "fish" && s.minGroup >= 5 && (s.adultInches || 0) <= 3,
    count: (s) => s.minGroup,
  },
  {
    id: "bottom",
    label: "Bottom dweller",
    why: "Works the lower third and clears leftover food.",
    match: (s) => s.kind === "fish" && /cory|loach|pleco|catfish|goby|blenny/i.test(s.name),
    count: (s) => (s.minGroup > 1 ? s.minGroup : 1),
  },
  {
    id: "cleanup",
    label: "Cleanup crew",
    why: "Snails and shrimp graze algae and turn over the substrate.",
    match: (s) => s.kind === "invert",
    count: () => 3,
  },
];

// Builds a full plan. Returns { ok, picks, load, capacity, notes }.
export function generateStockingPlan({ gallons, water = "fresh", experience = "beginner", seed = 1 } = {}) {
  const size = Number(gallons) || 0;
  if (!size) return { ok: false, reason: "Set a tank size first", picks: [] };

  const maxCare = experience === "beginner" ? "Easy" : experience === "intermediate" ? "Moderate" : null;
  const pool = SPECIES.filter((s) => eligible(s, { gallons: size, water, maxCare }));
  if (!pool.length) {
    return { ok: false, reason: `Nothing in the catalog suits a ${size} gallon ${water === "salt" ? "saltwater" : "freshwater"} tank at that experience level`, picks: [] };
  }

  const budget = size * TARGET_LOAD;
  const picks = [];
  const notes = [];

  ROLES.forEach((role) => {
    const candidates = seededSort(pool.filter(role.match), seed).filter(
      (s) => !picks.some((p) => p.species.name === s.name)
    );

    for (const s of candidates) {
      const count = role.count(s);
      const cost = (s.adultInches || 0) * count * bioWeight(s);
      if (load(picks) + cost > budget) continue;   // wouldn't fit
      if (conflicts(s, picks)) continue;           // wouldn't get along
      picks.push({ role: role.id, roleLabel: role.label, why: role.why, species: s, count });
      return;
    }

    notes.push(`No ${role.label.toLowerCase()} fits alongside the rest at this size.`);
  });

  const used = load(picks);
  return {
    ok: picks.length > 0,
    picks,
    load: Math.round(used * 10) / 10,
    capacity: size,
    pct: Math.round((used / size) * 100),
    headroom: Math.round((size - used) * 10) / 10,
    notes,
    water,
    experience,
    // Flat list for one-tap loading into a tank.
    stock: picks.map((p) => p.species.name),
    quantities: Object.fromEntries(picks.map((p) => [p.species.name, p.count])),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Equipment sizing.
//
// Every one of these is a rule of thumb a keeper has to look up, get wrong, or
// take from whoever is loudest in a forum thread. They're arithmetic — the app
// already knows the tank size and what's in it.
// ─────────────────────────────────────────────────────────────────────────────

export function getEquipmentPlan({ gallons, water = "fresh", stockedNames = [], roomTempF = 68, targetTempF } = {}) {
  const size = Number(gallons) || 0;
  if (!size) return { ok: false, reason: "Set a tank size first", items: [] };

  const stocked = stockedNames.map((n) => SPECIES.find((s) => s.name === n)).filter(Boolean);
  const hasCoral = stocked.some((s) => s.kind === "coral");

  // Target temperature: the middle of what the stock actually wants, else a
  // sensible default per water type.
  let target = Number(targetTempF);
  if (!target) {
    if (stocked.length) {
      const lo = Math.max(...stocked.map((s) => s.tempMinF));
      const hi = Math.min(...stocked.map((s) => s.tempMaxF));
      target = hi >= lo ? Math.round((lo + hi) / 2) : 78;
    } else {
      target = water === "salt" ? 78 : 76;
    }
  }

  // Heater: roughly 3–5 W per gallon per 10°F of lift. Rounded up to a size
  // actually sold, because "137 W" helps nobody.
  const lift = Math.max(0, target - roomTempF);
  const watts = Math.ceil((size * (lift / 10) * 4) / 25) * 25;
  const COMMON_HEATERS = [25, 50, 75, 100, 150, 200, 250, 300];
  const heater = COMMON_HEATERS.find((w) => w >= watts) || 300;

  // Filtration: 4× turnover freshwater, 6× reef.
  const turnover = water === "salt" ? 6 : 4;
  const filterGph = Math.round(size * turnover);

  // In-tank flow: reefs need far more, and SPS more again.
  const flowX = water === "salt" ? (hasCoral ? 30 : 15) : 8;
  const flowGph = Math.round(size * flowX);

  const items = [
    {
      id: "heater",
      label: "Heater",
      value: lift > 0 ? `${heater} W` : "Not needed",
      detail: lift > 0
        ? `Holds ${formatTemp(target)} in a ${formatTemp(roomTempF)} room. Two smaller heaters are safer than one big one — if one sticks on, it can't cook the tank alone.`
        : `Your room already sits at or above ${formatTemp(target)}. Watch for overheating instead.`,
    },
    {
      id: "filter",
      label: "Filtration",
      value: `${filterGph}+ GPH`,
      detail: `About ${turnover}× turnover for a ${size} gallon ${water === "salt" ? "reef" : "freshwater"} tank. Rated GPH is measured with no media — expect real flow to be lower.`,
    },
    {
      id: "flow",
      label: "In-tank flow",
      value: `${flowGph} GPH`,
      detail: hasCoral
        ? "Corals need turbulent, varied flow — around 30× turnover. Aim powerheads at each other rather than at the coral."
        : water === "salt"
          ? "Around 15× turnover keeps detritus suspended for the filter to catch."
          : "Gentle flow is fine for most freshwater fish; long-finned species prefer less.",
    },
    {
      id: "light",
      label: "Lighting",
      value: hasCoral ? "Reef-capable LED" : water === "salt" ? "Basic marine LED" : "Low–medium planted LED",
      detail: hasCoral
        ? "Corals need real PAR, not brightness. Match the fixture to the hardest coral you keep, and acclimate corals to new lighting slowly."
        : "Fish don't need strong light. 6–8 hours on a timer limits algae.",
    },
  ];

  if (water === "salt") {
    items.push({
      id: "flowdetail",
      label: "Water movement note",
      value: "Powerheads",
      detail: "Return-pump flow alone rarely reaches the numbers above. Powerheads make up the difference.",
    });
  }

  return { ok: true, items, targetTempF: target, hasCoral, size };
}
