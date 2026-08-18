const { buildTankReport, tankAge } = require("../lib/report");
const { setActiveTargets } = require("../lib/targets");

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


const NOW = new Date("2026-08-09T12:00:00Z");
const day = (n) => localDay(NOW.getTime() - n * 86400000);

afterEach(() => setActiveTargets({}));

const TANK = {


  id: "t1", name: "The Reef", gallons: 90, water: "salt", emoji: "🐠",
  createdAt: new Date(NOW.getTime() - 700 * 86400000).toISOString(),
  stock: ["Ocellaris Clownfish", "Royal Gramma"],
  quantities: { "Ocellaris Clownfish": 2 },
  stockMeta: {
    "Ocellaris Clownfish": { addedAt: day(650), source: "Blue Reef", price: 30, notes: "Hosts the anemone" },
    "Royal Gramma": { addedAt: day(90), source: "Coral Cove", price: 45 },
  },
  losses: [
    { id: "1", name: "Blue Tang", reason: "died", cause: "Disease", count: 1, date: day(30), tenure: "4 months", price: 80 },
    { id: "2", name: "Chromis", reason: "rehomed", cause: null, count: 3, date: day(60), tenure: "1 year" },
  ],
  waterTests: [
    { date: day(1), water: "salt", values: { ammonia: 0, nitrate: 25, ph: 8.1, alk: 8.4 } },
  ],
  // A real instant, which is what markJobDone actually stores. The previous
  // fixture pasted a LOCAL day-key in front of a hardcoded UTC time — a shape
  // the app never produces, and one whose age changes with the device timezone.
  maintenance: { waterchange: new Date(NOW.getTime() - 4 * 86400000).toISOString() },
  journal: [{ id: 1, date: day(2), text: "Tang started scratching", mood: "😟", photo: null }],
  treatments: [{ disease: "Ich (White Spot)", startedAt: `${day(3)}T09:00:00.000Z`, doneSteps: ["a", "b"] }],
  targets: {},
  costs: [],
};

describe("tank age", () => {
  test("reads in the unit a keeper would say", () => {
    expect(tankAge(new Date(NOW.getTime() - 20 * 86400000), NOW)).toBe("20 days");
    expect(tankAge(new Date(NOW.getTime() - 200 * 86400000), NOW)).toBe("7 months");
    // Past 18 months it switches to years — "23 months" is a number you have
    // to do arithmetic on to picture.
    expect(tankAge(new Date(NOW.getTime() - 700 * 86400000), NOW)).toBe("1.9 years");
    expect(tankAge(new Date(NOW.getTime() - 1000 * 86400000), NOW)).toBe("2.7 years");
    expect(tankAge(null)).toBeNull();
    expect(tankAge("nonsense")).toBeNull();
  });
});

describe("tank report", () => {
  const report = () => buildTankReport(TANK, { now: NOW });

  test("answers the questions a fish store asks first", () => {
    const r = report();
    // How big, what type, how long has it been running.
    expect(r).toContain("Volume: 90 gal");
    expect(r).toContain("Type: Saltwater");
    expect(r).toContain("Running for: 1.9 years");
  });

  test("prints each reading next to the target it is being judged by", () => {
    // A bare "nitrate 25" means nothing to a reader who doesn't know what the
    // keeper is aiming for.
    const r = report();
    expect(r).toContain("Nitrate: 25 ppm   (target < 20 ppm)");
    // 25 is inside the reef caution band (20-40), so it flags as watch rather
    // than out of range — the report must not overstate the problem.
    expect(r).toContain("<-- watch");
    expect(r).toContain("pH: 8.1");
  });

  test("uses the tank's own targets and says so", () => {
    const custom = { ...TANK, targets: { nitrate: { good: [2, 5], caution: [0, 10] } } };
    const r = buildTankReport(custom, { now: NOW });
    expect(r).toContain("(target 2–5 ppm)");
    expect(r).toContain("1 target set for this tank, not app defaults");
  });

  test("lists livestock with how long each has been kept", () => {
    const r = report();
    expect(r).toContain("2x Ocellaris Clownfish");
    expect(r).toContain("from Blue Reef");
    expect(r).toContain("Hosts the anemone");
    // Tenure is the most useful single fact — two years rules out a whole
    // class of answers about acclimation.
    expect(r).toMatch(/Ocellaris Clownfish \(kept 1y/);
  });

  test("includes the loss history and separates deaths from rehomings", () => {
    const r = report();
    expect(r).toContain("1 lost in the last year, mostly disease.");
    expect(r).toContain("Blue Tang — died");
    expect(r).toContain("3x Chromis — rehomed");
  });

  test("declares treatments already in the water", () => {
    // A shop recommending a medication needs to know what's already dosed.
    expect(report()).toContain("Ich (White Spot) — started");
  });

  test("reports upkeep in words a human reads, not raw task ids", () => {
    // It used to paste "waterchange: 2026-08-06" — an internal key and a bare
    // date, leaving the reader to work out whether that was recent.
    const r = report();
    expect(r).toContain("UPKEEP");
    expect(r).toContain("Water change: Done 4d ago");
    expect(r).not.toContain("waterchange:");
    expect(r).toContain("Tang started scratching");
  });

  test("leads with how many jobs are overdue", () => {
    const overdue = {
      ...TANK,
      maintenance: { waterchange: `${day(30)}T10:00:00.000Z`, skimmerclean: `${day(40)}T10:00:00.000Z` },
    };
    const r = buildTankReport(overdue, { now: NOW });
    expect(r).toMatch(/\d+ jobs? overdue\./);
  });

  test("is plain text a forum or a text message can carry", () => {
    const r = report();
    expect(r).not.toContain("{");
    expect(r).not.toMatch(/<[a-zA-Z/]/); // no markup; "< 20 ppm" and "<--" are fine
  });

  test("a brand-new empty tank still produces something coherent", () => {
    const empty = { name: "New", gallons: 20, water: "fresh", stock: [], quantities: {}, stockMeta: {}, losses: [], waterTests: [], journal: [], maintenance: {}, treatments: [], targets: {} };
    const r = buildTankReport(empty, { now: NOW });
    expect(r).toContain("Stock: Empty");
    // No empty section headers dangling with nothing under them.
    expect(r).not.toContain("LIVESTOCK");
    expect(r).not.toContain("HISTORY");
    expect(r.length).toBeGreaterThan(40);
  });

  test("survives a null tank rather than throwing", () => {
    expect(buildTankReport(null)).toBe("");
  });
});
