jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import fs from "fs";
import path from "path";
import { isPastOrToday, dayKeyProblem, isValidDayKey } from "../lib/day";
import { newEquipment } from "../lib/equipment";
import { newStockRecord } from "../lib/livestock";

const day = (n) => {
  const x = new Date(Date.now() - n * 86400000);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

describe("nothing that already happened can be dated in the future", () => {
  // A year typed wrong is the easiest mistake there is to make in a YYYY-MM-DD
  // field, and it was accepted: isValidDayKey allows five years ahead, for
  // dates that legitimately look forward.
  //
  // A water test dated next year sorts to the top and stays there. It becomes
  // "your latest reading" on every screen — the health score grades the tank
  // on it, the cadence engine paces testing from it — for a whole year, with
  // nothing to explain why the app is describing water the keeper hasn't got.
  test("today and yesterday are fine", () => {
    expect(isPastOrToday(day(0))).toBe(true);
    expect(isPastOrToday(day(1))).toBe(true);
    expect(isPastOrToday(day(400))).toBe(true);
  });

  test("tomorrow and next year are not", () => {
    expect(isPastOrToday(day(-1))).toBe(false);
    expect(isPastOrToday(day(-365))).toBe(false);
  });

  test("and the message names the likely cause", () => {
    // "Check the year" rather than "invalid date": the mistake is almost always
    // a digit in the year, and saying so is the difference between a fix and a
    // shrug.
    expect(dayKeyProblem(day(-365))).toMatch(/future.*year/i);
    expect(dayKeyProblem(day(0))).toBe(null);
  });

  test("an impossible date still reports what is impossible about it", () => {
    expect(dayKeyProblem("2026-13-45")).toMatch(/month 13/);
    expect(dayKeyProblem("2026-02-30")).toMatch(/28 days/);
  });

  test("a caller that legitimately looks ahead can say so", () => {
    expect(dayKeyProblem(day(-30), { allowFuture: true })).toBe(null);
  });

  test("rubbish is still rubbish", () => {
    for (const v of [null, undefined, "", 42, {}, "last tuesday"]) {
      expect(isPastOrToday(v)).toBe(false);
    }
    expect(isValidDayKey(day(-365))).toBe(true); // still a real date, just ahead
  });
});

describe("the record factories refuse it too", () => {
  // The typed field is one way in. An imported backup or a synced profile is
  // another, and neither goes near the form.
  test("equipment installed next year is dated today instead", () => {
    const e = newEquipment({ name: "Return pump", installedAt: day(-365) });
    expect(e.installedAt).toBe(day(0));
  });

  test("a fish added tomorrow is dated today instead", () => {
    const r = newStockRecord({ addedAt: day(-1) });
    expect(r.addedAt).toBe(day(0));
  });

  test("a real past date is kept exactly", () => {
    expect(newEquipment({ name: "Skimmer", installedAt: "2024-02-29" }).installedAt).toBe("2024-02-29");
    expect(newStockRecord({ addedAt: "2025-11-03" }).addedAt).toBe("2025-11-03");
  });
});

describe("the dated forms check it", () => {
  const ROOT = path.join(__dirname, "..");
  test("the water test form", () => {
    const src = fs.readFileSync(path.join(ROOT, "components/WaterTestCard.js"), "utf8");
    expect(src).toContain("dayKeyProblem(date)");
  });

  test("the cost form", () => {
    const src = fs.readFileSync(path.join(ROOT, "components/CostTrackerCard.js"), "utf8");
    expect(src).toContain("isPastOrToday(date)");
    expect(src).not.toMatch(/dateValid = isValidDayKey/);
  });
});
