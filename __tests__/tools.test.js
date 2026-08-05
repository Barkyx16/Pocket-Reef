import { getParamForecasts, getWaterChangeEffect, getRecommendedChangePercent, getTreatmentProgress, getTreatment, getTreatableDiseases, PARAMS } from "../core";
import { planDose, getDosingPlan, actualWaterVolume, REEF_TARGETS } from "../lib/dosing";
import { DISEASES } from "../data/fishHealth";

const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();
// Readings newest-first, matching how the app stores them.
const tests = (pairs, key = "nitrate") => pairs.map(([d, v]) => ({ date: iso(d), values: { [key]: v } }));

describe("parameter forecasting", () => {
  test("needs enough data before claiming a trend", () => {
    expect(getParamForecasts(tests([[0, 20]]), "fresh")).toEqual([]);
    expect(getParamForecasts(tests([[0, 20], [7, 10]]), "fresh")).toEqual([]);
  });

  test("detects a rising parameter and reports a weekly rate", () => {
    const f = getParamForecasts(tests([[0, 40], [7, 30], [14, 20], [21, 10]]), "fresh");
    const nitrate = f.find((x) => x.key === "nitrate");
    expect(nitrate).toBeTruthy();
    expect(nitrate.trend).toBe("up");
    expect(nitrate.perWeek).toBeGreaterThan(0);
  });

  test("ignores readings older than the window", () => {
    // Three points, but two are ancient — not enough recent data to forecast.
    expect(getParamForecasts(tests([[0, 20], [90, 10], [120, 5]]), "fresh")).toEqual([]);
  });

  test("flat readings produce no invented story", () => {
    const f = getParamForecasts(tests([[0, 20], [7, 20], [14, 20], [21, 20]]), "fresh");
    expect(f.find((x) => x.key === "nitrate")).toBeFalsy();
  });

  test("a countdown only appears for a confident fit", () => {
    const f = getParamForecasts(tests([[0, 35], [7, 25], [14, 15], [21, 5]]), "fresh");
    const n = f.find((x) => x.key === "nitrate");
    if (n && n.daysToEdge != null) {
      expect(n.confident).toBe(true);
      expect(n.daysToEdge).toBeGreaterThan(0);
      expect(n.daysToEdge).toBeLessThanOrEqual(45);
    }
  });

  test("noisy data never yields a confident countdown", () => {
    const f = getParamForecasts(tests([[0, 40], [7, 5], [14, 38], [21, 8]]), "fresh");
    const n = f.find((x) => x.key === "nitrate");
    if (n) expect(n.daysToEdge == null || n.confident).toBe(true);
  });

  test("survives empty and malformed input", () => {
    expect(() => getParamForecasts([], "fresh")).not.toThrow();
    expect(() => getParamForecasts([{ date: "nope", values: null }], "fresh")).not.toThrow();
  });
});

describe("water change impact", () => {
  const high = [{ date: iso(0), values: { nitrate: 80, ammonia: 0 } }];

  test("no test means no claim", () => {
    expect(getWaterChangeEffect({ waterTests: [] }).ok).toBe(false);
  });

  test("a 50% change halves nitrate", () => {
    const r = getWaterChangeEffect({ waterTests: high, percent: 50 });
    const n = r.changes.find((c) => c.key === "nitrate");
    expect(n.after).toBeCloseTo(40, 1);
    expect(n.drop).toBeCloseTo(40, 1);
  });

  test("nitrate in the tap water is accounted for", () => {
    const clean = getWaterChangeEffect({ waterTests: high, percent: 50, sourceValues: { nitrate: 0 } });
    const tap = getWaterChangeEffect({ waterTests: high, percent: 50, sourceValues: { nitrate: 20 } });
    const a = clean.changes.find((c) => c.key === "nitrate").after;
    const b = tap.changes.find((c) => c.key === "nitrate").after;
    expect(b).toBeGreaterThan(a);
  });

  test("it only models what dilution actually explains", () => {
    const r = getWaterChangeEffect({ waterTests: [{ date: iso(0), values: { nitrate: 40, ph: 7, temp: 78, alk: 8 } }], percent: 50, waterType: "fresh" });
    const keys = r.changes.map((c) => c.key);
    expect(keys).toContain("nitrate");
    // pH and temperature depend on the replacement water, not dilution.
    expect(keys).not.toContain("ph");
    expect(keys).not.toContain("temp");
  });

  test("recommends the smallest change that fixes it", () => {
    const pct = getRecommendedChangePercent({ waterTests: high });
    expect(pct).toBeGreaterThan(0);
    const r = getWaterChangeEffect({ waterTests: high, percent: pct });
    expect(r.changes.every((c) => c.afterStatus === "good")).toBe(true);
  });

  test("returns null when no change can fix it", () => {
    // Source water already out of range — the tap is the problem.
    const pct = getRecommendedChangePercent({ waterTests: high, sourceValues: { nitrate: 200 } });
    expect(pct).toBeNull();
  });

  test("0% changes nothing", () => {
    expect(getWaterChangeEffect({ waterTests: high, percent: 0 }).ok).toBe(false);
  });
});

