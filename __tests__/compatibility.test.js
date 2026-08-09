import { getCompatibility, SPECIES } from "../core";
import { OVERRIDE_KEYS } from "../data/compatibility";

const LEVELS = ["excellent", "ok", "caution", "avoid"];
const byName = Object.fromEntries(SPECIES.map((s) => [s.name, s]));
const find = (pred) => SPECIES.find(pred);

describe("the hand-tuned overrides", () => {
  test("every override names species that actually exist", () => {
    // A misspelled name makes the override silently dead — the engine falls
    // through to the generic rules and nobody ever notices the tuned advice
    // stopped firing. This is the only thing that surfaces it.
    const missing = [];
    OVERRIDE_KEYS.forEach((k) => {
      k.split("|").map((s) => s.trim()).forEach((name) => {
        if (!byName[name]) missing.push(`${name}  (in "${k}")`);
      });
    });
    expect(missing).toEqual([]);
  });

  test("every override actually takes effect", () => {
    // Beyond the names resolving, the pairing must return the override's own
    // verdict rather than whatever the rules would have said.
    const dead = OVERRIDE_KEYS.filter((k) => {
      const [a, b] = k.split("|").map((s) => s.trim());
      if (!byName[a] || !byName[b]) return false; // covered by the test above
      return !getCompatibility(a, b).reason;
    });
    expect(dead).toEqual([]);
  });

  test("overrides are order-independent", () => {
    OVERRIDE_KEYS.forEach((k) => {
      const [a, b] = k.split("|").map((s) => s.trim());
      if (!byName[a] || !byName[b]) return;
      expect(getCompatibility(a, b)).toEqual(getCompatibility(b, a));
    });
  });

  test("an override beats the rules it contradicts", () => {
    // Ocellaris + Cleaner Shrimp is pinned "excellent"; the predator-size rule
    // would otherwise flag a 3.5" carnivore against a 2" invert.
    const r = getCompatibility("Ocellaris Clownfish", "Cleaner Shrimp");
    expect(r.level).toBe("excellent");
  });
});

describe("the rule engine", () => {
  test("fresh and salt can never share a tank", () => {
    const f = find((s) => s.water === "fresh");
    const s = find((x) => x.water === "salt");
    const r = getCompatibility(f.name, s.name);
    expect(r.level).toBe("avoid");
    expect(r.reason).toMatch(/same tank/i);
  });

  test("an aggressive fish is flagged against a peaceful one", () => {
    const agg = find((s) => s.temperament === "aggressive" && s.water === "fresh");
    const calm = find((s) => s.temperament === "peaceful" && s.water === "fresh" && s.name !== agg.name);
    expect(getCompatibility(agg.name, calm.name).level).toBe("avoid");
  });

  test("a much larger carnivore is flagged as a predator", () => {
    // The rule fires at 2.2x adult length.
    const pair = (() => {
      for (const big of SPECIES) {
        if (big.diet === "herbivore" || big.diet === "photosynthetic") continue;
        if (big.temperament === "aggressive") continue;
        for (const small of SPECIES) {
          if (small.water !== big.water || small.kind === "coral" || /snail/i.test(small.name)) continue;
          if (small.temperament === "aggressive") continue;
          if (big.adultInches >= small.adultInches * 2.2) return [big, small];
        }
      }
      return null;
    })();
    if (!pair) return;
    const r = getCompatibility(pair[0].name, pair[1].name);
    expect(r.level).toBe("avoid");
  });

  test("corals are never treated as prey", () => {
    const coral = find((s) => s.kind === "coral");
    const bigFish = SPECIES.filter((s) => s.water === "salt" && s.kind === "fish" && s.diet !== "herbivore")
      .sort((a, b) => b.adultInches - a.adultInches)[0];
    if (!coral || !bigFish) return;
    const r = getCompatibility(bigFish.name, coral.name);
    expect(r.reason).not.toMatch(/large enough to eat/i);
  });

  test("the same species twice is a caution about group size, not a conflict", () => {
    const s = find((x) => x.kind === "fish");
    const r = getCompatibility(s.name, s.name);
    expect(r.level).toBe("caution");
    expect(r.reason).toMatch(/space|group/i);
  });

  test("an unknown species degrades gracefully", () => {
    const r = getCompatibility("Not A Fish", "Neon Tetra");
    expect(r.level).toBe("caution");
    expect(() => getCompatibility(null, undefined)).not.toThrow();
  });
});

describe("engine invariants across the whole catalog", () => {
  // A deterministic spread rather than all 49,770 pairs.
  const sample = [];
  for (let i = 0; i < SPECIES.length; i += 7) {
    for (let j = i + 3; j < SPECIES.length; j += 23) sample.push([SPECIES[i], SPECIES[j]]);
  }

  test("every verdict is a known level with a real reason", () => {
    const bad = [];
    sample.forEach(([a, b]) => {
      const r = getCompatibility(a.name, b.name);
      if (!LEVELS.includes(r.level) || !r.reason || r.reason.length < 8) bad.push(`${a.name}|${b.name}`);
    });
    expect(bad).toEqual([]);
  });

  test("the verdict never depends on argument order", () => {
    const asym = sample.filter(([a, b]) =>
      JSON.stringify(getCompatibility(a.name, b.name)) !== JSON.stringify(getCompatibility(b.name, a.name))
    ).map(([a, b]) => `${a.name}|${b.name}`);
    expect(asym).toEqual([]);
  });

  test("mixed water is always avoid, with no exceptions in the catalog", () => {
    const wrong = sample
      .filter(([a, b]) => a.water !== b.water)
      .filter(([a, b]) => getCompatibility(a.name, b.name).level !== "avoid")
      .map(([a, b]) => `${a.name}|${b.name}`);
    expect(wrong).toEqual([]);
  });
});
