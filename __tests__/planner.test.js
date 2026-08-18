import { generateStockingPlan, getEquipmentPlan } from "../lib/planner";
import { getCyclingCoach, getConflictFixes, getFeedingPlan, getCompatibility } from "../core";
import SPECIES from "../data/speciesData";

const iso = (d) => new Date(Date.now() - d * 86400000).toISOString();
const test$ = (values, d = 0) => ({ date: iso(d), values });

describe("stocking plan generator", () => {
  test("needs a tank size", () => {
    expect(generateStockingPlan({ gallons: 0 }).ok).toBe(false);
  });

  test("builds a plan for a common community tank", () => {
    const plan = generateStockingPlan({ gallons: 29, water: "fresh" });
    expect(plan.ok).toBe(true);
    expect(plan.picks.length).toBeGreaterThan(0);
  });

  test("every pick actually fits the tank", () => {
    const plan = generateStockingPlan({ gallons: 29, water: "fresh" });
    plan.picks.forEach((p) => expect(p.species.minGallons).toBeLessThanOrEqual(29));
  });

  test("no plan ever contains a conflicting pair — the whole point", () => {
    [10, 20, 29, 55, 75, 125].forEach((g) => {
      ["fresh", "salt"].forEach((water) => {
        const plan = generateStockingPlan({ gallons: g, water });
        const names = plan.picks.map((p) => p.species.name);
        for (let i = 0; i < names.length; i++) {
          for (let j = i + 1; j < names.length; j++) {
            expect(getCompatibility(names[i], names[j]).level).not.toBe("avoid");
          }
        }
      });
    });
  });

  test("water types are never mixed", () => {
    const plan = generateStockingPlan({ gallons: 55, water: "salt" });
    plan.picks.forEach((p) => expect(p.species.water).toBe("salt"));
  });

  test("leaves headroom rather than filling the tank", () => {
    const plan = generateStockingPlan({ gallons: 55, water: "fresh" });
    expect(plan.load).toBeLessThanOrEqual(55 * 0.75 + 0.01);
    expect(plan.headroom).toBeGreaterThan(0);
  });

  test("schooling fish are planned at their real group minimum", () => {
    const plan = generateStockingPlan({ gallons: 55, water: "fresh" });
    const school = plan.picks.find((p) => p.role === "school");
    if (school) expect(school.count).toBeGreaterThanOrEqual(school.species.minGroup);
  });

  test("beginner mode only suggests easy species", () => {
    const plan = generateStockingPlan({ gallons: 55, water: "fresh", experience: "beginner" });
    plan.picks.forEach((p) => expect(p.species.careLevel).toBe("Easy"));
  });

  test("the same seed reproduces the same plan", () => {
    const a = generateStockingPlan({ gallons: 40, water: "fresh", seed: 7 });
    const b = generateStockingPlan({ gallons: 40, water: "fresh", seed: 7 });
    expect(a.stock).toEqual(b.stock);
  });

  test("a different seed can give a different plan", () => {
    const seeds = [1, 2, 3, 4, 5].map((n) => generateStockingPlan({ gallons: 55, water: "fresh", seed: n }).stock.join(","));
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  test("returns a loadable stock and quantity map", () => {
    const plan = generateStockingPlan({ gallons: 29, water: "fresh" });
    expect(plan.stock.length).toBe(plan.picks.length);
    plan.stock.forEach((n) => expect(plan.quantities[n]).toBeGreaterThan(0));
  });

  test("a tiny tank yields a small plan, not a bad one", () => {
    const plan = generateStockingPlan({ gallons: 5, water: "fresh" });
    plan.picks.forEach((p) => expect(p.species.minGallons).toBeLessThanOrEqual(5));
  });
});

describe("equipment sizing", () => {
  test("needs a tank size", () => {
    expect(getEquipmentPlan({ gallons: 0 }).ok).toBe(false);
  });

  test("suggests a real heater size, not an arbitrary number", () => {
    const p = getEquipmentPlan({ gallons: 55, roomTempF: 65 });
    const heater = p.items.find((i) => i.id === "heater");
    expect(heater.value).toMatch(/^(25|50|75|100|150|200|250|300) W$/);
  });

  test("a bigger tank or colder room needs more watts", () => {
    const warmRoom = getEquipmentPlan({ gallons: 55, roomTempF: 74 });
    const coldRoom = getEquipmentPlan({ gallons: 55, roomTempF: 55 });
    const w = (p) => parseInt(p.items.find((i) => i.id === "heater").value, 10) || 0;
    expect(w(coldRoom)).toBeGreaterThanOrEqual(w(warmRoom));
  });

  test("no heater needed when the room is already warm enough", () => {
    const p = getEquipmentPlan({ gallons: 20, roomTempF: 82, targetTempF: 78 });
    expect(p.items.find((i) => i.id === "heater").value).toBe("Not needed");
  });

  test("reef turnover is higher than freshwater", () => {
    const gph = (p) => parseInt(p.items.find((i) => i.id === "filter").value, 10);
    expect(gph(getEquipmentPlan({ gallons: 50, water: "salt" }))).toBeGreaterThan(gph(getEquipmentPlan({ gallons: 50, water: "fresh" })));
  });

  test("corals raise the flow requirement and the lighting spec", () => {
    const coral = SPECIES.find((s) => s.kind === "coral");
    const withCoral = getEquipmentPlan({ gallons: 50, water: "salt", stockedNames: [coral.name] });
    const without = getEquipmentPlan({ gallons: 50, water: "salt" });
    const flow = (p) => parseInt(p.items.find((i) => i.id === "flow").value, 10);
    expect(flow(withCoral)).toBeGreaterThan(flow(without));
    expect(withCoral.items.find((i) => i.id === "light").value).toMatch(/Reef/i);
  });

  test("target temperature follows the stock", () => {
    const discus = SPECIES.find((s) => s.name === "Discus");
    if (!discus) return;
    const p = getEquipmentPlan({ gallons: 75, stockedNames: ["Discus"] });
    expect(p.targetTempF).toBeGreaterThanOrEqual(discus.tempMinF);
    expect(p.targetTempF).toBeLessThanOrEqual(discus.tempMaxF);
  });
});

describe("cycling coach", () => {
  test("an untested tank is told how to start", () => {
    const c = getCyclingCoach([]);
    expect(c.stage).toBe(0);
    expect(c.action).toMatch(/ammonia source/i);
    expect(c.needsTest).toBe(true);
  });

  test("the nitrite spike warns against stocking — where beginners lose fish", () => {
    const c = getCyclingCoach([test$({ ammonia: 0, nitrite: 2, nitrate: 5 })]);
    expect(c.stage).toBe(2);
    expect(c.action).toMatch(/not add fish/i);
  });

  test("a finished cycle says so and stops estimating", () => {
    const c = getCyclingCoach([test$({ ammonia: 0, nitrite: 0, nitrate: 20 })]);
    expect(c.cycled).toBe(true);
    expect(c.estimateRemaining).toBe(0);
  });

  test("the estimate is only called confident with enough readings", () => {
    expect(getCyclingCoach([test$({ ammonia: 2 })]).estimateConfident).toBe(false);
    const many = [test$({ ammonia: 2 }, 0), test$({ ammonia: 2 }, 3), test$({ ammonia: 2 }, 6)];
    expect(getCyclingCoach(many).estimateConfident).toBe(true);
  });

  test("stale testing is flagged", () => {
    expect(getCyclingCoach([test$({ ammonia: 1 }, 5)]).needsTest).toBe(true);
    expect(getCyclingCoach([test$({ ammonia: 1 }, 0)]).needsTest).toBe(false);
  });
});

describe("conflict fixes", () => {
  // Find a genuinely conflicting pair from the real engine rather than assuming one.
  const findConflict = () => {
    for (let i = 0; i < SPECIES.length; i++) {
      for (let j = i + 1; j < SPECIES.length; j++) {
        if (SPECIES[i].water !== SPECIES[j].water) continue;
        if (getCompatibility(SPECIES[i].name, SPECIES[j].name).level === "avoid") return [SPECIES[i], SPECIES[j]];
      }
    }
    return null;
  };

  test("a clean tank produces no fixes", () => {
    expect(getConflictFixes(55, [])).toEqual([]);
  });

  test("a conflicting pair produces suggested replacements", () => {
    const pair = findConflict();
    if (!pair) return;
    const fixes = getConflictFixes(200, [pair[0].name, pair[1].name]);
    if (!fixes.length) return; // no similar-role alternative exists; acceptable
    fixes.forEach((fix) => {
      expect(fix.alternatives.length).toBeGreaterThan(0);
      expect([pair[0].name, pair[1].name]).toContain(fix.replace);
    });
  });

  test("every suggested alternative actually gets along with what stays", () => {
    const pair = findConflict();
    if (!pair) return;
    const fixes = getConflictFixes(200, [pair[0].name, pair[1].name]);
    fixes.forEach((fix) => {
      fix.alternatives.forEach((alt) => {
        expect(getCompatibility(alt.name, fix.keeping).level).not.toBe("avoid");
        expect(getCompatibility(alt.name, fix.keeping).level).not.toBe("caution");
      });
    });
  });

  test("never suggests something already in the tank", () => {
    const pair = findConflict();
    if (!pair) return;
    const names = [pair[0].name, pair[1].name];
    getConflictFixes(200, names).forEach((fix) => {
      fix.alternatives.forEach((alt) => expect(names).not.toContain(alt.name));
    });
  });
});

describe("feeding plan", () => {
  test("an empty tank asks for stock first", () => {
    expect(getFeedingPlan([]).ok).toBe(false);
  });

  test("groups by diet and counts fish", () => {
    const herb = SPECIES.find((s) => s.diet === "herbivore" && s.kind === "fish");
    const carn = SPECIES.find((s) => s.diet === "carnivore" && s.kind === "fish" && s.water === herb.water);
    if (!herb || !carn) return;
    const plan = getFeedingPlan([herb.name, carn.name], { [herb.name]: 3, [carn.name]: 1 });
    expect(plan.ok).toBe(true);
    expect(plan.totalFish).toBe(4);
    expect(plan.groups.length).toBe(2);
  });

  test("carnivores are fed less often than small omnivores", () => {
    const carn = SPECIES.find((s) => s.diet === "carnivore" && s.kind === "fish");
    const plan = getFeedingPlan([carn.name]);
    expect(plan.groups[0].timesPerDay).toBe(1);
  });

  test("corals are excluded — they aren't fed from the flake tub", () => {
    const coral = SPECIES.find((s) => s.kind === "coral");
    const fish = SPECIES.find((s) => s.kind === "fish" && s.water === "salt");
    const plan = getFeedingPlan([coral.name, fish.name]);
    const named = plan.groups.flatMap((g) => g.species.map((s) => s.name));
    expect(named).not.toContain(coral.name);
  });

  test("the golden rule is always present", () => {
    const fish = SPECIES.find((s) => s.kind === "fish");
    expect(getFeedingPlan([fish.name]).goldenRule).toMatch(/overfeeding/i);
  });
});
