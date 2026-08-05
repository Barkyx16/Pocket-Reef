import SPECIES from "./speciesData";

// Compatibility intelligence — Pocket Reef's answer to companion planting.
// Given two species it returns { level, reason }, where level is one of
// "excellent" | "caution" | "avoid". A rule engine handles the general cases
// (water type, aggression, predator/prey size, parameter overlap, schooling),
// and OVERRIDES pins well-known specific pairings that rules would miss.

const byName = Object.fromEntries(SPECIES.map((s) => [s.name, s]));

// Specific, hand-tuned pairings (name|name, order-independent).
const OVERRIDES = {
  "Angelfish|Neon Tetra": { level: "avoid", reason: "Adult angelfish will hunt and eat neon-sized fish." },
  "Betta|Guppy": { level: "caution", reason: "A betta may nip guppies' flowing fins — watch closely and rehome if aggression starts." },
  "Betta|Neon Tetra": { level: "caution", reason: "A betta may nip neons, and a nippy school can shred betta fins — watch closely." },
  "Cherry Shrimp|Angelfish": { level: "avoid", reason: "Angelfish readily eat dwarf shrimp." },
  "Ocellaris Clownfish|Cleaner Shrimp": { level: "excellent", reason: "Clownfish happily visit cleaner shrimp stations — a classic reef pairing." },
  // Clownfish: different species (and aggressive maroons) don't mix.
  "Ocellaris Clownfish|Percula Clownfish": { level: "caution", reason: "Two different clownfish species usually fight — keep to one species per tank." },
  "Maroon Clownfish|Ocellaris Clownfish": { level: "avoid", reason: "Maroon clownfish are very aggressive and will attack smaller clowns." },
  // Same-shape tangs are territorial toward each other.
  "Yellow Tang|Purple Tang": { level: "avoid", reason: "Two similar tangs will fight — keep only one tang in most tanks." },
  // Small reef predators that hunt ornamental shrimp.
  "Six Line Wrasse|Cleaner Shrimp": { level: "caution", reason: "A six-line wrasse can harass or pick at small shrimp." },
  "Flame Hawkfish|Cleaner Shrimp": { level: "avoid", reason: "Hawkfish are ambush predators that hunt small shrimp." },
};

// Normalize override keys to sorted order so a pairing matches regardless of the
// order it was written in (the lookup below always sorts the two names).
const OV_NORM = {};
for (const k of Object.keys(OVERRIDES)) OV_NORM[k.split("|").map((s) => s.trim()).sort().join("|")] = OVERRIDES[k];

const key = (a, b) => [a, b].sort().join("|");
const overlaps = (aMin, aMax, bMin, bMax) => aMin <= bMax && bMin <= aMax;

export function getCompatibility(aName, bName) {
  const a = byName[aName];
  const b = byName[bName];
  if (!a || !b) return { level: "caution", reason: "Not enough data on one of these species." };
  if (aName === bName) return { level: "caution", reason: "Keeping more than one may need extra space — check the group and tank size." };

  const override = OV_NORM[key(aName, bName)];
  if (override) return override;

  // 1. Different water types can never share a tank.
  if (a.water !== b.water) {
    return { level: "avoid", reason: "Freshwater and saltwater species can't live in the same tank." };
  }

  // 2. Aggression: an aggressive fish rarely tolerates tankmates.
  if (a.temperament === "aggressive" || b.temperament === "aggressive") {
    return { level: "avoid", reason: `${a.temperament === "aggressive" ? a.name : b.name} is aggressive and best kept alone or with very careful tankmates.` };
  }

  // 3. Predator / prey by size: a much larger fish may eat a small one. Corals
  // and armored snails aren't prey, so they're excluded.
  const big = a.adultInches >= b.adultInches ? a : b;
  const small = big === a ? b : a;
  const preyExcluded = small.kind === "coral" || /snail/i.test(small.name);
  if (big.diet !== "herbivore" && big.diet !== "photosynthetic" && !preyExcluded && big.adultInches >= small.adultInches * 2.2) {
    return { level: "avoid", reason: `${big.name} is large enough to eat ${small.name}.` };
  }

  // 4. Water parameters must overlap to keep both healthy.
  if (!overlaps(a.tempMinF, a.tempMaxF, b.tempMinF, b.tempMaxF) || !overlaps(a.phMin, a.phMax, b.phMin, b.phMax)) {
    return { level: "caution", reason: "Their ideal temperature or pH ranges barely overlap — hard to keep both thriving." };
  }

  // 5. Two semi-aggressive fish can clash over territory.
  if (a.temperament === "semi-aggressive" && b.temperament === "semi-aggressive") {
    return { level: "caution", reason: "Both are semi-aggressive — give lots of space and watch for territorial squabbles." };
  }

  // 6. Otherwise: peaceful, compatible parameters → a great match.
  return { level: "excellent", reason: "Peaceful temperaments and matching water needs make these great tankmates." };
}
