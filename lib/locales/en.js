// English source strings. Mirror Pocket Planter's approach: this is the reference
// dictionary; every other locale is validated against its key set, and t() falls
// back to the English value (then the raw key) if a string is missing.
export default {
  tabs: { home: "Home", species: "Species", tank: "Tank", log: "Log", games: "Games", journal: "Journal", health: "Health", profile: "Profile", premium: "Premium", more: "More" },
  common: { language: "Language" },
  home: {
    eyebrow: "Your reef, at a glance",
    title: "Pocket Reef",
    sub: "Plan a tank where every fish, invert, and coral thrives together.",
  },
  species: {
    eyebrow: "{count} species",
    title: "Species",
    sub: "Browse fish, inverts & corals. Tap ＋ to stock your tank.",
  },
  tank: {
    eyebrow: "{gallons} gallon · {count} species",
    title: "My Tank",
    sub: "Everything you're keeping — checked for compatibility in real time.",
  },
  log: {
    eyebrowStreak: "{streak}-day streak 🔥",
    eyebrowIdle: "Keep your tank on track",
    title: "Log",
    sub: "Test your water and journal your tank — the two habits that keep a reef thriving.",
  },
  health: {
    eyebrow: "Fish health",
    title: "Health",
    sub: "Spot and stop the most common aquarium diseases — tap any for the full guide.",
  },
};
