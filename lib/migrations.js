import AsyncStorage from "@react-native-async-storage/async-storage";
import { getJSON, getRaw, setRaw, safeSetJSON, commitJSON, snapshotAll, restoreAll } from "./storage";
import { TEXT_LIMITS, limitText } from "./textLimits";

// ─────────────────────────────────────────────────────────────────────────────
// Schema versioning.
//
// The contract for every future release: user data on disk was written by an
// OLDER version of the app than the one now reading it. Two things make that
// safe, and both live here.
//
//   1. `ensureTankShape` — every tank is normalized against the current field
//      list on load. Add a field to a tank in a future batch, give it a default
//      here, and every existing user's tanks gain it automatically. This alone
//      prevents the most common post-update crash: new code reading `.map()` on
//      a field that didn't exist when the user's data was written.
//
//   2. `MIGRATIONS` — for changes normalization can't express, because they
//      reshape or move data rather than add to it. Each runs exactly once, in
//      order, and the store is backed up in full before any of them run.
//
// Bump SCHEMA_VERSION only when you add a migration.
// ─────────────────────────────────────────────────────────────────────────────

export const SCHEMA_VERSION = 3;

const VERSION_KEY = "pr_schemaVersion";
const BACKUP_KEY = "pr_backup_preMigration";

// Defaults for every field a tank is expected to carry. Anything missing from a
// stored tank gets filled in from here on load. ADD NEW TANK FIELDS HERE.
export const TANK_DEFAULTS = {
  name: "My Tank",
  gallons: 20,
  water: "fresh",
  emoji: "🐠",
  stock: [],
  quantities: {},
  notes: "",
  waterTests: [],
  journal: [],
  costs: [],
  maintenance: {},
  quarantine: [],
  feedings: [],
  // Active and completed disease treatment courses.
  treatments: [],
  // Per-animal records, keyed by species name (the same key `quantities` uses,
  // so the three stay in step). Holds when it was added, where from, what it
  // cost — the things a keeper writes on a tag and then loses.
  stockMeta: {},
  // Animals that are no longer in the tank, and why. Removing a fish used to
  // erase it, which meant the one record worth keeping — what died, when, and
  // what you thought caused it — was the only record the app destroyed.
  losses: [],
  // Water changes as records: { id, date, pct, gallons, note }. The maintenance
  // map holds *when* the last one was, which drives the due date; this holds
  // *what* it was, which is what turns a habit into evidence.
  waterChanges: [],
  // What's physically on this tank: heater, pump, skimmer, light. Purchase
  // dates and warranties live here; service intervals stay in `upkeep`.
  equipment: [],
  // Supplement doses: { id, key, ml, date, note }. Half of the consumption
  // maths — without a record of what went in, a stable tank is indistinguishable
  // from one that consumes nothing.
  doses: [],
  // Custom upkeep task definitions. Last-done dates stay in `maintenance`,
  // keyed by task id, so existing maintenance history is untouched by this.
  upkeep: [],
  // Per-tank parameter targets, keyed by parameter key: { good: [lo, hi],
  // caution: [lo, hi] }. Empty means "use the built-in range for this water
  // type". An SPS tank run at nitrate 5 and a fish-only run at 40 are both
  // correct, and grading them against one hardcoded band is what makes a
  // tracker feel like it doesn't know your tank.
  targets: {},
  // Consumables on the shelf: { id, name, kind, stock, unit, perGallon,
  // doseKey, perDay, expiresAt }. Usage is derived from `waterChanges` and
  // `doses` rather than stored, so this only holds what's left, not a history.
  inventory: [],
  // One test of the water going IN: { kind, values, testedAt }. Every
  // water-change prediction reads this; an empty object means "assume pure",
  // which is what the app assumed silently before it existed.
  sourceWater: {},
  // Photoperiod: { on, off, profile, rampMinutes }. Drives the algae diagnosis
  // and the lighting share of the running cost.
  lightSchedule: null,
  // Dated observations keyed by species name, alongside `quantities` and
  // `stockMeta` — growth measurements, spawning, colour, health episodes.
  observations: {},
  // Medication doses: { id, name, amount, unit, date, note }. Kept apart from
  // `doses`, which is supplements — mixing a treatment course into the
  // consumption maths would corrupt the alkalinity figures it drives.
  medDoses: [],
  // Per-tank reminder cadence, overriding the account-wide default. Empty means
  // "follow the global setting" — a quarantine tank and a display reef want
  // completely different schedules, and one cadence for all of them meant the
  // multi-tank keeper was nagged about a bare QT box on the display's rhythm.
  reminders: {},
};

