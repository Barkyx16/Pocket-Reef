import { fmt, fmtCount, fmtMoney, fmtPct, fmtWithUnit } from "../lib/format";

describe("fmt — significant figures, not fixed decimals", () => {
  test("trims engine precision to what the measurement supports", () => {
    // The bug this exists for: an inferred consumption rate rendered as
    // "1.1874/day", claiming four decimals of accuracy from four water changes.
    expect(fmt(1.1874)).toBe("1.19");
    expect(fmt(0.7312)).toBe("0.731"); // 3 s.f., and below 1 the third digit still carries meaning
    expect(fmt(8.2857)).toBe("8.29");
  });

  test("keeps small values visible instead of rounding them to nothing", () => {
    // A fixed 2dp would render every one of these as "0.00", which reads as
    // "you are dosing none of this".
    expect(fmt(0.0004)).toBe("0.0004");
    expect(fmt(0.05)).toBe("0.05");
    expect(fmt(0.0125)).toBe("0.0125");
  });

  test("drops trailing zeros, which claim resolution that isn't there", () => {
    expect(fmt(1.2)).toBe("1.2");
    expect(fmt(1.0)).toBe("1");
    expect(fmt(12.0)).toBe("12");
  });

  test("large values lose the decimals nobody reads", () => {
    expect(fmt(1234.567)).toBe("1235");
    expect(fmt(75)).toBe("75");
  });

  test("nothing renders as an em dash rather than NaN or null", () => {
    for (const v of [null, undefined, "", NaN, Infinity, "banana", {}]) {
      expect(fmt(v)).toBe("—");
    }
  });

  test("zero is zero, not an em dash", () => {
    // A measured rate of exactly zero is information: it isn't being used.
    expect(fmt(0)).toBe("0");
    expect(fmt(-0)).toBe("0");
  });

  test("negatives survive — a falling parameter has a negative rate", () => {
    expect(fmt(-1.1874)).toBe("-1.19");
    expect(fmt(-0.0004)).toBe("-0.0004");
  });
});

describe("the specialised formatters", () => {
  test("money always carries both places", () => {
    // "$12.5" looks like a bug in a way that "1.2 ml" does not.
    expect(fmtMoney(12.5)).toBe("$12.50");
    expect(fmtMoney(0.1 + 0.2)).toBe("$0.30");
    expect(fmtMoney(1234.5)).toBe("$1,235");
    expect(fmtMoney(null)).toBe("—");
  });

  test("counts are whole", () => {
    expect(fmtCount(3.7)).toBe("4");
    expect(fmtCount(0)).toBe("0");
    expect(fmtCount(null)).toBe("—");
  });

  test("percentages are whole", () => {
    expect(fmtPct(24.7)).toBe("25%");
    expect(fmtPct(0)).toBe("0%");
  });

  test("units are glued on, and absent values don't get one", () => {
    expect(fmtWithUnit(1.1874, "ml")).toBe("1.19 ml");
    expect(fmtWithUnit(1.1874, "")).toBe("1.19");
    // "— ml" reads as a quantity of nothing; the dash should stand alone.
    expect(fmtWithUnit(null, "ml")).toBe("—");
  });
});

describe("no value survives formatting as scientific notation", () => {
  test("because a keeper should never see 1e-7 in a dosing field", () => {
    for (const v of [1e-7, 1e21, 0.0000001, 123456789012345]) {
      expect(fmt(v)).not.toMatch(/e[+-]/i);
    }
  });
});
