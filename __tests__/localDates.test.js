jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// What day is it, where the keeper is standing?
//
// Every dated record was stamped with `new Date().toISOString().slice(0, 10)` —
// the date in Greenwich, not the date on the wall behind the tank. For roughly
// half the world that is silently, routinely wrong:
//
//   California, 5:30pm on 17 August → stamped 18 August
//   New Zealand, 9am on 17 August   → stamped 16 August
//
// And the mirror of it: stored keys were parsed back with `new Date("2026-08-17")`,
// which is UTC midnight. Ahead of Greenwich that instant is in the future for
// most of the local day, so every engine's age filter silently discarded a
// reading the keeper had just logged.
//
// The whole suite runs under several timezones in CI. This file pins the
// primitives.

const { dayKey, todayKey, fromDayKey, daysBetweenKeys, daysSinceKey, addDaysToKey, instantOf } = require("../lib/day");
const { getTodayKey } = require("../core");

describe("a day key is the local calendar day", () => {
  test("it comes from local fields, not from an ISO string", () => {
    // 00:30 UTC on the 18th. In any western timezone that is still the 17th.
    const instant = new Date("2026-08-18T00:30:00Z");
    const local = `${instant.getFullYear()}-${String(instant.getMonth() + 1).padStart(2, "0")}-${String(instant.getDate()).padStart(2, "0")}`;
    expect(dayKey(instant)).toBe(local);
  });

  test("the app's today and the device's today are the same day", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(getTodayKey()).toBe(expected);
    expect(todayKey()).toBe(expected);
  });

  test("junk gives null rather than a wrong day", () => {
    expect(dayKey("not a date")).toBeNull();
    expect(fromDayKey("nonsense")).toBeNull();
    expect(fromDayKey(null)).toBeNull();
  });
});

describe("a stored key round-trips", () => {
  test("out and back is the same day, in any timezone", () => {
    ["2026-01-01", "2026-06-15", "2026-12-31"].forEach((key) => {
      expect(dayKey(fromDayKey(key))).toBe(key);
    });
  });

  test("a key parses to local midnight, never to the day before", () => {
    const d = fromDayKey("2026-08-17");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(17);
    expect(d.getHours()).toBe(0);
  });

  test("today's key is never in the future", () => {
    // The bug this pins: ahead of Greenwich, UTC-midnight-today is later than
    // local now for most of the day, so every engine's `age >= 0` filter threw
    // away the reading the keeper had just logged.
    expect(instantOf(todayKey())).toBeLessThanOrEqual(Date.now());
  });
});

describe("day arithmetic is calendar arithmetic", () => {
  test("counting between keys", () => {
    expect(daysBetweenKeys("2026-08-01", "2026-08-08")).toBe(7);
    expect(daysBetweenKeys("2026-08-08", "2026-08-01")).toBe(-7);
    expect(daysBetweenKeys("2026-08-01", "2026-08-01")).toBe(0);
  });

  test("across a month and a year boundary", () => {
    expect(daysBetweenKeys("2026-01-31", "2026-02-01")).toBe(1);
    expect(daysBetweenKeys("2025-12-31", "2026-01-01")).toBe(1);
  });

  test("across a daylight-saving boundary, where a day is 23 or 25 hours", () => {
    // Rounding rather than flooring elapsed ms: a 23-hour day must still be one
    // day, not zero.
    expect(daysBetweenKeys("2026-03-07", "2026-03-09")).toBe(2);
    expect(daysBetweenKeys("2026-10-31", "2026-11-02")).toBe(2);
  });

  test("adding days", () => {
    expect(addDaysToKey("2026-08-17", 1)).toBe("2026-08-18");
    expect(addDaysToKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToKey("2026-03-01", -1)).toBe("2026-02-28");
  });

  test("days since a key, from today", () => {
    expect(daysSinceKey(todayKey())).toBe(0);
    expect(daysSinceKey(addDaysToKey(todayKey(), -5))).toBe(5);
  });
});

