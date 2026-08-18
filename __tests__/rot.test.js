jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

// One unreadable row shouldn't take out the card it appeared in.
//
// Every engine iterates a list of records and reaches into each one —
// `entry.date`, `task.id`. That is correct for a record and throws for a null,
// and a throw inside a card is caught by the boundary: the keeper doesn't see
// "one reading was unreadable", they see the whole chart replaced by an
// apology. Nulls get in from a write interrupted mid-save, a sync merge that
// resolved badly, or an import that half-parsed.

const { records } = require("../lib/records");
const { ensureTankShape } = require("../lib/migrations");
const { activeParams } = require("../lib/targets");

const alk = activeParams("salt").find((p) => p.key === "alk");
// Dated relative to now: observedInterval only looks back 90 days, so fixed
// dates would drift out of the window and make this suite fail with the
// calendar rather than with a regression.
const NOW = Date.now();
const ago = (d) => new Date(NOW - d * 86400000).toISOString().slice(0, 10);
const reading = (date, v) => ({ id: date, date, values: { alk: v } });
// A list that is the right shape with rot scattered through it.
const rotten = (good) => [good[0], null, good[1], undefined, good[2], "", good[3], 0, []];
const tests = rotten([
  reading(ago(21), 8.1), reading(ago(14), 8.4),
  reading(ago(7), 8.0), reading(ago(0), 8.3),
]);

describe("records() keeps the records and drops the rest", () => {
  test("drops every non-record", () => {
    expect(records([{ a: 1 }, null, undefined, "", 0, [], NaN, false, { b: 2 }]))
      .toEqual([{ a: 1 }, { b: 2 }]);
  });

  test("an array is rot where a record belongs, despite typeof saying object", () => {
    expect(records([[], [1, 2]])).toEqual([]);
  });

  test("a clean list comes back as the very same array", () => {
    // Callers that compare by reference keep working, and the common case
    // allocates nothing.
    const clean = [{ a: 1 }, { b: 2 }];
    expect(records(clean)).toBe(clean);
  });

  test("anything that isn't a list at all becomes an empty one", () => {
    for (const v of [null, undefined, {}, "abc", 0, NaN]) expect(records(v)).toEqual([]);
  });
});

describe("ensureTankShape strips rot on the way in", () => {
  // This covers everything read from storage, synced, imported or restored.
  test("record arrays lose their unreadable entries", () => {
    const t = ensureTankShape({ id: "t1", waterTests: tests, journal: [null, { id: "j", text: "ok" }] });
    expect(t.waterTests).toHaveLength(4);
    expect(t.waterTests.every((w) => w && typeof w === "object")).toBe(true);
    expect(t.journal).toEqual([{ id: "j", text: "ok" }]);
  });

  test("good records survive untouched", () => {
    const good = [reading("2026-01-01", 8.1), reading("2026-01-08", 8.4)];
    expect(ensureTankShape({ id: "t1", waterTests: good }).waterTests).toEqual(good);
  });

  test("an entirely rotten array becomes an empty one, not a crash", () => {
    expect(ensureTankShape({ id: "t1", waterTests: [null, null] }).waterTests).toEqual([]);
  });
});

