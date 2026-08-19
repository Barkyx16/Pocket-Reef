jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import fs from "fs";
import path from "path";
import { levelFromXp, BANNERS } from "../core";
import { setUnit, getUnit } from "../lib/units";
import { setCurrency, getCurrency } from "../lib/currency";
import { setLanguage, getLanguage } from "../lib/i18n";

const ROOT = path.join(__dirname, "..");

describe("XP that isn't a number", () => {
  // XP arrives from a restored backup, a synced profile, or storage written by
  // an older build. The import guard was `typeof p.xp === "number"` — and
  // typeof NaN is "number".
  test("NaN doesn't become a NaN level and a NaN progress bar", () => {
    const l = levelFromXp(NaN);
    expect(Number.isFinite(l.pct)).toBe(true);
    expect(Number.isFinite(l.toNext)).toBe(true);
    expect(l.level).toBe(1);
  });

  test("negative XP doesn't draw a bar at -1000%", () => {
    const l = levelFromXp(-500);
    expect(l.pct).toBeGreaterThanOrEqual(0);
    expect(l.pct).toBeLessThanOrEqual(100);
  });

  test("every junk value yields a drawable bar", () => {
    for (const xp of [NaN, -1, -1e9, Infinity, -Infinity, null, undefined, "abc", {}, []]) {
      const l = levelFromXp(xp);
      expect(l.pct).toBeGreaterThanOrEqual(0);
      expect(l.pct).toBeLessThanOrEqual(100);
      expect(Number.isFinite(l.toNext)).toBe(true);
      expect(l.level).toBeGreaterThanOrEqual(1);
    }
  });

  test("a real number still behaves exactly as before", () => {
    const l = levelFromXp(500);
    expect(l.level).toBeGreaterThan(1);
    expect(l.pct).toBeGreaterThanOrEqual(0);
    // A numeric string is a legitimate thing to find in old storage.
    expect(levelFromXp("500").level).toBe(l.level);
  });
});

describe("a preference and its React copy cannot disagree", () => {
  // Each of these lives in two places: a module singleton the formatters read,
  // and React state the picker renders. The singleton validated its input and
  // the state stored whatever it was handed, so a junk value from an import
  // left the module on the default while the state — and storage, and the next
  // sync — carried the junk. No pill looked selected and nothing explained why.
  afterEach(() => { setUnit("imperial"); setCurrency("USD"); setLanguage("en"); });

  test("units reject what they don't know", () => {
    setUnit("banana");
    expect(getUnit()).toBe("imperial");
    setUnit("metric");
    expect(getUnit()).toBe("metric");
  });

  test("currency rejects what it doesn't know", () => {
    setCurrency("XYZ");
    expect(getCurrency()).toBe("USD");
    setCurrency("GBP");
    expect(getCurrency()).toBe("GBP");
  });

  test("language rejects what it doesn't know", () => {
    setLanguage("kl");
    expect(getLanguage()).toBe("en");
    setLanguage("es");
    expect(getLanguage()).toBe("es");
  });

  test("App reads the accepted value back rather than echoing the input", () => {
    const app = fs.readFileSync(path.join(ROOT, "App.js"), "utf8");
    // The specific shape of the bug: state set from the raw argument.
    expect(app).not.toMatch(/setUnit\(\w+\); setUnitState\(\w+\)/);
    expect(app).not.toMatch(/setCurrency\(\w+\); setCurrencyState\(\w+\)/);
    expect(app).not.toMatch(/setLanguage\(\w+\); setLangState\(\w+\)/);
    expect(app).toContain("setUnitState(getUnit())");
    expect(app).toContain("setCurrencyState(getCurrency())");
    expect(app).toContain("setLangState(getLanguage())");
  });

  test("every entry point reads back, not just the picker", () => {
    // Hydration, the sync snapshot and the picker all set these.
    const app = fs.readFileSync(path.join(ROOT, "App.js"), "utf8");
    expect((app.match(/setUnitState\(getUnit\(\)\)/g) || []).length).toBeGreaterThanOrEqual(3);
    expect((app.match(/setCurrencyState\(getCurrency\(\)\)/g) || []).length).toBeGreaterThanOrEqual(3);
  });
});

describe("import validates values, not just types", () => {
  const app = fs.readFileSync(path.join(ROOT, "App.js"), "utf8");

  test("XP is checked for being finite, not merely a number", () => {
    expect(app).not.toContain('if (typeof p.xp === "number") setXp(p.xp)');
    expect(app).toContain("Number.isFinite(p.xp)");
  });

  test("a banner id is checked against the catalogue", () => {
    // An unknown id leaves the profile hero with no banner at all.
    expect(app).toMatch(/BANNERS\.some\(\(b\) => b\.id === p\.bannerId\)/);
    expect(BANNERS.some((b) => b.id === "reef")).toBe(true);
    expect(BANNERS.some((b) => b.id === "nope")).toBe(false);
  });

  test("careDone must be a map, since it is read as one", () => {
    expect(app).toMatch(/p\.careDone && typeof p\.careDone === "object" && !Array\.isArray\(p\.careDone\)/);
  });

  test("day keys are validated before they reach the streak engine", () => {
    expect(app).toMatch(/p\.activeDays\.filter\(\(d\) => isValidDayKey\(d\)\)/);
  });

  test("species-name lists drop entries that aren't names", () => {
    for (const field of ["wishlist", "recent"]) {
      expect(app).toMatch(new RegExp(`p\\.${field}\\.filter\\(\\(n\\) => typeof n === "string"`));
    }
  });
});