describe("instantOf tells a day from a timestamp", () => {
  test("a bare key becomes local midnight", () => {
    expect(instantOf("2026-08-17")).toBe(fromDayKey("2026-08-17").getTime());
  });

  test("a full ISO timestamp keeps its instant", () => {
    const iso = "2026-08-17T15:30:00.000Z";
    expect(instantOf(iso)).toBe(new Date(iso).getTime());
  });

  test("junk is NaN, not zero", () => {
    expect(Number.isNaN(instantOf("nope"))).toBe(true);
    expect(Number.isNaN(instantOf(null))).toBe(true);
  });
});

describe("the engines see today's reading", () => {
  // The end-to-end version of the bug: a test logged right now must be visible
  // to everything that filters on age.
  const today = todayKey();
  const tests = [-0, -3, -6].map((n) => ({
    date: addDaysToKey(today, n),
    water: "salt",
    values: { alk: 8 + Math.abs(n) * 0.3 },
  }));

  test("stability grades it rather than reporting no data", () => {
    const { tankStability } = require("../lib/stability");
    expect(tankStability(tests, "salt", {}).ok).toBe(true);
  });

  test("the cadence engine can pace it", () => {
    const { observedInterval } = require("../lib/cadence");
    expect(observedInterval(tests, "alk", {})).toBeGreaterThan(0);
  });

  test("the forecast engine sees it too", () => {
    // getParamForecasts had its own `new Date(t.date)` and was missed by the
    // first pass — so ahead of Greenwich it discarded today's reading and the
    // predictive alerts had one fewer point than the keeper could see.
    const { getParamForecasts } = require("../core");
    const climbing = [0, 7, 14, 21].map((n) => ({
      date: addDaysToKey(today, -n),
      water: "salt",
      values: { nitrate: 10 + n },
    }));
    const found = getParamForecasts(climbing, "salt", []);
    expect(Array.isArray(found)).toBe(true);
    expect(found.find((f) => f.key === "nitrate")).toBeTruthy();
  });

  test("the health score counts the days since the last test correctly", () => {
    const { getTankHealthScore } = require("../core");
    const scored = getTankHealthScore({
      tank: [], tankGallons: 40, quantities: {}, maintenance: {}, waterType: "salt",
      waterTests: [{ date: today, water: "salt", values: { ammonia: 0, nitrite: 0, nitrate: 5 } }],
    });
    // A test logged today must never read as one logged in the future.
    expect(scored.score).toBeGreaterThan(0);
  });

  test("the anomaly check sees the history", () => {
    const { checkReading } = require("../lib/anomaly");
    const { activeParams } = require("../lib/targets");
    const alk = activeParams("salt").find((p) => p.key === "alk");
    const many = Array.from({ length: 6 }, (_, i) => ({
      date: addDaysToKey(today, -i * 3),
      water: "salt",
      values: { alk: 8.4 },
    }));
    // Four-plus readings on file, so it has something to compare against.
    expect(checkReading(alk, 8.5, many, {}).reason).not.toBe("not enough history");
  });
});

describe("day-keyed maps don't grow forever", () => {
  const { pruneDayMap } = require("../lib/day");
  const NOW = new Date("2026-08-18T12:00:00Z");

  test("recent days are kept", () => {
    const map = { "2026-08-18": ["feed"], "2026-08-15": ["test"] };
    expect(Object.keys(pruneDayMap(map, 14, NOW)).sort()).toEqual(["2026-08-15", "2026-08-18"]);
  });

  test("old days are dropped", () => {
    // careDone gathered one key per day, forever — and rode along in every
    // sync, export and restore point.
    const map = { "2026-08-18": ["feed"], "2020-01-01": ["feed"], "2026-01-01": ["feed"] };
    expect(Object.keys(pruneDayMap(map, 14, NOW))).toEqual(["2026-08-18"]);
  });

  test("five years of daily ticks collapse to a fortnight", () => {
    const map = {};
    for (let i = 0; i < 1800; i++) map[addDaysToKey("2026-08-18", -i)] = ["feed"];
    expect(Object.keys(pruneDayMap(map, 14, NOW)).length).toBeLessThanOrEqual(15);
  });

  test("a key that isn't a day is left alone rather than silently discarded", () => {
    const map = { "2026-08-18": ["feed"], version: 3 };
    expect(pruneDayMap(map, 14, NOW).version).toBe(3);
  });

  test("an empty or missing map is safe", () => {
    expect(pruneDayMap({}, 14, NOW)).toEqual({});
    expect(pruneDayMap(undefined, 14, NOW)).toEqual({});
  });
});

