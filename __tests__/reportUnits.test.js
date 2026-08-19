jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import fs from "fs";
import path from "path";
import { buildTankReport } from "../lib/report";
import { setUnit } from "../lib/units";

const ROOT = path.join(__dirname, "..");
const day = (n) => {
  const x = new Date(Date.now() - n * 86400000);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

const tank = () => ({
  id: "t1", name: "Living Room Reef", gallons: 75, water: "salt",
  createdAt: new Date(Date.now() - 400 * 86400000).toISOString(),
  stock: ["Ocellaris Clownfish"], quantities: {},
  waterTests: [{ date: day(0), water: "salt", values: { temp: 78, alk: 8.4, calcium: 420, nitrate: 5 } }],
  waterChanges: [{ id: "w1", date: day(5), pct: 25, gallons: 19 }],
  journal: [], losses: [], equipment: [], inventory: [], doses: [], feedings: [],
  costs: [], maintenance: {}, upkeep: [], observations: {}, stockMeta: {},
});

afterEach(() => setUnit("imperial"));

describe("a metric keeper's report is in their units, with the right numbers", () => {
  // App passed unitLabel: "L" and nothing converted the number, so a 75 gallon
  // tank was reported as "75 L". 75 gallons is 284 L — the document a keeper
  // hands to a shop or posts on a forum understated their tank fourfold.
  test("volume is converted, not just relabelled", () => {
    setUnit("metric");
    const out = buildTankReport(tank(), {});
    expect(out).toContain("284 L");
    expect(out).not.toMatch(/Volume: 75 L/);
  });

  test("imperial is unchanged", () => {
    const out = buildTankReport(tank(), {});
    expect(out).toContain("75 gal");
  });

  test("water-change volume is converted too", () => {
    setUnit("metric");
    const out = buildTankReport(tank(), {});
    // 19 gal is 72 L, and it appears in the same sentence as a percentage.
    expect(out).toMatch(/Changed in 30 days: 72 L/);
    expect(out).not.toMatch(/Changed in 30 days: 19 L/);
  });

  test("temperature is shown in the unit the keeper reads", () => {
    // The report printed °F to everyone, so a metric keeper's own report
    // disagreed with every other screen in their app.
    setUnit("metric");
    const out = buildTankReport(tank(), {});
    expect(out).toMatch(/Temp: 26 °C/);
    expect(out).not.toContain("°F");
  });

  test("the temperature target is converted with it", () => {
    // A converted reading beside an unconverted target is worse than neither:
    // 26 against "74-82" reads as dangerously cold.
    setUnit("metric");
    const out = buildTankReport(tank(), {});
    const line = out.split("\n").find((l) => l.startsWith("Temp:"));
    expect(line).toMatch(/target 23–28°C/);
  });

  test("imperial temperature is untouched", () => {
    const out = buildTankReport(tank(), {});
    expect(out).toMatch(/Temp: 78 °F/);
    expect(out).toMatch(/target 74–82°F/);
  });

  test("parameters that have no metric form are unaffected", () => {
    setUnit("metric");
    const out = buildTankReport(tank(), {});
    expect(out).toMatch(/Alk: 8\.4 dKH/);
    expect(out).toMatch(/Calcium: 420 ppm/);
    expect(out).toMatch(/Nitrate: 5 ppm/);
  });
});

describe("the caller can no longer pass a label that lies", () => {
  test("buildTankReport does not take unitLabel", () => {
    const src = fs.readFileSync(path.join(ROOT, "lib/report.js"), "utf8");
    expect(src).not.toMatch(/unitLabel = "gal"/);
    expect(src).toContain("formatVolume(tank.gallons)");
  });

  test("App no longer passes one", () => {
    const app = fs.readFileSync(path.join(ROOT, "App.js"), "utf8");
    expect(app).not.toMatch(/unitLabel: unit === "metric"/);
  });

  test("the unit is read at build time, so switching it changes the report", () => {
    const before = buildTankReport(tank(), {});
    setUnit("metric");
    const after = buildTankReport(tank(), {});
    expect(after).not.toBe(before);
  });
});
