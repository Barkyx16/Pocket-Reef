jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

// Holes found by audit, pinned so they can't come back.
//
// Every one of these is a case where two parts of the app disagreed, or where
// an engine existed and nothing called it. Those are the failures that survive
// a feature review: nothing is broken on screen, the answer is just wrong.

const { getTodayActions, getRecommendedChangePercent, getWaterChangeEffect } = require("../core");
const { withExtras } = require("../lib/todayExtras");
const { inferCreatedAt } = require("../lib/existingTank");
const { explainsStubborn, newSourceProfile } = require("../lib/sourceWater");

const NOW = Date.now();
const ago = (n) => new Date(NOW - n * 86400000).toISOString();
const key = (n) => ago(n).slice(0, 10);

describe("the daily hub can't contradict itself", () => {
  test("a quarantined fish gets one verdict, not two opposite ones", () => {
    // 30 days elapsed with no checks ticked. The old action said "finished
    // quarantine — ready to add"; the protocol says four checks are unmet.
    // Both appeared at once, and the reassuring one was the wrong one.
    const quarantine = [{ id: 1, name: "Yellow Tang", startDate: ago(30), checks: {} }];
    const merged = withExtras(
      getTodayActions({ tank: [], waterTests: [], maintenance: {}, quarantine }),
      { quarantine, waterTests: [], inventory: [] },
      {}
    );
    const lines = merged.filter((a) => a.text.includes("Yellow Tang"));
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toMatch(/aren't met/i);
  });

  test("a fish that has met every check is cleared, once", () => {
    const checks = { eating: true, marks: true, behaviour: true, breathing: true };
    const quarantine = [{ id: 1, name: "Tang", startDate: ago(30), checks }];
    const merged = withExtras(
      getTodayActions({ tank: [], waterTests: [], maintenance: {}, quarantine }),
      { quarantine, waterTests: [], inventory: [] },
      {}
    );
    const lines = merged.filter((a) => a.text.includes("Tang"));
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toMatch(/ready for the display/i);
  });
});

describe("water changes account for what's in the tap", () => {
  // 90ppm is genuinely out of range for freshwater (good tops out at 40).
  const tests = [{ date: key(1), water: "fresh", values: { nitrate: 90 } }];

  test("a target below the source water is reported as unreachable", () => {
    // The old calculator's arithmetic ignored the tap entirely and would
    // confidently quote a percentage that cannot reach the target.
    const pct = getRecommendedChangePercent({
      waterTests: tests, waterType: "fresh",
      sourceValues: { nitrate: 60 },
    });
    // 60ppm out of the tap: even a 90% change lands at ~63, still above the
    // 40 that counts as good. There is no answer, and null is the honest one.
    expect(pct).toBeNull();
  });

  test("with clean source water the same target is reachable", () => {
    expect(getRecommendedChangePercent({ waterTests: tests, waterType: "fresh", sourceValues: {} })).toBeGreaterThan(0);
  });

  test("the predicted result dilutes toward the source, not toward zero", () => {
    const res = getWaterChangeEffect({ waterTests: tests, waterType: "fresh", percent: 50, sourceValues: { nitrate: 20 } });
    // Half the water replaced with 20ppm water: 90 → 55, not 90 → 45.
    expect(res.changes.find((c) => c.key === "nitrate").after).toBe(55);
  });
});

describe("a stubborn reading gets explained", () => {
  test("sitting near the source-water floor is named as the reason", () => {
    const tank = {
      sourceWater: newSourceProfile({ kind: "tap", values: { nitrate: 20 } }),
      waterTests: [{ date: key(1), water: "fresh", values: { nitrate: 22 } }],
    };
    expect(explainsStubborn(tank, "nitrate")).toMatch(/as low as water changes can take it/i);
  });
});

describe("importing a history dates the tank", () => {
  test("four years of readings means a four-year-old tank, not a new one", () => {
    const created = inferCreatedAt({
      waterTests: [{ date: "2022-03-01" }, { date: "2026-01-01" }],
    });
    expect(created.slice(0, 4)).toBe("2022");
  });

  test("no history means nothing to infer", () => {
    expect(inferCreatedAt({ waterTests: [] })).toBeNull();
  });
});

const { mergeQuarantine, mergeTank } = require("../lib/merge");
const { getConflictFixes, SPECIES, getCompatibility } = require("../core");

describe("merging quarantine keeps both devices' observations", () => {
  test("a check ticked on either device counts as ticked", () => {
    // Same arrival, same id, on both devices. A plain union by id takes
    // first-seen and silently discards the other side's checks — so a fish
    // observed on the iPad is asked about again on the phone, or held back.
    const phone = [{ id: 1, name: "Tang", startDate: "2026-08-01", checks: { eating: true } }];
    const ipad = [{ id: 1, name: "Tang", startDate: "2026-08-01", checks: { marks: true, behaviour: true } }];
    const merged = mergeQuarantine(phone, ipad);
    expect(merged).toHaveLength(1);
    expect(merged[0].checks).toEqual({ eating: true, marks: true, behaviour: true });
  });

  test("an unticked box never un-ticks a ticked one", () => {
    const merged = mergeQuarantine(
      [{ id: 1, checks: { eating: true } }],
      [{ id: 1, checks: { eating: false } }]
    );
    expect(merged[0].checks.eating).toBe(true);
  });

  test("quarantine began when it began", () => {
    const merged = mergeQuarantine(
      [{ id: 1, startDate: "2026-08-10" }],
      [{ id: 1, startDate: "2026-08-01" }]
    );
    expect(merged[0].startDate).toBe("2026-08-01");
  });

  test("the tank merge routes quarantine through it", () => {
    const merged = mergeTank(
      { id: "t1", quarantine: [{ id: 1, checks: { eating: true } }] },
      { id: "t1", quarantine: [{ id: 1, checks: { marks: true } }] }
    );
    expect(merged.quarantine[0].checks).toEqual({ eating: true, marks: true });
  });

  test("medication doses survive a merge too", () => {
    const merged = mergeTank(
      { id: "t1", medDoses: [{ id: "m1", date: "2026-08-01", amount: 10 }] },
      { id: "t1", medDoses: [{ id: "m2", date: "2026-08-02", amount: 10 }] }
    );
    expect(merged.medDoses).toHaveLength(2);
  });
});

describe("a named conflict comes with a way out", () => {
  test("incompatible fish produce an actual swap suggestion", () => {
    // The filter tested for compatibility levels "great" and "ok". The engine
    // only ever emits "excellent" | "caution" | "avoid", so it matched nothing
    // and this returned [] for every tank that has ever existed. Scanning the
    // catalog is the assertion: at least one real conflicting pair must yield
    // a usable swap, or the function is decorative again.
    const fresh = SPECIES.filter((s) => s.water === "fresh");
    let fix = null;
    for (let i = 0; i < fresh.length && !fix; i++) {
      for (let j = i + 1; j < fresh.length && !fix; j++) {
        if (getCompatibility(fresh[i].name, fresh[j].name).level !== "avoid") continue;
        const f = getConflictFixes(75, [fresh[i].name, fresh[j].name], 3);
        if (f.length) fix = f[0];
      }
    }
    expect(fix).toBeTruthy();
    expect(fix.replace).toBeTruthy();
    expect(fix.keeping).toBeTruthy();
    expect(fix.alternatives.length).toBeGreaterThan(0);
  });

  test("every suggested alternative genuinely gets on with what's staying", () => {
    const fixes = getConflictFixes(75, ["Neon Tetra", "Giant Danio"], 3);
    fixes.forEach((f) => {
      f.alternatives.forEach((alt) => {
        expect(getCompatibility(alt.name, f.keeping).level).toBe("excellent");
      });
    });
  });

  test("a compatible tank needs no fixes", () => {
    expect(getConflictFixes(500, [], 3)).toHaveLength(0);
  });
});

const { newMedDose, courseTotal } = require("../lib/meds");
const { ensureTankShape } = require("../lib/migrations");

describe("medication doses are recordable, not just calculable", () => {
  test("a tank stored before medDoses existed gains the field", () => {
    expect(ensureTankShape({ id: "t1" }).medDoses).toEqual([]);
  });

  test("a course totals what actually went in", () => {
    const doses = [
      newMedDose({ name: "Copper", amount: 12, date: "2026-08-16" }),
      newMedDose({ name: "Copper", amount: 6, date: "2026-08-14" }),
    ];
    expect(courseTotal(doses, "2026-08-10")).toBe(18);
  });

  test("medication is kept out of the supplement consumption maths", () => {
    // `doses` drives the alkalinity consumption model. A treatment course
    // landing in there would corrupt every figure it produces.
    const shaped = ensureTankShape({ id: "t1", medDoses: [{ id: "m1", amount: 10 }] });
    expect(shaped.doses).toEqual([]);
    expect(shaped.medDoses).toHaveLength(1);
  });
});

describe("the whole-tank recommendation is reachable", () => {
  test("it finds the smallest change that fixes everything, not just nitrate", () => {
    const tests = [{ date: key(1), water: "fresh", values: { nitrate: 90, ph: 7.2 } }];
    const pct = getRecommendedChangePercent({ waterTests: tests, waterType: "fresh", sourceValues: {}, stockedNames: [] });
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThanOrEqual(90);
  });
});
