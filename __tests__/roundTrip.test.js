jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Does a tank survive the journeys the app puts it through?
//
// Five rounds of features added fields to a tank: source water, a light
// schedule, observations, inventory, medication doses, quarantine checks. Each
// one is written by one screen and read by another, and each has to survive
// three separate trips — the export file, a restore point, and a sync merge.
// A field that a trip forgets doesn't error; it just quietly isn't there any
// more, which is how somebody loses four years of coral photographs.

const AsyncStorageMod = require("@react-native-async-storage/async-storage");
const AsyncStorage = AsyncStorageMod.default || AsyncStorageMod;

const { ensureTankShape, ensureTanksShape } = require("../lib/migrations");
const { mergeSnapshots } = require("../lib/merge");
const { createRestorePoint, restoreToPoint } = require("../lib/restore");
const { serialise } = require("../lib/backupFile");
const { buildSnapshot, SYNCED_FIELDS } = require("../lib/cloudSync");
const { newObservation } = require("../lib/observations");
const { newInventoryItem } = require("../lib/inventory");
const { newSourceProfile } = require("../lib/sourceWater");
const { newLightSchedule } = require("../lib/lighting");
const { newMedDose } = require("../lib/meds");

// A tank using every field the app has ever added to one.
const fullTank = () => ({
  id: "t1",
  name: "The Reef",
  gallons: 120,
  water: "salt",
  emoji: "🐠",
  createdAt: "2021-04-01T00:00:00.000Z",
  notes: "Mixed reef",
  stock: ["Ocellaris Clownfish"],
  quantities: { "Ocellaris Clownfish": 2 },
  stockMeta: { "Ocellaris Clownfish": { addedAt: "2021-05-01", source: "LFS", price: 45, notes: "" } },
  waterTests: [{ date: "2026-08-16", water: "salt", values: { nitrate: 5, alk: 8.4 } }],
  journal: [{ id: 1, date: "2026-08-01", text: "Added a clown", mood: "🐠", photo: null }],
  costs: [{ id: 2, date: "2026-07-01", label: "Salt", amount: 40, category: "Other" }],
  maintenance: { waterchange: "2026-08-14" },
  quarantine: [{ id: 3, name: "Tang", startDate: "2026-08-05", checks: { eating: true } }],
  feedings: [{ id: 4, date: "2026-08-16", food: "Frozen" }],
  treatments: [],
  losses: [{ id: 5, name: "Blue Tang", count: 1, reason: "died", date: "2025-01-01" }],
  waterChanges: [{ id: "w1", date: "2026-08-14", pct: 25, gallons: 30 }],
  equipment: [{ id: "e1", name: "Return pump", category: "flow", price: 180, watts: 30, warrantyMonths: 24, installedAt: "2021-04-01", notes: "" }],
  doses: [{ id: "d1", key: "alk", ml: 12, date: "2026-08-15", note: "" }],
  medDoses: [newMedDose({ name: "Copper", amount: 12, date: "2026-08-10" })],
  upkeep: [{ id: "u1", label: "Skimmer strip", emoji: "🧰", days: 30, kind: "chore", notes: "" }],
  targets: { alk: { good: [8, 9], caution: [7.5, 9.5] } },
  inventory: [newInventoryItem({ name: "Salt mix", kind: "salt", stock: 40, perGallon: 0.5 })],
  sourceWater: newSourceProfile({ kind: "rodi", values: { nitrate: 0 } }),
  lightSchedule: newLightSchedule({ on: "10:00", off: "20:00", profile: "sps" }),
  observations: { "Ocellaris Clownfish": [newObservation({ text: "Spawned", size: 2.5, photo: "file:///a.jpg", date: "2026-06-01" })] },
});

// The fields that carry a keeper's actual work, as opposed to derived state.
const RECORD_FIELDS = [
  "waterTests", "journal", "costs", "quarantine", "feedings", "losses",
  "waterChanges", "equipment", "doses", "medDoses", "upkeep", "inventory",
];

const scalarish = ["name", "gallons", "water", "createdAt", "notes", "sourceWater", "lightSchedule", "targets", "stockMeta", "maintenance", "observations", "quantities"];

