// Emergency troubleshooter — fast, practical first-response steps for the common
// "something's wrong right now" situations, distinct from the disease library
// (which is about specific illnesses). Each entry expands to ordered steps.
export const TROUBLESHOOTING = [
  {
    id: "ammonia",
    emoji: "☠️",
    problem: "Ammonia or nitrite above 0",
    summary: "Toxic — act today.",
    steps: [
      "Do a 25–50% water change right now with dechlorinated, temperature-matched water.",
      "Stop feeding for a day or two — less food means less waste while the filter catches up.",
      "Don't rinse or replace your filter media (that's where your bacteria live).",
      "Retest daily and repeat water changes until both read 0. Add more livestock only once stable.",
    ],
  },
  {
    id: "cloudy",
    emoji: "🌫️",
    problem: "Cloudy or milky water",
    summary: "Usually a bacterial bloom.",
    steps: [
      "In a new tank, a white haze is a normal bacterial bloom — don't panic, and don't over-clean.",
      "Avoid overfeeding and don't disturb the substrate, which feed the bloom.",
      "Make sure filtration and flow are adequate; it typically clears on its own in a few days.",
      "Green water instead? That's algae — reduce light hours and nutrients.",
    ],
  },
  {
    id: "algae",
    emoji: "🟢",
    problem: "Algae taking over",
    summary: "A nutrient + light imbalance.",
    steps: [
      "Test nitrate and (if you can) phosphate — algae feeds on both. Water changes bring them down.",
      "Cut your light period to 6–8 hours and keep the tank out of direct sunlight.",
      "Don't overfeed; remove uneaten food and detritus.",
      "Add cleanup crew (snails, or for reefs a tang/hermits) and manually remove what you can.",
    ],
  },
  {
    id: "gasping",
    emoji: "😮‍💨",
    problem: "Fish gasping at the surface",
    summary: "Low oxygen or a toxin.",
    steps: [
      "Increase surface agitation immediately — add an air stone or aim a powerhead at the surface.",
      "Check temperature: warmer water holds less oxygen, so cool it gradually if it's high.",
      "Test for ammonia/nitrite, which damage gills — do a water change if either is present.",
      "Make sure the tank isn't overstocked and that flow reaches all areas.",
    ],
  },
  {
    id: "newtank",
    emoji: "💀",
    problem: "New fish keep dying",
    summary: "Often an uncycled tank.",
    steps: [
      "Test ammonia and nitrite — if either is above 0, the tank isn't cycled and needs more time.",
      "Confirm you're dechlorinating tap water and matching temperature (and salinity for reefs).",
      "Add fish slowly, a few at a time, and quarantine new arrivals for 2–4 weeks.",
      "Acclimate slowly (drip or float-and-add) so temperature and chemistry don't shock them.",
    ],
  },
  {
    id: "temp",
    emoji: "🌡️",
    problem: "Temperature swinging",
    summary: "Heater or room-temp issue.",
    steps: [
      "Verify your heater is sized right (~3–5 watts per gallon) and actually turning on.",
      "Add a second thermometer to cross-check — a stuck heater can over- or under-heat.",
      "Too hot? A clip-on fan across the surface cools by evaporation; a chiller for bigger swings.",
      "Too cold or unreliable? Replace the heater — a stuck-off heater in winter is an emergency.",
    ],
  },
];
