const {
  newStockRecord, daysInTank, tenureLabel, newLoss, isMortality,
  livestockSpend, mortalitySummary, longestResident, documentedShare, LOSS_REASONS,
} = require("../lib/livestock");

const {
  effectiveParams, builtInParam, validTarget, customisedKeys, applyPreset,
  formatIdeal, getPresets, PRESETS,
} = require("../lib/targets");

const { assessParam } = require("../core");

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


const DAY = 86400000;
const NOW = new Date("2026-08-09T12:00:00Z");
const daysAgo = (n) => localDay(NOW.getTime() - n * DAY);



describe("stock records", () => {
  test("a record needs nothing but a date, which it defaults", () => {
    const r = newStockRecord();
    expect(r.addedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.source).toBe("");
    expect(r.price).toBeNull();
  });

  test("an empty price is null, not zero", () => {
    // Zero would quietly claim the fish was free and drag every spend total
    // down with it.
    expect(newStockRecord({ price: "" }).price).toBeNull();
    expect(newStockRecord({ price: 0 }).price).toBe(0);
    expect(newStockRecord({ price: "24.50" }).price).toBe(24.5);
  });

  test("tenure reads in the unit a keeper would say", () => {
    expect(tenureLabel({ addedAt: daysAgo(0) }, NOW)).toBe("Added today");
    expect(tenureLabel({ addedAt: daysAgo(1) }, NOW)).toBe("1 day");
    expect(tenureLabel({ addedAt: daysAgo(12) }, NOW)).toBe("12 days");
    expect(tenureLabel({ addedAt: daysAgo(90) }, NOW)).toBe("3 months");
    expect(tenureLabel({ addedAt: daysAgo(400) }, NOW)).toBe("1y 1m");
    expect(tenureLabel({ addedAt: daysAgo(730) }, NOW)).toBe("2 years");
  });

  test("an undated record reports no tenure rather than zero days", () => {
    expect(daysInTank({})).toBeNull();
    expect(tenureLabel({})).toBeNull();
    expect(daysInTank({ addedAt: "not-a-date" })).toBeNull();
  });

  test("the longest resident is the tank's headline record", () => {
    const meta = {
      "Ocellaris Clownfish": { addedAt: daysAgo(800) },
      "Blue Tang": { addedAt: daysAgo(30) },
      "Royal Gramma": {},
    };
    const best = longestResident(["Ocellaris Clownfish", "Blue Tang", "Royal Gramma"], meta, NOW);
    expect(best.name).toBe("Ocellaris Clownfish");
    expect(best.days).toBe(800);
  });

  test("documented share reports honestly on a half-filled record", () => {
    const meta = { A: { addedAt: daysAgo(5) }, B: {} };
    expect(documentedShare(["A", "B", "C"], meta)).toEqual({ documented: 1, total: 3, pct: 33 });
    expect(documentedShare([], {})).toEqual({ documented: 0, total: 0, pct: 0 });
  });
});

describe("losses", () => {
  test("only a death counts as mortality", () => {
    expect(isMortality("died")).toBe(true);
    // Rehoming a fish that outgrew the tank is good husbandry. Counting it
    // against a survival rate would punish the right decision.
    expect(isMortality("rehomed")).toBe(false);
    expect(isMortality("moved")).toBe(false);
    expect(isMortality("removed")).toBe(false);
  });

  test("a cause is only attached to a death", () => {
    expect(newLoss({ name: "A", reason: "died", cause: "Disease" }).cause).toBe("Disease");
    expect(newLoss({ name: "A", reason: "rehomed", cause: "Disease" }).cause).toBeNull();
  });

  test("a loss snapshots the tenure so it survives the record being removed", () => {
    const record = { addedAt: daysAgo(430), source: "Blue Reef" };
    const loss = newLoss({ name: "Blue Tang", reason: "died", record });
    expect(loss.tenure).toBeTruthy();
    expect(loss.source).toBe("Blue Reef");
    expect(loss.addedAt).toBe(record.addedAt);
  });

  test("count defaults to one and can never be zero or fractional", () => {
    expect(newLoss({ name: "A" }).count).toBe(1);
    expect(newLoss({ name: "A", count: 0 }).count).toBe(1);
    expect(newLoss({ name: "A", count: 3.6 }).count).toBe(4);
    expect(newLoss({ name: "A", count: "3" }).count).toBe(3);
  });

  test("every reason in the picker is one the model understands", () => {
    for (const r of LOSS_REASONS) {
      expect(typeof isMortality(r.id)).toBe("boolean");
      expect(r.label.length).toBeGreaterThan(0);
    }
  });
});

