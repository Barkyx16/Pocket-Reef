# Pocket Reef 🐠

An aquarium/reef companion app — built on the same architecture as Pocket Planter.
The species catalog is Pocket Planter's plant list; the **compatibility engine** is
companion planting; the **fish-disease guides** are the plant-disease cards; and
tank size is the ZIP→zone personalization.

## Run it

```bash
cd ~/Desktop/pocket-reef
npm install
npx expo start
```

Then press **i** for the iOS simulator, **a** for Android, or scan the QR code with
the **Expo Go** app on your phone. (`npm run web` also works for a quick preview.)

## What's here

| File | Role (Pocket Planter analog) |
|---|---|
| `App.js` | Tab shell + detail routing + persistence |
| `core.js` | Helpers, tank warnings, re-exports (`core.js`) |
| `styles.js` | Ocean/reef theme (`styles.js`) |
| `data/speciesData.js` | The species catalog (`produceData.js`) |
| `data/compatibility.js` | **Compatibility engine** (companion planting) |
| `data/fishHealth.js` | Disease library (`diseaseData.js`) |
| `data/waterParams.js` | Water-test targets + assessment (the daily habit loop) |
| `screens/` | Home · Species · Tank · Log · Health tabs |
| `components/` | Species/detail cards, disease guide, water test, journal, hero, collapsible |
| `lib/i18n.js` | i18n stub, ready to expand to more locales |

## Feature loop (built out)

- **Home** — reef-keeper level + XP + daily/best streak, a prioritized "Today" action hub
  (reminder-cadence-aware, with nitrate and complete-your-school nudges), Fish of the Day,
  Tip of the Day, achievements progress, tank health score, a "This Week" activity summary,
  season tip, smart "recommended for your tank" picks, a wishlist section, tank-size picker,
  daily-care checklist, and live tank warnings. Multi-tank switcher (switch · edit · duplicate
  · delete) with an all-tanks overview.
- **Species** — 316-species catalog with full-text search (name, diet, kind, description),
  water/care/temperament/size/reef-safe filters, sort (name · size · easiest), a "fits my
  tank" filter, wishlist hearts, a two-species Compare mode, recently-viewed shortcuts, and
  a 🎲 Surprise-me button.
- **Tank** — your stock with per-species quantity steppers, real-time compatibility, a
  bioload/stocking gauge, a stocking planner ("room for ~N more fish"), an ideal
  temperature/pH window, tank age & maturity, notes, a compatibility matrix, gear & feeding
  guides, acclimation steps, a quarantine tracker that graduates arrivals straight into your
  stock, one-tap curated Tank Ideas, and a rich share card (health + latest water + age).
- **Log** — water testing (graded vs the safe range; freshwater + full reef chemistry incl.
  alkalinity, calcium & magnesium) with since-last-test deltas, water insights (averages,
  cadence, in-range %) and CSV export, target-range cheat-sheet, nitrogen-cycle tracker,
  water-change calculator with one-tap logging, maintenance, a feeding log, a searchable
  photo journal, a photo gallery, timeline, and cost tracking with category breakdown. All earn XP.
- **Health** — illustrated disease guides, a symptom checker, and an emergency troubleshooter.
- **Profile** — cloud-save/backup, lifetime stats, a collection breakdown (species by water
  type & kind), 79 achievements (with earned/locked filter), and premium.
- **Species detail** — care stats, contextual care tips, live compatibility vs your tank,
  which of your tanks keep it, wishlist toggle, "more like this," and health risks.

The **Today hub is deep-linked** — tapping an item jumps to the tab where you act on it.
Bioload is **kind-weighted** (corals add ~0, inverts ~0.3× a fish), so reefs don't read as
overstocked. Journal entries are **editable**, and the water-test form can **prefill your
last readings**.

## Architecture notes

- **`core.js`** is the brain — tank warnings, bioload, recommendations, cycle status,
  the "Today" hub, the 0–100 tank health score, achievements, streaks/XP, and Fish of the Day.
- **Per-tank data** (stock, water tests, journal, costs, maintenance, quarantine) lives
  inside each tank profile in `pr_tanks`; user-level progress (XP, streak, prefs) is shared.
  A one-time migration lifts the legacy single-tank keys into the first tank profile.
- **Compatibility engine** (`data/compatibility.js`) = rules (water type, aggression,
  predator/prey size, parameter overlap) + hand-tuned `OVERRIDES` for known pairings.

## Ideas for next

- Per-species quantities (the stock model is presence-only today), so bioload and
  schooling guidance can account for how many of each you keep.
- Real photos: extend `data/speciesImageMap.js` + `assets/species/` (keep them small —
  max ~600px, learned the hard way!).
- Wire `expo-notifications` to the existing reminder prefs, and RevenueCat to the premium gate.
- Enrich the archetype-based species summaries with per-species detail.

Built with Expo (SDK 54) + React Native — same stack as Pocket Planter, so EAS build
and submit work identically.
