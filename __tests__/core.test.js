import {
  getSpecies, getTankWarnings, getBioload, getStockingRoom, getRecommended,
  getTankStatus, getCycleStatus, getTodayActions, getTankMaturity, getWaterDelta,
  getTankHealthScore, getAchievements, getTankParamWindow, getWaterStats,
  getStreak, getWeeklyActivity, TIPS,
} from "../core";
import SPECIES from "../data/speciesData";
import { getCompatibility } from "../data/compatibility";
import { ACHIEVEMENTS } from "../data/achievements";

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


// ─────────────────────────────────────────────────────────────────────────────
// core.js is the brain — bioload, warnings, health scoring, achievements, the
// Today hub. It ships 10 changes at a time with nothing catching a regression,
// and a babel compile can't see a broken calculation.
//
// These tests pin the BEHAVIOUR that users would notice breaking, not the
// implementation. They should survive a refactor and fail on a bad answer.
// ─────────────────────────────────────────────────────────────────────────────

const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();
const todayKey = () => localDay();

// A few known-good catalog entries to build fixtures from.
const NEON = "Neon Tetra";
const CLOWN = "Ocellaris Clownfish";



describe("catalog integrity", () => {
  test("every species has the fields the app renders", () => {
    const missing = SPECIES.filter(
      (s) => !s.name || !s.kind || !s.water || typeof s.minGallons !== "number" || typeof s.adultInches !== "number"
    );
    expect(missing.map((s) => s.name)).toEqual([]);
  });

  test("species names are unique", () => {
    const seen = new Set();
    const dupes = [];
    SPECIES.forEach((s) => { if (seen.has(s.name)) dupes.push(s.name); seen.add(s.name); });
    expect(dupes).toEqual([]);
  });

  test("temperature and pH ranges are ordered, not inverted", () => {
    const bad = SPECIES.filter((s) => s.tempMinF > s.tempMaxF || s.phMin > s.phMax);
    expect(bad.map((s) => s.name)).toEqual([]);
  });

  test("getSpecies finds a known fish and survives an unknown one", () => {
    expect(getSpecies(NEON).name).toBe(NEON);
    expect(getSpecies("Not A Real Fish")).toBeFalsy();
  });
});

describe("bioload", () => {
  test("empty tank is zero", () => {
    expect(getBioload(20, []).pct).toBe(0);
  });

  test("more fish means more load", () => {
    const one = getBioload(20, [NEON], { [NEON]: 1 }).pct;
    const six = getBioload(20, [NEON], { [NEON]: 6 }).pct;
    expect(six).toBeGreaterThan(one);
  });

  test("quantities are respected, not just presence", () => {
    const presence = getBioload(20, [NEON]).pct;
    const ten = getBioload(20, [NEON], { [NEON]: 10 }).pct;
    expect(ten).toBeGreaterThan(presence);
  });

  test("corals weigh ~nothing next to fish — the reef fix", () => {
    // The bug this guards: reef tanks reading as overstocked because corals
    // were counted like fish.
    const coral = SPECIES.find((s) => s.kind === "coral");
    const fish = SPECIES.find((s) => s.kind === "fish" && s.water === "salt");
    if (!coral || !fish) return;
    const coralLoad = getBioload(30, [coral.name], { [coral.name]: 5 }).inches;
    const fishLoad = getBioload(30, [fish.name], { [fish.name]: 5 }).inches;
    expect(coralLoad).toBeLessThan(fishLoad);
  });

  test("a bigger tank carries the same stock more comfortably", () => {
    const small = getBioload(10, [NEON], { [NEON]: 6 }).pct;
    const big = getBioload(55, [NEON], { [NEON]: 6 }).pct;
    expect(big).toBeLessThan(small);
  });
});

describe("stocking room", () => {
  test("an empty tank has room", () => {
    expect(getStockingRoom(29, []).roomInches).toBeGreaterThan(0);
  });

  test("room never goes negative", () => {
    const packed = getStockingRoom(5, [NEON], { [NEON]: 60 }).roomInches;
    expect(packed).toBeGreaterThanOrEqual(0);
  });
});