function expectIntact(after, before) {
  RECORD_FIELDS.forEach((k) => {
    expect(`${k}:${(after[k] || []).length}`).toBe(`${k}:${(before[k] || []).length}`);
  });
  scalarish.forEach((k) => {
    expect({ [k]: after[k] }).toEqual({ [k]: before[k] });
  });
  expect(after.stock).toEqual(before.stock);
}

describe("a fully-populated tank survives", () => {
  test("normalisation, which every load runs it through", () => {
    const before = fullTank();
    expectIntact(ensureTankShape(before), before);
  });

  test("the export file", () => {
    const before = fullTank();
    // The export is JSON.stringify'd and parsed back on import.
    const after = JSON.parse(serialise({ tanks: [before] })).tanks[0];
    expectIntact(after, before);
  });

  test("export followed by the import normaliser", () => {
    const before = fullTank();
    const after = ensureTanksShape(JSON.parse(serialise({ tanks: [before] })).tanks)[0];
    expectIntact(after, before);
  });

  test("a restore point", async () => {
    await AsyncStorage.clear();
    const before = fullTank();
    await AsyncStorage.setItem("pr_tanks", JSON.stringify([before]));
    const point = await createRestorePoint("round trip");

    await AsyncStorage.setItem("pr_tanks", JSON.stringify([{ id: "t1", name: "Wrecked" }]));
    await restoreToPoint(point.id);

    const after = JSON.parse(await AsyncStorage.getItem("pr_tanks"))[0];
    expectIntact(after, before);
  });

  test("a merge against the same copy from another device", () => {
    const before = fullTank();
    // A deep clone, not a second fullTank(): the record constructors mint a
    // fresh id per call, so two independently-built fixtures are genuinely
    // different records and unioning them to 2 is correct. What a real sync
    // sees is the SAME records with the same ids on both sides.
    const copy = JSON.parse(JSON.stringify(before));
    const { merged } = mergeSnapshots({ tanks: [before] }, { tanks: [copy] }, { localNewer: true });
    expectIntact(merged.tanks[0], before);
  });

  test("a merge with genuinely different tails keeps both", () => {
    const local = fullTank();
    const cloud = JSON.parse(JSON.stringify(local));
    cloud.waterTests = [...cloud.waterTests, { date: "2026-08-10", water: "salt", values: { nitrate: 8 } }];
    cloud.journal = [...cloud.journal, { id: 99, date: "2026-08-09", text: "From the iPad", mood: "🐠", photo: null }];
    const { merged } = mergeSnapshots({ tanks: [local] }, { tanks: [cloud] }, { localNewer: true });
    expect(merged.tanks[0].waterTests).toHaveLength(2);
    expect(merged.tanks[0].journal).toHaveLength(2);
  });

  test("a merge against an empty cloud row", () => {
    const before = fullTank();
    const { merged } = mergeSnapshots({ tanks: [before] }, { tanks: [] }, { localNewer: true });
    expectIntact(merged.tanks[0], before);
  });

  test("the cloud snapshot, which is what actually syncs", () => {
    const before = fullTank();
    const snap = buildSnapshot({ tanks: [before], xp: 10 });
    expect(snap.tanks).toBeDefined();
    expectIntact(snap.tanks[0], before);
    // A field added to the app but not to SYNCED_FIELDS is device-local
    // forever without anyone noticing.
    expect(SYNCED_FIELDS).toContain("tanks");
  });
});

describe("a tank from an older build gains the new fields", () => {
  test("every field the app now reads has a default", () => {
    const ancient = { id: "old", name: "Legacy", stock: ["Ocellaris Clownfish"] };
    const shaped = ensureTankShape(ancient);
    ["inventory", "observations", "medDoses", "sourceWater", "equipment", "doses", "upkeep", "targets", "waterChanges", "losses"].forEach((k) => {
      expect(shaped[k]).toBeDefined();
    });
    // And nothing it already had was disturbed.
    expect(shaped.stock).toEqual(["Ocellaris Clownfish"]);
    expect(shaped.name).toBe("Legacy");
  });

  test("a field holding the wrong type is repaired, not trusted", () => {
    const broken = ensureTankShape({ id: "x", waterTests: "not an array", observations: 42 });
    expect(Array.isArray(broken.waterTests)).toBe(true);
    expect(typeof broken.observations).toBe("object");
  });
});
