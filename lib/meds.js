// ─────────────────────────────────────────────────────────────────────────────
// Medication dosing.
//
// The treatment plans say "dose per the label", which is correct and is where
// the app stopped. The label says "5 ml per 10 gallons". The keeper is then
// standing over a sick tank at 11pm doing arithmetic they've never done, on a
// volume they don't actually know, for a chemical where double is lethal.
//
// This does not invent doses. Following lib/dosing.js's rule — there is no
// universal strength and inventing one is worse than useless — the label's
// figures are entered by the keeper and this does the three things they get
// wrong:
//
//   1. Volume. A "75 gallon" tank holds nearer 65 once rock, sand and the gap
//      below the rim are subtracted. Dosing rated volume overdoses every time.
//   2. Re-dosing after a water change. You replaced 30% of the water, so you
//      removed 30% of the medication — the top-up is 30% of a full dose, not a
//      full dose, and not nothing.
//   3. The course. Which day you're on, and what's already gone in.
//
// Everything here is arithmetic on numbers the keeper supplies. Where a class
// of medication is genuinely dangerous, that's stated — those warnings are
// about handling, not about how much to use.
// ─────────────────────────────────────────────────────────────────────────────

import { actualWaterVolume } from "./dosing";
import { todayKey, instantOf } from "./day";
import { boundedNumber, LIMITS } from "./bounds";
import { records } from "./records";
import { TEXT_LIMITS, limitText } from "./textLimits";
import { round } from "./num";

// Hazards that belong to a class of medication regardless of brand. These are
// the ones that kill livestock or the filter when missed.
export const MED_CLASSES = [
  {
    id: "copper",
    label: "Copper-based",
    invertSafe: false,
    warnings: [
      "Lethal to every invertebrate, coral and snail — never dose a display with them in it.",
      "Absorbed by rock and sand and released later; treat in a bare hospital tank.",
      "Needs a copper test kit. Therapeutic and lethal are close together.",
    ],
  },
  {
    id: "formalin",
    label: "Formalin",
    invertSafe: false,
    warnings: [
      "Strips oxygen from the water — add an airstone before dosing, not after.",
      "Do not use above 27°C / 80°F; toxicity rises sharply with temperature.",
    ],
  },
  {
    id: "antibiotic",
    label: "Antibiotic",
    invertSafe: true,
    warnings: [
      "Kills filter bacteria as well as the target. Test ammonia daily through the course.",
      "Finish the full course even once symptoms clear, or you breed a resistant strain.",
    ],
  },
  {
    id: "antiparasitic",
    label: "Anti-parasitic",
    invertSafe: false,
    warnings: ["Many are unsafe for shrimp, snails and scaleless fish — check the label for your stock."],
  },
  {
    id: "other",
    label: "Other / general",
    invertSafe: true,
    warnings: [],
  },
];

export const classOf = (id) => MED_CLASSES.find((c) => c.id === id) || MED_CLASSES[MED_CLASSES.length - 1];


// Carbon and chemical media strip medication straight back out. This is the
// most common reason a course "doesn't work".
export const CARBON_WARNING = "Remove carbon and chemical filtration before dosing — they pull the medication out of the water within hours.";

// The core calculation.
//
// `labelDose` / `labelPer` come off the bottle: "5 ml per 10 gallons" is
// labelDose 5, labelPer 10. `ratedGallons` is the tank's stated size; the
// actual volume is derived, because that's the number the fish live in.
export function planMedDose({ labelDose, labelPer, ratedGallons, waterChangePct = 0, unit = "ml" }) {
  const dose = Number(labelDose);
  const per = Number(labelPer);
  const rated = Number(ratedGallons);

  if (!dose || !per || dose <= 0 || per <= 0) {
    return { ok: false, reason: "Enter the dose from the label — for example 5 ml per 10 gallons." };
  }
  // A label figure outside these is a typo, and the arithmetic on it produces
  // something like "9e+33 ml" — scientific notation in a dosing instruction,
  // which is unusable and frightening rather than merely wrong.
  if (boundedNumber(dose, LIMITS.doseMl) == null || boundedNumber(per, LIMITS.gallons) == null) {
    return { ok: false, reason: "Those label figures don't look right — check the bottle and enter them as written." };
  }
  if (!rated || rated <= 0) {
    return { ok: false, reason: "Set your tank size first; the dose is calculated from real volume." };
  }

  const actual = actualWaterVolume(rated);
  const full = round((dose / per) * actual, 2);

  // After a water change you removed exactly the fraction of medication that
  // you removed of water. Topping up with a full dose is an overdose; topping
  // up with nothing drops you below therapeutic.
  const pct = Math.max(0, Math.min(100, Number(waterChangePct) || 0));
  const topUp = pct ? round(full * (pct / 100), 2) : 0;

  return {
    ok: true,
    unit,
    ratedGallons: rated,
    actualGallons: actual,
    fullDose: full,
    topUp,
    // Stated plainly because it is the number people get wrong, every time.
    volumeNote: `Calculated on about ${actual} gallons of actual water, not the ${rated} on the box — rock, sand and the gap below the rim take up the difference.`,
    topUpNote: pct
      ? `After a ${pct}% water change you removed ${pct}% of the medication. Replace ${topUp} ${unit}, not a full dose.`
      : null,
  };
}

// What's already gone in during this course, so the card can show the running
// total rather than relying on memory.
export function courseTotal(doses = [], sinceDate) {
  doses = records(doses);

  const since = sinceDate ? new Date(sinceDate).getTime() : 0;
  return round(
    doses
      .filter((d) => {
        const t = instantOf(d.date);
        return !Number.isNaN(t) && t >= since;
      })
      .reduce((n, d) => n + (Number(d.amount) || 0), 0),
    2
  );
}

// Everything the keeper should be told before the first dose goes in.
export function safetyFor(classId, { hasInverts = false } = {}) {
  const cls = classOf(classId);
  const out = [CARBON_WARNING, ...cls.warnings];
  if (hasInverts && !cls.invertSafe) {
    out.unshift("You have invertebrates in this tank. This class of medication will kill them — move them, or treat the fish elsewhere.");
  }
  return out;
}

export function newMedDose({ name, amount, unit = "ml", date, note = "" } = {}) {
  const amt = boundedNumber(amount, LIMITS.doseMl);
  if (!name || amt == null) return null;
  return {
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: limitText(String(name).trim(), TEXT_LIMITS.name),
    amount: round(amt, 2),
    unit,
    date: date || todayKey(),
    note: limitText(String(note || "").trim(), TEXT_LIMITS.shortNote),
  };
}
