// ─────────────────────────────────────────────────────────────────────────────
// Algae, diagnosed from your own tank.
//
// The troubleshooting entry for "algae taking over" is four generic lines, and
// it's one of the most-opened things in the app. Generic is the problem: every
// algae article on the internet says "reduce nutrients and light", which is
// true, useless, and exactly what somebody already tried before opening an app.
//
// The useful version needs three things the app already holds and has never
// combined: what the algae actually is, what this tank's nutrients actually
// read, and how long its lights are actually on. With those, "reduce nutrients
// and light" becomes "your phosphate is 0.24 and your lights run 12 hours —
// start with the lights, they're free."
//
// Where the data contradicts the usual advice, it says so. A diatom bloom in a
// six-week-old tank with zero nitrate is not a nutrient problem and telling
// somebody to do more water changes makes it last longer.
// ─────────────────────────────────────────────────────────────────────────────

import { getTankMaturity } from "../core";
import { assessLighting } from "./lighting";
import { round } from "./num";

// What people can actually tell apart by looking. Each carries the causes that
// genuinely drive it, in the order they're usually to blame.
export const ALGAE_TYPES = [
  {
    id: "diatoms",
    label: "Brown dust",
    also: "Diatoms",
    looks: "A brown or rust-coloured film on the glass, sand and rocks. Wipes off easily.",
    causes: ["newtank", "silicate"],
    benign: true,
    summary: "The classic new-tank bloom. Feeds on silicate left over from tap water and fresh sand, and burns itself out.",
  },
  {
    id: "green-film",
    label: "Green film on glass",
    also: "Green spot / film algae",
    looks: "A green haze on the glass that needs scraping every few days.",
    causes: ["light", "phosphate"],
    summary: "Normal in small amounts. Needing to scrape more than weekly means light or phosphate is high.",
  },
  {
    id: "hair",
    label: "Green hair algae",
    also: "GHA",
    looks: "Soft green strands on rock, growing visibly week to week.",
    causes: ["nitrate", "phosphate", "light", "flow"],
    summary: "The most common serious outbreak. Almost always nutrients plus light together — one alone rarely does it.",
  },
  {
    id: "cyano",
    label: "Red or purple slime",
    also: "Cyanobacteria",
    looks: "A slimy sheet, red, purple or dark green, that peels off in mats and traps bubbles.",
    causes: ["flow", "nitrate", "phosphate", "oldlight"],
    summary: "Not really algae — a bacteria. Dead spots with poor flow are the giveaway; it settles where water doesn't move.",
  },
  {
    id: "green-water",
    label: "Green water",
    also: "Algae bloom",
    looks: "The water itself is green and cloudy; the glass may be clean.",
    causes: ["light", "nitrate"],
    summary: "Free-floating algae. Water changes barely dent it — it reproduces faster than you can dilute it.",
  },
  {
    id: "bba",
    label: "Black beard",
    also: "BBA",
    looks: "Dark tufts like short black bristles, usually on plant edges, hardscape and equipment.",
    causes: ["flow", "co2", "light"],
    summary: "Freshwater's stubborn one. Tied to unstable CO2 and inconsistent flow more than to raw nutrients.",
  },
  {
    id: "bryopsis",
    label: "Feathery green",
    also: "Bryopsis",
    looks: "Fern-like feathery fronds that snails refuse to touch.",
    causes: ["phosphate", "magnesium"],
    summary: "Tougher than hair algae and mostly immune to grazers. Elevated magnesium is the usual weapon.",
  },
];

export const typeOf = (id) => ALGAE_TYPES.find((t) => t.id === id) || null;


// The tank's own numbers, as evidence for or against each cause.
function gatherEvidence(tank = {}, waterType = "fresh") {
  const latest = (tank.waterTests || [])[0];
  const values = (latest && latest.values) || {};
  const light = assessLighting(tank);
  const maturity = getTankMaturity(tank.createdAt);

  const nitrate = values.nitrate != null ? Number(values.nitrate) : null;
  const phosphate = values.phosphate != null ? Number(values.phosphate) : null;
  const magnesium = values.magnesium != null ? Number(values.magnesium) : null;

  // Reef tanks run far tighter nutrient targets than freshwater, so the
  // threshold for "high" has to follow the tank type or every reef reads fine
  // and every freshwater tank reads alarming.
  const nitrateHigh = waterType === "salt" ? 20 : 40;
  const phosphateHigh = 0.1;

  return {
    nitrate,
    phosphate,
    magnesium,
    nitrateHigh: nitrate != null && nitrate >= nitrateHigh,
    phosphateHigh: phosphate != null && phosphate >= phosphateHigh,
    magnesiumLow: magnesium != null && magnesium < 1300,
    hasNutrientData: nitrate != null || phosphate != null,
    light,
    lightLong: light.ok && (light.verdict === "long" || light.verdict === "too-long"),
    youngTank: maturity ? maturity.days < 90 : false,
    tankDays: maturity ? maturity.days : null,
    waterType,
  };
}

