// Numbers the app will and won't believe.
//
// Water readings have been plausibility-checked since early on — a pH of 78
// never reaches storage. Nothing else was. None of these inputs crashed
// anything; they produced confident nonsense, which is worse, because the app
// looks like it's working and every figure downstream is wrong.

const { boundedNumber, LIMITS } = require("../lib/bounds");
const { newInventoryItem } = require("../lib/inventory");
const { newEquipment } = require("../lib/equipment");
const { newObservation } = require("../lib/observations");
const { newDose } = require("../lib/dosingLog");
const { newWaterChange } = require("../lib/waterChanges");
const { newMedDose, planMedDose } = require("../lib/meds");

const ABSURD = 1e15;

describe("the bound itself", () => {
  test("accepts an ordinary value", () => {
    expect(boundedNumber(30, 5000)).toBe(30);
  });

  test("rejects rather than clamping", () => {
    // A clamped value is a number nobody typed, presented as one they did.
    expect(boundedNumber(999999, 5000)).toBeNull();
  });

  test("rejects the non-numeric, the negative and the infinite", () => {
    ["", null, undefined, "abc", -5, Infinity, NaN].forEach((v) => {
      expect(boundedNumber(v, 100)).toBeNull();
    });
  });

  test("zero is a real answer where it means something", () => {
    expect(boundedNumber(0, 100)).toBeNull();
    expect(boundedNumber(0, 100, { allowZero: true })).toBe(0);
  });
});

describe("records refuse absurd numbers", () => {
  test("an inventory item", () => {
    const i = newInventoryItem({ name: "Salt", kind: "salt", stock: ABSURD, perGallon: ABSURD, perDay: ABSURD });
    expect(i.stock).toBe(0);
    expect(i.perGallon).toBeNull();
    expect(i.perDay).toBeNull();
  });

  test("equipment — wattage drives the running-cost estimate", () => {
    const e = newEquipment({ name: "Pump", category: "flow", watts: ABSURD, price: ABSURD, warrantyMonths: ABSURD });
    expect(e.watts).toBeNull();
    expect(e.price).toBeNull();
    expect(e.warrantyMonths).toBeNull();
  });

  test("an observation's measurement", () => {
    expect(newObservation({ size: ABSURD })).toBeNull();
    expect(newObservation({ text: "fine", size: ABSURD }).size).toBeNull();
  });

  test("a supplement dose — it skews consumption forever, not just once", () => {
    expect(newDose({ key: "alk", ml: ABSURD })).toBeNull();
  });

  test("a medication dose", () => {
    expect(newMedDose({ name: "Copper", amount: ABSURD })).toBeNull();
  });

  test("a water change volume", () => {
    expect(newWaterChange({ pct: 25, gallons: ABSURD }).gallons).toBeNull();
  });
});

describe("the medication planner", () => {
  test("refuses label figures that would produce scientific notation", () => {
    const r = planMedDose({ labelDose: ABSURD, labelPer: 0.0001, ratedGallons: ABSURD });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/check the bottle/i);
  });

  test("and still answers an ordinary label", () => {
    const r = planMedDose({ labelDose: 5, labelPer: 10, ratedGallons: 75 });
    expect(r.ok).toBe(true);
    // No exponent anywhere near the number a keeper reads off the screen.
    expect(String(r.fullDose)).not.toMatch(/e\+/);
  });
});

describe("ordinary values still pass", () => {
  test("nothing a real keeper types is refused", () => {
    expect(newInventoryItem({ name: "Salt", kind: "salt", stock: 40, perGallon: 0.5 }).perGallon).toBe(0.5);
    expect(newEquipment({ name: "Heater", category: "heating", watts: 300, price: 45, warrantyMonths: 24 }).watts).toBe(300);
    expect(newObservation({ size: 2.5 }).size).toBe(2.5);
    expect(newDose({ key: "alk", ml: 12 }).ml).toBe(12);
    expect(newMedDose({ name: "Copper", amount: 8 }).amount).toBe(8);
    expect(newWaterChange({ pct: 25, gallons: 30 }).gallons).toBe(30);
  });

  test("a genuinely large system is not argued with", () => {
    // The ceilings catch typos, not people with 2,000 gallon builds.
    expect(newWaterChange({ pct: 25, gallons: 2000 }).gallons).toBe(2000);
    expect(newEquipment({ name: "Chiller", category: "heating", watts: 1500 }).watts).toBe(1500);
    expect(LIMITS.gallons).toBeGreaterThan(10000);
  });
});
