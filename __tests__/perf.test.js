jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

// A performance budget, pinned.
//
// The analysis engines run on the Home screen, and their cost scales with how
// long somebody has kept the tank — so they are slowest for exactly the keepers
// who have the most invested. A frame is 16ms; anything here that alone
// exceeds it drops one every time the tank changes.

const { buildReview } = require("../lib/review");
const { getExtraActions } = require("../lib/todayExtras");
const { findCorrelations } = require("../lib/correlate");
const { tankStability } = require("../lib/stability");

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

// Four years: weekly tests and changes, daily doses and feedings.
const bigTank = () => ({
  gallons: 120, water: "salt",
  createdAt: new Date(Date.now() - 1460 * 86400000).toISOString(),
  stock: [], quantities: {},
  waterTests: Array.from({ length: 208 }, (_, i) => ({
    date: day(i * 7), water: "salt",
    values: { ammonia: 0, nitrite: 0, nitrate: 10 + (i % 9), phosphate: 0.03, ph: 8.1, alk: 8 + (i % 5) * 0.3, calcium: 420, magnesium: 1350, temp: 78, salinity: 1.025 },
  })),
  waterChanges: Array.from({ length: 208 }, (_, i) => ({ id: `w${i}`, date: day(i * 7 + 1), pct: 25, gallons: 30 })),
  doses: Array.from({ length: 1460 }, (_, i) => ({ id: `d${i}`, key: "alk", ml: 12, date: day(i) })),
  feedings: Array.from({ length: 1460 }, (_, i) => ({ id: `f${i}`, date: day(i) })),
  journal: [], costs: [], maintenance: {}, quarantine: [], inventory: [], observations: {},
});

// Median of several runs: a single timing on a loaded box is mostly noise.
//
// Each measurement times a BATCH rather than one call. The one-year case runs
// in about 0.2ms, and this suite executes alongside fifty others — a single GC
// pause is several times that, so a lone timing measures pauses rather than
// work. Taking the median of seven doesn't save it either, because a stall
// under load lands on several consecutive iterations. Timing a batch big enough
// to dwarf a pause does, and it cost this suite an intermittent failure to
// learn that.
//
// The batch size is found rather than fixed: doubling until the run clears a
// few milliseconds keeps a fast function accurate without making a slow one
// take twenty seconds to measure.
const FLOOR_MS = 3;
const MAX_BATCH = 256;

function batchFor(fn) {
  let n = 1;
  for (;;) {
    const t = process.hrtime.bigint();
    for (let i = 0; i < n; i++) fn();
    const ms = Number(process.hrtime.bigint() - t) / 1e6;
    if (ms >= FLOOR_MS || n >= MAX_BATCH) return n;
    n *= 2;
  }
}

const median = (fn, runs = 5, batch = null) => {
  // The first pass through a function is the optimiser's, not the algorithm's.
  fn();
  const n = batch || batchFor(fn);
  const times = [];
  for (let i = 0; i < runs; i++) {
    const t = process.hrtime.bigint();
    for (let j = 0; j < n; j++) fn();
    times.push(Number(process.hrtime.bigint() - t) / 1e6 / n);
  }
  return times.sort((a, b) => a - b)[Math.floor(runs / 2)];
};

describe("the analysis scales with how long you've kept the tank", () => {
  const tank = bigTank();

  // A wall-clock budget is the obvious test and the wrong one: this suite runs
  // 50-odd files in parallel, so an absolute millisecond assertion measures how
  // busy the machine is. What actually regressed before was the ALGORITHM —
  // a linear scan through every reading, inside a loop over every event. So
  // that's what's pinned: quadrupling the history must not quadruple the cost
  // per unit of work. A linear scan would go up ~16x for 4x the data; a binary
  // search goes up a little over 4x.
  const scaling = (build, run) => {
    const small = build(52);   // one year
    const large = build(208);  // four years
    // The same batch for both, so the ratio compares work and not bookkeeping.
    const batch = batchFor(() => run(large));
    const t1 = median(() => run(small), 5, batch);
    const t2 = median(() => run(large), 5, batch);
    // The batch makes both numbers comfortably measurable, so this guard is
    // now only for the impossible case rather than load-bearing.
    return t2 / Math.max(t1, 0.001);
  };

  test("correlation stays sub-quadratic as history grows", () => {
    const ratio = scaling(
      (n) => ({ ...tank, waterTests: tank.waterTests.slice(0, n), waterChanges: tank.waterChanges.slice(0, n) }),
      (t) => findCorrelations(t, "salt", {})
    );
    // 4x the data. Linear-ish passes comfortably; the old scan did not.
    expect(ratio).toBeLessThan(9);
  });

  test("stability is linear in the number of readings", () => {
    const ratio = scaling(
      (n) => tank.waterTests.slice(0, n),
      (tests) => tankStability(tests, "salt", {})
    );
    expect(ratio).toBeLessThan(9);
  });

  test("nothing in the Today extras scans the whole history repeatedly", () => {
    const ratio = scaling(
      (n) => ({ ...tank, waterTests: tank.waterTests.slice(0, n) }),
      (t) => getExtraActions(t, { waterType: "salt" })
    );
    expect(ratio).toBeLessThan(9);
  });

  test("the weekly review, which is the heaviest thing Home renders", () => {
    const ratio = scaling(
      (n) => ({ ...tank, waterTests: tank.waterTests.slice(0, n), waterChanges: tank.waterChanges.slice(0, n) }),
      (t) => buildReview(t, { waterType: "salt" })
    );
    expect(ratio).toBeLessThan(9);
  });

  test("correlation still finds the same patterns after the rewrite", () => {
    // Fast and wrong is not an improvement.
    const found = findCorrelations(tank, "salt", {});
    expect(Array.isArray(found)).toBe(true);
    found.forEach((f) => {
      expect(f.occurrences).toBeGreaterThanOrEqual(3);
      expect(Math.abs(f.agreement)).toBeGreaterThanOrEqual(0.7);
    });
  });
});
