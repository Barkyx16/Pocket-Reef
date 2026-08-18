import { isValidDayKey, dayKeyProblem, instantOf } from "../lib/day";
import { newEquipment } from "../lib/equipment";
import { newStockRecord } from "../lib/livestock";

describe("the Date constructor rolls impossible dates over; this doesn't", () => {
  test("a month that doesn't exist is rejected, not wrapped into next year", () => {
    // The ISO string parser does reject this one. instantOf does not, and
    // instantOf is what every dated record in this app is read through: it
    // splits the key and builds a local Date, and that constructor rolls over
    // rather than failing. "2026-13-45" lands in February 2027. A water test
    // filed seven months out doesn't look wrong in a list — it looks missing.
    expect(Number.isNaN(instantOf("2026-13-45"))).toBe(false); // the trap
    expect(isValidDayKey("2026-13-45")).toBe(false);           // the fix
  });

  test("a day past the end of the month is rejected, not wrapped into the next", () => {
    expect(isValidDayKey("2026-02-30")).toBe(false);
    expect(isValidDayKey("2026-04-31")).toBe(false);
    expect(isValidDayKey("2026-06-31")).toBe(false);
  });

  test("leap years are handled without a lookup table", () => {
    expect(isValidDayKey("2024-02-29")).toBe(true);
    expect(isValidDayKey("2026-02-29")).toBe(false);
    expect(isValidDayKey("2000-02-29")).toBe(true);  // divisible by 400
    expect(isValidDayKey("1900-02-29")).toBe(false); // divisible by 100, not 400
  });

  test("month ends are accepted", () => {
    for (const d of ["2026-01-31", "2026-04-30", "2026-12-31", "2026-02-28"]) {
      expect(isValidDayKey(d)).toBe(true);
    }
  });

  test("the shape has to be exact", () => {
    // "2026-8-1" parses fine but sorts wrong as a string, which is how every
    // date in this app is compared.
    for (const d of ["2026-8-1", "26-08-17", "2026/08/17", "17-08-2026", " 2026-08-17 x"]) {
      expect(isValidDayKey(d)).toBe(false);
    }
  });

  test("surrounding whitespace is forgiven", () => {
    expect(isValidDayKey("  2026-08-17  ")).toBe(true);
  });

  test("a year that is obviously a typo is rejected", () => {
    expect(isValidDayKey("0226-08-17")).toBe(false);
    expect(isValidDayKey("2226-08-17")).toBe(false);
  });

  test("nothing throws on rubbish", () => {
    for (const v of [null, undefined, "", 20260817, {}, [], NaN, true]) {
      expect(isValidDayKey(v)).toBe(false);
    }
  });
});

describe("dayKeyProblem says what is actually wrong", () => {
  test("names the month when the month is impossible", () => {
    expect(dayKeyProblem("2026-13-45")).toMatch(/month 13/);
  });

  test("names the real length of the month when the day overruns", () => {
    expect(dayKeyProblem("2026-02-30")).toMatch(/28 days/);
    expect(dayKeyProblem("2024-02-30")).toMatch(/29 days/);
    expect(dayKeyProblem("2026-04-31")).toMatch(/30 days/);
  });

  test("asks for the format when the shape is wrong", () => {
    expect(dayKeyProblem("last tuesday")).toMatch(/YYYY-MM-DD/);
  });

  test("blank is not a problem — it means today in the fields that default", () => {
    expect(dayKeyProblem("")).toBe(null);
    expect(dayKeyProblem(null)).toBe(null);
    expect(dayKeyProblem(undefined)).toBe(null);
  });

  test("a good date has no complaint", () => {
    expect(dayKeyProblem("2026-08-17")).toBe(null);
  });

  test("every message is a sentence a keeper can act on", () => {
    for (const bad of ["2026-13-45", "2026-02-30", "banana", "0001-01-01"]) {
      const msg = dayKeyProblem(bad);
      expect(typeof msg).toBe("string");
      expect(msg.length).toBeGreaterThan(10);
      expect(msg).toMatch(/[.!]$/);
    }
  });
});

describe("records built from a typed date fall back rather than storing a rolled-over one", () => {
  test("equipment installed on a date that doesn't exist gets today", () => {
    const eq = newEquipment({ name: "Skimmer", installedAt: "2026-02-30" });
    expect(eq.installedAt).not.toBe("2026-02-30");
    expect(isValidDayKey(eq.installedAt)).toBe(true);
  });

  test("a real typed date is kept exactly", () => {
    const eq = newEquipment({ name: "Skimmer", installedAt: "2024-02-29" });
    expect(eq.installedAt).toBe("2024-02-29");
  });

  test("livestock added on an impossible date gets today", () => {
    const rec = newStockRecord({ addedAt: "2026-13-45" });
    expect(isValidDayKey(rec.addedAt)).toBe(true);
    expect(rec.addedAt).not.toBe("2026-13-45");
  });

  test("a real added-date is kept exactly", () => {
    expect(newStockRecord({ addedAt: "2025-11-03" }).addedAt).toBe("2025-11-03");
  });
});
