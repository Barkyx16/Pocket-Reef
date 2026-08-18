jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// What the app says when something dies.
//
// The tone rules matter as much as the findings. An app that treats every loss
// as a crisis is one people stop telling about losses — and then it loses the
// pattern that would actually have mattered. And it must never speculate about
// blame: where the record supports a cause it names it with the number, and
// where it doesn't it says so.

const { reviewLoss } = require("../lib/afterLoss");
const { newLoss, newStockRecord } = require("../lib/livestock");
const { SPECIES } = require("../core");

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


const NOW = new Date("2026-08-17T12:00:00Z").getTime();
const day = (n) => localDay(NOW - n * 86400000);
const test0 = (date, values) => ({ date, water: "fresh", values });
const FISH = SPECIES.find((s) => s.water === "fresh" && s.minGroup > 1);

const died = (name, extra = {}) => newLoss({ name, reason: "died", date: day(0), ...extra });
const has = (r, id) => r.findings.some((f) => f.id === id);
const find = (r, id) => r.findings.find((f) => f.id === id);



describe("a loss that isn't a death", () => {
  test("rehoming isn't treated as a health event", () => {
    const r = reviewLoss(newLoss({ name: FISH.name, reason: "rehomed" }), {}, { now: NOW });
    expect(r.mortality).toBe(false);
    expect(r.findings).toHaveLength(0);
    // Reassurance, not alarm. ("Nothing else to check" contains "check" and is
    // exactly the right thing to say, so the assertion is on alarm words.)
    expect(r.headline).not.toMatch(/\b(urgent|danger|risk|crisis|wrong|failed)\b/i);
    expect(r.headline).toMatch(/wasn't a loss to the tank's health/i);
  });
});