describe("mortality summary", () => {
  const losses = [
    { name: "Blue Tang", reason: "died", cause: "Disease", count: 1, date: daysAgo(10) },
    { name: "Blue Tang", reason: "died", cause: "Disease", count: 1, date: daysAgo(40) },
    { name: "Royal Gramma", reason: "died", cause: "Aggression", count: 1, date: daysAgo(60) },
    { name: "Chromis", reason: "rehomed", cause: null, count: 4, date: daysAgo(20) },
    { name: "Old Fish", reason: "died", cause: "Old age", count: 1, date: daysAgo(500) },
  ];

  test("counts deaths in the window and ignores rehomings", () => {
    const s = mortalitySummary(losses, { days: 365, now: NOW });
    expect(s.total).toBe(3); // the 500-day-old death is outside the window
    expect(s.byCause.Disease).toBe(2);
    expect(s.byCause.Aggression).toBe(1);
    expect(s.byCause["Old age"]).toBeUndefined();
  });

  test("names the leading cause", () => {
    expect(mortalitySummary(losses, { days: 365, now: NOW }).topCause).toEqual({ cause: "Disease", count: 2 });
  });

  test("flags a species lost more than once", () => {
    // One death is bad luck; two of the same fish is a husbandry mismatch, and
    // that's the finding worth showing a keeper.
    const repeats = mortalitySummary(losses, { days: 365, now: NOW }).repeatOffenders;
    expect(repeats).toEqual([{ name: "Blue Tang", count: 2 }]);
  });

  test("an empty history is zero, not a crash", () => {
    const s = mortalitySummary([], { now: NOW });
    expect(s.total).toBe(0);
    expect(s.topCause).toBeNull();
    expect(s.repeatOffenders).toEqual([]);
  });
});

describe("livestock spend", () => {
  test("multiplies by quantity and separates current from lost", () => {
    const meta = { "Neon Tetra": { price: 3 }, "Blue Tang": { price: 80 } };
    const spend = livestockSpend(["Neon Tetra", "Blue Tang"], meta, { "Neon Tetra": 6 }, [{ price: 25, count: 2, reason: "died" }]);
    expect(spend.current).toBe(98); // 3*6 + 80*1
    expect(spend.lost).toBe(50);
    expect(spend.total).toBe(148);
  });

  test("undocumented prices count as nothing, not as a guess", () => {
    const spend = livestockSpend(["A", "B"], { A: { price: 10 } }, {}, []);
    expect(spend.current).toBe(10);
  });
});

