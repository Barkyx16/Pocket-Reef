jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import { getWaterChangeEffect } from "../core";
import { layoutSeries, niceScale } from "../lib/chart";
import { forecastItem, newInventoryItem } from "../lib/inventory";
import { runningCost, itemDraw, DUTY_CYCLE, TYPICAL_WATTS } from "../lib/running";
import { CATEGORIES } from "../lib/equipment";
import { paramStability } from "../lib/stability";
import { activeParams } from "../lib/targets";

// Properties, not examples.
//
// The dosing formula was wrong by the square of the tank volume and every
// example test passed, because they all asserted shape — a number came back,
// it was positive, the per-day figure was smaller than the total. What caught
// it was an invariant: a bigger tank must never need less product. These are
// the rest of those invariants, for the engines that have them.

const rnd = (a, b) => a + Math.random() * (b - a);
const day = (n) => {
  const x = new Date(Date.now() - n * 86400000);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

describe("a water change moves toward the replacement water, never past it", () => {
  test("300 random mixes stay between the tank and the source", () => {
    for (let i = 0; i < 300; i++) {
      const before = rnd(0, 120), src = rnd(0, 60), pct = rnd(1, 100);
      const r = getWaterChangeEffect({
        waterTests: [{ date: day(0), water: "salt", values: { nitrate: before } }],
        waterType: "salt", percent: pct, sourceValues: { nitrate: src },
      });
      const ch = r.ok && r.changes.find((c) => c.key === "nitrate");
      if (!ch) continue;
      expect(ch.after).toBeGreaterThanOrEqual(Math.min(before, src) - 0.02);
      expect(ch.after).toBeLessThanOrEqual(Math.max(before, src) + 0.02);
      expect(ch.drop).toBeCloseTo(before - ch.after, 1);
    }
  });

  test("a full change leaves you with the source water", () => {
    const r = getWaterChangeEffect({
      waterTests: [{ date: day(0), water: "salt", values: { nitrate: 40 } }],
      waterType: "salt", percent: 100, sourceValues: { nitrate: 5 },
    });
    expect(r.changes.find((c) => c.key === "nitrate").after).toBeCloseTo(5, 2);
  });
});

describe("chart geometry stays inside its box", () => {
  test("200 random series plot within bounds, high readings drawn high", () => {
    for (let i = 0; i < 200; i++) {
      const n = 2 + Math.floor(rnd(0, 18));
      const pts = Array.from({ length: n }, (_, k) => ({ value: rnd(0, 100), date: day(n - k) }));
      const W = rnd(100, 900), H = rnd(60, 400);
      const r = layoutSeries(pts, { width: W, height: H });
      for (const dot of r.dots) {
        expect(Number.isFinite(dot.x) && Number.isFinite(dot.y)).toBe(true);
        expect(dot.x).toBeGreaterThanOrEqual(-0.5);
        expect(dot.x).toBeLessThanOrEqual(W + 0.5);
        expect(dot.y).toBeGreaterThanOrEqual(-0.5);
        expect(dot.y).toBeLessThanOrEqual(H + 0.5);
      }
      // Screen coordinates run downward, so a higher reading has a smaller y.
      const byValue = [...r.dots].sort((a, b) => a.value - b.value);
      for (let k = 1; k < byValue.length; k++) {
        if (byValue[k].value > byValue[k - 1].value) {
          expect(byValue[k].y).toBeLessThanOrEqual(byValue[k - 1].y + 0.01);
        }
      }
    }
  });

  test("a dead-flat series still gets a span to draw in", () => {
    // Otherwise the line divides by a zero height and vanishes.
    const s = niceScale([8.4, 8.4, 8.4]);
    expect(s.max).toBeGreaterThan(s.min);
  });
});

describe("supplies run out later with more, sooner with heavier use", () => {
  test("300 random items", () => {
    const tank = { gallons: 90, waterChanges: [] };
    for (let i = 0; i < 300; i++) {
      const stock = rnd(1, 500), perDay = rnd(0.01, 20);
      const mk = (s, d) => forecastItem(newInventoryItem({ name: "Salt", kind: "salt", stock: s, perDay: d }), tank, {});
      const base = mk(stock, perDay);
      if (!base || base.daysLeft == null) continue;
      expect(base.daysLeft).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(base.daysLeft)).toBe(true);
      expect(mk(stock * 2, perDay).daysLeft).toBeGreaterThanOrEqual(base.daysLeft - 1e-6);
      expect(mk(stock, perDay * 2).daysLeft).toBeLessThanOrEqual(base.daysLeft + 1e-6);
    }
  });
});

describe("running costs scale the way a bill does", () => {
  test("more watts and a dearer tariff both cost more", () => {
    for (const cat of CATEGORIES.map((c) => c.id)) {
      const watts = 200, rate = 0.2;
      const at = (w, r) => runningCost({ equipment: [{ id: "e", name: "x", category: cat, watts: w }] }, { rate: r });
      const base = at(watts, rate);
      if (!base || !base.ok) continue;
      expect(Number(base.perMonth)).toBeGreaterThanOrEqual(0);
      expect(Number(at(watts * 2, rate).perMonth)).toBeGreaterThanOrEqual(Number(base.perMonth));
      expect(Number(at(watts, rate * 2).perMonth)).toBeGreaterThanOrEqual(Number(base.perMonth));
      expect(Number(base.perYear)).toBeCloseTo(Number(base.perMonth) * 12, 0);
    }
  });

  test("every equipment category has a duty cycle and a typical wattage", () => {
    // An unknown category silently falls back to running 24 hours a day. Add a
    // "chiller" without an entry here and the card reports it at more than
    // three times its real cost, with nothing to indicate a problem — the
    // number is simply wrong. Nothing checked this alignment before.
    const ids = CATEGORIES.map((c) => c.id);
    expect(ids.filter((id) => !(id in DUTY_CYCLE))).toEqual([]);
    expect(ids.filter((id) => !(id in TYPICAL_WATTS))).toEqual([]);
  });

  test("and no duty cycle names a category that no longer exists", () => {
    const ids = CATEGORIES.map((c) => c.id);
    expect(Object.keys(DUTY_CYCLE).filter((k) => !ids.includes(k))).toEqual([]);
  });

  test("a heater is not billed as if it ran all day", () => {
    // The whole point of the duty cycle: heaters cycle to hold temperature.
    const heater = itemDraw({ category: "heating", watts: 300 });
    expect(heater.hoursPerDay).toBeLessThan(24);
    expect(heater.kWhPerMonth).toBeLessThan((300 * 24 * 30.4) / 1000);
  });
});

describe("stability grades get worse as a parameter swings harder", () => {
  const p = activeParams("salt").find((x) => x.key === "alk");
  const series = (swing) =>
    Array.from({ length: 10 }, (_, i) => ({ date: day(i * 3), water: "salt", values: { alk: 8.5 + (i % 2 ? swing : -swing) } }));
  const RANK = { "rock-solid": 0, steady: 1, drifting: 2, swinging: 3, unstable: 4 };

  test("the grade never improves as the swing grows", () => {
    let last = -1;
    for (const swing of [0, 0.1, 0.25, 0.5, 1, 2, 4]) {
      const r = paramStability(p, series(swing));
      if (!r) continue;
      expect(RANK[r.grade]).toBeGreaterThanOrEqual(last);
      last = RANK[r.grade];
      expect(Number(r.perDay)).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(Number(r.perDay))).toBe(true);
    }
    expect(last).toBeGreaterThan(0); // it actually moved
  });
});
