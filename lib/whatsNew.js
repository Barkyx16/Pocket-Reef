// ─────────────────────────────────────────────────────────────────────────────
// What changed since you last opened this.
//
// The app has grown a great deal, and an existing keeper who updates gets none
// of it announced. They open the same Home screen, the new work sits behind a
// tool picker and a collapsed card, and the most likely outcome is that they
// never find out their app can now tell them why their nitrate won't come down.
//
// Achievements and search made the depth findable for somebody looking. This is
// for somebody who isn't looking — shown once per version, then never again.
//
// Deliberately written as what it does for the keeper rather than as a
// changelog. "Correlation engine" is a thing I built; "why your nitrate won't
// come down" is a thing they have wondered about.
// ─────────────────────────────────────────────────────────────────────────────

// Newest first. `since` is the app version the entry shipped in, used only to
// decide what a returning keeper hasn't seen.
export const RELEASES = [
  {
    version: "1.1.0",
    title: "Your tank, explained",
    items: [
      { emoji: "🚰", title: "Why a reading won't come down", text: "Test your tap or RODI once, and every water-change prediction accounts for what's already in it — including when the answer is that no water change can reach your target." },
      { emoji: "⚖️", title: "Steady beats ideal", text: "Parameters are now graded on how fast they move, not just where they sit. A tank averaging a perfect number by swinging to get there is harder on its inhabitants than one sitting slightly off." },
      { emoji: "🔗", title: "What your tank does when you do something", text: "Water changes, doses and feedings are cross-referenced against your readings, so the app can say what actually follows what — from your own log." },
      { emoji: "🌿", title: "Algae, diagnosed from your numbers", text: "Say what you're seeing and it works back through your nutrients, photoperiod and tank age. The free fix comes first." },
      { emoji: "💡", title: "Light schedule", text: "Photoperiod drives algae as much as nutrients do, and it's the only one of the two that costs nothing to change." },
      { emoji: "🧂", title: "The shelf", text: "Salt, media and test kits, with run-out dates worked out from the water changes and doses you already log." },
      { emoji: "📅", title: "How often to test", text: "An interval per parameter, from how fast yours actually move and how much room they have." },
      { emoji: "📥", title: "Bring your history with you", text: "Import years of readings from a spreadsheet. Every trend and forecast is worth more on three years of data than on a fortnight." },
      { emoji: "🛟", title: "Restore points", text: "Automatic local snapshots, so a bad import or a mistap is a tap to undo rather than a support email." },
      { emoji: "🔀", title: "Two devices, one history", text: "Sync conflicts merge both copies instead of asking which week of your own records to delete." },
      { emoji: "✈️", title: "Going away", text: "Care notes for whoever's watching the tank — and the honest advice that under five days, the safest plan is to do nothing." },
      { emoji: "🛡️", title: "Quarantine, properly", text: "What to watch for each week, and clearance that depends on the fish rather than on the calendar." },
    ],
  },
];

// Comparable version numbers. "1.10.0" is newer than "1.9.0", which a string
// comparison gets backwards.
export function compareVersions(a = "0", b = "0") {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

// What to show, given the version last acknowledged.
//
//   seen == null  → a brand-new install. Show nothing: somebody who has never
//                   used the app has nothing to catch up on, and a "what's new"
//                   on first launch is a tour of features they haven't met.
//   seen == current → nothing new.
//   otherwise     → every release newer than what they've seen.
export function unseenReleases(seen, current) {
  if (!seen) return [];
  return RELEASES.filter((r) => compareVersions(r.version, seen) > 0 && compareVersions(r.version, current) <= 0);
}

export function shouldShow(seen, current) {
  return unseenReleases(seen, current).length > 0;
}

// Flattens the unseen releases into one list, capped — twelve items is a
// changelog, and a changelog is something people dismiss.
export function itemsToShow(seen, current, limit = 8) {
  return unseenReleases(seen, current).flatMap((r) => r.items).slice(0, limit);
}

export const LATEST_VERSION = RELEASES.length ? RELEASES[0].version : "0";