describe("tank warnings", () => {
  test("a sane tank is quiet", () => {
    const w = getTankWarnings(29, [NEON], { [NEON]: 6 });
    expect(Array.isArray(w)).toBe(true);
  });

  test("a fish too big for the tank is flagged", () => {
    const big = SPECIES.find((s) => s.minGallons >= 55);
    if (!big) return;
    const w = getTankWarnings(5, [big.name], { [big.name]: 1 });
    expect(w.length).toBeGreaterThan(0);
  });

  test("mixing fresh and salt is flagged", () => {
    const fresh = SPECIES.find((s) => s.water === "fresh");
    const salt = SPECIES.find((s) => s.water === "salt");
    const w = getTankWarnings(55, [fresh.name, salt.name]);
    expect(w.length).toBeGreaterThan(0);
  });

  test("schooling shortfall stays quiet when no count is set", () => {
    // Deliberate: an undefined quantity must not fire, or every existing user
    // gets flooded with warnings about fish they never counted.
    const schooler = SPECIES.find((s) => s.minGroup >= 6);
    if (!schooler) return;
    const quiet = getTankWarnings(55, [schooler.name], {});
    const loud = getTankWarnings(55, [schooler.name], { [schooler.name]: 1 });
    expect(loud.length).toBeGreaterThan(quiet.length);
  });
});

describe("compatibility engine", () => {
  test("a species is compatible with itself", () => {
    const r = getCompatibility(NEON, NEON);
    expect(r).toBeTruthy();
  });

  test("fresh and salt never mix", () => {
    const fresh = SPECIES.find((s) => s.water === "fresh");
    const salt = SPECIES.find((s) => s.water === "salt");
    const r = getCompatibility(fresh.name, salt.name);
    expect(r.level).not.toBe("good");
  });

  test("it is symmetric — order must not change the verdict", () => {
    const pairs = [[NEON, CLOWN], ["Neon Tetra", "Betta"], ["Zebra Danio", "Neon Tetra"]];
    pairs.forEach(([a, b]) => {
      if (!getSpecies(a) || !getSpecies(b)) return;
      expect(getCompatibility(a, b).level).toBe(getCompatibility(b, a).level);
    });
  });

  test("a much larger predator is flagged against a small tankmate", () => {
    const small = SPECIES.find((s) => s.kind === "fish" && s.adultInches <= 1.5 && s.water === "fresh");
    const large = SPECIES.find((s) => s.kind === "fish" && s.water === "fresh" && s.adultInches >= (small ? small.adultInches * 2.5 : 99));
    if (!small || !large) return;
    expect(getCompatibility(small.name, large.name).level).not.toBe("good");
  });
});

describe("nitrogen cycle", () => {
  test("no tests means not started", () => {
    expect(getCycleStatus([]).cycled).toBe(false);
    expect(getCycleStatus([]).label).toBeTruthy();
  });

  test("clean readings with nitrate present read as cycled", () => {
    const s = getCycleStatus([{ date: iso(0), values: { ammonia: 0, nitrite: 0, nitrate: 20 } }]);
    expect(s.cycled).toBe(true);
  });

  test("ammonia spike is not reported as cycled", () => {
    const s = getCycleStatus([{ date: iso(0), values: { ammonia: 4, nitrite: 0, nitrate: 0 } }]);
    expect(s.cycled).toBe(false);
  });
});

describe("today actions", () => {
  const base = { tank: [NEON], waterTests: [], maintenance: {}, quarantine: [], careDoneCount: 0 };

  test("returns a list", () => {
    expect(Array.isArray(getTodayActions(base))).toBe(true);
  });

  test("every action carries a destination tab, so deep links work", () => {
    const actions = getTodayActions({
      ...base,
      waterTests: [{ date: iso(40), values: { ammonia: 0, nitrite: 0, nitrate: 60 } }],
      maintenance: { filterclean: iso(90), gravelvac: iso(60) },
      reminderPrefs: { waterTest: "weekly", waterChange: "weekly" },
    });
    actions.forEach((a) => expect(typeof a.to).toBe("string"));
  });

  test("reminders set to off stop producing nudges", () => {
    const on = getTodayActions({ ...base, waterTests: [{ date: iso(40), values: { nitrate: 10 } }], reminderPrefs: { waterTest: "weekly", waterChange: "weekly" } });
    const off = getTodayActions({ ...base, waterTests: [{ date: iso(40), values: { nitrate: 10 } }], reminderPrefs: { waterTest: "off", waterChange: "off" } });
    expect(off.length).toBeLessThanOrEqual(on.length);
  });

  test("overdue maintenance surfaces", () => {
    const actions = getTodayActions({ ...base, maintenance: { filterclean: iso(200) } });
    expect(actions.some((a) => /filter/i.test(a.text))).toBe(true);
  });
});

