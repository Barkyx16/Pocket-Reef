import { planDose, actualWaterVolume, REEF_TARGETS } from "../lib/dosing";
import { planMedDose } from "../lib/meds";

// Every existing dosing test asserted the shape — totalMl > 0, perDayMl <
// totalMl, zero when already at target. None asserted the SIZE, which is why
// the formula could divide by volume where it multiplies and stay green.
//
// These check against real product labels, which is the only honest way to
// know a dosing figure is right.

describe("a supplement dose matches the label arithmetic", () => {
  // Seachem Reef Carbonate: 5 ml per 20 US gallons raises alkalinity 2.8 dKH.
  // The field asks for "dKH raised per ml, per gallon", so one ml in one gallon
  // raises it by 2.8 * (20 / 5) = 11.2.
  const STRENGTH = 11.2;

  test("raising a 100 gallon tank by 1.5 dKH takes about 12 ml", () => {
    // Straight from the label: 5 ml * (90/20) is one full 2.8 dKH dose for this
    // volume, so 1.5 dKH is 5 * (90/20) * (1.5/2.8) = 12.05 ml.
    const p = planDose({ key: "alk", current: 7, ratedGallons: 100, strengthPerUnit: STRENGTH });
    expect(p.ok).toBe(true);
    expect(p.needed).toBe(1.5);
    expect(p.volume).toBe(90);          // rock and sand displace the rest
    expect(p.totalMl).toBeCloseTo(12.05, 1);
  });

  test("it was out by the square of the volume", () => {
    // The old formula was needed / strength / volume, which on this tank is
    // 0.0015 ml — 8,100 times too small. A keeper doses that, nothing moves,
    // and the tool looks like it worked.
    const p = planDose({ key: "alk", current: 7, ratedGallons: 100, strengthPerUnit: STRENGTH });
    const oldFormula = 1.5 / STRENGTH / 90;
    expect(p.totalMl / oldFormula).toBeCloseTo(90 * 90, -2);
  });

  test("doubling the tank doubles the dose", () => {
    const small = planDose({ key: "alk", current: 7, ratedGallons: 50, strengthPerUnit: STRENGTH });
    const big = planDose({ key: "alk", current: 7, ratedGallons: 100, strengthPerUnit: STRENGTH });
    expect(big.totalMl / small.totalMl).toBeCloseTo(2, 1);
  });

  test("halving the strength doubles the dose", () => {
    const strong = planDose({ key: "alk", current: 7, ratedGallons: 100, strengthPerUnit: STRENGTH });
    const weak = planDose({ key: "alk", current: 7, ratedGallons: 100, strengthPerUnit: STRENGTH / 2 });
    expect(weak.totalMl / strong.totalMl).toBeCloseTo(2, 1);
  });

  test("nothing to do when the reading is already there", () => {
    const p = planDose({ key: "alk", current: 9, ratedGallons: 100, strengthPerUnit: STRENGTH });
    expect(p.totalMl).toBe(0);
    expect(p.alreadyThere).toBe(true);
  });

  test("a big correction is spread, and never above the safe daily rise", () => {
    const p = planDose({ key: "alk", current: 4, ratedGallons: 100, strengthPerUnit: STRENGTH });
    expect(p.capped).toBe(true);
    expect(p.needed / p.days).toBeLessThanOrEqual(REEF_TARGETS.alk.safeDailyRise + 1e-9);
    expect(p.perDayMl).toBeLessThan(p.totalMl);
  });

  test("the dose is computed on real water, not the rated size", () => {
    // Rock, sand and the gap below the rim. Dosing the rated volume overdoses
    // every tank, every time.
    expect(actualWaterVolume(100)).toBeLessThan(100);
    const p = planDose({ key: "alk", current: 7, ratedGallons: 100, strengthPerUnit: STRENGTH });
    expect(p.volume).toBe(actualWaterVolume(100));
  });
});

describe("the medication calculator, checked the same way", () => {
  // Not changed — verified. "5 ml per 10 gallons" on a 100 gallon tank is
  // (5/10) * 90 = 45 ml, and that is what it returns.
  test("a label dose scales to the real volume", () => {
    const p = planMedDose({ labelDose: 5, labelPer: 10, ratedGallons: 100 });
    expect(p.ok).toBe(true);
    expect(p.actualGallons).toBe(90);
    expect(p.fullDose).toBeCloseTo(45, 1);
  });

  test("a top-up after a water change replaces only what left", () => {
    const p = planMedDose({ labelDose: 5, labelPer: 10, ratedGallons: 100, waterChangePct: 25 });
    expect(p.topUp).toBeCloseTo(11.25, 1);
  });
});