// Every cause the app can actually speak to, with the test for whether THIS
// tank has it and what to do about it. Ordered by how cheap the fix is: the
// free ones first, because somebody mid-outbreak will do one thing today.
const CAUSES = {
  newtank: {
    label: "The tank is still new",
    test: (e) => e.youngTank,
    fix: "Nothing. This is what a maturing tank does and it passes on its own — usually by three months. Wipe the glass and wait it out.",
    free: true,
  },
  light: {
    label: "Lights are on too long",
    test: (e) => e.lightLong,
    fixFor: (e) => {
      if (!e.light || !e.light.ok) return "Put the lights on a timer and keep the photoperiod short — it's the cheapest algae control there is.";
      const cut = e.light.excess || 1;
      return `Cut your photoperiod by ${cut} hour${cut >= 2 ? "s" : ""} — you're at ${e.light.hours}, and ${e.light.profile.label.toLowerCase()} wants ${e.light.ideal}. This is free and works within a fortnight.`;
    },
    free: true,
  },
  oldlight: {
    label: "Old bulbs",
    test: () => false, // Only ever offered as a possibility, never asserted.
    fix: "Fluorescent and metal halide bulbs shift spectrum months before they look dim, and the shifted spectrum favours algae. If yours are over a year old, replace them.",
  },
  flow: {
    label: "Dead spots in the flow",
    test: () => null, // Can't be measured from the record — asked, not asserted.
    fix: "Look for where detritus settles and aim a powerhead there. Slime algae in particular grows exactly where water doesn't move.",
    free: true,
  },
  nitrate: {
    label: "Nitrate is high",
    test: (e) => e.nitrateHigh,
    fixFor: (e) => `Your nitrate is ${e.nitrate}. Bigger or more frequent water changes, and feed less — most tanks are fed twice what they need.`,
  },
  phosphate: {
    label: "Phosphate is high",
    test: (e) => e.phosphateHigh,
    fixFor: (e) => `Your phosphate is ${e.phosphate}. Phosphate feeds algae harder than nitrate does — GFO or a phosphate remover brings it down within days.`,
  },
  silicate: {
    label: "Silicate from tap water or new sand",
    test: (e) => e.youngTank,
    fix: "RODI water removes the silicate that diatoms feed on. New sand releases it for a few weeks regardless.",
  },
  co2: {
    label: "Unstable CO2",
    test: () => null,
    fix: "In a planted tank, black beard tracks CO2 swings rather than the level. A steadier injection, or none at all, beats a higher one.",
  },
  magnesium: {
    label: "Magnesium is low",
    test: (e) => e.magnesiumLow,
    fixFor: (e) => `Magnesium at ${e.magnesium} is low. Raising it to 1500–1600 for a few weeks is the standard bryopsis treatment.`,
  },
};

// The whole diagnosis for one identified algae.
export function diagnose(typeId, tank = {}, waterType = "fresh") {
  const type = typeOf(typeId);
  if (!type) return { ok: false, reason: "Pick what you're seeing and Pocket Reef will work back from your own readings." };

  const evidence = gatherEvidence(tank, waterType);

  const confirmed = [];
  const possible = [];

  type.causes.forEach((id) => {
    const cause = CAUSES[id];
    if (!cause) return;
    const result = cause.test(evidence);
    // Evaluated only for causes that will actually be shown. Building the text
    // up front crashed every tank without a light schedule: `fixFor` for the
    // light cause reads the assessment's profile, and an unset schedule has no
    // profile to read — a cause that wasn't even being claimed took the screen
    // down with it.
    if (result !== true && result !== null) return;
    const entry = {
      id,
      label: cause.label,
      fix: cause.fixFor ? cause.fixFor(evidence) : cause.fix,
      free: Boolean(cause.free),
    };
    // true = this tank demonstrably has it. null = can't be measured from the
    // record, so it's offered as something to check rather than claimed.
    if (result === true) confirmed.push(entry);
    else possible.push(entry);
  });

  // Free fixes first among the confirmed causes — somebody mid-outbreak does
  // one thing today, and it should be the one that costs nothing.
  confirmed.sort((a, b) => Number(b.free) - Number(a.free));

  // The case where the usual advice is actively wrong.
  const contradiction =
    type.benign && evidence.youngTank
      ? `This is a ${evidence.tankDays}-day-old tank. Brown dust at this age is the tank maturing, not a fault — chasing it with water changes and scrubbing makes it last longer, not shorter.`
      : confirmed.length === 0 && evidence.hasNutrientData
        ? "Your nutrients read fine and nothing in your record explains this. That usually means flow, an old bulb, or something feeding the tank that isn't in the log — check those before changing anything that's working."
        : null;

  return {
    ok: true,
    type,
    evidence,
    confirmed,
    possible,
    contradiction,
    // The one thing to do today.
    firstStep: confirmed.length ? confirmed[0] : possible[0] || null,
    headline: type.benign && evidence.youngTank
      ? `${type.label} in a new tank — this is normal.`
      : confirmed.length
        ? `${confirmed.length} thing${confirmed.length === 1 ? "" : "s"} in your own readings explain${confirmed.length === 1 ? "s" : ""} this.`
        : "Nothing in your readings explains this one.",
  };
}

// Narrows the list to what can actually occur in this tank, so a freshwater
// keeper isn't offered cyanobacteria advice written for a reef.
export function typesFor(waterType = "fresh") {
  return ALGAE_TYPES.filter((t) => {
    if (t.id === "bryopsis") return waterType === "salt";
    if (t.id === "bba") return waterType === "fresh";
    return true;
  });
}