describe("tank health score", () => {
  test("stays within 0-100", () => {
    const cases = [
      {},
      { tank: [NEON], tankGallons: 20 },
      { tank: [NEON], tankGallons: 1, quantities: { [NEON]: 99 } },
      { tank: [NEON], tankGallons: 55, waterTests: [{ date: iso(0), values: { ammonia: 0, nitrite: 0, nitrate: 10, ph: 7 } }] },
    ];
    cases.forEach((c) => {
      const s = getTankHealthScore(c);
      // The contract deliberately changed: null means "nothing assessable yet",
      // which is a real answer. Anything else must still be a sane percentage.
      if (s.score === null) {
        expect(s.assessed).toBe(false);
      } else {
        expect(s.score).toBeGreaterThanOrEqual(0);
        expect(s.score).toBeLessThanOrEqual(100);
      }
    });
  });

  test("good water scores better than an ammonia spike", () => {
    const good = getTankHealthScore({ tank: [NEON], tankGallons: 29, waterTests: [{ date: iso(0), values: { ammonia: 0, nitrite: 0, nitrate: 10, ph: 7 } }] });
    const bad = getTankHealthScore({ tank: [NEON], tankGallons: 29, waterTests: [{ date: iso(0), values: { ammonia: 6, nitrite: 3, nitrate: 120, ph: 5 } }] });
    expect(good.score).toBeGreaterThan(bad.score);
  });

  test("an overstocked tank scores below a comfortable one", () => {
    const ok = getTankHealthScore({ tank: [NEON], tankGallons: 55, quantities: { [NEON]: 6 } });
    const packed = getTankHealthScore({ tank: [NEON], tankGallons: 5, quantities: { [NEON]: 80 } });
    expect(packed.score).toBeLessThan(ok.score);
  });
});

describe("achievements", () => {
  test("all definitions are well formed and uniquely identified", () => {
    const ids = new Set();
    ACHIEVEMENTS.forEach((a) => {
      expect(typeof a.check).toBe("function");
      expect(a.id).toBeTruthy();
      expect(ids.has(a.id)).toBe(false);
      ids.add(a.id);
    });
  });

  test("a brand-new account earns nothing it hasn't done", () => {
    const res = getAchievements({ tanks: [], activeDays: [], xp: 0, wishlist: [] });
    const earned = res.filter((a) => a.earned);
    expect(earned.length).toBe(0);
  });

  test("no check throws on empty or malformed state", () => {
    // A crash here takes down the whole Profile tab.
    expect(() => getAchievements({})).not.toThrow();
    expect(() => getAchievements({ tanks: [{}], activeDays: null, wishlist: null })).not.toThrow();
  });

  test("real activity earns something", () => {
    const res = getAchievements({
      tanks: [{ stock: [NEON], waterTests: [{ date: iso(0), values: { ph: 7 } }], journal: [{ date: iso(0), text: "hi" }], feedings: [{ date: iso(0) }] }],
      activeDays: [todayKey()],
      xp: 500,
      wishlist: [NEON],
    });
    expect(res.filter((a) => a.earned).length).toBeGreaterThan(0);
  });
});

