import { getAchievements, ACHIEVEMENTS, getTreatment } from "../core";

const iso = (d) => new Date(Date.now() - d * 86400000).toISOString();
const tank = (over = {}) => ({
  id: "t1", name: "T", gallons: 55, water: "fresh",
  stock: [], quantities: {}, notes: "", waterTests: [], journal: [],
  costs: [], maintenance: {}, quarantine: [], feedings: [], treatments: [],
  createdAt: iso(30), ...over,
});
const earned = (tanks) => getAchievements({ tanks }).filter((a) => a.earned).map((a) => a.id);

describe("achievements for the newer features", () => {
  test("ids are unique across the whole set", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every achievement has the fields the UI renders", () => {
    ACHIEVEMENTS.forEach((a) => {
      expect(typeof a.id).toBe("string");
      expect(typeof a.title).toBe("string");
      expect(a.desc.length).toBeGreaterThan(5);
      expect(typeof a.check).toBe("function");
    });
  });

  test("a small fresh account earns nothing by accident", () => {
    // Deliberately a small tank — a 55gal one legitimately earns "big_tank",
    // which is correct behaviour, not a false positive.
    expect(earned([tank({ gallons: 10 })])).toEqual([]);
  });

  test("starting a treatment earns Field Medic", () => {
    const t = tank({ treatments: [{ disease: "Ich (White Spot)", startedAt: iso(0), doneSteps: [] }] });
    expect(earned([t])).toContain("first_treatment");
    // But not the completion one — that's the distinction that matters.
    expect(earned([t])).not.toContain("treatment_done");
  });

  test("only a fully worked course counts as completed", () => {
    const plan = getTreatment("Ich (White Spot)");
    const all = plan.steps.map((s, i) => `${s.day}-${i}`);
    const partial = tank({ treatments: [{ disease: "Ich (White Spot)", startedAt: iso(20), doneSteps: all.slice(0, 2) }] });
    const full = tank({ treatments: [{ disease: "Ich (White Spot)", startedAt: iso(20), doneSteps: all }] });
    expect(earned([partial])).not.toContain("treatment_done");
    expect(earned([full])).toContain("treatment_done");
  });

  test("reef chemistry counts alk, calcium and magnesium readings", () => {
    const tests = Array.from({ length: 5 }, (_, i) => ({ date: iso(i), values: { alk: 8.2 } }));
    expect(earned([tank({ waterTests: tests })])).toContain("reef_chem5");
  });

  test("plain freshwater tests do not count as reef chemistry", () => {
    const tests = Array.from({ length: 8 }, (_, i) => ({ date: iso(i), values: { nitrate: 10 } }));
    expect(earned([tank({ waterTests: tests })])).not.toContain("reef_chem5");
  });

  test("forecastable needs three readings, matching the forecaster", () => {
    const two = Array.from({ length: 2 }, (_, i) => ({ date: iso(i), values: { nitrate: 10 } }));
    const three = Array.from({ length: 3 }, (_, i) => ({ date: iso(i), values: { nitrate: 10 } }));
    expect(earned([tank({ waterTests: two })])).not.toContain("forecastable");
    expect(earned([tank({ waterTests: three })])).toContain("forecastable");
  });

  test("notes are only credited when actually written", () => {
    expect(earned([tank({ notes: "   " })])).not.toContain("note_taker");
    expect(earned([tank({ notes: "Reef build log" })])).toContain("note_taker");
  });

  test("a school below its minimum does not count", () => {
    const under = tank({ stock: ["Neon Tetra"], quantities: { "Neon Tetra": 2 } });
    expect(earned([under])).not.toContain("schools_out");
  });

  test("achievements never throw on malformed tanks", () => {
    expect(() => getAchievements({ tanks: [null, {}, { stock: null, treatments: null }] })).not.toThrow();
    expect(() => getAchievements({})).not.toThrow();
    expect(() => getAchievements({ tanks: null })).not.toThrow();
  });
});
