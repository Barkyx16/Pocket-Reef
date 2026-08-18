jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// The achievements added for the record types the original set never knew
// about. These double as the app's own feature tour, so an achievement that
// can't actually be earned is worse than no achievement — it advertises
// something that isn't reachable.

const { buildAchievementStats, getAchievements, ACHIEVEMENTS } = require("../core");
const { newObservation } = require("../lib/observations");
const { newInventoryItem } = require("../lib/inventory");
const { newSourceProfile } = require("../lib/sourceWater");
const { newLightSchedule } = require("../lib/lighting");
const { newMedDose } = require("../lib/meds");

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


const day = (n) => localDay(Date.now() - n * 86400000);
const statsFor = (tank) => buildAchievementStats({ tanks: [{ id: "t1", stock: [], quantities: {}, ...tank }] });
const earned = (tank, id) => {


  const list = getAchievements({ tanks: [{ id: "t1", stock: [], quantities: {}, ...tank }] });
  const a = list.find((x) => x.id === id);
  return a && a.earned;
};

describe("the new achievements are reachable", () => {
  test("every new achievement has a unique id and a check", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    ACHIEVEMENTS.forEach((a) => {
      expect(typeof a.check).toBe("function");
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.desc.length).toBeGreaterThan(0);
    });
  });

  test("testing your source water earns one", () => {
    expect(earned({ sourceWater: newSourceProfile({ kind: "tap", values: { nitrate: 10 } }) }, "source_tested")).toBe(true);
    expect(earned({}, "source_tested")).toBeFalsy();
  });

  test("setting a light schedule earns one", () => {
    expect(earned({ lightSchedule: newLightSchedule({ on: "10:00", off: "20:00" }) }, "light_scheduled")).toBe(true);
    // An empty object is what an older tank carries after normalisation, and
    // it must not count as a schedule.
    expect(earned({ lightSchedule: {} }, "light_scheduled")).toBeFalsy();
  });

  test("stocking the shelf earns one", () => {
    const inventory = ["Salt", "Carbon", "Floss"].map((n) => newInventoryItem({ name: n, kind: "media", stock: 1 }));
    expect(earned({ inventory }, "shelf_stocked")).toBe(true);
    expect(earned({ inventory: inventory.slice(0, 2) }, "shelf_stocked")).toBeFalsy();
  });

  test("recording wattage earns one", () => {
    expect(earned({ equipment: [{ id: "e", name: "Pump", category: "flow", watts: 30 }] }, "gear_watts")).toBe(true);
    expect(earned({ equipment: [{ id: "e", name: "Pump", category: "flow", watts: null }] }, "gear_watts")).toBeFalsy();
  });

  test("observations earn theirs, and ten earn the next", () => {
    const one = { observations: { Clown: [newObservation({ text: "Spawned" })] } };
    expect(earned(one, "first_observation")).toBe(true);
    expect(earned(one, "observer_ten")).toBeFalsy();

    const ten = { observations: { Clown: Array.from({ length: 10 }, (_, i) => newObservation({ text: `n${i}`, date: day(i) })) } };
    expect(earned(ten, "observer_ten")).toBe(true);
  });

  test("two measurements of the same animal earn the growth one — one doesn't", () => {
    const two = { observations: { Coral: [newObservation({ size: 2, date: day(90) }), newObservation({ size: 3, date: day(1) })] } };
    expect(earned(two, "growth_tracked")).toBe(true);

    const one = { observations: { Coral: [newObservation({ size: 2, date: day(1) }), newObservation({ text: "looks bigger", date: day(0) })] } };
    expect(earned(one, "growth_tracked")).toBeFalsy();
  });

  test("two photos of the same animal earn then-and-now", () => {
    const shots = { observations: { Coral: [newObservation({ photo: "file:///a.jpg", date: day(90) }), newObservation({ photo: "file:///b.jpg", date: day(1) })] } };
    expect(earned(shots, "photo_series")).toBe(true);
  });

  test("quarantine cleared on the checks, not the clock", () => {
    const byBook = { quarantine: [{ id: 1, name: "Tang", startDate: day(30), checks: { eating: true, marks: true, behaviour: true, breathing: true } }] };
    expect(earned(byBook, "qt_cleared")).toBe(true);

    // Time served, checks unmet — precisely the case the protocol exists to
    // catch, so it must not be rewarded.
    const clockOnly = { quarantine: [{ id: 1, name: "Tang", startDate: day(60), checks: {} }] };
    expect(earned(clockOnly, "qt_cleared")).toBeFalsy();
  });

  test("logging a medication dose earns one", () => {
    expect(earned({ medDoses: [newMedDose({ name: "Copper", amount: 10 })] }, "meds_logged")).toBe(true);
  });

  test("a hundred tests earns the long record", () => {
    const waterTests = Array.from({ length: 100 }, (_, i) => ({ date: day(i * 7), water: "salt", values: { nitrate: 10 } }));
    expect(earned({ waterTests }, "long_history")).toBe(true);
    expect(earned({ waterTests: waterTests.slice(0, 99) }, "long_history")).toBeFalsy();
  });

  test("an empty tank earns none of them and throws on none", () => {
    const st = statsFor({});
    expect(st.observations).toBe(0);
    expect(st.shelfStocked).toBe(0);
    expect(st.sourceTested).toBeFalsy();
    // A tank from an older build has none of these fields at all.
    expect(() => buildAchievementStats({ tanks: [{ id: "old" }] })).not.toThrow();
  });
});
