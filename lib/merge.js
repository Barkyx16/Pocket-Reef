// ─────────────────────────────────────────────────────────────────────────────
// Merging two copies instead of choosing between them.
//
// Cloud sync stores one JSON blob per account and writes it whole, so the
// conflict question has only ever had two answers: keep this device, or keep
// the cloud. Both of them throw work away. The dialog is honest about it —
// "keeping the cloud copy will replace what's on this device" — but a keeper
// who logged tests on their phone at the tank and on their iPad on the sofa
// has to pick which week of their own records to delete.
//
// Nothing about the data requires that. A water test is an immutable dated
// fact; so is a dose, a water change, a journal entry, an expense. Two copies
// of a tank are almost always the same history plus different tails, and the
// union of them is simply the correct answer.
//
// The rules, in order of how much they matter:
//
//   * Records with ids are unioned by id. Nothing is dropped.
//   * Water tests have no id — they're keyed by date, which is the app's own
//     model (the CSV importer dedupes on date too). Where both sides have a
//     reading for one date, the fuller one wins, because a partial test is
//     usually the same test entered before the rest of the kit was run.
//   * Scalars that can't be merged — tank name, size, notes — go to whichever
//     side was edited more recently. Something has to win; the newer edit is
//     the least surprising answer and it's the only one the keeper can predict.
//
// Every merge returns a report, because a silent merge is as untrustworthy as
// a silent overwrite.
// ─────────────────────────────────────────────────────────────────────────────

const asArray = (v) => (Array.isArray(v) ? v : []);
const asObject = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

// Newest first, matching how every log in the app is stored.
const byDateDesc = (a, b) => {
  const x = String(a && a.date || "");
  const y = String(b && b.date || "");
  return x < y ? 1 : x > y ? -1 : 0;
};

// Record lists that carry a stable id. These are the easy, safe ones.
const ID_LISTS = ["journal", "costs", "feedings", "waterChanges", "doses", "medDoses", "equipment", "upkeep", "losses", "inventory", "treatments"];

// How many readings a test actually contains — the tiebreak when two copies
// claim the same date.
const valueCount = (t) => Object.keys(asObject(t && t.values)).length;

export function unionById(a = [], b = []) {
  const out = [];
  const seen = new Set();
  [...asArray(a), ...asArray(b)].forEach((item) => {
    if (!item) return;
    const id = item.id != null ? String(item.id) : null;
    // An entry with no id can't be deduped, so it's kept rather than dropped —
    // a duplicate is recoverable and a deletion is not.
    if (id == null) { out.push(item); return; }
    if (seen.has(id)) return;
    seen.add(id);
    out.push(item);
  });
  return out.sort(byDateDesc);
}

export function unionTests(a = [], b = []) {
  const byDate = new Map();
  [...asArray(a), ...asArray(b)].forEach((t) => {
    if (!t || !t.date) return;
    const existing = byDate.get(t.date);
    if (!existing || valueCount(t) > valueCount(existing)) byDate.set(t.date, t);
  });
  return [...byDate.values()].sort(byDateDesc);
};

// Maps keyed by species name or task id: maintenance dates, quantities, notes.
// The later date wins where the values are dates; otherwise the preferred side.
function mergeMap(a = {}, b = {}, { preferB = false, datesAsValues = false } = {}) {
  const out = { ...asObject(a) };
  Object.entries(asObject(b)).forEach(([k, v]) => {
    if (!(k in out)) { out[k] = v; return; }
    if (datesAsValues) {
      // A "last done" date: the later one is the true answer regardless of
      // which device is newer, because the job really was done then.
      const mine = String(out[k] || "");
      const theirs = String(v || "");
      if (theirs > mine) out[k] = v;
      return;
    }
    if (preferB) out[k] = v;
  });
  return out;
}

// Observations are keyed by species name and hold id'd lists, so they merge
// like both at once.
function mergeObservations(a = {}, b = {}) {
  const out = { ...asObject(a) };
  Object.entries(asObject(b)).forEach(([name, list]) => {
    out[name] = unionById(out[name] || [], list);
  });
  return out;
}

// Scalar fields that simply cannot be merged.
const SCALARS = ["name", "gallons", "water", "emoji", "notes", "createdAt", "lightSchedule", "sourceWater", "targets"];

export function mergeTank(local = {}, cloud = {}, { preferCloud = false } = {}) {
  const merged = { ...local, ...(preferCloud ? {} : {}) };

  SCALARS.forEach((key) => {
    const l = local[key];
    const c = cloud[key];
    if (c === undefined) return;
    if (l === undefined) { merged[key] = c; return; }
    // createdAt is the exception: the earlier date is right. A tank doesn't
    // get younger, and a device that only just installed would otherwise reset
    // a three-year-old tank's age to its own install date.
    if (key === "createdAt") {
      merged[key] = String(l) < String(c) ? l : c;
      return;
    }
    merged[key] = preferCloud ? c : l;
  });

  ID_LISTS.forEach((key) => { merged[key] = unionById(local[key], cloud[key]); });

  // Quarantine can't use the plain union: an arrival exists on both sides with
  // the SAME id, so first-seen wins and every clearance check ticked on the
  // other device is thrown away. Observing a fish is exactly the kind of thing
  // done on whichever device is to hand, and a lost tick means the app asks
  // for it again — or worse, holds a clear fish back.
  merged.quarantine = mergeQuarantine(local.quarantine, cloud.quarantine);

  merged.waterTests = unionTests(local.waterTests, cloud.waterTests);
  // Stock is a set of names; a fish present on either side is in the tank.
  merged.stock = [...new Set([...asArray(local.stock), ...asArray(cloud.stock)])];
  merged.quantities = mergeMap(local.quantities, cloud.quantities, { preferB: preferCloud });
  merged.stockMeta = mergeMap(local.stockMeta, cloud.stockMeta, { preferB: preferCloud });
  merged.maintenance = mergeMap(local.maintenance, cloud.maintenance, { datesAsValues: true });
  merged.observations = mergeObservations(local.observations, cloud.observations);

  return merged;
}