describe("the water", () => {
  test("no test on record means test now", () => {
    const r = reviewLoss(died(FISH.name), { waterTests: [] }, { now: NOW });
    expect(has(r, "no-test")).toBe(true);
    expect(find(r, "no-test").tone).toBe("act");
  });

  test("a stale test means test now, and says how stale", () => {
    const tank = { waterTests: [test0(day(40), { nitrate: 10 })] };
    const r = reviewLoss(died(FISH.name), tank, { now: NOW });
    expect(find(r, "stale-test").body).toMatch(/40 days ago/);
  });

  test("a bad reading is named with its number, not as 'check your water'", () => {
    const tank = { waterTests: [test0(day(1), { ammonia: 2, nitrate: 10 })] };
    const r = reviewLoss(died(FISH.name), tank, { now: NOW });
    const f = find(r, "bad-reading");
    expect(f.tone).toBe("act");
    expect(f.body).toContain("2");
    // It offers the reading as evidence, never as a verdict.
    expect(f.body).toMatch(/doesn't prove/i);
  });

  test("clean water is reported as clean, which rules something out", () => {
    const tank = { waterTests: [test0(day(1), { ammonia: 0, nitrite: 0, nitrate: 10, ph: 7.2 })] };
    const r = reviewLoss(died(FISH.name), tank, { now: NOW });
    expect(find(r, "clean-water").tone).toBe("good");
  });
});

describe("how long it had been there", () => {
  test("a recent arrival points at the shop and the journey, not at the keeper", () => {
    const tank = {
      waterTests: [test0(day(1), { ammonia: 0, nitrate: 10 })],
      stockMeta: { [FISH.name]: newStockRecord({ addedAt: day(5) }) },
    };
    const r = reviewLoss(died(FISH.name), tank, { now: NOW });
    const f = find(r, "new-arrival");
    expect(f.body).toMatch(/shop|journey|acclimation/i);
    expect(f.tone).toBe("watch");
  });

  test("a long-lived animal is told plainly that old age isn't a failure", () => {
    const tank = {
      waterTests: [test0(day(1), { ammonia: 0, nitrate: 10 })],
      stockMeta: { [FISH.name]: newStockRecord({ addedAt: day(900) }) },
    };
    const f = find(reviewLoss(died(FISH.name), tank, { now: NOW }), "long-resident");
    expect(f.tone).toBe("good");
    expect(f.body).toMatch(/isn't a failure/i);
  });
});

describe("what's still in the tank", () => {
  test("an incompatible tankmate still in there is named", () => {
    const aggressive = SPECIES.filter((s) => s.water === "fresh" && s.temperament === "aggressive");
    if (aggressive.length < 1) return;
    const victim = SPECIES.find((s) =>
      s.water === "fresh" && s.name !== aggressive[0].name &&
      require("../core").getCompatibility(s.name, aggressive[0].name).level === "avoid");
    if (!victim) return;

    const tank = { stock: [aggressive[0].name], waterTests: [test0(day(1), { ammonia: 0, nitrate: 10 })] };
    const f = find(reviewLoss(died(victim.name), tank, { now: NOW }), "conflict");
    expect(f.title).toContain(aggressive[0].name);
    expect(f.body).toMatch(/happen again/i);
  });

  test("a school dropped below its minimum warns for the survivors", () => {
    const tank = {
      stock: [FISH.name],
      quantities: { [FISH.name]: 2 },
      waterTests: [test0(day(1), { ammonia: 0, nitrate: 10 })],
    };
    const f = find(reviewLoss(died(FISH.name), tank, { now: NOW }), "under-group");
    expect(f.title).toContain(String(FISH.minGroup));
    expect(f.body).toMatch(/remaining ones/i);
  });
});

describe("one loss is not a crisis", () => {
  test("a single death with clean water raises nothing urgent", () => {
    const tank = {
      waterTests: [test0(day(1), { ammonia: 0, nitrite: 0, nitrate: 10, ph: 7.2 })],
      stockMeta: { [FISH.name]: newStockRecord({ addedAt: day(200) }) },
      losses: [],
    };
    const r = reviewLoss(died(FISH.name), tank, { now: NOW });
    expect(r.urgent).toBe(0);
    expect(r.headline).toMatch(/nothing in your record points at a cause/i);
  });

  test("but a cluster is called what it is", () => {
    const tank = {
      waterTests: [test0(day(1), { ammonia: 0, nitrite: 0, nitrate: 10, ph: 7.2 })],
      losses: [died("A"), died("B"), died("C")],
    };
    const f = find(reviewLoss(died("D"), tank, { now: NOW }), "cluster");
    expect(f.tone).toBe("act");
    expect(f.body).toMatch(/more than bad luck/i);
  });

  test("old losses don't count toward a cluster", () => {
    const tank = {
      waterTests: [test0(day(1), { ammonia: 0, nitrate: 10 })],
      losses: [
        newLoss({ name: "A", reason: "died", date: day(200) }),
        newLoss({ name: "B", reason: "died", date: day(300) }),
        newLoss({ name: "C", reason: "died", date: day(400) }),
      ],
    };
    expect(has(reviewLoss(died("D"), tank, { now: NOW }), "cluster")).toBe(false);
  });

  test("rehoming three fish is not a mortality cluster", () => {
    const tank = {
      waterTests: [test0(day(1), { ammonia: 0, nitrate: 10 })],
      losses: [
        newLoss({ name: "A", reason: "rehomed", date: day(2) }),
        newLoss({ name: "B", reason: "rehomed", date: day(3) }),
        newLoss({ name: "C", reason: "moved", date: day(4) }),
      ],
    };
    expect(has(reviewLoss(died("D"), tank, { now: NOW }), "cluster")).toBe(false);
  });
});

describe("robustness", () => {
  test("the thing to do today sorts first", () => {
    const tank = { waterTests: [], losses: [died("A"), died("B"), died("C")] };
    const r = reviewLoss(died(FISH.name), tank, { now: NOW });
    expect(r.findings[0].tone).toBe("act");
  });

  test("an empty tank and an unknown species don't throw", () => {
    expect(() => reviewLoss(died("Not A Real Fish"), {}, { now: NOW })).not.toThrow();
    expect(reviewLoss(null, {}, { now: NOW }).ok).toBe(false);
  });
});