describe("the engines survive rot they were handed directly", () => {
  // ensureTankShape covers storage. Arrays assembled at runtime and passed
  // straight to an engine never go through it, so each engine guards its own
  // doorway too.
  const cases = {
    "chart.layoutSeries": () => require("../lib/chart")
      .layoutSeries([{ value: 8, date: "2026-01-01" }, null, { value: 9, date: "2026-01-08" }], { width: 300 }),
    "chart.layoutEvents": () => require("../lib/chart")
      .layoutEvents([{ date: "2026-01-01" }, null], { width: 300, tMin: 0, tMax: Date.now() }),
    "cadence.testSchedule": () => require("../lib/cadence").testSchedule(tests, "salt"),
    "cadence.recommendFor": () => require("../lib/cadence").recommendFor(alk, tests),
    "cadence.observedInterval": () => require("../lib/cadence").observedInterval(tests, "alk"),
    "anomaly.checkReadings": () => require("../lib/anomaly").checkReadings([alk, null], { alk: 8 }, tests),
    "upkeep.sortedByUrgency": () => require("../lib/upkeep")
      .sortedByUrgency([{ id: "a", label: "x", interval: 7 }, null], {}),
    "inventory.forecastInventory": () => require("../lib/inventory")
      .forecastInventory([{ id: "i", name: "Salt", kind: "salt", stock: 5 }, null], { gallons: 50 }),
    "meds.courseTotal": () => require("../lib/meds").courseTotal([{ date: "2026-01-01", ml: 5 }, null]),
    "dataHealth.countRecords": () => require("../lib/dataHealth").countRecords([{ id: "t", waterTests: tests }, null]),
    "todayExtras.withExtras": () => require("../lib/todayExtras").withExtras([{ id: "a", rank: 1 }, null], {}),
    "pending.flattenPending": () => require("../lib/pending").flattenPending([{ items: [{ id: 1 }, null] }, null]),
    "pending.pendingSummary": () => require("../lib/pending").pendingSummary([{ urgent: true }, null]),
    "crashLog.formatCrashes": () => require("../lib/crashLog").formatCrashes([{ at: 1, message: "x" }, null]),
    "correlate.interpret": () => require("../lib/correlate").interpret({ direction: "up" }),
    "vacation.sitterSheet": () => require("../lib/vacation").sitterSheet({ gallons: 50 }),
  };

  for (const [name, run] of Object.entries(cases)) {
    test(`${name} skips the rot instead of throwing`, () => {
      expect(run).not.toThrow();
    });
  }

  test("the rot is skipped, not counted", () => {
    // Surviving by returning nothing would pass the test above and still be
    // wrong — the good readings have to come through.
    const { dots } = require("../lib/chart").layoutSeries(
      [{ value: 8, date: "2026-01-01" }, null, { value: 9, date: "2026-01-08" }], { width: 300 });
    expect(dots).toHaveLength(2);
    expect(require("../lib/cadence").observedInterval(tests, "alk")).toBe(7);
  });

  test("an unnamed tank still prints a sitter sheet", () => {
    const sheet = require("../lib/vacation").sitterSheet({ gallons: 50, days: 7 });
    expect(typeof sheet).toBe("string");
    expect(sheet.length).toBeGreaterThan(0);
  });

  test("a finding with no event is uninterpretable, not fatal", () => {
    expect(require("../lib/correlate").interpret({ direction: "up" })).toBe(null);
    expect(require("../lib/correlate").interpret(null)).toBe(null);
  });
});

describe("the list of record arrays stays honest", () => {
  // Imported, not restated — a copy of the list here would pass while the
  // real one drifted, which is the failure this suite exists to prevent.
  const { TANK_DEFAULTS, RECORD_LISTS } = require("../lib/migrations");

  test("stock keeps its species names, which are strings not records", () => {
    // The first version of the rot filter dropped anything that wasn't an
    // object, which emptied every keeper's livestock list. This is that bug,
    // pinned.
    const t = ensureTankShape({ id: "t1", stock: ["Ocellaris Clownfish", "Yellow Tang"] });
    expect(t.stock).toEqual(["Ocellaris Clownfish", "Yellow Tang"]);
  });

  test("blank species names are still dropped — they match no species", () => {
    expect(ensureTankShape({ id: "t1", stock: ["Yellow Tang", "", null, "  ", 7] }).stock)
      .toEqual(["Yellow Tang"]);
  });

  test("every array in the schema is either guarded or knowingly exempt", () => {
    // A new per-tank array added to TANK_DEFAULTS without a decision here would
    // silently miss the guard. Forcing the choice is the point.
    // Arrays whose entries are not records, each with a reason.
    const EXEMPT = {
      stock: "species-name strings, keyed into stockMeta",
    };
    const arrays = Object.keys(TANK_DEFAULTS).filter((k) => Array.isArray(TANK_DEFAULTS[k]));
    const unaccounted = arrays.filter((k) => !RECORD_LISTS.includes(k) && !(k in EXEMPT));
    expect(unaccounted).toEqual([]);
  });

  test("every guarded list actually exists in the schema", () => {
    // The mirror of the check above: a rename that left this list behind would
    // guard nothing at all and still pass every other test here.
    expect(RECORD_LISTS.filter((k) => !Array.isArray(TANK_DEFAULTS[k]))).toEqual([]);
  });
});