describe("custom parameter targets", () => {
  test("no targets means the built-in ranges, unchanged", () => {
    const base = effectiveParams("salt", {});
    expect(base.find((p) => p.key === "nitrate").good).toEqual([0, 20]);
    expect(base.every((p) => !p.custom)).toBe(true);
  });

  test("a custom range replaces the built-in and re-derives the hint", () => {
    // The stale hint is the real bug here: "< 20 ppm" under a field graded at
    // 5 tells the keeper the app disagrees with itself.
    const params = effectiveParams("salt", { nitrate: { good: [2, 5] } });
    const nitrate = params.find((p) => p.key === "nitrate");
    expect(nitrate.good).toEqual([2, 5]);
    expect(nitrate.ideal).toBe("2–5 ppm");
    expect(nitrate.custom).toBe(true);
    // Untouched parameters keep their built-in definition.
    expect(params.find((p) => p.key === "calcium").good).toEqual([400, 450]);
  });

  test("grading follows the custom range", () => {
    const params = effectiveParams("salt", { nitrate: { good: [2, 5] } });
    const nitrate = params.find((p) => p.key === "nitrate");
    // 15ppm is "good" on the built-in reef band and clearly not good on SPS.
    expect(assessParam(nitrate, 4).status).toBe("good");
    expect(assessParam(nitrate, 15).status).not.toBe("good");
  });

  test("a custom good band without a caution band still gets a tolerance", () => {
    // Without this every reading a hair outside "good" would grade as danger,
    // which turns a tightened target into a permanently alarming tank.
    const nitrate = effectiveParams("salt", { nitrate: { good: [2, 5] } }).find((p) => p.key === "nitrate");
    expect(nitrate.caution[0]).toBeLessThanOrEqual(2);
    expect(nitrate.caution[1]).toBeGreaterThan(5);
    expect(assessParam(nitrate, 6).status).toBe("caution");
  });

  test("a malformed target is ignored rather than applied", () => {
    for (const bad of [{ good: [5] }, { good: ["a", "b"] }, { good: [10, 2] }, {}, null]) {
      const p = effectiveParams("salt", { nitrate: bad }).find((x) => x.key === "nitrate");
      expect(p.good).toEqual([0, 20]);
    }
    expect(validTarget({ good: [1, 2] })).toBe(true);
    expect(validTarget({ good: [2, 1] })).toBe(false);
  });

  test("customised keys lists only the real overrides", () => {
    expect(customisedKeys({ nitrate: { good: [2, 5] }, alk: { good: [9, 1] } })).toEqual(["nitrate"]);
  });

  test("builtInParam gives the value a per-parameter reset restores", () => {
    expect(builtInParam("salt", "nitrate").good).toEqual([0, 20]);
    expect(builtInParam("fresh", "nitrate").good).toEqual([0, 40]);
    expect(builtInParam("salt", "nope")).toBeNull();
  });
});

describe("presets", () => {
  test("every preset is valid for the water type it belongs to", () => {
    for (const water of ["salt", "fresh"]) {
      for (const preset of getPresets(water)) {
        expect(preset.label.length).toBeGreaterThan(0);
        expect(preset.blurb.length).toBeGreaterThan(0);
        for (const [key, target] of Object.entries(preset.targets)) {
          // A preset naming a parameter that doesn't exist for this water type
          // would silently do nothing.
          expect(builtInParam(water, key)).not.toBeNull();
          expect(validTarget(target)).toBe(true);
        }
      }
    }
  });

  test("presets differ from each other where it matters", () => {
    const sps = PRESETS.salt.find((p) => p.id === "sps").targets.nitrate.good;
    const fowlr = PRESETS.salt.find((p) => p.id === "fowlr").targets.nitrate.good;
    expect(sps[1]).toBeLessThan(fowlr[1]);
  });

  test("applying a preset keeps a value the keeper hand-tuned", () => {
    // "Everything else like SPS" — not "throw away my number".
    const mine = { alk: { good: [8.2, 8.4] } };
    const next = applyPreset(mine, PRESETS.salt.find((p) => p.id === "sps"));
    expect(next.alk.good).toEqual([8.2, 8.4]);
    expect(next.nitrate.good).toEqual([2, 5]);
  });

  test("formatIdeal reads like the built-in hints", () => {
    expect(formatIdeal([0, 20], "ppm")).toBe("< 20 ppm");
    expect(formatIdeal([8, 9.5], "dKH")).toBe("8–9.5 dKH");
    expect(formatIdeal([0, 0], "ppm")).toBe("0 ppm");
    expect(formatIdeal([6, 7.5], "")).toBe("6–7.5");
  });
});
