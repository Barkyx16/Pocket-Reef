jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import { getCycleStatus, getTodayActions } from "../core";

const day = (n) => {
  const x = new Date(Date.now() - n * 86400000);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const CLEAN = { ammonia: 0, nitrite: 0, nitrate: 5, alk: 8.5, ph: 8.1, temp: 78, salinity: 1.025 };
const t = (n, v) => ({ date: day(n), water: "salt", values: v });

describe("ammonia in an established tank is a crash, not a cycle", () => {
  // The two readings are identical and the advice is opposite. A cycling tank
  // is told "keep testing, don't add fish yet" — correct there, and it was what
  // a four-year-old reef at 2 ppm ammonia with fish in it was being told, where
  // waiting is how they die. The old check never looked past the newest
  // reading, so it had no way to tell the two apart.
  const established = [t(0, { ...CLEAN, ammonia: 2, nitrite: 1 }),
    ...Array.from({ length: 120 }, (_, i) => t((i + 1) * 10, CLEAN))];

  test("a spike after years of clean readings is called a spike", () => {
    const c = getCycleStatus(established);
    expect(c.crashed).toBe(true);
    expect(c.cycled).toBe(true);
    expect(c.label).toMatch(/spike/i);
  });

  test("and it says to act rather than to wait", () => {
    const c = getCycleStatus(established);
    expect(c.guidance).toMatch(/change water now/i);
    expect(c.guidance).toMatch(/Do not wait/i);
    expect(c.guidance).not.toMatch(/don't add fish yet/i);
  });

  test("it outranks everything else on Today", () => {
    // The only reading in the app that kills fish within hours.
    const acts = getTodayActions({
      tank: ["Ocellaris Clownfish"], waterTests: established,
      maintenance: { waterchange: day(2) }, waterType: "salt",
    });
    expect(acts[0].rank).toBe(0);
    expect(acts[0].text).toMatch(/spike in an established tank/i);
    expect(acts.some((a) => /still cycling/i.test(a.text))).toBe(false);
  });

  test("nitrite alone counts too", () => {
    const c = getCycleStatus([t(0, { ...CLEAN, nitrite: 0.5 }), t(10, CLEAN), t(20, CLEAN)]);
    expect(c.crashed).toBe(true);
    expect(c.label).toMatch(/Nitrite spike/i);
  });
});

describe("a tank that genuinely is cycling still gets cycling advice", () => {
  // The whole risk of this change: frightening a beginner mid-cycle, when
  // ammonia is supposed to be there and patience is the right answer.
  test("a new tank mid-cycle is unchanged", () => {
    const cycling = [t(0, { ammonia: 2, nitrite: 1, nitrate: 0 }),
                     t(2, { ammonia: 3, nitrite: 0, nitrate: 0 }),
                     t(4, { ammonia: 1, nitrite: 0, nitrate: 0 })];
    const c = getCycleStatus(cycling);
    expect(c.crashed).toBeFalsy();
    expect(c.cycled).toBe(false);
    expect(c.guidance).toMatch(/don't add fish yet/i);
  });

  test("Today still says cycling, not crashed", () => {
    // A fish-in cycle: stock present, which is what gates the Today block at
    // all — an empty tank gets its cycling guidance from the tracker card.
    const cycling = [t(0, { ammonia: 2, nitrite: 1, nitrate: 0 }), t(3, { ammonia: 3, nitrite: 0, nitrate: 0 })];
    const acts = getTodayActions({ tank: ["Ocellaris Clownfish"], waterTests: cycling, maintenance: {}, waterType: "salt" });
    expect(acts.some((a) => /still cycling/i.test(a.text))).toBe(true);
    expect(acts.some((a) => /spike in an established/i.test(a.text))).toBe(false);
  });

  test("one clean reading is not proof of a cycle", () => {
    // Nitrate present with zero ammonia and nitrite is the signal, and it has
    // to have happened BEFORE the spike, not be the spike itself.
    const c = getCycleStatus([t(0, { ammonia: 1, nitrite: 0, nitrate: 0 })]);
    expect(c.crashed).toBeFalsy();
  });

  test("a cycled tank reading clean is still just cycled", () => {
    const c = getCycleStatus([t(0, CLEAN), t(10, CLEAN)]);
    expect(c.cycled).toBe(true);
    expect(c.crashed).toBeFalsy();
    expect(c.label).toMatch(/Cycled/);
  });

  test("no readings at all is not a crash", () => {
    expect(getCycleStatus([]).crashed).toBeFalsy();
    expect(getCycleStatus().crashed).toBeFalsy();
  });
});
