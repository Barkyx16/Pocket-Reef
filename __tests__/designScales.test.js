import fs from "fs";
import path from "path";
import { type, radius, space, elevation, theme } from "../styles";

const ROOT = path.join(__dirname, "..");
const FILES = ["components", "screens"].flatMap((dir) =>
  fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".js")).map((f) => path.join(dir, f)));

const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const raw = (re) => FILES.flatMap((f) => [...read(f).matchAll(re)].map((m) => ({ f, v: Number(m[1]) })));

describe("the app works from a scale", () => {
  // Measured before this: 37 distinct font sizes and 27 border radii. Thirteen
  // of the sizes sat between 9 and 15pt — thirteen answers to "small text" —
  // and seven of those were half-points. That is the residue of nudging one
  // screen at a time, and it is the difference between a design that was drawn
  // and one that accumulated.
  test("no half-point font sizes survive", () => {
    // The clearest evidence nobody was working from a scale. Each moved by at
    // most 0.5pt, which is why it was safe to do without seeing the result.
    // One exemption, and it is a real one: the "LEVEL" caption above the
    // number in the profile ring is 8.5pt inside a fixed 76pt circle. The
    // nearest step is 10, a 1.5pt jump that would be visible and might not fit.
    // Left as a deliberate one-off rather than forced onto the scale.
    const EXEMPT = new Set(["components/ProfileHero.js:8.5"]);
    const halves = raw(/fontSize: ([\d.]+)/g)
      .filter((x) => x.v !== Math.round(x.v) && x.v > 2)
      .map((x) => `${x.f}:${x.v}`)
      .filter((k) => !EXEMPT.has(k));
    expect(halves).toEqual([]);
  });

  test("most type goes through the scale", () => {
    const total = FILES.reduce((n, f) => n + (read(f).match(/fontSize:/g) || []).length, 0);
    const tokened = FILES.reduce((n, f) => n + (read(f).match(/fontSize: type\./g) || []).length, 0);
    expect(tokened / total).toBeGreaterThan(0.8);
  });

  test("most radii go through the scale", () => {
    const total = FILES.reduce((n, f) => n + (read(f).match(/borderRadius:/g) || []).length, 0);
    const tokened = FILES.reduce((n, f) => n + (read(f).match(/borderRadius: radius\./g) || []).length, 0);
    expect(tokened / total).toBeGreaterThan(0.8);
  });

  test("no raw number duplicates a scale step", () => {
    // A literal 12 beside a `type.small` that is also 12 is the drift starting
    // again: change the step and the literal silently stays behind. This is the
    // same trap the colour tokens hit, caught the same way.
    const steps = new Set(Object.values(type));
    const strays = raw(/fontSize: ([\d.]+)/g).filter((x) => steps.has(x.v));
    expect(strays.map((x) => `${x.f}:${x.v}`)).toEqual([]);

    const rSteps = new Set(Object.values(radius));
    const rStrays = raw(/borderRadius: (\d+)\b/g).filter((x) => rSteps.has(x.v));
    expect(rStrays.map((x) => `${x.f}:${x.v}`)).toEqual([]);
  });
});

describe("the scales themselves are coherent", () => {
  test("type steps ascend and are all whole numbers", () => {
    const v = Object.values(type);
    expect(v).toEqual([...v].sort((a, b) => a - b));
    for (const n of v) expect(Number.isInteger(n)).toBe(true);
    expect(new Set(v).size).toBe(v.length);
  });

  test("a scale small enough to force a decision about hierarchy", () => {
    // A step for every occasion is the same as no scale.
    expect(Object.keys(type).length).toBeLessThanOrEqual(12);
    expect(Object.keys(radius).length).toBeLessThanOrEqual(10);
  });

  test("spacing is a 4pt grid", () => {
    for (const n of Object.values(space)) expect(n % 4).toBe(0);
  });

  test("elevation has few enough levels that depth means something", () => {
    expect(Object.keys(elevation)).toEqual(["none", "card", "floating"]);
    expect(elevation.floating.shadowRadius).toBeGreaterThan(elevation.card.shadowRadius);
  });

  test("the colour tokens are still the ones in use", () => {
    // 1400+ references; this is the one part of the system that was adopted.
    const uses = FILES.reduce((n, f) => n + (read(f).match(/\btheme\./g) || []).length, 0);
    expect(uses).toBeGreaterThan(1000);
    expect(theme.accent).toBeTruthy();
  });
});