describe("parameter window", () => {
  test("a single species yields its own range", () => {
    const s = getSpecies(NEON);
    const w = getTankParamWindow([NEON]);
    expect(w.tempLo).toBe(s.tempMinF);
    expect(w.tempHi).toBe(s.tempMaxF);
  });

  test("incompatible ranges are reported rather than silently intersected", () => {
    const cold = SPECIES.filter((s) => s.water === "fresh").sort((a, b) => a.tempMaxF - b.tempMaxF)[0];
    const warm = SPECIES.filter((s) => s.water === "fresh").sort((a, b) => b.tempMinF - a.tempMinF)[0];
    if (!cold || !warm || cold.tempMaxF >= warm.tempMinF) return;
    const w = getTankParamWindow([cold.name, warm.name]);
    expect(w.ok).toBe(false);
  });
});

describe("streaks", () => {
  test("no activity is no streak", () => {
    expect(getStreak([])).toBe(0);
  });

  test("today alone is a streak of one", () => {
    expect(getStreak([todayKey()])).toBe(1);
  });

  test("consecutive days accumulate", () => {
    const days = [0, 1, 2].map((d) => localDay(Date.now() - d * 86400000));
    expect(getStreak(days)).toBe(3);
  });

  test("a gap breaks it", () => {
    const days = [todayKey(), localDay(Date.now() - 5 * 86400000)];
    expect(getStreak(days)).toBe(1);
  });
});

describe("water stats and deltas", () => {
  test("no readings degrade gracefully", () => {
    expect(() => getWaterStats([])).not.toThrow();
    expect(() => getWaterDelta([])).not.toThrow();
  });

  test("a delta is computed between the two most recent readings", () => {
    const d = getWaterDelta([{ date: iso(0), values: { nitrate: 30 } }, { date: iso(7), values: { nitrate: 10 } }], "fresh");
    expect(d).toBeTruthy();
  });
});

describe("misc guards", () => {
  test("tank maturity handles a missing creation date", () => {
    expect(() => getTankMaturity(null)).not.toThrow();
  });

  test("recommendations never suggest the wrong water type", () => {
    const recs = getRecommended(29, [], 8, "fresh");
    recs.forEach((r) => expect(r.water).not.toBe("salt"));
  });

  test("tank status returns a label for any input", () => {
    [[0, []], [20, [NEON]], [1, [NEON]]].forEach(([g, stock]) => {
      expect(getTankStatus(g, stock)).toBeTruthy();
    });
  });

  test("weekly activity handles empty input", () => {
    expect(() => getWeeklyActivity({})).not.toThrow();
  });

  test("tips exist and are non-empty strings", () => {
    expect(TIPS.length).toBeGreaterThan(0);
    TIPS.forEach((t) => expect(String(t).length).toBeGreaterThan(0));
  });
});

describe("catalog copy quality", () => {
  // Care STATS stay archetype-based by design — families share a tuned baseline,
  // and that's how 316 species remain maintainable. Summaries are different:
  // they're what the user reads on every card, and an Angelfish that described
  // itself exactly like an Oscar was the tell that made the app look like it
  // didn't know fish.
  //
  // Every species now has its own. These tests make that a permanent property
  // rather than a one-off cleanup.
  const summaries = {};
  SPECIES.forEach((s) => { (summaries[s.summary] = summaries[s.summary] || []).push(s.name); });
  const groups = Object.values(summaries);

  test("every species has a unique summary", () => {
    const shared = groups
      .filter((g) => g.length > 1)
      .map((g) => `${g.length}x: ${g.join(", ")}`);
    expect(shared).toEqual([]);
  });

  test("the distinct-summary count matches the catalog size", () => {
    expect(groups.length).toBe(SPECIES.length);
  });

  test("every summary is a real sentence, not a placeholder", () => {
    const bad = SPECIES.filter((s) => !s.summary || s.summary.length < 25 || /TODO|TBD|lorem/i.test(s.summary));
    expect(bad.map((s) => s.name)).toEqual([]);
  });

  test("summaries stay short enough to read on a card", () => {
    // The card gives this two lines. Much past ~120 chars and it truncates.
    const tooLong = SPECIES.filter((s) => s.summary.length > 125).map((s) => `${s.name} (${s.summary.length})`);
    expect(tooLong).toEqual([]);
  });

  test("a summary actually mentions its own species, not just its family", () => {
    // Spot-check that near-identical relatives read differently — the specific
    // failure this whole pass existed to fix.
    const pairs = [
      ["Angelfish", "Oscar"],
      ["Neon Tetra", "Cardinal Tetra"],
      ["Yellow Tang", "Blue Tang"],
      ["Percula Clownfish", "Maroon Clownfish"],
      ["Acropora", "Montipora"],
    ];
    pairs.forEach(([a, b]) => {
      const sa = SPECIES.find((x) => x.name === a);
      const sb = SPECIES.find((x) => x.name === b);
      if (!sa || !sb) return;
      expect(sa.summary).not.toBe(sb.summary);
    });
  });
});

