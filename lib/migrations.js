import AsyncStorage from "@react-native-async-storage/async-storage";
import { getJSON, getRaw, setRaw, safeSetJSON, commitJSON, snapshotAll } from "./storage";

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
const TANK_DEFAULTS = {
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
};

// Brings one tank up to the current shape without touching data it already has.
// Also repairs type mismatches — a field that should be an array but isn't is
// more dangerous than a missing one, because it passes an existence check and
// then throws at the call site.
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
