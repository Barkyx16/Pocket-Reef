// ─────────────────────────────────────────────────────────────────────────────
// Treatment plans.
//
// The Health tab could tell you what your fish has, and then stopped. That's
// the least useful moment to stop: the keeper now knows their fish is sick,
// has no schedule, and is about to search a forum at 11pm and follow whatever
// the loudest reply says.
//
// Each plan is a day-by-day course with the two things people get wrong most
// often — treating for long enough to break the parasite's life cycle, and
// removing carbon that would strip the medication straight back out.
//
// These are the standard hobby protocols, deliberately generic about products:
// dosing varies per medication and the label always wins. Where a treatment is
// genuinely dangerous to get wrong, the step says so.
// ─────────────────────────────────────────────────────────────────────────────

export const TREATMENTS = {
  "Ich (White Spot)": {
    durationDays: 14,
    urgency: "high",
    // Why the course runs past the visible symptoms — the single most common
    // reason ich comes back.
    keyPoint: "Medication only kills the free-swimming stage. Spots vanishing means the parasite has dropped off to reproduce, NOT that it's gone — stopping now guarantees a worse second wave.",
    steps: [
      { day: 1, title: "Remove chemical filtration", detail: "Take out carbon and any chemical media — they strip medication out of the water. Leave the biological filter alone." },
      { day: 1, title: "Raise temperature slowly", detail: "Freshwater only: raise to about 82°F over 24 hours to speed the parasite's cycle. Never rush it, and add extra aeration — warm water holds less oxygen." },
      { day: 1, title: "Begin medication", detail: "Dose the whole display tank, following the product label. Treating one fish in isolation leaves the tank infested." },
      { day: 3, title: "Second dose", detail: "Re-dose per label. Do a gravel vacuum first if the label calls for a water change." },
      { day: 5, title: "Third dose", detail: "Keep going even if the spots have gone — this is the stage most people stop at." },
      { day: 8, title: "Water change and re-dose", detail: "25% change, vacuum the substrate to remove cysts, then re-dose." },
      { day: 11, title: "Final dose", detail: "Last treatment of the course." },
      { day: 14, title: "Return to normal", detail: "Large water change, carbon back in, temperature back to normal over 24 hours. Watch for two more weeks." },
    ],
  },

  "Marine Velvet": {
    durationDays: 14,
    urgency: "critical",
    keyPoint: "Velvet kills far faster than ich — often within 48 hours. Move fish to a hospital tank and treat with copper immediately; this is not a wait-and-see illness.",
    steps: [
      { day: 1, title: "Move to a hospital tank now", detail: "Copper cannot go in a reef tank — it kills every invertebrate and is absorbed by rock permanently. Set up a bare hospital tank." },
      { day: 1, title: "Start copper, and test it", detail: "Dose to a therapeutic level and verify with a copper test kit. Too little does nothing; too much kills the fish. Test daily." },
      { day: 1, title: "Leave the display fallow", detail: "With no fish, the parasite in the display starves. It needs 6–8 weeks fishless — shorter and you reinfect everything." },
      { day: 3, title: "Check copper level", detail: "Copper is absorbed and drops. Test and top up to hold the therapeutic range." },
      { day: 7, title: "Halfway", detail: "Keep copper stable. Fish should be visibly improving; breathing should have eased." },
      { day: 14, title: "Complete the course", detail: "Hold therapeutic copper for the full 14 days, then reduce gradually with water changes." },
      { day: 30, title: "Observe before returning", detail: "Keep fish in observation for another 2 weeks. Return them only once the display has been fishless 6–8 weeks." },
    ],
  },

  "Brooklynella": {
    durationDays: 10,
    urgency: "critical",
    keyPoint: "Clownfish disease — it moves fast and copper does NOT treat it. Formalin baths are the standard response, and delay is usually fatal.",
    steps: [
      { day: 1, title: "Hospital tank immediately", detail: "Move affected fish to bare-bottom quarantine with strong aeration." },
      { day: 1, title: "Formalin bath", detail: "Give a formalin dip per product instructions, watching the fish the whole time. Remove it at once if it loses balance." },
      { day: 2, title: "Second bath", detail: "Repeat the dip. Fresh, clean water in the hospital tank between baths." },
      { day: 4, title: "Third bath", detail: "Continue as directed. Skin sloughing should be slowing." },
      { day: 7, title: "Assess", detail: "Fish should be eating and the mucus film clearing. Continue baths if symptoms persist." },
      { day: 10, title: "Observation", detail: "Stop treatment and observe for a further week before returning the fish." },
    ],
  },

  "Fin Rot": {
    durationDays: 10,
    urgency: "moderate",
    keyPoint: "Fin rot is almost always a symptom of poor water quality, not a primary infection. Medication without fixing the water just delays the next outbreak.",
    steps: [
      { day: 1, title: "Test everything", detail: "Ammonia, nitrite and nitrate. Any ammonia or nitrite at all is the likely cause and needs fixing first." },
      { day: 1, title: "Large water change", detail: "Change 30–50%, matched for temperature. Clean water alone resolves many mild cases." },
      { day: 2, title: "Daily water changes", detail: "25% daily to keep bacterial load down while the fins recover." },
      { day: 3, title: "Medicate if it's still spreading", detail: "If the edges are still receding or turning black, start an antibacterial per label." },
      { day: 7, title: "Check the margins", detail: "Healing fins show a clear, often clear-white regrowth edge. Ragged black edges mean it's still active." },
      { day: 10, title: "Return to routine", detail: "Resume normal maintenance. Full fin regrowth takes weeks — the infection stopping is the win." },
    ],
  },

  "Columnaris": {
    durationDays: 7,
    urgency: "critical",
    keyPoint: "Often mistaken for fungus. It can kill within 24–48 hours in warm water, and unlike most illnesses you should LOWER the temperature, not raise it.",
    steps: [
      { day: 1, title: "Lower the temperature", detail: "Bring it down toward 75°F. Columnaris becomes far more aggressive in warm water — the opposite of ich." },
      { day: 1, title: "Start antibiotics", detail: "This is bacterial, not fungal. Antifungal treatments will not work." },
      { day: 1, title: "Add aquarium salt (freshwater)", detail: "Salt at the labelled rate slows the bacteria. Check tankmates tolerate it — many catfish and loaches don't." },
      { day: 3, title: "Water change and re-dose", detail: "25% change, then re-dose per label." },
      { day: 5, title: "Assess", detail: "White saddle-shaped patches should be receding. If not, a different antibiotic may be needed." },
      { day: 7, title: "Complete the course", detail: "Finish the full course even if it looks cured — stopping early breeds resistance." },
    ],
  },

  "Gill Flukes": {
    durationDays: 10,
    urgency: "high",
    keyPoint: "Rapid breathing and flashing with no visible spots usually means flukes. They lay eggs that medication can't touch, so a second treatment after hatching is essential.",
    steps: [
      { day: 1, title: "Remove carbon and treat", detail: "Use a praziquantel-based treatment across the whole tank." },
      { day: 1, title: "Add aeration", detail: "Damaged gills mean the fish is already short of oxygen. Increase surface agitation." },
      { day: 3, title: "Watch breathing", detail: "Gill rate should ease as adult flukes die off." },
      { day: 7, title: "Second treatment", detail: "The critical step — this kills the generation that has just hatched from eggs the first dose couldn't reach." },
      { day: 10, title: "Water change", detail: "Large change and carbon back in. Watch for a further two weeks." },
    ],
  },

  "Swim Bladder Disorder": {
    durationDays: 7,
    urgency: "moderate",
    keyPoint: "Usually constipation or trapped air from gulping at the surface — not an infection. Fasting resolves the majority of cases without any medication.",
    steps: [
      { day: 1, title: "Stop feeding", detail: "Fast the fish completely for 3 days. This alone fixes most cases." },
      { day: 1, title: "Check the water", detail: "Rule out ammonia, nitrite and temperature swings as the cause." },
      { day: 4, title: "Feed a deshelled pea", detail: "A blanched, deshelled pea acts as roughage for herbivores and omnivores. Skip this for carnivores." },
      { day: 4, title: "Stop floating food", detail: "Switch to sinking pellets so the fish stops gulping air at the surface." },
      { day: 7, title: "Assess", detail: "If buoyancy hasn't improved at all, it may be an infection or a permanent deformity — some fish live well long-term either way." },
    ],
  },

  "Dropsy": {
    durationDays: 14,
    urgency: "critical",
    keyPoint: "Dropsy is a symptom of organ failure, not a disease. Prognosis is poor and treatment is often unsuccessful — it's worth knowing that before starting.",
    steps: [
      { day: 1, title: "Isolate the fish", detail: "Move it to a hospital tank, both to treat it and to protect the others." },
      { day: 1, title: "Aquarium salt bath", detail: "Epsom salt (magnesium sulphate, not table salt) helps draw out fluid. Follow a hospital-tank dosing guide." },
      { day: 1, title: "Start antibiotics", detail: "A broad-spectrum antibiotic in food is more effective than in water, if the fish is still eating." },
      { day: 4, title: "Assess honestly", detail: "Raised, pinecone-like scales with no improvement usually means it won't recover. Consider whether continuing is kind." },
      { day: 7, title: "Continue or stop", detail: "If the swelling is reducing, complete the course. If it's worsening, humane euthanasia is the kinder option." },
      { day: 14, title: "Review the cause", detail: "Dropsy often follows chronic stress or poor water. Look at the whole system, not just the fish." },
    ],
  },

  "Popeye": {
    durationDays: 10,
    urgency: "moderate",
    keyPoint: "One eye usually means injury; both eyes usually mean water quality or internal infection. Which it is changes the treatment entirely.",
    steps: [
      { day: 1, title: "Count the eyes", detail: "One bulging eye points to physical injury. Both point to water quality or systemic infection." },
      { day: 1, title: "Test the water", detail: "Ammonia, nitrite, nitrate. Bilateral popeye is very often a water-quality symptom." },
      { day: 1, title: "Epsom salt", detail: "Magnesium sulphate helps reduce the fluid behind the eye. Use hospital-tank dosing." },
      { day: 3, title: "Check for hazards", detail: "For a single eye, look for sharp decor or an aggressive tankmate and remove the cause." },
      { day: 5, title: "Antibiotics if needed", detail: "Add an antibacterial if the eye is cloudy or the swelling is worsening." },
      { day: 10, title: "Recovery", detail: "Swelling should be down. Full recovery can take weeks, and some sight loss may be permanent." },
    ],
  },

  "Hole-in-the-Head": {
    durationDays: 21,
    urgency: "moderate",
    keyPoint: "Strongly linked to diet and water quality — especially stray voltage, activated carbon use, and a lack of vitamins. Medication without fixing the cause rarely holds.",
    steps: [
      { day: 1, title: "Improve the diet", detail: "Add vitamin-enriched and varied foods. Nutritional deficiency is a major driver." },
      { day: 1, title: "Increase water changes", detail: "Move to larger, more frequent changes — nitrate levels correlate strongly with outbreaks." },
      { day: 2, title: "Consider metronidazole", detail: "If Hexamita is suspected, medicated food is far more effective than dosing the water." },
      { day: 7, title: "Check the environment", detail: "Look for stray voltage and consider removing carbon — both are associated with the condition." },
      { day: 14, title: "Assess the pits", detail: "Lesions should be shrinking and no longer weeping." },
      { day: 21, title: "Long-term care", detail: "Healed pits often leave scars. Keep the improved diet and water routine permanently." },
    ],
  },
};

// The plan for a disease, or null when there isn't one.
export function getTreatment(diseaseName) {
  return TREATMENTS[diseaseName] || null;
}

// Every disease that has a plan.
export function getTreatableDiseases() {
  return Object.keys(TREATMENTS);
}