// Arrivals union by id like everything else, but their checks are OR'd: a box
// ticked anywhere was ticked, and nobody ticks one by accident.
export function mergeQuarantine(a = [], b = []) {
  const byId = new Map();
  [...asArray(a), ...asArray(b)].forEach((item) => {
    if (!item) return;
    const id = item.id != null ? String(item.id) : null;
    if (id == null) return;
    const existing = byId.get(id);
    if (!existing) { byId.set(id, { ...item, checks: asObject(item.checks) }); return; }
    byId.set(id, {
      ...existing,
      // The earlier start date is the true one — quarantine began when it began.
      startDate: String(item.startDate || "") && String(item.startDate) < String(existing.startDate || "")
        ? item.startDate
        : existing.startDate,
      checks: { ...existing.checks, ...Object.fromEntries(Object.entries(asObject(item.checks)).filter(([, v]) => v)) },
    });
  });
  // Entries with no id can't be reconciled; keeping them beats deleting them.
  const unkeyed = [...asArray(a), ...asArray(b)].filter((i) => i && i.id == null);
  return [...byId.values(), ...unkeyed];
}

// Counts what each side contributed, so the result can be described rather
// than asserted.
function countRecords(tank = {}) {
  let n = asArray(tank.waterTests).length + asArray(tank.quarantine).length;
  ID_LISTS.forEach((k) => { n += asArray(tank[k]).length; });
  Object.values(asObject(tank.observations)).forEach((l) => { n += asArray(l).length; });
  return n;
}

export function mergeSnapshots(local = {}, cloud = {}, { localNewer = true } = {}) {
  const preferCloud = !localNewer;

  const localTanks = asArray(local.tanks);
  const cloudTanks = asArray(cloud.tanks);
  const byId = new Map();

  localTanks.forEach((t) => { if (t && t.id) byId.set(t.id, { local: t }); });
  cloudTanks.forEach((t) => {
    if (!t || !t.id) return;
    const slot = byId.get(t.id) || {};
    slot.cloud = t;
    byId.set(t.id, slot);
  });

  const tanks = [];
  let onlyLocal = 0;
  let onlyCloud = 0;
  let gained = 0;

  byId.forEach(({ local: l, cloud: c }) => {
    if (l && c) {
      const merged = mergeTank(l, c, { preferCloud });
      gained += Math.max(0, countRecords(merged) - Math.max(countRecords(l), countRecords(c)));
      tanks.push(merged);
    } else if (l) { onlyLocal++; tanks.push(l); }
    else if (c) { onlyCloud++; tanks.push(c); }
  });

  // Order follows whichever side is newer, so the tank list doesn't reshuffle
  // under someone who didn't ask for it.
  const order = (preferCloud ? cloudTanks : localTanks).map((t) => t && t.id).filter(Boolean);
  tanks.sort((a, b) => {
    const i = order.indexOf(a.id);
    const j = order.indexOf(b.id);
    return (i === -1 ? 999 : i) - (j === -1 ? 999 : j);
  });

  const newer = preferCloud ? cloud : local;
  const older = preferCloud ? local : cloud;

  const merged = {
    ...older,
    ...newer,
    tanks,
    // Progress is cumulative, so the higher figure is the true one — taking
    // the newer device's would delete XP earned on the other.
    xp: Math.max(Number(local.xp) || 0, Number(cloud.xp) || 0),
    activeDays: [...new Set([...asArray(local.activeDays), ...asArray(cloud.activeDays)])].sort(),
    wishlist: [...new Set([...asArray(local.wishlist), ...asArray(cloud.wishlist)])],
    challengesDone: [...new Set([...asArray(local.challengesDone), ...asArray(cloud.challengesDone)])],
    recent: [...new Set([...asArray(newer.recent), ...asArray(older.recent)])].slice(0, 20),
    careDone: mergeMap(local.careDone, cloud.careDone, { preferB: preferCloud }),
    // Hand-written text: never overwrite a note with a blank one.
    speciesNotes: mergeNotes(local.speciesNotes, cloud.speciesNotes, preferCloud),
    strengths: mergeMap(local.strengths, cloud.strengths, { preferB: preferCloud }),
    tankSized: Boolean(local.tankSized || cloud.tankSized),
  };

  return {
    merged,
    report: {
      tanks: tanks.length,
      onlyLocal,
      onlyCloud,
      gained,
      preferred: preferCloud ? "cloud" : "device",
      records: countRecords({ waterTests: [] }) + tanks.reduce((n, t) => n + countRecords(t), 0),
    },
  };
}

// A blank note must never replace a written one, whichever side is newer —
// text somebody typed by hand is the least replaceable thing in the store.
function mergeNotes(a = {}, b = {}, preferB = false) {
  const out = { ...asObject(a) };
  Object.entries(asObject(b)).forEach(([k, v]) => {
    const mine = String(out[k] || "").trim();
    const theirs = String(v || "").trim();
    if (!theirs) return;
    if (!mine) { out[k] = v; return; }
    if (mine === theirs) return;
    // Both sides wrote something different. Keeping both is the only lossless
    // answer; a merge marker is ugly and a deleted paragraph is worse.
    out[k] = preferB ? `${theirs}\n\n${mine}` : `${mine}\n\n${theirs}`;
  });
  return out;
}