describe("no fixture dates itself in UTC", () => {
  // This class of bug only surfaces for part of the day, in some timezones —
  // a suite can pass every run for a week and then fail at 17:00. A fixture
  // that derives a day key from toISOString() dates its records in UTC while
  // every engine reads them as local, so west of Greenwich the fixture's
  // "today" becomes the app's tomorrow and the reading lands in the future.
  //
  // Found the hard way: todayHub.test.js had done this since it was written
  // and only failed once the clock happened to be past the boundary during a
  // run. Checked here so the next one is caught at once rather than in six
  // months at an inconvenient hour.
  const fs = require("fs");
  const path = require("path");
  const DIR = path.join(__dirname);

  test("no test file builds a day key out of an ISO string", () => {
    const offenders = [];
    for (const f of fs.readdirSync(DIR).filter((n) => n.endsWith(".js"))) {
      const src = fs.readFileSync(path.join(DIR, f), "utf8");
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        // This file names the pattern in prose to explain it.
        if (line.trim().startsWith("//") || line.trim().startsWith("*")) return;
        if (/toISOString\(\)[^\n]*\.slice\(0, ?10\)/.test(line)) {
          offenders.push(`${f}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  test("and the check can actually see the files", () => {
    // A walker that silently matches nothing passes forever.
    expect(fs.readdirSync(DIR).filter((n) => n.endsWith(".js")).length).toBeGreaterThan(50);
  });
});

describe("stepping back n days is not subtracting n × 24 hours", () => {
  // Found when a test failed only in Pacific/Auckland. A fixture built its
  // dates as `NOW - n * 86400000` and asserted the two were 199 days apart;
  // New Zealand's April DST change falls inside a 200-day window, so they were
  // 198. The assertion had already been widened to "199 or 200" to cope, which
  // hid the cause rather than fixing it.
  //
  // The app's own arithmetic was right throughout — it correctly reported the
  // gap between the two dates it was handed. The dates were wrong.
  const { addDaysToKey, daysBetweenKeys, dayKey } = require("../lib/day");

  test("calendar stepping is exact across a DST boundary", () => {
    // 2026-03-08 (US spring forward) and 2026-11-01 (fall back) both sit
    // inside these windows.
    for (const [from, n] of [["2026-01-01", 200], ["2026-09-01", 120], ["2026-02-01", 199]]) {
      const to = addDaysToKey(from, n);
      expect([from, n, daysBetweenKeys(from, to)]).toEqual([from, n, n]);
    }
  });

  test("millisecond stepping is not, which is the trap", () => {
    // Demonstrated rather than described: this is what the fixture was doing.
    const start = new Date(2026, 1, 1, 12, 0, 0).getTime(); // 1 Feb, midday
    const naive = dayKey(new Date(start + 199 * 86400000));
    const calendar = addDaysToKey("2026-02-01", 199);
    // In a zone with DST between the two dates these differ by a day; in one
    // without, they agree. Either way the calendar answer is the correct one.
    expect(daysBetweenKeys("2026-02-01", calendar)).toBe(199);
    expect(typeof naive).toBe("string");
  });

  test("a fixture that asserts an exact day gap uses calendar stepping", () => {
    // The one test that asserted a precise gap now builds its dates with
    // addDaysToKey. If another starts asserting one, it should do the same.
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(path.join(__dirname, "nextlevel5.test.js"), "utf8");
    expect(src).toContain("addDaysToKey(localDay(NOW), -n)");
    expect(src).not.toMatch(/dayKey = \(n\) => localDay\(NOW - n \* 86400000\)/);
  });
});
