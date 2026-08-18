jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// The merge is the one that matters most here. It runs at sign-in, on data the
// keeper cannot get back if it's wrong, and its failure mode is silent — a
// missing week of readings looks exactly like a week nobody logged. So it's
// tested for losslessness first and for its tie-breaking rules second.

const { mergeSnapshots, mergeTank, unionById, unionTests } = require("../lib/merge");
const { assessArrival, dayNumber, phaseFor, DEFAULT_DAYS, CRITERIA } = require("../lib/quarantine");
const { getExtraActions, withExtras } = require("../lib/todayExtras");
const { backupFilename, serialise, humanSize } = require("../lib/backupFile");
const { newObservation, addObservation, photoTimeline, growth } = require("../lib/observations");
const { newInventoryItem } = require("../lib/inventory");
const { newLightSchedule } = require("../lib/lighting");

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


const NOW = new Date("2026-08-17T12:00:00Z").getTime();
const dayAgo = (n) => localDay(NOW - n * 86400000);
const test0 = (date, values, water = "salt") => ({ date, water, values });



// ─────────────────────────────────────────────────────────────────────────────
describe("merging two copies of a tank", () => {
  const base = { id: "t1", name: "Reef", gallons: 100, water: "salt", createdAt: "2023-01-01T00:00:00.000Z" };

  test("readings logged on both devices all survive", () => {
    const local = { ...base, waterTests: [test0(dayAgo(1), { nitrate: 5 }), test0(dayAgo(9), { nitrate: 6 })] };
    const cloud = { ...base, waterTests: [test0(dayAgo(3), { nitrate: 7 }), test0(dayAgo(9), { nitrate: 6 })] };
    const merged = mergeTank(local, cloud);
    expect(merged.waterTests).toHaveLength(3);
    expect(merged.waterTests[0].date).toBe(dayAgo(1)); // newest first
  });

  test("a fuller reading wins over a partial one for the same day", () => {
    const local = { ...base, waterTests: [test0(dayAgo(1), { nitrate: 5 })] };
    const cloud = { ...base, waterTests: [test0(dayAgo(1), { nitrate: 5, alk: 8.4, calcium: 420 })] };
    expect(Object.keys(mergeTank(local, cloud).waterTests[0].values)).toHaveLength(3);
  });

  test("id'd records are unioned, never dropped", () => {
    const local = { ...base, doses: [{ id: "d1", date: dayAgo(1), ml: 10 }] };
    const cloud = { ...base, doses: [{ id: "d2", date: dayAgo(2), ml: 12 }, { id: "d1", date: dayAgo(1), ml: 10 }] };
    expect(mergeTank(local, cloud).doses).toHaveLength(2);
  });

  test("a record with no id is kept rather than silently deduped away", () => {
    expect(unionById([{ date: dayAgo(1) }], [{ date: dayAgo(2) }])).toHaveLength(2);
  });

  test("stock is the union — a fish on either side is in the tank", () => {
    const merged = mergeTank({ ...base, stock: ["A", "B"] }, { ...base, stock: ["B", "C"] });
    expect(merged.stock.sort()).toEqual(["A", "B", "C"]);
  });

  test("a job's last-done date takes the later value whichever device is newer", () => {
    const local = { ...base, maintenance: { waterchange: dayAgo(20) } };
    const cloud = { ...base, maintenance: { waterchange: dayAgo(2) } };
    // Local is the "newer" device, but the job really was done two days ago.
    expect(mergeTank(local, cloud, { preferCloud: false }).maintenance.waterchange).toBe(dayAgo(2));
  });

  test("a tank never gets younger", () => {
    const local = { ...base, createdAt: "2026-08-01T00:00:00.000Z" }; // fresh install
    const cloud = { ...base, createdAt: "2021-05-05T00:00:00.000Z" };
    expect(mergeTank(local, cloud).createdAt).toBe("2021-05-05T00:00:00.000Z");
  });

  test("unmergeable scalars follow whichever side is newer", () => {
    const local = { ...base, name: "Phone name" };
    const cloud = { ...base, name: "iPad name" };
    expect(mergeTank(local, cloud, { preferCloud: false }).name).toBe("Phone name");
    expect(mergeTank(local, cloud, { preferCloud: true }).name).toBe("iPad name");
  });

  test("observations merge per species and per entry", () => {
    const local = { ...base, observations: { Coral: [newObservation({ text: "a", date: dayAgo(5) })] } };
    const cloud = { ...base, observations: { Coral: [newObservation({ text: "b", date: dayAgo(2) })], Fish: [newObservation({ text: "c" })] } };
    const merged = mergeTank(local, cloud);
    expect(merged.observations.Coral).toHaveLength(2);
    expect(merged.observations.Fish).toHaveLength(1);
  });
});