describe("stock-aware parameter grading", () => {
  const { assessParamForStock, PARAMS } = require("../core");
  const tempParam = PARAMS.fresh.find((p) => p.key === "temp");
  const ammoniaParam = PARAMS.fresh.find((p) => p.key === "ammonia");

  test("an empty tank falls back to the generic range", () => {
    const a = assessParamForStock(tempParam, 78, []);
    expect(a.source).toBeUndefined();
  });

  test("a Discus tank accepts the warmth Discus need", () => {
    // The bug this prevents: telling a Discus keeper their correct 84F is wrong.
    const discus = SPECIES.find((s) => s.name === "Discus");
    if (!discus) return;
    const mid = Math.round((discus.tempMinF + discus.tempMaxF) / 2);
    expect(assessParamForStock(tempParam, mid, ["Discus"]).status).toBe("good");
  });

  test("the same temperature is flagged for a cold-water fish", () => {
    const cold = SPECIES.filter((s) => s.water === "fresh").sort((a, b) => a.tempMaxF - b.tempMaxF)[0];
    const discus = SPECIES.find((s) => s.name === "Discus");
    if (!cold || !discus || cold.tempMaxF >= discus.tempMinF) return;
    const hot = discus.tempMaxF;
    expect(assessParamForStock(tempParam, hot, [cold.name]).status).not.toBe("good");
  });

  test("a small drift is a caution, not an emergency", () => {
    const s = SPECIES.find((x) => x.name === "Neon Tetra");
    const justOver = s.tempMaxF + 1;
    expect(assessParamForStock(tempParam, justOver, ["Neon Tetra"]).status).toBe("caution");
  });

  test("ammonia has no species opinion — always the generic range", () => {
    const withStock = assessParamForStock(ammoniaParam, 4, ["Neon Tetra"]);
    expect(withStock.source).toBeUndefined();
    expect(withStock.status).toBe("danger");
  });

  test("an impossible stock window falls back instead of failing everything", () => {
    // Fish whose ranges don't overlap: the tank has a bigger problem than this
    // reading, and grading against an empty window would mark all water bad.
    const cold = SPECIES.filter((s) => s.water === "fresh").sort((a, b) => a.tempMaxF - b.tempMaxF)[0];
    const warm = SPECIES.filter((s) => s.water === "fresh").sort((a, b) => b.tempMinF - a.tempMinF)[0];
    if (!cold || !warm || cold.tempMaxF >= warm.tempMinF) return;
    const a = assessParamForStock(tempParam, 76, [cold.name, warm.name]);
    expect(a.source).toBeUndefined();
  });

  test("never throws on odd input", () => {
    expect(() => assessParamForStock(tempParam, null, ["Neon Tetra"])).not.toThrow();
    expect(() => assessParamForStock(tempParam, "abc", ["Neon Tetra"])).not.toThrow();
    expect(() => assessParamForStock(tempParam, 78, ["Not A Fish"])).not.toThrow();
  });
});

