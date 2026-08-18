jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Five more engines. As before, the refusals matter as much as the findings:
// an anomaly detector that flags normal readings is one people switch off, a
// simulator that approves everything is decoration, and a restore system that
// can't actually restore is worse than none because it's trusted.

const { checkReading, checkReadings, median } = require("../lib/anomaly");
const { simulateAdditions, tankSizeFor, alternativesFor } = require("../lib/whatif");
const { createRestorePoint, listRestorePoints, restoreToPoint, deleteRestorePoint, describeAge, describeSize, MAX_POINTS } = require("../lib/restore");
const { testSchedule, recommendFor, observedInterval } = require("../lib/cadence");
const { compareFleet, profileTank } = require("../lib/fleet");
const { activeParams } = require("../lib/targets");
const { SPECIES, getSpecies } = require("../core");
const AsyncStorageMod = require("@react-native-async-storage/async-storage");

// Day keys built the way the app builds them: local calendar fields, not UTC.
// These fixtures previously used toISOString(), which is the exact assumption
// the app was fixed for — so in any non-UTC zone the fixture's "today" and the
// app's "today" were different days.
function localDay(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const AsyncStorage = AsyncStorageMod.default || AsyncStorageMod;

const NOW = new Date("2026-08-17T12:00:00Z").getTime();
const dayAgo = (n) => localDay(NOW - n * 86400000);
const test0 = (date, values) => ({ date, water: "salt", values });
const param = (key, water = "salt") => activeParams(water).find((p) => p.key === key);



// ─────────────────────────────────────────────────────────────────────────────
// Anomaly detection
// ─────────────────────────────────────────────────────────────────────────────
describe("is this reading plausible for THIS tank", () => {
  // Six months of a tank that always reads nitrate 8–12.
  const steady = [0, 7, 14, 21, 28, 35].map((d, i) => test0(dayAgo(d), { nitrate: [10, 8, 12, 9, 11, 10][i] }));

  test("a normal reading passes without comment", () => {
    expect(checkReading(param("nitrate"), 11, steady, { now: NOW }).level).toBe("ok");
  });

  test("a reading absurd for this tank is caught, though it's perfectly possible in general", () => {
    // 65ppm is a real number somebody logs honestly. Not in this tank. Chosen
    // deliberately NOT to be a clean 10x, so this exercises the "unusual for
    // you" path rather than the decimal-slip one tested below.
    const r = checkReading(param("nitrate"), 65, steady, { now: NOW });
    expect(r.level).toBe("suspect");
    expect(r.message).toMatch(/retest/i);
    expect(r.message).toContain("10"); // names the usual value
  });

  test("a decimal in the wrong place is named as such, with the likely value", () => {
    const alkHistory = [0, 7, 14, 21].map((d) => test0(dayAgo(d), { alk: 8.4 }));
    const r = checkReading(param("alk"), 84, alkHistory, { now: NOW });
    expect(r.title).toMatch(/decimal/i);
    expect(r.suggestion).toBe(8.4);
  });

  test("a new tank with no history is never second-guessed", () => {
    expect(checkReading(param("nitrate"), 500, [test0(dayAgo(0), { nitrate: 10 })], { now: NOW }).level).toBe("ok");
  });

  test("a perfectly steady tank doesn't flag every ordinary wobble", () => {
    // MAD is zero here; without a noise floor every deviation is infinitely
    // surprising and the detector fires on 8.5.
    const flat = [0, 7, 14, 21].map((d) => test0(dayAgo(d), { alk: 8.4 }));
    expect(checkReading(param("alk"), 8.5, flat, { now: NOW }).level).toBe("ok");
    expect(checkReading(param("alk"), 8.6, flat, { now: NOW }).level).toBe("ok");
  });

  test("a genuine crash in a steady tank still gets through", () => {
    const flat = [0, 7, 14, 21].map((d) => test0(dayAgo(d), { alk: 8.4 }));
    expect(checkReading(param("alk"), 3, flat, { now: NOW }).level).not.toBe("ok");
  });

  test("one previous outlier doesn't move the goalposts", () => {
    // A mean would be dragged upward by the 100 and then accept 60 as normal.
    const withOutlier = [...steady, test0(dayAgo(42), { nitrate: 100 })];
    expect(checkReading(param("nitrate"), 60, withOutlier, { now: NOW }).level).not.toBe("ok");
  });

  test("stale history isn't used to judge today", () => {
    const old = [200, 210, 220, 230].map((d) => test0(dayAgo(d), { nitrate: 10 }));
    expect(checkReading(param("nitrate"), 100, old, { now: NOW }).level).toBe("ok");
  });

  test("blanks and nonsense are the validator's job, not this one", () => {
    expect(checkReading(param("nitrate"), "", steady, { now: NOW }).level).toBe("ok");
    expect(checkReading(param("nitrate"), "abc", steady, { now: NOW }).level).toBe("ok");
  });

  test("a whole form is checked at once, worst first", () => {
    const history = [0, 7, 14, 21].map((d) => test0(dayAgo(d), { nitrate: 10, alk: 8.4 }));
    const found = checkReadings([param("nitrate"), param("alk")], { nitrate: 100, alk: 8.5 }, history, { now: NOW });
    expect(found).toHaveLength(1);
    expect(found[0].key).toBe("nitrate");
  });

  test("median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Wishlist what-if
// ─────────────────────────────────────────────────────────────────────────────
describe("what if I bought my wishlist", () => {
  const fresh = SPECIES.filter((s) => s.water === "fresh");
  const small = fresh.find((s) => s.minGallons <= 15);
  const huge = fresh.reduce((a, b) => (b.minGallons > a.minGallons ? b : a));

  test("a species needing a bigger tank is blocked, and says by how much", () => {
    const r = simulateAdditions({ gallons: 10, water: "fresh", stock: [] }, [huge.name]);
    expect(r.blocked).toHaveLength(1);
    expect(r.blocked[0].blockers.some((b) => b.kind === "size")).toBe(true);
  });

  test("the wrong water type is blocked", () => {
    const salty = SPECIES.find((s) => s.water === "salt");
    const r = simulateAdditions({ gallons: 500, water: "fresh", stock: [] }, [salty.name]);
    expect(r.blocked[0].blockers.some((b) => b.kind === "water")).toBe(true);
  });

  test("it catches conflicts BETWEEN wishlist species, which per-fish checks can't", () => {
    const aggressive = fresh.filter((s) => s.temperament === "aggressive");
    if (aggressive.length < 2) return;
    const r = simulateAdditions({ gallons: 500, water: "fresh", stock: [] }, [aggressive[0].name, aggressive[1].name]);
    const clash = r.items.some((i) => i.blockers.some((b) => b.kind === "wishconflict"));
    expect(clash).toBe(true);
  });

  test("schooling species are simulated as the school you'd actually buy", () => {
    const schooler = fresh.find((s) => s.minGroup > 1);
    const r = simulateAdditions({ gallons: 500, water: "fresh", stock: [] }, [schooler.name]);
    expect(r.items[0].count).toBe(schooler.minGroup);
  });

  test("bioload is computed for the whole basket, not one fish at a time", () => {
    const r = simulateAdditions({ gallons: 500, water: "fresh", stock: [] }, [small.name]);
    expect(r.load.after.pct).toBeGreaterThanOrEqual(r.load.before.pct);
  });

  test("a tiny tank and a big list is reported as overstocking, not as a pass", () => {
    const many = fresh.filter((s) => s.minGallons <= 20).slice(0, 8).map((s) => s.name);
    const r = simulateAdditions({ gallons: 20, water: "fresh", stock: [] }, many);
    expect(r.overstocked).toBe(true);
    expect(r.headline).toMatch(/overstock/i);
  });

  test("the buy order puts the peaceful fish in first", () => {
    const peaceful = fresh.find((s) => s.temperament === "peaceful" && s.minGallons <= 20);
    const aggressive = fresh.find((s) => s.temperament === "aggressive" && s.minGallons <= 55);
    if (!peaceful || !aggressive) return;
    const r = simulateAdditions({ gallons: 500, water: "fresh", stock: [] }, [aggressive.name, peaceful.name]);
    if (r.order.length === 2) expect(r.order[0].name).toBe(peaceful.name);
  });

  test("fish already in the tank aren't proposed as additions", () => {
    const r = simulateAdditions({ gallons: 500, water: "fresh", stock: [small.name] }, [small.name]);
    expect(r.ok).toBe(false);
  });

  test("an empty wishlist says so rather than throwing", () => {
    expect(simulateAdditions({ gallons: 100 }, []).ok).toBe(false);
  });

  test("it can say what size tank the list would actually need", () => {
    expect(tankSizeFor([huge.name])).toBeGreaterThanOrEqual(huge.minGallons);
    expect(tankSizeFor([])).toBeNull();
  });

  test("alternatives only suggest species that genuinely fit", () => {
    const alts = alternativesFor({ gallons: 10, water: "fresh", stock: [] }, 4);
    alts.forEach((s) => {
      expect(s.minGallons).toBeLessThanOrEqual(10);
      expect(s.water).toBe("fresh");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Restore points
// ─────────────────────────────────────────────────────────────────────────────
describe("restore points", () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  test("a point captures the data and can be listed", async () => {
    await AsyncStorage.setItem("pr_tanks", JSON.stringify([{ id: "t1", name: "Reef" }]));
    const entry = await createRestorePoint("Test");
    expect(entry).toBeTruthy();
    expect(entry.keys).toBeGreaterThan(0);
    expect(await listRestorePoints()).toHaveLength(1);
  });

  test("restoring brings back the data as it was", async () => {
    await AsyncStorage.setItem("pr_tanks", JSON.stringify([{ id: "t1", name: "Original" }]));
    const entry = await createRestorePoint("Before edit");

    await AsyncStorage.setItem("pr_tanks", JSON.stringify([{ id: "t1", name: "Ruined" }]));
    const res = await restoreToPoint(entry.id);

    expect(res.ok).toBe(true);
    expect(JSON.parse(await AsyncStorage.getItem("pr_tanks"))[0].name).toBe("Original");
  });

  test("a restore is itself undoable — it snapshots the present first", async () => {
    await AsyncStorage.setItem("pr_tanks", JSON.stringify([{ id: "t1", name: "Original" }]));
    const first = await createRestorePoint("v1");
    await AsyncStorage.setItem("pr_tanks", JSON.stringify([{ id: "t1", name: "Second" }]));

    const res = await restoreToPoint(first.id);
    expect(res.undoId).toBeTruthy();

    // Undo the restore: back to "Second".
    const undo = await restoreToPoint(res.undoId);
    expect(undo.ok).toBe(true);
    expect(JSON.parse(await AsyncStorage.getItem("pr_tanks"))[0].name).toBe("Second");
  });

  test("snapshots never contain other snapshots", async () => {
    await AsyncStorage.setItem("pr_tanks", JSON.stringify([{ id: "t1" }]));
    const a = await createRestorePoint("one");
    const b = await createRestorePoint("two");
    // Without stripping, the second snapshot embeds the first and grows fast.
    expect(b.bytes).toBeLessThan(a.bytes * 3);
    const raw = await AsyncStorage.getItem(`pr_restore_pt_${b.id}`);
    expect(raw).not.toContain("pr_restore_pt_");
  });

  test("only the newest few are kept, and dropped payloads are deleted", async () => {
    await AsyncStorage.setItem("pr_tanks", JSON.stringify([{ id: "t1" }]));
    const made = [];
    for (let i = 0; i < MAX_POINTS + 2; i++) made.push(await createRestorePoint(`p${i}`));

    const index = await listRestorePoints();
    expect(index).toHaveLength(MAX_POINTS);
    // The oldest two are gone from storage, not just from the index.
    expect(await AsyncStorage.getItem(`pr_restore_pt_${made[0].id}`)).toBeNull();
  });

  test("a missing point fails safely rather than wiping anything", async () => {
    await AsyncStorage.setItem("pr_tanks", JSON.stringify([{ id: "t1", name: "Intact" }]));
    const res = await restoreToPoint("does-not-exist");
    expect(res.ok).toBe(false);
    expect(JSON.parse(await AsyncStorage.getItem("pr_tanks"))[0].name).toBe("Intact");
  });

  test("a point can be deleted", async () => {
    await AsyncStorage.setItem("pr_tanks", "[]");
    const entry = await createRestorePoint("temp");
    expect(await deleteRestorePoint(entry.id)).toHaveLength(0);
    expect(await AsyncStorage.getItem(`pr_restore_pt_${entry.id}`)).toBeNull();
  });

  test("ages and sizes read like English", () => {
    expect(describeAge(new Date(NOW - 30 * 60000).toISOString(), NOW)).toBe("30 min ago");
    expect(describeAge(new Date(NOW - 3 * 3600000).toISOString(), NOW)).toBe("3 hours ago");
    expect(describeAge(new Date(NOW - 26 * 3600000).toISOString(), NOW)).toBe("yesterday");
    expect(describeSize(2048)).toBe("2 KB");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test cadence
// ─────────────────────────────────────────────────────────────────────────────
describe("how often to test", () => {
  test("a fast-moving parameter near its edge wants testing often", () => {
    // Alk climbing steadily toward the top of its band.
    const climbing = [0, 3, 6, 9].map((d, i) => test0(dayAgo(d), { alk: [11.4, 10.6, 9.8, 9.0][i] }));
    const r = recommendFor(param("alk"), climbing, { now: NOW });
    expect(r.recommended).toBeLessThanOrEqual(5);
    expect(r.moving).toBe(true);
  });

  test("a parameter that never moves is paced right down", () => {
    const flat = [0, 7, 14, 21, 28].map((d) => test0(dayAgo(d), { magnesium: 1300 }));
    const r = recommendFor(param("magnesium"), flat, { now: NOW });
    expect(r.recommended).toBe(30);
    expect(r.moving).toBe(false);
  });

  test("it notices when you're testing too rarely for what the tank does", () => {
    // Alk moving fast, but only tested fortnightly.
    const rare = [0, 14, 28, 42].map((d, i) => test0(dayAgo(d), { alk: [11.4, 10.4, 9.4, 8.4][i] }));
    const s = testSchedule(rare, "salt", { now: NOW });
    expect(s.ok).toBe(true);
    const alk = s.items.find((i) => i.key === "alk");
    expect(alk.actual).toBeGreaterThan(alk.recommended);
  });

  test("and when you're testing something more than it deserves", () => {
    const daily = Array.from({ length: 10 }, (_, i) => test0(dayAgo(i), { magnesium: 1300 }));
    const s = testSchedule(daily, "salt", { now: NOW });
    expect(s.overTested.some((i) => i.key === "magnesium")).toBe(true);
  });

  test("intervals stay inside something a human would actually do", () => {
    const wild = [0, 1, 2, 3].map((d, i) => test0(dayAgo(d), { alk: [20, 4, 20, 4][i] }));
    const r = recommendFor(param("alk"), wild, { now: NOW });
    expect(r.recommended).toBeGreaterThanOrEqual(1);
    expect(r.recommended).toBeLessThanOrEqual(30);
  });

  test("a thin log asks for more tests rather than guessing a schedule", () => {
    expect(testSchedule([test0(dayAgo(0), { alk: 8.4 })], "salt", { now: NOW }).ok).toBe(false);
  });

  test("observed interval reflects the actual gaps", () => {
    const weekly = [0, 7, 14, 21].map((d) => test0(dayAgo(d), { nitrate: 10 }));
    expect(observedInterval(weekly, "nitrate", { now: NOW })).toBe(7);
    expect(observedInterval([test0(dayAgo(0), { nitrate: 10 })], "nitrate", { now: NOW })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fleet comparison
// ─────────────────────────────────────────────────────────────────────────────
describe("comparing tanks", () => {
  const good = {
    id: "t1", name: "Nano", water: "salt", gallons: 20, emoji: "🐠",
    stock: ["Ocellaris Clownfish"], quantities: { "Ocellaris Clownfish": 1 },
    maintenance: { waterchange: dayAgo(2) },
    waterTests: [0, 3, 6, 9].map((d) => test0(dayAgo(d), { ammonia: 0, nitrate: 5, alk: 8.4 })),
    losses: [],
  };
  const bad = {
    id: "t2", name: "Display", water: "salt", gallons: 20, emoji: "🐟",
    stock: ["Ocellaris Clownfish"], quantities: { "Ocellaris Clownfish": 1 },
    maintenance: { waterchange: dayAgo(60) },
    waterTests: [0, 20, 40].map((d, i) => test0(dayAgo(d), { ammonia: 0, nitrate: 40, alk: [7.2, 9.8, 7.4][i] })),
    losses: [{ id: "l1", name: "Blue Tang", count: 1, reason: "died", date: dayAgo(30) }],
  };

  test("it ranks them and names the biggest difference", () => {
    const f = compareFleet([bad, good], { now: NOW });
    expect(f.ok).toBe(true);
    expect(f.best.name).toBe("Nano");
    expect(f.worst.name).toBe("Display");
    expect(f.headline).toContain("Nano");
    expect(f.differences.length).toBeGreaterThan(0);
  });

  test("the differences are ones where the better tank is actually better", () => {
    const f = compareFleet([bad, good], { now: NOW });
    // Testing cadence is the classic one, and Nano tests far more often.
    const cadence = f.differences.find((d) => d.id === "testEvery");
    if (cadence) expect(cadence.best).not.toBe(cadence.worst);
  });

  test("a single tank has nothing to compare against", () => {
    const f = compareFleet([good], { now: NOW });
    expect(f.ok).toBe(false);
    expect(f.reason).toMatch(/second tank/i);
  });

  test("a brand-new tank sorts last without being declared the worst", () => {
    const empty = { id: "t3", name: "New", water: "salt", gallons: 10, stock: [], waterTests: [], maintenance: {} };
    const f = compareFleet([good, bad, empty], { now: NOW });
    expect(f.ranked[f.ranked.length - 1].name).toBe("New");
    expect(f.worst.name).not.toBe("New");
  });

  test("a profile reports the measures the comparison is built from", () => {
    const p = profileTank(good, { now: NOW });
    expect(p.name).toBe("Nano");
    expect(p.measures.testEvery).toBeGreaterThan(0);
    expect(p.measures).toHaveProperty("stability");
  });

  test("tanks needing attention are surfaced across the whole fleet", () => {
    const f = compareFleet([good, bad], { now: NOW });
    expect(f.needsAttention.some((p) => p.name === "Display")).toBe(true);
  });
});
