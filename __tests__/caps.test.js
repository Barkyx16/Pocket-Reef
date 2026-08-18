import fs from "fs";
import path from "path";
import { CAPS, capped } from "../lib/caps";

const ROOT = path.join(__dirname, "..");

describe("a keeper's history is not silently deleted", () => {
  // Water tests are what stability, trends, forecasts, correlations and the
  // health score are all computed from, and they were capped at 60 — the
  // tightest cap in the app bar one, on its primary record. A keeper testing
  // weekly lost everything past fourteen months. Silently: the 61st test
  // deleted the 1st, with no warning and no undo.
  test("water tests outlast the keeper's interest in the hobby", () => {
    const weeklyYears = CAPS.waterTests / 52;
    expect(weeklyYears).toBeGreaterThan(10);
    // Twice-weekly testing is normal on a new reef and should still be years.
    expect(CAPS.waterTests / 104).toBeGreaterThan(5);
  });

  test("no cap is so small that ordinary use reaches it", () => {
    // Whatever the record, a year of daily logging must fit.
    for (const [name, cap] of Object.entries(CAPS)) {
      expect([name, cap >= 200]).toEqual([name, true]);
    }
  });

  test("every cap is a positive whole number", () => {
    for (const v of Object.values(CAPS)) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
  });
});

describe("capped()", () => {
  test("keeps the newest and drops the overflow", () => {
    expect(capped([1, 2, 3, 4, 5], 3)).toEqual([1, 2, 3]);
  });

  test("returns the same array when nothing is dropped", () => {
    // The common path — every write goes through here.
    const list = [1, 2];
    expect(capped(list, 10)).toBe(list);
  });

  test("a non-list becomes an empty one rather than throwing", () => {
    for (const v of [null, undefined, {}, "abc", 7]) expect(capped(v, 10)).toEqual([]);
  });

  test("a nonsense cap leaves the list intact rather than emptying it", () => {
    // Erring toward keeping data: a bad cap must never be read as "keep none".
    const list = [1, 2, 3];
    expect(capped(list, 0)).toBe(list);
    expect(capped(list, NaN)).toBe(list);
    expect(capped(list, -5)).toBe(list);
  });
});

describe("the caps are declared, not scattered", () => {
  const app = fs.readFileSync(path.join(ROOT, "App.js"), "utf8");

  test("no log is truncated by a magic number in App.js", () => {
    // Collected in one table the caps are comparable, which is the only reason
    // the wrong one was ever visible. Scattered, they were nine unrelated
    // numbers nobody could compare.
    const offenders = [];
    for (const m of app.matchAll(/(\w+): *\[[^\]]*\]\.slice\(0, *(\d+)\)/g)) {
      offenders.push(`${m[1]} capped at ${m[2]}`);
    }
    expect(offenders).toEqual([]);
  });

  test("every log App.js caps has an entry in the table", () => {
    const used = [...app.matchAll(/CAPS\.(\w+)/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(5);
    expect(used.filter((k) => !(k in CAPS))).toEqual([]);
  });
});
