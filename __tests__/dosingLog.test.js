const {
  newDose, dosedBetween, consumptionRate, maintenanceDose,
  describeConsumption, recentDoseDays, dosedToday,
  DOSABLE, MIN_TESTS, MIN_SPAN_DAYS,
} = require("../lib/dosingLog");
const { actualWaterVolume } = require("../lib/dosing");

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
const NOW = new Date("2026-08-10T12:00:00Z").getTime();
const day = (n) => localDay(NOW - n * DAY);
const test1 = (date, alk) => ({ date, water: "salt", values: { alk } });



describe("recording a dose", () => {
  test("a dose needs a real amount", () => {
    expect(newDose({ key: "alk", ml: 12 }).ml).toBe(12);
    expect(newDose({ key: "alk", ml: 0 })).toBeNull();
    expect(newDose({ key: "alk", ml: -5 })).toBeNull();
    expect(newDose({ key: "alk", ml: "abc" })).toBeNull();
  });

  test("only dosable parameters are accepted", () => {
    for (const k of DOSABLE) expect(newDose({ key: k, ml: 5 })).not.toBeNull();
    // Nobody doses nitrate up with a supplement bottle; allowing it would put
    // meaningless rows in the consumption maths.
    expect(newDose({ key: "nitrate", ml: 5 })).toBeNull();
  });

  test("it defaults to today and keeps fractional millilitres", () => {
    const d = newDose({ key: "calcium", ml: 7.25 });
    expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(d.ml).toBe(7.25);
  });
});

describe("totalling what was dosed", () => {
  const doses = [
    { key: "alk", ml: 10, date: day(10) },
    { key: "alk", ml: 10, date: day(5) },
    { key: "alk", ml: 10, date: day(1) },
    { key: "calcium", ml: 99, date: day(5) },
    { key: "alk", ml: 10, date: day(30) }, // outside the window
  ];

  test("sums only the right supplement inside the range, inclusive", () => {
    expect(dosedBetween(doses, "alk", day(10), day(1))).toBe(30);
    expect(dosedBetween(doses, "calcium", day(10), day(1))).toBe(99);
  });

  test("excludes doses outside the range", () => {
    expect(dosedBetween(doses, "alk", day(6), day(0))).toBe(20);
  });

  test("an empty log totals zero rather than throwing", () => {
    expect(dosedBetween([], "alk", day(10), day(1))).toBe(0);
    expect(dosedBetween([null, {}], "alk", day(10), day(1))).toBe(0);
  });
});

describe("measuring consumption", () => {
  const gallons = 100;            // 90 actual gallons after displacement
  const strength = 0.05;          // 1ml raises 1 gallon by 0.05 dKH

  test("a tank held steady by dosing is consuming exactly what it's dosed", () => {
    // Alk flat at 8.0 across 10 days while dosing 20ml/day. 200ml total raises
    // 90 gallons by 200*0.05/90 = 0.111 dKH... so consumption is that, per day.
    const waterTests = [test1(day(10), 8.0), test1(day(5), 8.0), test1(day(0), 8.0)];
    const doses = Array.from({ length: 11 }, (_, i) => ({ key: "alk", ml: 20, date: day(i) }));
    const r = consumptionRate({ key: "alk", waterTests, doses, ratedGallons: gallons, strengthPerUnit: strength, now: NOW });

    expect(r.ok).toBe(true);
    expect(r.days).toBe(10);
    expect(r.dosedMl).toBe(220);
    expect(r.observedChange).toBe(0);
    // 220 * 0.05 / 90 = 0.1222 total rise, over 10 days.
    expect(r.perDay).toBeCloseTo(0.0122, 3);
  });

  test("with no dosing it is simply the rate of decline", () => {
    const waterTests = [test1(day(10), 9.0), test1(day(5), 8.5), test1(day(0), 8.0)];
    const r = consumptionRate({ key: "alk", waterTests, doses: [], ratedGallons: gallons, strengthPerUnit: strength, now: NOW });
    expect(r.ok).toBe(true);
    expect(r.perDay).toBeCloseTo(0.1, 5); // 1.0 dKH over 10 days
  });

  test("a rising parameter is reported as not consuming, not as a negative", () => {
    // "-0.05 dKH/day of consumption" is a sentence nobody can act on.
    const waterTests = [test1(day(10), 8.0), test1(day(5), 8.4), test1(day(0), 8.8)];
    const r = consumptionRate({ key: "alk", waterTests, doses: [], ratedGallons: gallons, strengthPerUnit: strength, now: NOW });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/holding or rising/i);
  });

  test("it refuses to guess from too few tests", () => {
    const waterTests = [test1(day(10), 9.0), test1(day(0), 8.0)];
    const r = consumptionRate({ key: "alk", waterTests, doses: [], ratedGallons: gallons, strengthPerUnit: strength, now: NOW });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(new RegExp(`${MIN_TESTS} tests`));
  });

  test("it refuses to guess from too short a span", () => {
    // Two readings a day apart are test-kit error, not a trend.
    const waterTests = [test1(day(2), 9.0), test1(day(1), 8.7), test1(day(0), 8.4)];
    const r = consumptionRate({ key: "alk", waterTests, doses: [], ratedGallons: gallons, strengthPerUnit: strength, now: NOW });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(new RegExp(`${MIN_SPAN_DAYS} days`));
  });

  test("dosing without a product strength is refused rather than mis-measured", () => {
    // Ignoring the dosing would report a tank that's holding steady as one that
    // consumes nothing, which is the opposite of the truth.
    const waterTests = [test1(day(10), 8.0), test1(day(5), 8.0), test1(day(0), 8.0)];
    const doses = [{ key: "alk", ml: 200, date: day(5) }];
    const r = consumptionRate({ key: "alk", waterTests, doses, ratedGallons: gallons, strengthPerUnit: null, now: NOW });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/product strength/i);
  });

  test("without a strength but also without dosing, the decline still counts", () => {
    const waterTests = [test1(day(10), 9.0), test1(day(5), 8.5), test1(day(0), 8.0)];
    const r = consumptionRate({ key: "alk", waterTests, doses: [], ratedGallons: gallons, strengthPerUnit: null, now: NOW });
    expect(r.ok).toBe(true);
    expect(r.perDay).toBeCloseTo(0.1, 5);
  });

  test("readings older than the window are ignored", () => {
    const waterTests = [test1(day(200), 20), test1(day(10), 9.0), test1(day(5), 8.5), test1(day(0), 8.0)];
    const r = consumptionRate({ key: "alk", waterTests, doses: [], ratedGallons: gallons, strengthPerUnit: strength, now: NOW });
    expect(r.days).toBe(10);
    expect(r.samples).toBe(3);
  });

  test("tests missing this parameter don't count as samples", () => {
    const waterTests = [
      { date: day(10), values: { nitrate: 5 } },
      test1(day(8), 9.0), test1(day(4), 8.5), test1(day(0), 8.0),
    ];
    const r = consumptionRate({ key: "alk", waterTests, doses: [], ratedGallons: gallons, strengthPerUnit: strength, now: NOW });
    expect(r.samples).toBe(3);
    expect(r.days).toBe(8);
  });
});

