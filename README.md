# Pocket Reef 🐠

An offline-first aquarium companion for freshwater tanks and saltwater reefs. Plan your
stock, check what actually gets along, track your water chemistry, and keep the whole
hobby loop in one place.

Built with **Expo (SDK 54) + React Native**. Runs on iOS, Android, and the web.

---

## Run it

```bash
npm install
npx expo start
```

Then press **i** for the iOS simulator, **a** for Android, or scan the QR code with the
**Expo Go** app. `npm run web` gives you a quick browser preview.

Everything works offline out of the box — the app saves to the device. Cloud accounts are
optional; see [Cloud save](#cloud-save-optional).

---

## By the numbers

| | |
|---|---|
| **Species catalog** | **316** — 174 freshwater, 142 saltwater |
| **By kind** | 253 fish · 37 invertebrates · 26 corals |
| **Disease guides** | 10, each with signs, prevention, and treatment |
| **Emergency scenarios** | 6 guided troubleshooting flows |
| **Curated tank ideas** | 22 one-tap stocking plans |
| **Achievements** | 86 |
| **Water parameters** | 6 freshwater · 10 saltwater (full reef chemistry) |
| **Daily tips** | 15 |
| **Languages** | English, Spanish |
| **App surface** | 11 screens · 61 components |

### Species data

Every entry carries: `name`, `kind` (fish/invert/coral), `water` (fresh/salt), minimum
tank size, temperature range, pH range, temperament, care level, diet, adult size,
reef-safe flag, schooling minimum, and a plain-English summary.

Care data is **archetype-based** — species are family-classified and share a tuned
baseline, which is how the catalog scales to 316 without 316 hand-written care sheets.
Individual entries can be refined freely.

### Water parameters tracked

- **Freshwater** — ammonia, nitrite, nitrate, pH, GH (hardness), temperature
- **Saltwater** — ammonia, nitrite, nitrate, phosphate, pH, temperature, salinity,
  alkalinity, calcium, magnesium

Each reading is graded against the safe range for your water type, and every parameter
flows automatically through trends, deltas, insights, the cheat-sheet, and the tank
health score.

---

## Free vs Premium

| | Free | Premium |
|---|---|---|
| Home tab | ✅ | ✅ |
| Species catalog | 7-species preview | All 316 |
| Fish saved to a tank | 5 | Unlimited |
| Tank, Log, Health, Journal, Games, Profile | 🔒 | ✅ |
| Disease guides & symptom checker | 🔒 | ✅ |
| Curated tank ideas | 🔒 | ✅ |
| Cloud save & achievements | 🔒 | ✅ |

Entitlement is owned by **RevenueCat** (`lib/purchases.js`) — the app reads it
and never writes it. That's what makes a subscription survive reinstalls, new
devices, refunds, and expiry, and it's why `premiumUnlocked` is deliberately
absent from the cloud-sync field list.

`PREMIUM_TAB_IDS` in `App.js` is the single list that decides paid access. The
tab bar, the More sheet, `jumpTo()` and the render guard all read it, so a tab
can't end up half-protected and a deep link can't route around it. Locked tabs
are never mounted — the wall renders instead of the screen, not on top of it.

In-app purchases need a device build; in Expo Go the SDK is absent and the app
stays on the free tier.

---

## Features

### Home
Reef-keeper level with XP, daily and best streaks, and a prioritized **"Today" action
hub** that reads your reminder cadence and surfaces what actually needs doing — nitrate
climbing, a school below its minimum, a water change coming due. Every Today item is
deep-linked: tapping it jumps to the tab where you act on it.

Plus Fish of the Day, Tip of the Day, achievement progress, tank health score, a
"This Week" activity summary, seasonal tips, smart recommendations for your specific
tank, your wishlist, a daily-care checklist, and live tank warnings.

Multi-tank throughout — switch, edit, duplicate, or delete, with an all-tanks overview.

### Species
Full-text search across name, diet, kind, and description. Filter by water type, care
level, temperament, size, and reef-safe status. Sort by name, size, or easiest. Then the
useful ones: **"fits my tank"** narrows to what your current setup can actually hold,
wishlist hearts save what you're eyeing, **Compare mode** puts two species side by side,
recently-viewed gives you shortcuts back, and 🎲 Surprise Me picks for you.

### Tank
Your stock with per-species quantity steppers, feeding into real-time compatibility
checks, a bioload gauge, and a stocking planner that estimates how many more fish you
have room for.

**Bioload is kind-weighted** — corals add ~0 and inverts ~0.3× a fish — so reef tanks
don't falsely read as overstocked.

Also: the ideal temperature/pH window computed as the intersection across everything you
keep (and flagged when your stock has no overlap), tank age and maturity, notes, a
tappable compatibility matrix that explains *why* a pairing works or doesn't, gear and
feeding guides, acclimation steps, a quarantine tracker that graduates arrivals straight
into your stock, curated Tank Ideas, and a share card with health score, latest water,
and tank age.

### Log
- **Water testing** — graded against safe ranges, with since-last-test deltas
- **Water insights** — per-parameter averages, testing cadence, in-range percentage, CSV export
- **Nitrogen cycle tracker** — know when the tank is actually ready
- **Water-change calculator** — with one-tap logging into maintenance and the journal
- **Maintenance schedule**, **feeding log**, **cost tracking** with category breakdown
- **Photo journal** — searchable, mood-filterable, editable, with a gallery and timeline

Everything logged earns XP.

### Health
Illustrated disease guides, a **symptom checker** that works backward from what you're
actually seeing, and an emergency troubleshooter for the moments that matter.

### Profile
Cloud save and backup, lifetime stats, a collection breakdown by water type and kind,
86 achievements with an earned/locked filter, and premium.

### Species detail
Care stats, contextual tips, live compatibility against your tank, which of *your* tanks
already keep it, wishlist toggle, "more like this," and associated health risks.

---

## Architecture

| Path | Role |
|---|---|
| `App.js` | Tab shell, detail routing, persistence, deep links |
| `core.js` | The brain — warnings, bioload, recommendations, cycle status, Today hub, health score, achievements, streaks/XP |
| `styles.js` | Tokenized design system (ocean/reef theme, spacing scale, gradients, elevation) |
| `data/speciesData.js` | The 316-species catalog |
| `data/compatibility.js` | Compatibility rule engine + hand-tuned overrides |
| `data/fishHealth.js` | Disease library with structured symptom tags |
| `data/waterParams.js` | Parameter targets and grading |
| `data/achievements.js` | 86 achievement definitions |
| `data/tankIdeas.js` | 22 curated stocking plans |
| `data/troubleshooting.js` | Emergency scenario flows |
| `screens/` | Home · Species · Tank · Log · Health · Journal · Games · Profile · More · Premium · Auth |
| `components/` | 61 cards and primitives |
| `lib/` | i18n, units, Supabase client, cloud sync, biometric auth |

### The compatibility engine

`data/compatibility.js` combines rule evaluation — water type, aggression, predator/prey
size ratio, parameter overlap — with hand-tuned `OVERRIDES` for the real-world pairings
the rules get wrong. The predator rule flags any fish 2.2× or more the size of a tankmate
(snails and corals excluded).

Curated tank ideas are verified conflict-free against this engine before shipping.

### Data model

Per-tank data — stock, quantities, notes, water tests, journal, costs, maintenance,
quarantine, feedings — lives inside each tank profile under the `pr_tanks` key.
User-level progress (XP, streaks, wishlist, prefs) is shared across tanks. A one-time
migration lifts legacy single-tank keys into the first tank profile.

---

## Cloud save (optional)

Accounts are powered by Supabase. Until credentials are configured the app runs
local-only and shows "Continue on this device" instead of a login form — every feature
still works.

Setup is four steps, documented in [`supabase/README.md`](supabase/README.md): create a
project, run [`supabase/schema.sql`](supabase/schema.sql), paste your keys into
`lib/supabaseConfig.js`, and register the auth redirect URLs.

The schema is one JSON snapshot row per user with Row Level Security on and every policy
scoped to `auth.uid()`, so the publishable key that ships in the app can only ever touch
the signed-in user's own row. Pushes are debounced and written as a single upsert —
last write wins. Photos stay on the device; only their references sync.

---

## Roadmap

- Wire `expo-notifications` to the existing reminder prefs — the schedule is already
  stored and cadence-aware, but nothing schedules yet
- A test suite for `core.js` — it's the brain and currently has no coverage
- Deploy the `delete-account` Edge Function (body is in `supabase/README.md`)
- Real photography: extend `data/speciesImageMap.js` and `assets/species/`
- RevenueCat for the premium gate
- Enrich archetype-based species summaries with per-species detail

---

## License

Not yet licensed. All rights reserved.
