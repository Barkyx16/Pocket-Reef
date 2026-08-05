// Fish disease library — the direct analog of Pocket Planter's DISEASE_LIBRARY.
// Each entry drives a tappable, illustrated health guide (see HealthTab).
// Fields mirror the plant-disease cards: what it is, signs, prevent, treat.
// `symptoms` are structured tags that power the Health tab's symptom checker.
export const DISEASES = [
  {
    name: "Ich (White Spot)", emoji: "⚪", water: "both",
    symptoms: ["White spots", "Flashing / scratching", "Clamped fins", "Rapid breathing"],
    description: "The most common aquarium disease — a parasite (Ichthyophthirius) that shows as grains of salt on the skin and fins.",
    signs: "Tiny white spots like sprinkled salt, flashing/rubbing against decor, clamped fins, and rapid breathing.",
    prevent: "Quarantine new fish, avoid temperature swings, and keep stress low with stable, clean water.",
    treat: "Raise temperature gradually, add an ich medication (or aquarium salt for freshwater), and treat the whole tank for the full parasite cycle.",
  },
  {
    name: "Fin Rot", emoji: "🩹", water: "both",
    symptoms: ["Fraying fins", "Reddened fins", "Clamped fins"],
    description: "A bacterial infection, usually triggered by poor water quality or fin nipping, that eats away at the fins.",
    signs: "Ragged, fraying, or receding fin edges, sometimes with a white or reddened margin.",
    prevent: "Keep water pristine with regular changes, avoid overstocking, and remove fin-nipping tankmates.",
    treat: "Improve water quality immediately; for advanced cases use an antibacterial medication and continue clean water changes.",
  },
  {
    name: "Marine Velvet", emoji: "🟡", water: "salt",
    symptoms: ["Gold dust film", "Rapid breathing", "Flashing / scratching", "Lethargy"],
    description: "A fast, deadly saltwater parasite (Amyloodinium) that coats fish in a fine gold-brown dust.",
    signs: "A dusty gold or rust sheen, heavy breathing, scratching, and lethargy — it moves fast and hits the gills first.",
    prevent: "Quarantine every new fish for weeks — velvet is almost always introduced by an untreated newcomer.",
    treat: "Move affected fish to a hospital tank and treat with copper (carefully dosed) or chloroquine; act immediately.",
  },
  {
    name: "Swim Bladder Disorder", emoji: "🎈", water: "both",
    symptoms: ["Floating / sinking", "Trouble swimming", "Loss of appetite"],
    description: "A buoyancy problem — often from overfeeding, constipation, or a swallowed air — not a contagious disease.",
    signs: "Floating upside down, sinking to the bottom, or struggling to stay level while swimming.",
    prevent: "Feed smaller portions, soak dry foods before feeding, and include some fiber (e.g. blanched pea for many fish).",
    treat: "Fast the fish for 24–48 hours, then feed sparingly; keep water warm and clean while it recovers.",
  },
  {
    name: "Dropsy", emoji: "🔴", water: "both",
    symptoms: ["Swollen belly", "Raised scales", "Bulging eyes", "Lethargy"],
    description: "A symptom of serious internal (usually bacterial) infection causing fluid buildup — often a late-stage warning.",
    signs: "A swollen belly with scales sticking out like a pinecone, and often bulging eyes.",
    prevent: "Keep water quality high and stress low — dropsy usually follows chronic poor conditions.",
    treat: "Isolate the fish, use an antibacterial/epsom-salt bath, and improve conditions — but the prognosis is guarded.",
  },
  {
    name: "Popeye", emoji: "👁️", water: "both",
    symptoms: ["Bulging eyes", "Cloudy eyes"],
    description: "A swelling of one or both eyes from injury or infection — a symptom, not a single disease.",
    signs: "One or both eyes bulge outward, sometimes cloudy; usually just one eye if it's from an injury.",
    prevent: "Keep water clean, remove sharp decor, and reduce aggression that leads to eye injuries.",
    treat: "Improve water quality and use epsom salt to draw down swelling; add an antibacterial if infection is suspected.",
  },
  {
    name: "Hole-in-the-Head", emoji: "🕳️", water: "both",
    symptoms: ["Pitting on head", "Eroded skin", "Loss of appetite"],
    description: "Head and Lateral Line Erosion (HLLE) — pitting on the head and along the lateral line, common in tangs and cichlids.",
    signs: "Small pits or eroded patches appearing on the head and following the lateral line down the body.",
    prevent: "Feed a varied, vitamin-rich diet (include marine algae/nori), keep nitrate low, and avoid stray voltage.",
    treat: "Fix diet and water quality — improve nutrition, lower nitrate with water changes; it often reverses slowly.",
  },
  {
    name: "Columnaris", emoji: "⚪", water: "fresh",
    symptoms: ["Cottony patches", "Mouth sores", "Rapid breathing"],
    description: "A fast bacterial infection (often called mouth fungus, though it's bacterial) that strikes stressed freshwater fish.",
    signs: "White or grayish cottony patches on the mouth, fins, or body, and rapid gill breathing.",
    prevent: "Reduce stress, keep water pristine and well-oxygenated, and avoid overcrowding and high temperatures.",
    treat: "Lower the temperature slightly, improve water quality, and treat promptly with an antibacterial medication.",
  },
  {
    name: "Gill Flukes", emoji: "🪱", water: "both",
    symptoms: ["Flashing / scratching", "Rapid breathing", "Excess slime", "Clamped fins"],
    description: "Microscopic parasitic flatworms that latch onto the gills and skin, irritating and weakening the fish.",
    signs: "Flashing and scratching, rapid or labored gill movement, excess slime, and clamped fins.",
    prevent: "Quarantine new fish and keep water clean — flukes are usually introduced by an untreated newcomer.",
    treat: "Treat with a praziquantel-based medication (the standard for flukes) and improve water quality.",
  },
  {
    name: "Brooklynella", emoji: "🟤", water: "salt",
    symptoms: ["Excess slime", "Gasping at surface", "Faded color", "Lethargy"],
    description: "Clownfish disease — a fast, deadly parasite that most often hits newly imported clownfish.",
    signs: "Heavy, sloughing slime coat, faded color, gasping at the surface, and rapid decline over a day or two.",
    prevent: "Quarantine all new clownfish and buy captive-bred stock, which is far less likely to carry it.",
    treat: "Act immediately with a formalin dip and a hospital tank — Brooklynella kills fast, so speed matters.",
  },
];

const byName = Object.fromEntries(DISEASES.map((d) => [d.name, d]));
export function getDisease(name) {
  return byName[name] || null;
}

// The diseases most relevant to a given species (by water type).
export function getDiseasesForSpecies(species) {
  if (!species) return DISEASES;
  return DISEASES.filter((d) => d.water === "both" || d.water === species.water);
}

// Every distinct symptom tag, alphabetized — powers the symptom-checker chips.
export const SYMPTOMS = [...new Set(DISEASES.flatMap((d) => d.symptoms || []))].sort();

// Diseases that list a given symptom (optionally scoped to a water type).
export function getDiseasesBySymptom(symptom, water = "all") {
  return DISEASES.filter(
    (d) => (d.symptoms || []).includes(symptom) && (water === "all" || d.water === "both" || d.water === water)
  );
}
