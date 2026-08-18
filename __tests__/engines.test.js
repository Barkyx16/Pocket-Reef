// The four new analysis engines, tested as logic.
//
// These make claims about a keeper's tank that nothing else in the app makes,
// and every one of them can be confidently wrong in a way a screenshot would
// never reveal. So the fixtures are built to be arithmetically checkable by
// hand, and the negative cases — the situations where each engine must refuse
// to say anything — get as much attention as the positive ones. An analysis
// engine that always finds a pattern is worse than none.

const { paramStability, tankStability, stabilityHeadline, gradeFor, SWING_LIMIT } = require("../lib/stability");
const { findCorrelations, collectEvents, interpret } = require("../lib/correlate");
const { newInventoryItem, measuredRate, forecastItem, forecastInventory, suggestedItems } = require("../lib/inventory");
const { buildReview } = require("../lib/review");
const { activeParams } = require("../lib/targets");

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
const dayAgo = (n) => localDay(NOW - n * 86400000);
const test0 = (date, values, water = "salt") => ({ date, water, values });
const alkParam = () => activeParams("salt").find((p) => p.key === "alk");



// ─────────────────────────────────────────────────────────────────────────────
// Stability
// ─────────────────────────────────────────────────────────────────────────────
describe("stability grading", () => {
  test("a tank holding steady grades rock solid", () => {
    const tests = [dayAgo(0), dayAgo(7), dayAgo(14), dayAgo(21)].map((d, i) => test0(d, { alk: 8.4 + (i % 2) * 0.1 }));
    const s = paramStability(alkParam(), tests, { now: NOW });
    expect(s.grade).toBe("rock-solid");
    expect(s.readings).toBe(4);
  });

  test("a parameter bouncing inside the good band is still caught", () => {
    // 7.4 → 9.6 → 7.8 — every one of these grades "Good" on its own, which is
    // the exact blind spot this engine exists to cover.
    const tests = [
      test0(dayAgo(0), { alk: 7.8 }),
      test0(dayAgo(3), { alk: 9.6 }),
      test0(dayAgo(6), { alk: 7.4 }),
    ];
    const s = paramStability(alkParam(), tests, { now: NOW });
    expect(["swinging", "unstable"]).toContain(s.grade);
    // 2.2 dKH across 3 days is ~0.73/day against a 0.4 limit.
    expect(s.perDay).toBeCloseTo(0.73, 1);
  });

  test("the same movement spread over weeks is drift, not a swing", () => {
    const slow = [
      test0(dayAgo(0), { alk: 9.6 }),
      test0(dayAgo(20), { alk: 8.5 }),
      test0(dayAgo(40), { alk: 7.4 }),
    ];
    const s = paramStability(alkParam(), slow, { now: NOW });
    expect(s.grade).toBe("rock-solid");
  });

  test("movement inside test-kit error is ignored", () => {
    const tests = [
      test0(dayAgo(0), { alk: 8.4 }),
      test0(dayAgo(1), { alk: 8.5 }),
      test0(dayAgo(2), { alk: 8.4 }),
    ];
    const s = paramStability(alkParam(), tests, { now: NOW });
    expect(s.perDay).toBe(0);
    expect(s.grade).toBe("rock-solid");
  });

  test("two tests on the same day can't report an infinite swing", () => {
    const tests = [test0(dayAgo(0), { alk: 11 }), test0(dayAgo(0), { alk: 7 }), test0(dayAgo(5), { alk: 8.4 })];
    const s = paramStability(alkParam(), tests, { now: NOW });
    expect(Number.isFinite(s.perDay)).toBe(true);
  });

  test("parameters where the level is the risk are not graded on swing", () => {
    // Nitrate going 10 → 25 → 10 is a water-change schedule, not a hazard.
    const nitrate = activeParams("salt").find((p) => p.key === "nitrate");
    expect(SWING_LIMIT.nitrate).toBeUndefined();
    expect(paramStability(nitrate, [test0(dayAgo(0), { nitrate: 10 }), test0(dayAgo(3), { nitrate: 25 }), test0(dayAgo(6), { nitrate: 10 })], { now: NOW })).toBeNull();
  });

  test("too few readings is refused, not guessed", () => {
    expect(paramStability(alkParam(), [test0(dayAgo(0), { alk: 8 }), test0(dayAgo(4), { alk: 9 })], { now: NOW })).toBeNull();
  });

  test("stale readings don't describe this week", () => {
    const old = [90, 100, 110].map((d) => test0(dayAgo(d), { alk: 8.4 }));
    expect(paramStability(alkParam(), old, { now: NOW })).toBeNull();
  });

  test("the worst parameter dominates the tank score rather than being averaged away", () => {
    const tests = [
      test0(dayAgo(0), { alk: 7.4, calcium: 420, magnesium: 1300 }),
      test0(dayAgo(3), { alk: 9.6, calcium: 422, magnesium: 1300 }),
      test0(dayAgo(6), { alk: 7.8, calcium: 418, magnesium: 1305 }),
    ];
    const s = tankStability(tests, "salt", { now: NOW });
    expect(s.ok).toBe(true);
    expect(s.worst.key).toBe("alk");
    expect(s.score).toBeLessThan(80);
  });

  test("an empty history says so instead of scoring zero", () => {
    const s = tankStability([], "salt", { now: NOW });
    expect(s.ok).toBe(false);
    expect(s.score).toBeNull();
  });

  test("the headline names the actual movement", () => {
    const tests = [test0(dayAgo(0), { alk: 7.8 }), test0(dayAgo(3), { alk: 9.6 }), test0(dayAgo(6), { alk: 7.4 })];
    const line = stabilityHeadline(tankStability(tests, "salt", { now: NOW }));
    expect(line).toContain("Alk");
    expect(line).toMatch(/safe 0\.4/);
  });

  test("grade boundaries", () => {
    expect(gradeFor(0.2).grade).toBe("rock-solid");
    expect(gradeFor(0.6).grade).toBe("steady");
    expect(gradeFor(1.0).grade).toBe("swinging");
    expect(gradeFor(2.0).grade).toBe("unstable");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Correlation
// ─────────────────────────────────────────────────────────────────────────────
describe("event correlation", () => {
  // Four water changes, each followed by nitrate dropping 10ppm.
  const tank = {
    gallons: 100,
    waterChanges: [0, 14, 28, 42].map((d) => ({ id: `w${d}`, date: dayAgo(d + 1), pct: 25, gallons: 25 })),
    waterTests: [0, 14, 28, 42].flatMap((d) => [
      test0(dayAgo(d), { nitrate: 10 }),      // after the change
      test0(dayAgo(d + 3), { nitrate: 20 }),  // before it
    ]),
  };

  test("finds the effect the water-change log was written to explain", () => {
    const found = findCorrelations(tank, "salt", { now: NOW });
    const hit = found.find((f) => f.param === "nitrate" && f.event === "waterchange");
    expect(hit).toBeTruthy();
    expect(hit.direction).toBe("down");
    expect(hit.meanDelta).toBe(-10);
    expect(hit.occurrences).toBe(4);
  });

  test("it reads as association, never as proof", () => {
    const hit = findCorrelations(tank, "salt", { now: NOW }).find((f) => f.param === "nitrate");
    expect(hit.text).toMatch(/after 4 of 4/);
    expect(hit.text).not.toMatch(/because|caused/i);
  });

  test("a routine working correctly is confirmed, not alarmed about", () => {
    const hit = findCorrelations(tank, "salt", { now: NOW }).find((f) => f.param === "nitrate");
    expect(interpret(hit).tone).toBe("good");
  });

  test("alkalinity falling after every water change is flagged as a salt-mix problem", () => {
    const bad = {
      gallons: 100,
      waterChanges: [0, 14, 28, 42].map((d) => ({ id: `w${d}`, date: dayAgo(d + 1), pct: 25, gallons: 25 })),
      waterTests: [0, 14, 28, 42].flatMap((d) => [
        test0(dayAgo(d), { alk: 7.5 }),
        test0(dayAgo(d + 3), { alk: 8.7 }),
      ]),
    };
    const hit = findCorrelations(bad, "salt", { now: NOW }).find((f) => f.param === "alk" && f.event === "waterchange");
    expect(hit.direction).toBe("down");
    expect(interpret(hit).tone).toBe("warn");
    expect(interpret(hit).note).toMatch(/salt mix/i);
  });

  test("an inconsistent effect is not reported", () => {
    // Up, down, up, down after each change — no pattern to claim.
    const noisy = {
      gallons: 100,
      waterChanges: [0, 14, 28, 42].map((d) => ({ id: `w${d}`, date: dayAgo(d + 1), pct: 25, gallons: 25 })),
      waterTests: [
        test0(dayAgo(0), { nitrate: 30 }), test0(dayAgo(3), { nitrate: 10 }),
        test0(dayAgo(14), { nitrate: 10 }), test0(dayAgo(17), { nitrate: 30 }),
        test0(dayAgo(28), { nitrate: 30 }), test0(dayAgo(31), { nitrate: 10 }),
        test0(dayAgo(42), { nitrate: 10 }), test0(dayAgo(45), { nitrate: 30 }),
      ],
    };
    expect(findCorrelations(noisy, "salt", { now: NOW }).find((f) => f.event === "waterchange" && f.param === "nitrate")).toBeFalsy();
  });

  test("two occurrences is a coincidence, not a pattern", () => {
    const thin = {
      gallons: 100,
      waterChanges: [0, 14].map((d) => ({ id: `w${d}`, date: dayAgo(d + 1), pct: 25, gallons: 25 })),
      waterTests: [0, 14].flatMap((d) => [test0(dayAgo(d), { nitrate: 10 }), test0(dayAgo(d + 3), { nitrate: 20 })]),
    };
    expect(findCorrelations(thin, "salt", { now: NOW })).toHaveLength(0);
  });

  test("movement within kit error is never a finding", () => {
    const tiny = {
      gallons: 100,
      waterChanges: [0, 14, 28, 42].map((d) => ({ id: `w${d}`, date: dayAgo(d + 1), pct: 25, gallons: 25 })),
      waterTests: [0, 14, 28, 42].flatMap((d) => [test0(dayAgo(d), { alk: 8.4 }), test0(dayAgo(d + 3), { alk: 8.5 })]),
    };
    expect(findCorrelations(tiny, "salt", { now: NOW }).find((f) => f.param === "alk")).toBeFalsy();
  });

  test("a reading taken long after the event isn't attributed to it", () => {
    const laggy = {
      gallons: 100,
      waterChanges: [0, 30, 60, 90].map((d) => ({ id: `w${d}`, date: dayAgo(d + 20), pct: 25, gallons: 25 })),
      waterTests: [0, 30, 60, 90].flatMap((d) => [test0(dayAgo(d), { nitrate: 10 }), test0(dayAgo(d + 25), { nitrate: 20 })]),
    };
    expect(findCorrelations(laggy, "salt", { now: NOW }).find((f) => f.event === "waterchange")).toBeFalsy();
  });

  test("a tank with no events yields nothing rather than throwing", () => {
    expect(findCorrelations({ waterTests: [test0(dayAgo(0), { nitrate: 10 })] }, "salt", { now: NOW })).toEqual([]);
    expect(findCorrelations({}, "salt", { now: NOW })).toEqual([]);
  });

  test("journal prose is not treated as an intervention", () => {
    const events = collectEvents({ journal: [{ id: 1, date: dayAgo(1), text: "Saw algae" }], waterChanges: [{ date: dayAgo(2) }] });
    expect(events.some((e) => e.type === "waterchange")).toBe(true);
    expect(events.some((e) => e.type === "journal")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Inventory
// ─────────────────────────────────────────────────────────────────────────────
describe("consumables", () => {
  const saltTank = {
    gallons: 100,
    // 25 gallons changed every 14 days over the window.
    waterChanges: [0, 14, 28, 42].map((d) => ({ id: `w${d}`, date: dayAgo(d), pct: 25, gallons: 25 })),
  };

  test("salt usage is measured from water actually changed", () => {
    const salt = newInventoryItem({ name: "Salt mix", kind: "salt", stock: 50, perGallon: 0.5 });
    const rate = measuredRate(salt, saltTank, { now: NOW });
    // 100 gallons × 0.5 lb over a 42-day span ≈ 1.19 lb/day.
    expect(rate.measured).toBe(true);
    expect(rate.perDay).toBeCloseTo(1.19, 1);
    expect(rate.basis).toContain("4 water changes");
  });

  test("that becomes a run-out date", () => {
    const salt = newInventoryItem({ name: "Salt mix", kind: "salt", stock: 50, perGallon: 0.5 });
    const f = forecastItem(salt, saltTank, { now: NOW });
    expect(f.state).toBe("ok");
    // ~42 days of salt left. The span is measured from a local calendar day to
    // an instant, so the figure moves by one with the device's UTC offset.
    expect(f.daysLeft).toBeGreaterThanOrEqual(41);
    expect(f.daysLeft).toBeLessThanOrEqual(43);
    expect(f.runsOutOn).toMatch(/^2026-09-2[6-9]$/);
  });

  test("a nearly-empty bucket is flagged low before the weekend it ruins", () => {
    const salt = newInventoryItem({ name: "Salt mix", kind: "salt", stock: 8, perGallon: 0.5 });
    const f = forecastItem(salt, saltTank, { now: NOW });
    expect(f.state).toBe("low");
    expect(f.daysLeft).toBeLessThanOrEqual(14);
  });

  test("a change logged as a percentage still counts", () => {
    const pctOnly = { gallons: 100, waterChanges: [0, 14, 28].map((d) => ({ id: `w${d}`, date: dayAgo(d), pct: 25, gallons: null })) };
    const salt = newInventoryItem({ name: "Salt", kind: "salt", stock: 50, perGallon: 0.5 });
    expect(measuredRate(salt, pctOnly, { now: NOW }).perDay).toBeGreaterThan(0);
  });

  test("supplement usage comes from the dose log", () => {
    const tank = { doses: [0, 2, 4, 6].map((d) => ({ id: `d${d}`, key: "alk", ml: 10, date: dayAgo(d) })) };
    const item = newInventoryItem({ name: "Alk supplement", kind: "supplement", stock: 1000, doseKey: "alk" });
    const rate = measuredRate(item, tank, { now: NOW });
    // 40ml across roughly six and a half days. The exact span depends on the
    // device timezone — the oldest dose is a local calendar day and `now` is an
    // instant — so this asserts the band rather than a UTC-only figure.
    expect(rate.perDay).toBeGreaterThan(5.5);
    expect(rate.perDay).toBeLessThan(7);
  });

  test("too little logged usage refuses to predict rather than inventing a date", () => {
    const item = newInventoryItem({ name: "Salt", kind: "salt", stock: 50, perGallon: 0.5 });
    const f = forecastItem(item, { gallons: 100, waterChanges: [{ id: "w", date: dayAgo(1), gallons: 25 }] }, { now: NOW });
    expect(f.state).toBe("unknown");
    expect(f.daysLeft).toBeNull();
    expect(f.headline).toMatch(/not enough usage/i);
  });

  test("a keeper-stated rate is used when nothing can be measured, and marked as such", () => {
    const item = newInventoryItem({ name: "Carbon", kind: "media", stock: 6, perDay: 0.1 });
    const f = forecastItem(item, {}, { now: NOW });
    expect(f.rate.measured).toBe(false);
    expect(f.daysLeft).toBe(60);
  });

  test("an expired test kit is the danger, not the shortage", () => {
    const kit = newInventoryItem({ name: "Alk kit", kind: "test", stock: 40, perDay: 1, expiresAt: dayAgo(5) });
    const f = forecastItem(kit, {}, { now: NOW });
    expect(f.state).toBe("expired");
    expect(f.headline).toMatch(/expired/i);
  });

  test("expiry wins when it lands before depletion", () => {
    const kit = newInventoryItem({ name: "Alk kit", kind: "test", stock: 300, perDay: 1, expiresAt: localDay(NOW + 10 * 86400000) });
    const f = forecastItem(kit, {}, { now: NOW });
    expect(f.state).toBe("expiring");
  });

  test("the shelf sorts by urgency and produces a shopping list", () => {
    const items = [
      newInventoryItem({ name: "Carbon", kind: "media", stock: 100, perDay: 0.1 }),
      newInventoryItem({ name: "Salt mix", kind: "salt", stock: 0, perGallon: 0.5 }),
      newInventoryItem({ name: "Floss", kind: "media", stock: 2, perDay: 0.5 }),
    ];
    const { rows, shoppingList } = forecastInventory(items, saltTank, { now: NOW });
    expect(rows[0].item.name).toBe("Salt mix"); // out of stock first
    expect(shoppingList).toContain("Salt mix");
    expect(shoppingList).toContain("Floss");
    expect(shoppingList).not.toContain("Carbon");
  });

  test("a nameless item is refused", () => {
    expect(newInventoryItem({ name: "   " })).toBeNull();
  });

  test("suggestions match the water type", () => {
    expect(suggestedItems("salt").some((i) => i.kind === "salt")).toBe(true);
    expect(suggestedItems("fresh").some((i) => i.kind === "salt")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Weekly review
// ─────────────────────────────────────────────────────────────────────────────
describe("the weekly review", () => {
  const busyTank = {
    gallons: 100,
    water: "salt",
    waterTests: [test0(dayAgo(1), { nitrate: 8, alk: 8.4 }), test0(dayAgo(6), { nitrate: 20, alk: 8.4 })],
    waterChanges: [{ id: "w1", date: dayAgo(3), pct: 25, gallons: 25 }],
    feedings: [{ id: "f1", date: dayAgo(2), food: "Frozen" }],
    doses: [],
    journal: [],
  };

  test("it counts the week honestly", () => {
    const r = buildReview(busyTank, { now: NOW, waterType: "salt" });
    expect(r.activity.tests).toBe(2);
    expect(r.activity.waterChanges).toBe(1);
    expect(r.headline).toContain("2 tests");
  });

  test("it reports what actually moved", () => {
    const r = buildReview(busyTank, { now: NOW, waterType: "salt" });
    const nitrate = r.movements.find((m) => m.key === "nitrate");
    expect(nitrate.delta).toBe(-12);
    expect(nitrate.direction).toBe("down");
    // Alkalinity didn't move beyond kit error, so it isn't listed as news.
    expect(r.movements.find((m) => m.key === "alk")).toBeFalsy();
  });

  test("an empty week says so rather than rendering zeroes", () => {
    const r = buildReview({ waterTests: [], water: "salt" }, { now: NOW, waterType: "salt" });
    expect(r.empty).toBe(true);
    expect(r.headline).toMatch(/nothing logged/i);
  });

  test("an out-of-stock consumable outranks everything else for focus", () => {
    const tank = { ...busyTank, inventory: [newInventoryItem({ name: "Salt mix", kind: "salt", stock: 0, perGallon: 0.5 })] };
    const r = buildReview(tank, { now: NOW, waterType: "salt" });
    expect(r.focus.kind).toBe("inventory");
    expect(r.focus.text).toContain("Salt mix");
  });

  test("an unstable parameter becomes the focus when the shelf is fine", () => {
    const swinging = {
      ...busyTank,
      waterTests: [
        test0(dayAgo(0), { alk: 7.8 }),
        test0(dayAgo(3), { alk: 9.6 }),
        test0(dayAgo(6), { alk: 7.4 }),
      ],
    };
    const r = buildReview(swinging, { now: NOW, waterType: "salt" });
    expect(r.focus.kind).toBe("stability");
    expect(r.focus.text).toMatch(/Alk/);
  });

  test("a quiet, healthy week is allowed to say nothing is wrong", () => {
    const calm = {
      gallons: 100,
      water: "salt",
      waterTests: [0, 7, 14].map((d) => test0(dayAgo(d), { alk: 8.4, calcium: 420 })),
      feedings: [{ id: "f", date: dayAgo(1) }],
      inventory: [],
    };
    const r = buildReview(calm, { now: NOW, waterType: "salt" });
    expect(r.focus.kind).toBe("good");
  });

  test("no test in the window is itself the finding", () => {
    const stale = { gallons: 100, water: "salt", waterTests: [test0(dayAgo(40), { alk: 8.4 })], feedings: [{ id: "f", date: dayAgo(1) }] };
    const r = buildReview(stale, { now: NOW, waterType: "salt" });
    expect(r.focus.kind).toBe("activity");
  });

  test("it says whether the week was busier than the one before", () => {
    const r = buildReview(busyTank, { now: NOW, waterType: "salt" });
    expect(["more", "fewer", "same"]).toContain(r.testTrend);
  });
});