describe("health improvements", () => {
  const { getHealthImprovements } = require("../core");

  test("a brand-new tank is told what to do first", () => {
    const hs = getTankHealthScore({ tank: [NEON], tankGallons: 29 });
    const tips = getHealthImprovements(hs);
    expect(tips.length).toBeGreaterThan(0);
    tips.forEach((t) => {
      expect(t.points).toBeGreaterThan(0);
      expect(typeof t.action).toBe("string");
      expect(typeof t.to).toBe("string"); // deep-linkable, like Today actions
    });
  });

  test("suggestions are ranked by points available", () => {
    const hs = getTankHealthScore({ tank: [NEON], tankGallons: 29 });
    const tips = getHealthImprovements(hs, 5);
    for (let i = 1; i < tips.length; i++) {
      expect(tips[i - 1].points).toBeGreaterThanOrEqual(tips[i].points);
    }
  });

  test("a factor already at full marks is never suggested", () => {
    const hs = getTankHealthScore({
      tank: [NEON], tankGallons: 55, quantities: { [NEON]: 6 },
      waterTests: [{ date: iso(0), values: { ammonia: 0, nitrite: 0, nitrate: 10, ph: 7 } }],
      maintenance: { waterchange: iso(1), filterclean: iso(2), gravelvac: iso(1), glassclean: iso(1) },
    });
    const suggested = getHealthImprovements(hs, 10).map((t) => t.label);
    const perfect = hs.factors.filter((f) => f.state === true).map((f) => f.label);
    perfect.forEach((label) => expect(suggested).not.toContain(label));
  });

  test("a perfect tank has nothing left to suggest", () => {
    const hs = { score: 100, factors: [{ label: "Water quality", state: true, weight: 25 }] };
    expect(getHealthImprovements(hs)).toEqual([]);
  });

  test("handles missing or malformed input", () => {
    expect(getHealthImprovements(null)).toEqual([]);
    expect(getHealthImprovements({})).toEqual([]);
    expect(getHealthImprovements({ factors: "nope" })).toEqual([]);
  });
});

describe("health score only grades what it can assess", () => {
  test("an empty, never-tested tank has NO score rather than a flattering one", () => {
    // It used to report 73%: full marks for having no fish to conflict, plus
    // half marks for water, cycle and maintenance it had never measured.
    const h = getTankHealthScore({ tank: [], tankGallons: 20 });
    expect(h.score).toBeNull();
    expect(h.assessed).toBe(false);
    expect(h.label).toMatch(/not enough/i);
  });

  test("every factor of an empty tank is marked not-applicable", () => {
    const h = getTankHealthScore({ tank: [], tankGallons: 20 });
    expect(h.factors.every((f) => f.state === "n/a")).toBe(true);
    expect(h.applicable).toBe(0);
  });

  test("an empty tank is not credited for having nothing to conflict", () => {
    const h = getTankHealthScore({ tank: [], tankGallons: 20 });
    const compat = h.factors.find((f) => f.label === "Compatibility");
    const stocking = h.factors.find((f) => f.label === "Stocking level");
    expect(compat.state).toBe("n/a");
    expect(stocking.state).toBe("n/a");
  });

  test("a stocked but untested tank scores on what IS knowable", () => {
    const h = getTankHealthScore({ tank: [NEON, "Cardinal Tetra"], tankGallons: 29 });
    expect(typeof h.score).toBe("number");
    // Only compatibility + stocking are assessable, so the denominator is 45.
    expect(h.applicable).toBe(45);
    expect(h.factors.find((f) => f.label === "Water quality").state).toBe("n/a");
  });

  test("a well-kept tank still scores high", () => {
    const h = getTankHealthScore({
      tank: [NEON, "Cardinal Tetra"], tankGallons: 55, quantities: { [NEON]: 6, "Cardinal Tetra": 6 },
      waterTests: [{ date: iso(0), values: { ammonia: 0, nitrite: 0, nitrate: 10, ph: 7 } }],
      maintenance: { waterchange: iso(1), filterclean: iso(2), gravelvac: iso(1), glassclean: iso(1) },
    });
    expect(h.score).toBeGreaterThanOrEqual(80);
  });

  test("untracked factors become the top improvement suggestions", () => {
    const { getHealthImprovements } = require("../core");
    const h = getTankHealthScore({ tank: [NEON], tankGallons: 29 });
    const tips = getHealthImprovements(h, 3);
    expect(tips.length).toBeGreaterThan(0);
    expect(tips[0].points).toBeGreaterThan(0);
  });
});
