// Water-parameter targets and assessment — the heart of Pocket Reef's daily
// habit loop (the aquarium equivalent of Pocket Planter's watering system).
// Each parameter has a "good" band and a wider "caution" band; anything outside
// caution is flagged danger. Ranges differ for freshwater vs reef.
export const PARAMS = {
  fresh: [
    { key: "ammonia", label: "Ammonia", unit: "ppm", good: [0, 0], caution: [0, 0.25], ideal: "0 ppm", tip: "Anything above 0 is toxic — do a water change and check your filter." },
    { key: "nitrite", label: "Nitrite", unit: "ppm", good: [0, 0], caution: [0, 0.25], ideal: "0 ppm", tip: "Should read 0 in a cycled tank. If not, change water and hold off on feeding." },
    { key: "nitrate", label: "Nitrate", unit: "ppm", good: [0, 40], caution: [40, 80], ideal: "< 40 ppm", tip: "Creeping up? Do a water change and don't overfeed." },
    { key: "ph", label: "pH", unit: "", good: [6.0, 8.0], caution: [5.5, 8.5], ideal: "6.0–8.0", tip: "Stability matters more than a specific number — avoid sudden swings." },
    { key: "gh", label: "Hardness", unit: "dGH", good: [4, 12], caution: [2, 18], ideal: "4–12 dGH", tip: "General hardness of 4–12 dGH suits most community fish — soft-water species like the low end, livebearers the high." },
    { key: "temp", label: "Temp", unit: "°F", good: [72, 80], caution: [68, 84], ideal: "72–80°F", tip: "Keep it steady; check your heater if it drifts." },
  ],
  salt: [
    { key: "ammonia", label: "Ammonia", unit: "ppm", good: [0, 0], caution: [0, 0.25], ideal: "0 ppm", tip: "Must be 0 in a reef — any reading means trouble; change water now." },
    { key: "nitrite", label: "Nitrite", unit: "ppm", good: [0, 0], caution: [0, 0.25], ideal: "0 ppm", tip: "Should be 0 once cycled." },
    { key: "nitrate", label: "Nitrate", unit: "ppm", good: [0, 20], caution: [20, 40], ideal: "< 20 ppm", tip: "Reef corals prefer low nitrate — water changes and feeding control keep it down." },
    { key: "phosphate", label: "Phosphate", unit: "ppm", good: [0, 0.05], caution: [0, 0.1], ideal: "< 0.05 ppm", tip: "Low phosphate keeps algae down and coral colors bright — export it with water changes, skimming, or GFO." },
    { key: "ph", label: "pH", unit: "", good: [8.0, 8.4], caution: [7.8, 8.5], ideal: "8.0–8.4", tip: "Good aeration and alkalinity hold reef pH steady." },
    { key: "temp", label: "Temp", unit: "°F", good: [74, 82], caution: [72, 84], ideal: "74–82°F", tip: "Reefs like it stable — a controller helps in summer." },
    { key: "salinity", label: "Salinity", unit: "SG", good: [1.023, 1.026], caution: [1.020, 1.028], ideal: "1.023–1.026", tip: "Top off evaporation with fresh (not salt) water to hold salinity steady." },
    { key: "alk", label: "Alk", unit: "dKH", good: [8, 12], caution: [7, 14], ideal: "8–12 dKH", tip: "Alkalinity is the reef's buffer — keep it steady; small daily swings stress corals more than the exact number." },
    { key: "calcium", label: "Calcium", unit: "ppm", good: [400, 450], caution: [380, 480], ideal: "400–450 ppm", tip: "Corals pull calcium to build skeletons — dose to hold it stable alongside alkalinity and magnesium." },
    { key: "magnesium", label: "Magnesium", unit: "ppm", good: [1250, 1400], caution: [1200, 1450], ideal: "1250–1400 ppm", tip: "Magnesium keeps calcium and alkalinity in balance — check it if those two won't hold." },
  ],
};

// Assess a single reading: "good" | "caution" | "danger" | "none".
// Physically possible bounds per parameter — NOT the healthy range, which is
// `good`/`caution`. These exist to catch a mistyped reading before it's stored:
// a pH of 78 (meant 7.8) or a temp of 780 poisons every average, trend and
// forecast built on it afterwards, and nothing downstream can tell it was a
// typo. Deliberately wide — a genuinely alarming reading must still go in.
const PLAUSIBLE = {
  ammonia: [0, 100],
  nitrite: [0, 100],
  nitrate: [0, 500],
  phosphate: [0, 50],
  ph: [3, 11],
  gh: [0, 60],
  temp: [32, 120],      // °F
  salinity: [1.0, 1.05], // specific gravity
  alk: [0, 30],
  calcium: [0, 1000],
  magnesium: [0, 3000],
};

// Is this reading physically possible? Returns { ok, reason }.
export function validateParam(p, value) {
  if (value == null || value === "") return { ok: true };
  const v = Number(value);
  if (Number.isNaN(v)) return { ok: false, reason: "Not a number" };
  const bounds = PLAUSIBLE[p.key];
  if (!bounds) return { ok: true };
  if (v < bounds[0] || v > bounds[1]) {
    return { ok: false, reason: `${p.label} of ${v}${p.unit ? " " + p.unit : ""} isn't possible — check the reading` };
  }
  return { ok: true };
}

export function assessParam(p, value) {
  if (value == null || value === "") return { status: "none" };
  const v = Number(value);
  if (Number.isNaN(v)) return { status: "none" };
  if (v >= p.good[0] && v <= p.good[1]) return { status: "good" };
  if (v >= p.caution[0] && v <= p.caution[1]) return { status: "caution" };
  return { status: "danger" };
}