describe("the maintenance dose", () => {
  test("is the amount that replaces exactly what's consumed", () => {
    // 0.1 dKH/day on 90 real gallons at 0.05 dKH per ml per gallon → 180ml/day.
    expect(maintenanceDose({ perDay: 0.1, ratedGallons: 100, strengthPerUnit: 0.05 })).toBe(180);
  });

  test("accounts for displacement, not the rated size", () => {
    // Dosing for 100 gallons when the tank holds 90 overshoots by ~11%.
    expect(actualWaterVolume(100)).toBe(90);
    const forRated = (0.1 * 100) / 0.05;
    expect(maintenanceDose({ perDay: 0.1, ratedGallons: 100, strengthPerUnit: 0.05 })).toBeLessThan(forRated);
  });

  test("returns nothing rather than a fake number when an input is missing", () => {
    expect(maintenanceDose({ perDay: 0.1, ratedGallons: 100, strengthPerUnit: 0 })).toBeNull();
    expect(maintenanceDose({ perDay: 0, ratedGallons: 100, strengthPerUnit: 0.05 })).toBeNull();
    expect(maintenanceDose({ perDay: 0.1, ratedGallons: 0, strengthPerUnit: 0.05 })).toBeNull();
  });
});

describe("how it reads", () => {
  test("a measured rate says what it measured and over how long", () => {
    const rate = { ok: true, perDay: 0.09, days: 12 };
    expect(describeConsumption("alk", rate)).toBe("Using about 0.09 dKH/day, measured over 12 days");
  });

  test("an unmeasurable rate explains itself instead of showing a blank", () => {
    expect(describeConsumption("alk", { ok: false, reason: "Log 3 tests" })).toBe("Log 3 tests");
    expect(describeConsumption("alk", null)).toBe("Not enough data yet");
  });
});

describe("the log itself", () => {
  const doses = [
    { key: "alk", ml: 20, date: "2026-08-10" },
    { key: "calcium", ml: 15, date: "2026-08-10" },
    { key: "alk", ml: 20, date: "2026-08-09" },
  ];

  test("groups by day, newest first, totalling each supplement", () => {
    const rows = recentDoseDays(doses);
    expect(rows[0].date).toBe("2026-08-10");
    expect(rows[0].totals).toEqual({ alk: 20, calcium: 15 });
    expect(rows[1].totals).toEqual({ alk: 20 });
  });

  test("two doses of the same thing on one day add up", () => {
    const rows = recentDoseDays([...doses, { key: "alk", ml: 5, date: "2026-08-10" }]);
    expect(rows[0].totals.alk).toBe(25);
  });

  test("reports which supplements have been dosed today", () => {
    expect(dosedToday(doses, "2026-08-10").sort()).toEqual(["alk", "calcium"]);
    expect(dosedToday(doses, "2026-08-08")).toEqual([]);
  });
});