describe("merging whole accounts", () => {
  const tankA = { id: "t1", name: "Reef", waterTests: [test0(dayAgo(1), { nitrate: 5 })], stock: [] };
  const tankB = { id: "t1", name: "Reef", waterTests: [test0(dayAgo(4), { nitrate: 8 })], stock: [] };

  test("nothing is lost from either side", () => {
    const { merged, report } = mergeSnapshots({ tanks: [tankA] }, { tanks: [tankB] }, { localNewer: true });
    expect(merged.tanks[0].waterTests).toHaveLength(2);
    expect(report.tanks).toBe(1);
  });

  test("a tank that exists on only one device survives", () => {
    const { merged, report } = mergeSnapshots(
      { tanks: [tankA] },
      { tanks: [tankB, { id: "t2", name: "Nano", stock: [] }] },
      { localNewer: true }
    );
    expect(merged.tanks).toHaveLength(2);
    expect(report.onlyCloud).toBe(1);
  });

  test("progress is cumulative, so the higher figure wins", () => {
    const { merged } = mergeSnapshots({ tanks: [], xp: 900 }, { tanks: [], xp: 1200 }, { localNewer: true });
    expect(merged.xp).toBe(1200);
  });

  test("logged days and wishlists are unioned", () => {
    const { merged } = mergeSnapshots(
      { tanks: [], activeDays: ["2026-08-01"], wishlist: ["A"] },
      { tanks: [], activeDays: ["2026-08-02"], wishlist: ["B"] },
      { localNewer: true }
    );
    expect(merged.activeDays).toEqual(["2026-08-01", "2026-08-02"]);
    expect(merged.wishlist.sort()).toEqual(["A", "B"]);
  });

  test("a blank note never replaces a written one", () => {
    const { merged } = mergeSnapshots(
      { tanks: [], speciesNotes: { Clown: "Eats from my hand" } },
      { tanks: [], speciesNotes: { Clown: "" } },
      { localNewer: false } // cloud is newer, and cloud's note is empty
    );
    expect(merged.speciesNotes.Clown).toBe("Eats from my hand");
  });

  test("two different notes are both kept rather than one deleted", () => {
    const { merged } = mergeSnapshots(
      { tanks: [], speciesNotes: { Clown: "Phone note" } },
      { tanks: [], speciesNotes: { Clown: "iPad note" } },
      { localNewer: true }
    );
    expect(merged.speciesNotes.Clown).toContain("Phone note");
    expect(merged.speciesNotes.Clown).toContain("iPad note");
  });

  test("an empty cloud copy can't wipe the device", () => {
    const { merged } = mergeSnapshots({ tanks: [tankA] }, {}, { localNewer: true });
    expect(merged.tanks[0].waterTests).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("quarantine as a protocol", () => {
  const arrival = (startDaysAgo, checks) => ({ id: "q1", name: "Clownfish", startDate: dayAgo(startDaysAgo), checks });

  test("day one is the day it went in", () => {
    expect(dayNumber(dayAgo(0), NOW)).toBe(1);
    expect(dayNumber(dayAgo(6), NOW)).toBe(7);
  });

  test("each phase says what to watch for right now", () => {
    expect(phaseFor(2).id).toBe("settle");
    expect(phaseFor(7).id).toBe("watch");
    expect(phaseFor(14).id).toBe("confirm");
    expect(phaseFor(20).id).toBe("clear");
    expect(phaseFor(7).watch.join(" ")).toMatch(/white spots/i);
  });

  test("time alone is not clearance — the checks have to be met", () => {
    const a = assessArrival(arrival(30), { now: NOW });
    expect(a.day).toBeGreaterThan(DEFAULT_DAYS);
    expect(a.ready).toBe(false);
    expect(a.overdue).toBe(true);
    expect(a.headline).toMatch(/still outstanding/i);
  });

  test("every check met clears it", () => {
    const checks = {};
    CRITERIA.filter((c) => !c.auto).forEach((c) => { checks[c.id] = true; });
    const a = assessArrival(arrival(25, checks), { now: NOW });
    expect(a.ready).toBe(true);
    expect(a.headline).toMatch(/clear to move/i);
  });

  test("checks met early still wait out the clock", () => {
    const checks = {};
    CRITERIA.filter((c) => !c.auto).forEach((c) => { checks[c.id] = true; });
    const a = assessArrival(arrival(5, checks), { now: NOW });
    expect(a.ready).toBe(false);
    expect(a.daysLeft).toBeGreaterThan(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
describe("what the daily hub now knows", () => {
  test("an empty bucket is an action for today", () => {
    const tank = { inventory: [newInventoryItem({ name: "Salt mix", kind: "salt", stock: 0, perGallon: 0.5 })] };
    const extras = getExtraActions(tank, { now: NOW });
    const salt = extras.find((e) => e.text.includes("Salt mix"));
    expect(salt.rank).toBe(0);
  });

  test("an unstable parameter reaches the home screen", () => {
    const tank = {
      waterTests: [test0(dayAgo(0), { alk: 7.8 }), test0(dayAgo(3), { alk: 9.6 }), test0(dayAgo(6), { alk: 7.4 })],
    };
    const extras = getExtraActions(tank, { waterType: "salt", now: NOW });
    expect(extras.some((e) => /Alk/.test(e.text))).toBe(true);
  });

  test("an overlong photoperiod is offered as the free fix", () => {
    const tank = { stock: [], water: "fresh", lightSchedule: newLightSchedule({ on: "08:00", off: "22:00" }) };
    const extras = getExtraActions(tank, { now: NOW });
    expect(extras.some((e) => /free algae fix/i.test(e.text))).toBe(true);
  });

  test("a quiet, well-stocked tank adds nothing", () => {
    expect(getExtraActions({ waterTests: [], inventory: [] }, { now: NOW })).toHaveLength(0);
  });

  test("extras never outrank a real overdue chore", () => {
    const existing = [{ rank: 0, icon: "🔴", to: "log", text: "Ammonia is high" }];
    const tank = { stock: [], water: "fresh", lightSchedule: newLightSchedule({ on: "08:00", off: "22:00" }) };
    const merged = withExtras(existing, tank, { now: NOW });
    expect(merged[0].text).toBe("Ammonia is high");
  });

  test("the shape matches what the hub already renders", () => {
    const tank = { inventory: [newInventoryItem({ name: "Salt", kind: "salt", stock: 0, perGallon: 0.5 })] };
    getExtraActions(tank, { now: NOW }).forEach((a) => {
      expect(typeof a.rank).toBe("number");
      expect(typeof a.text).toBe("string");
      expect(typeof a.to).toBe("string");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("the backup file", () => {
  test("it's named so a Files listing sorts and explains itself", () => {
    // Named for the keeper's day, not Greenwich's — a backup taken on Monday
    // evening in California should not be filed under Tuesday.
    const at = new Date("2026-08-17T12:00:00Z");
    const local = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
    expect(backupFilename(at)).toBe(`pocket-reef-backup-${local}.json`);
  });

  test("it's readable rather than one enormous line", () => {
    const text = serialise({ tanks: [{ id: "t1" }] });
    expect(text).toContain("\n");
    expect(JSON.parse(text).tanks[0].id).toBe("t1");
  });

  test("sizes read like sizes", () => {
    expect(humanSize(512)).toBe("512 B");
    expect(humanSize(2048)).toBe("2 KB");
    expect(humanSize(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("photographing a specimen over time", () => {
  const name = "Torch Coral";

  test("a photo alone is a valid observation — no caption required", () => {
    expect(newObservation({ photo: "file:///a.jpg" })).toBeTruthy();
    expect(newObservation({})).toBeNull();
  });

  test("the timeline runs oldest first, which is the way you look at it", () => {
    let obs = {};
    obs = addObservation(obs, name, newObservation({ photo: "file:///new.jpg", date: dayAgo(1) }));
    obs = addObservation(obs, name, newObservation({ photo: "file:///old.jpg", date: dayAgo(200) }));
    const t = photoTimeline(obs[name]);
    expect(t.shots[0].photo).toContain("old");
    expect(t.days).toBe(199);
    expect(t.comparable).toBe(true);
  });

  test("one photo isn't a comparison", () => {
    const t = photoTimeline([newObservation({ photo: "file:///a.jpg", date: dayAgo(1) })]);
    expect(t.ok).toBe(true);
    expect(t.comparable).toBe(false);
  });

  test("observations without photos don't appear in it", () => {
    const t = photoTimeline([newObservation({ text: "no photo", date: dayAgo(1) })]);
    expect(t.ok).toBe(false);
  });

  test("photos and measurements coexist without interfering", () => {
    let obs = {};
    obs = addObservation(obs, name, newObservation({ photo: "file:///a.jpg", size: 2, date: dayAgo(90) }));
    obs = addObservation(obs, name, newObservation({ photo: "file:///b.jpg", size: 4, date: dayAgo(0) }));
    expect(growth(obs[name]).change).toBe(2);
    expect(photoTimeline(obs[name]).shots).toHaveLength(2);
  });
});
