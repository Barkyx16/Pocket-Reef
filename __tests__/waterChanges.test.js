
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

const {
  newWaterChange, volumeIn, turnoverIn, cadenceCheck,
  daysSinceLast, averageChange, summarise,
} = require("../lib/waterChanges");

const DAY = 86400000;
const NOW = new Date("2026-08-11T12:00:00Z").getTime();
const day = (n) => localDay(NOW - n * DAY);



describe("recording a change", () => {
  test("a percentage alone is enough", () => {
    const w = newWaterChange({ pct: 25 });
    expect(w.pct).toBe(25);
    expect(w.gallons).toBeNull();
    expect(w.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("a volume alone is enough", () => {
    expect(newWaterChange({ gallons: 30 }).gallons).toBe(30);
  });

  test("neither is refused — the maintenance tick already covers 'I did one'", () => {
    // An empty record would only dilute the totals it exists to produce.
    expect(newWaterChange({})).toBeNull();
    expect(newWaterChange({ pct: 0, gallons: 0 })).toBeNull();
    expect(newWaterChange({ pct: "abc" })).toBeNull();
  });

  test("a nonsense percentage is clamped, not stored", () => {
    expect(newWaterChange({ pct: 150 }).pct).toBe(100);
    expect(newWaterChange({ gallons: -5, pct: 10 }).gallons).toBeNull();
  });
});

describe("how much water actually moved", () => {
  const changes = [
    { id: "1", date: day(2), gallons: 30 },
    { id: "2", date: day(9), gallons: 30 },
    { id: "3", date: day(16), pct: 25 },   // 25% of 120 = 30
    { id: "4", date: day(60), gallons: 99 }, // outside the window
  ];

  test("volume totals the window, converting percentages by tank size", () => {
    expect(volumeIn(changes, 30, { tankGallons: 120, now: NOW })).toBe(90);
  });

  test("a percentage with no tank size can't be counted rather than guessed", () => {
    expect(volumeIn([{ date: day(1), pct: 25 }], 30, { tankGallons: 0, now: NOW })).toBe(0);
  });

  test("turnover expresses it as a share of the tank", () => {
    // 90 gallons on a 120 gallon tank across a month.
    expect(turnoverIn(changes, 30, { tankGallons: 120, now: NOW })).toBe(75);
  });

  test("turnover is unknowable without a tank size", () => {
    expect(turnoverIn(changes, 30, { tankGallons: 0, now: NOW })).toBeNull();
  });

  test("the average size is what was done, not what was intended", () => {
    // Windowed to 30 days, so the 60-day-old outlier is excluded — the same
    // window the volume figures beside it use.
    expect(averageChange(changes, { tankGallons: 120, now: NOW })).toBe(25);
  });
});

describe("keeping to a cadence", () => {
  test("weekly changes over four weeks read as on track", () => {
    const changes = [0, 7, 14, 21].map((n) => ({ date: day(n), pct: 10 }));
    const c = cadenceCheck(changes, { everyDays: 7, days: 28, now: NOW });
    expect(c.ok).toBe(true);
    expect(c.reason).toMatch(/on track/);
  });

  test("falling behind says what happened, not a score", () => {
    // "62% adherence" invites gaming the number rather than changing water.
    const c = cadenceCheck([{ date: day(3), pct: 10 }], { everyDays: 7, days: 28, now: NOW });
    expect(c.ok).toBe(false);
    expect(c.actual).toBe(1);
    expect(c.expected).toBe(4);
    expect(c.reason).not.toMatch(/%/);
  });

  test("no schedule means no judgement", () => {
    expect(cadenceCheck([], { everyDays: 0, now: NOW }).ok).toBe(true);
  });

  test("the gap since the last one is reported honestly when there is none", () => {
    expect(daysSinceLast([], NOW)).toBeNull();
    expect(daysSinceLast([{ date: day(5) }], NOW)).toBe(5);
  });
});

describe("the summary", () => {
  test("a real history answers the questions the journal prose couldn't", () => {
    const changes = [
      { id: "1", date: day(2), gallons: 30 },
      { id: "2", date: day(9), gallons: 30 },
    ];
    const s = summarise(changes, { tankGallons: 120, everyDays: 7, now: NOW });
    expect(s.count).toBe(2);
    expect(s.last).toBe(2);
    expect(s.volume30).toBe(60);
    expect(s.turnover30).toBe(50);
    expect(s.average).toBe(25);
  });

  test("an empty history doesn't throw or invent numbers", () => {
    const s = summarise([], { tankGallons: 120, now: NOW });
    expect(s.count).toBe(0);
    expect(s.last).toBeNull();
    expect(s.volume30).toBe(0);
    expect(s.average).toBeNull();
  });

  test("garbage in doesn't throw", () => {
    expect(() => summarise([null, {}, { date: "nope" }], { tankGallons: 120, now: NOW })).not.toThrow();
  });
});

describe("it reaches the places that ask", () => {
  const fs = require("fs");
  const path = require("path");
  const { buildTankReport } = require("../lib/report");

  const TANK = {
    name: "The Reef", gallons: 120, water: "salt",
    createdAt: new Date(NOW - 400 * DAY).toISOString(),
    stock: [], quantities: {}, stockMeta: {}, losses: [], journal: [], costs: [],
    waterTests: [], maintenance: {}, quarantine: [], feedings: [], treatments: [],
    targets: {}, upkeep: [], doses: [], equipment: [],
    waterChanges: [
      { id: "1", date: day(2), gallons: 30 },
      { id: "2", date: day(9), gallons: 30 },
    ],
  };

  test("the report answers how much and how recently", () => {
    const r = buildTankReport(TANK, { now: new Date(NOW) });
    expect(r).toContain("WATER CHANGES");
    expect(r).toContain("Last change: 2 days ago");
    expect(r).toContain("Changed in 30 days: 60 gal");
    expect(r).toContain("50% of volume");
  });

  test("a tank with no recorded changes omits the section", () => {
    const r = buildTankReport({ ...TANK, waterChanges: [] }, { now: new Date(NOW) });
    expect(r).not.toContain("WATER CHANGES");
  });

  test("logging one writes a record, not just prose", () => {
    const APP = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");
    const body = APP.slice(APP.indexOf("const logWaterChange"), APP.indexOf("const deleteDose"));
    expect(body).toContain("newWaterChange(");
    expect(body).toContain("waterChanges:");
    // The tick still happens — it's what drives the due date.
    expect(body).toContain('markJobDone(activeTankId, "waterchange"');
  });

  test("the Log tab no longer keeps its own prose-only version", () => {
    const LOG = fs.readFileSync(path.join(__dirname, "..", "screens", "LogTab.js"), "utf8");
    expect(LOG).not.toContain("const logWaterChange = (info) =>");
    expect(LOG).toContain("onLogWaterChange={onLogWaterChange}");
  });
});