describe("reef dosing", () => {
  test("rock and sand displacement is applied", () => {
    expect(actualWaterVolume(100)).toBeLessThan(100);
    expect(actualWaterVolume(100)).toBeGreaterThan(80);
  });

  test("refuses to guess a product strength", () => {
    const r = planDose({ key: "alk", current: 6, ratedGallons: 50 });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/label/i);
  });

  test("computes a dose from strength and volume", () => {
    const r = planDose({ key: "alk", current: 7, ratedGallons: 50, strengthPerUnit: 0.01 });
    expect(r.ok).toBe(true);
    expect(r.totalMl).toBeGreaterThan(0);
    expect(r.needed).toBeGreaterThan(0);
  });

  test("a large alkalinity correction is split across days", () => {
    // The dangerous case: swinging alk hard in one dose burns corals.
    const r = planDose({ key: "alk", current: 4, ratedGallons: 50, strengthPerUnit: 0.01 });
    expect(r.days).toBeGreaterThan(1);
    expect(r.capped).toBe(true);
    expect(r.perDayMl).toBeLessThan(r.totalMl);
  });

  test("a small correction is a single dose", () => {
    const r = planDose({ key: "alk", current: 8.2, ratedGallons: 50, strengthPerUnit: 0.01 });
    expect(r.days).toBe(1);
    expect(r.capped).toBe(false);
  });

  test("already in range means nothing to do", () => {
    const mid = (REEF_TARGETS.calcium.min + REEF_TARGETS.calcium.max) / 2;
    const r = planDose({ key: "calcium", current: mid + 5, ratedGallons: 50, strengthPerUnit: 1 });
    expect(r.alreadyThere).toBe(true);
    expect(r.totalMl).toBe(0);
  });

  test("low magnesium is flagged before calcium and alkalinity", () => {
    const plan = getDosingPlan({ latestValues: { magnesium: 1100, alk: 6.5, calcium: 350 }, ratedGallons: 50 });
    expect(plan.magnesiumFirst).toBe(true);
    expect(plan.plans[0].key).toBe("magnesium");
  });

  test("no magnesium warning when magnesium is fine", () => {
    const plan = getDosingPlan({ latestValues: { magnesium: 1350, alk: 6.5 }, ratedGallons: 50 });
    expect(plan.magnesiumFirst).toBe(false);
  });

  test("handles missing readings without throwing", () => {
    expect(() => getDosingPlan({})).not.toThrow();
    expect(getDosingPlan({}).plans).toEqual([]);
  });
});

describe("treatment plans", () => {
  test("every plan is well formed", () => {
    getTreatableDiseases().forEach((name) => {
      const p = getTreatment(name);
      expect(p.durationDays).toBeGreaterThan(0);
      expect(p.steps.length).toBeGreaterThan(0);
      expect(typeof p.keyPoint).toBe("string");
      p.steps.forEach((s) => {
        expect(s.day).toBeGreaterThan(0);
        expect(s.day).toBeLessThanOrEqual(Math.max(p.durationDays, 30));
        expect(s.title.length).toBeGreaterThan(0);
        expect(s.detail.length).toBeGreaterThan(10);
      });
    });
  });

  test("every disease in the library has a plan", () => {
    const missing = DISEASES.filter((d) => !getTreatment(d.name)).map((d) => d.name);
    expect(missing).toEqual([]);
  });

  test("steps are in chronological order", () => {
    getTreatableDiseases().forEach((name) => {
      const days = getTreatment(name).steps.map((s) => s.day);
      expect(days).toEqual([...days].sort((a, b) => a - b));
    });
  });

  test("progress reports today's step", () => {
    const p = getTreatmentProgress("Ich (White Spot)", iso(0));
    expect(p.day).toBe(1);
    expect(p.dueToday.length).toBeGreaterThan(0);
    expect(p.pct).toBe(0);
  });

  test("later in the course, earlier steps read as overdue when unticked", () => {
    const p = getTreatmentProgress("Ich (White Spot)", iso(6));
    expect(p.day).toBe(7);
    expect(p.overdue.length).toBeGreaterThan(0);
  });

  test("completed steps count toward progress", () => {
    const first = getTreatmentProgress("Ich (White Spot)", iso(0));
    const ids = first.steps.slice(0, 3).map((s) => s.id);
    const after = getTreatmentProgress("Ich (White Spot)", iso(0), ids);
    expect(after.completed).toBe(3);
    expect(after.pct).toBeGreaterThan(0);
  });

  test("stopping early is detected — the reason ich comes back", () => {
    const p = getTreatmentProgress("Ich (White Spot)", iso(30));
    expect(p.finished).toBe(true);
    expect(p.abandonedEarly).toBe(true);
  });

  test("a fully worked course is not flagged as abandoned", () => {
    const base = getTreatmentProgress("Ich (White Spot)", iso(30));
    const all = base.steps.map((s) => s.id);
    expect(getTreatmentProgress("Ich (White Spot)", iso(30), all).abandonedEarly).toBe(false);
  });

  test("unknown disease or missing start returns null", () => {
    expect(getTreatmentProgress("Not A Disease", iso(0))).toBeNull();
    expect(getTreatmentProgress("Ich (White Spot)", null)).toBeNull();
    expect(getTreatmentProgress("Ich (White Spot)", "garbage")).toBeNull();
  });
});