// Brings one tank up to the current shape without touching data it already has.
// Also repairs type mismatches — a field that should be an array but isn't is
// more dangerous than a missing one, because it passes an existence check and
// then throws at the call site.
// The per-tank arrays whose entries are records. `stock` is deliberately
// absent: its entries are species-name strings, not objects.
export const RECORD_LISTS = [
  "waterTests", "journal", "costs", "quarantine", "feedings", "treatments",
  "losses", "waterChanges", "equipment", "doses", "upkeep",
  "inventory", "medDoses",
];

export function ensureTankShape(tank) {
  if (!tank || typeof tank !== "object") return null;
  const out = { ...tank };

  Object.keys(TANK_DEFAULTS).forEach((key) => {
    const want = TANK_DEFAULTS[key];
    const have = out[key];
    if (have === undefined || have === null) {
      out[key] = Array.isArray(want) ? [] : typeof want === "object" ? {} : want;
      return;
    }
    if (Array.isArray(want) && !Array.isArray(have)) out[key] = [];
    else if (!Array.isArray(want) && typeof want === "object" && typeof have !== "object") out[key] = {};
  });

  // An id is the one field we cannot invent a sensible default for — without it
  // the tank can't be selected, switched to, or deleted.
  if (!out.id) out.id = String(Date.now()) + Math.random().toString(36).slice(2, 6);

  // Tank age predates nothing else, so derive it from the oldest thing logged.
  if (!out.createdAt) {
    const dates = [
      ...(out.waterTests || []).map((e) => e && e.date),
      ...(out.journal || []).map((e) => e && e.date),
    ].filter(Boolean).sort();
    out.createdAt = dates.length ? new Date(dates[0]).toISOString() : new Date().toISOString();
  }

  // Rot inside a list the app will iterate.
  //
  // Guaranteeing the container is an array is not enough on its own: the
  // engines reach into the contents, and `entry.date` on a null throws. That
  // crashes the card rather than skipping the bad row, so one unreadable
  // record takes out the whole chart it appeared in. Nulls arrive from a write
  // interrupted mid-save, a sync merge that resolved badly, or a half-parsed
  // import.
  //
  // The lists are named rather than derived, because they are not all the same
  // shape: `stock` holds species names as plain strings and keys into
  // `stockMeta`, so a blanket "drop anything that isn't an object" empties it.
  // That is not a hypothetical — it is what the first version of this did, and
  // what the round-trip tests caught.
  RECORD_LISTS.forEach((key) => {
    if (!Array.isArray(out[key])) return;
    const clean = out[key].filter((e) => e && typeof e === "object" && !Array.isArray(e));
    if (clean.length !== out[key].length) out[key] = clean;
  });
  if (Array.isArray(out.stock)) {
    // Species names: strings, and a blank one matches no species.
    //
    // Deduped as well, because the list is keyed by name everywhere it renders
    // and a repeat is a duplicate React key — two rows for one fish, sharing
    // component state. The UI can't create one (adding is a toggle guarded by
    // `includes`), but merging two devices' lists can, and so can an import.
    const seen = new Set();
    const clean = out.stock.filter((n) => {
      if (typeof n !== "string" || !n.trim()) return false;
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    });
    if (clean.length !== out.stock.length) out.stock = clean;
  }

  // Text that never passed through a capped TextInput — a pasted JSON import, a
  // profile synced from a build that predates the limits, a restored backup —
  // is bounded here. This is the one place every tank goes through on load,
  // import, restore and sync, so it is the only place the cap can't be skipped.
  out.name = limitText(out.name, TEXT_LIMITS.name);
  out.notes = limitText(out.notes, TEXT_LIMITS.note);
  if (Array.isArray(out.journal)) {
    out.journal = out.journal.map((e) =>
      e && typeof e === "object" ? { ...e, text: limitText(e.text, TEXT_LIMITS.note) } : e);
  }

  return out;
}

// Normalizes a whole list, dropping entries too broken to repair.
export function ensureTanksShape(tanks) {
  if (!Array.isArray(tanks)) return [];
  return tanks.map(ensureTankShape).filter(Boolean);
}

// ── The migration chain ──────────────────────────────────────────────────────
// Each entry runs once, in ascending order, for users below that version.
// `run` should be idempotent where it can be — belt and braces.

