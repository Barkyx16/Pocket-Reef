jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import fs from "fs";
import path from "path";
import { getTankWarnings, getCareTips, tempRange } from "../core";
import { setUnit } from "../lib/units";

const ROOT = path.join(__dirname, "..");
const FILES = ["core.js", "App.js", ...["components", "screens", "lib"].flatMap((dir) =>
  fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".js")).map((f) => path.join(dir, f)))];

afterEach(() => setUnit("imperial"));

describe("the advice is in the keeper's units, not just the chrome", () => {
  // units.js reached the components and never reached the engines. A metric
  // keeper was told "needs at least 30 gallons, held at 72-82°F" by the
  // stocking check, the care tips, the what-if planner and the heater sizing —
  // the sentences the app exists to produce.
  const fish = { name: "Yellow Tang", minGallons: 75, tempMinF: 72, tempMaxF: 82,
                 adultInches: 8, kind: "fish", careLevel: "Moderate", water: "salt" };

  test("a stocking warning converts both volumes", () => {
    setUnit("metric");
    const w = getTankWarnings(40, ["Yellow Tang"], {});
    const text = JSON.stringify(w);
    expect(text).toContain("L");
    expect(text).not.toMatch(/\d+ gal\b/);
  });

  test("care tips convert the volume and the temperature together", () => {
    setUnit("metric");
    const tips = getCareTips(fish).join(" | ");
    expect(tips).toMatch(/284 L/);
    expect(tips).toMatch(/°C/);
    expect(tips).not.toContain("°F");
    expect(tips).not.toMatch(/\bgallons\b/);
  });

  test("imperial is untouched", () => {
    const tips = getCareTips(fish).join(" | ");
    expect(tips).toMatch(/75 gal/);
    expect(tips).toMatch(/72–82°F/);
  });

  test("tempRange follows the setting", () => {
    expect(tempRange(fish)).toBe("72–82°F");
    setUnit("metric");
    expect(tempRange(fish)).toBe("22–28°C");
  });
});

describe("no prose builds a unit by hand", () => {
  // The check is deliberately narrow: an interpolation with a unit glued to it,
  // which is the shape every one of these bugs had.
  const ALLOWED = new Set([
    // Gives both units on purpose, because a medication label may use either.
    "lib/meds.js",
    // The formatters themselves.
    "lib/units.js",
  ]);

  test("no interpolated value is followed by a hardcoded unit", () => {
    const offenders = [];
    for (const f of FILES) {
      if (ALLOWED.has(f)) continue;
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      src.split("\n").forEach((line, i) => {
        const s = line.trim();
        if (s.startsWith("//") || s.startsWith("*")) return;
        if (/\$\{[^}]{1,60}\}\s*(gal\b|gallons\b|°F\b|°C\b)/.test(line)) {
          offenders.push(`${f}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  test("the exemptions are still exemptions, not a growing list", () => {
    // Two entries, each for a stated reason. A list that grows is how this
    // comes back.
    expect(ALLOWED.size).toBe(2);
    expect(fs.readFileSync(path.join(ROOT, "lib/meds.js"), "utf8")).toContain("27°C / 80°F");
  });

  test("the walker actually reads the files", () => {
    expect(FILES.length).toBeGreaterThan(100);
  });
});