const MIGRATIONS = [
  {
    version: 1,
    describe: "Lift legacy single-tank keys into the multi-tank profile list",
    async run() {
      const existing = await commitJSON("pr_tanks", null);
      if (Array.isArray(existing) && existing.length) return; // already multi-tank

      const [gallons, stock, waterTests, journal, costs, maintenance, quarantine] = await Promise.all(
        ["pr_tankGallons", "pr_tank", "pr_waterTests", "pr_journal", "pr_costs", "pr_maint", "pr_qt"].map((k) => AsyncStorage.getItem(k))
      );
      // Nothing legacy to lift — a genuinely new install.
      if (!stock && !waterTests && !journal) return;

      const parse = (raw, fallback) => { try { return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; } };
      const tank = ensureTankShape({
        name: "My Tank",
        gallons: gallons ? Number(gallons) || 20 : 20,
        stock: parse(stock, []),
        waterTests: parse(waterTests, []),
        journal: parse(journal, []),
        costs: parse(costs, []),
        maintenance: parse(maintenance, {}),
        quarantine: parse(quarantine, []),
      });
      await safeSetJSON("pr_tanks", [tank]);
      await setRaw("pr_activeTank", tank.id);
    },
  },
  {
    version: 2,
    describe: "Normalize every stored tank against the current field list",
    async run() {
      const tanks = await commitJSON("pr_tanks", null);
      if (!Array.isArray(tanks) || !tanks.length) return;
      await safeSetJSON("pr_tanks", ensureTanksShape(tanks));
    },
  },
  {
    version: 3,
    describe: "Add the treatments list to every stored tank",
    async run() {
      const tanks = await commitJSON("pr_tanks", null);
      if (!Array.isArray(tanks) || !tanks.length) return;
      // ensureTanksShape already fills the new field from TANK_DEFAULTS; this
      // just persists it so the write happens once rather than on every load.
      await safeSetJSON("pr_tanks", ensureTanksShape(tanks));
    },
  },
];

// Runs any migrations the stored data hasn't seen yet.
//
// Before the first one runs, the entire store is snapshotted to
// `pr_backup_preMigration`. If a migration in some future release turns out to
// be wrong, the user's pre-update data is still sitting there intact — which is
// the difference between a bad release and an unrecoverable one.
//
// Returns { migrated, from, to, backedUp, failed }.
export async function runMigrations() {
  const storedRaw = await getRaw(VERSION_KEY, null);
  // No version key means one of two things: a brand-new install, or a user from
  // before versioning existed. Tanks on disk distinguish them — an existing reef
  // must walk the chain, a new install starts current.
  let from;
  if (storedRaw != null) {
    from = Number(storedRaw) || 0;
  } else {
    const tanks = await commitJSON("pr_tanks", null);
    const legacy = await AsyncStorage.getItem("pr_tank");
    from = (Array.isArray(tanks) && tanks.length) || legacy ? 0 : SCHEMA_VERSION;
  }

  if (from >= SCHEMA_VERSION) {
    if (storedRaw == null) await setRaw(VERSION_KEY, String(SCHEMA_VERSION));
    return { migrated: false, from, to: SCHEMA_VERSION, backedUp: false, failed: [] };
  }

  const pending = MIGRATIONS.filter((m) => m.version > from).sort((a, b) => a.version - b.version);
  if (!pending.length) {
    await setRaw(VERSION_KEY, String(SCHEMA_VERSION));
    return { migrated: false, from, to: SCHEMA_VERSION, backedUp: false, failed: [] };
  }

  let backedUp = false;
  const snapshot = await snapshotAll();
  if (snapshot) {
    backedUp = await safeSetJSON(BACKUP_KEY, {
      version: from,
      at: new Date().toISOString(),
      data: snapshot,
    });
  }

  const failed = [];
  for (const m of pending) {
    try {
      await m.run();
      // Record progress after each step, so an interrupted upgrade resumes at
      // the right place instead of replaying migrations that already ran.
      await setRaw(VERSION_KEY, String(m.version));
    } catch (e) {
      failed.push({ version: m.version, error: String(e && e.message ? e.message : e) });
      break; // don't run later migrations on top of a failed one
    }
  }

  if (!failed.length) await setRaw(VERSION_KEY, String(SCHEMA_VERSION));
  return { migrated: true, from, to: SCHEMA_VERSION, backedUp, failed };
}

// Reads the pre-migration backup, if one exists.
export async function getPreMigrationBackup() {
  return getJSON(BACKUP_KEY, null);
}

// Puts the pre-migration copy back.
//
// The backup was being taken faithfully and then never offered to anyone: a
// failed upgrade set a flag no screen read, so the user saw damaged or missing
// data with no indication that an intact copy of it was sitting on the device.
// Taking a backup you never restore is just using disk.
//
// The schema version is rewound to the backup's own version, so the next launch
// re-attempts the migration from a known-good starting point rather than
// assuming the upgrade succeeded.
export async function restorePreMigrationBackup() {
  const backup = await getPreMigrationBackup();
  if (!backup || !backup.data) return { ok: false, error: "No backup found on this device." };
  const restored = await restoreAll(backup.data);
  if (!restored) return { ok: false, error: "The backup could not be written back." };
  await setRaw(VERSION_KEY, String(backup.version ?? 0));
  return { ok: true, at: backup.at || null, version: backup.version ?? 0 };
}