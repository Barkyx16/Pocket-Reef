import fs from "fs";
import path from "path";
import { decimalText, integerText, toNumber } from "../lib/numericInput";
import { round, round1, round2 } from "../lib/num";

const ROOT = path.join(__dirname, "..");

describe("a decimal typed on a European keyboard", () => {
  // iOS renders the decimal-pad with a comma wherever that is the local
  // separator. The old sanitiser deleted it, so "1,5" became "15" — an order
  // of magnitude out, entirely plausible, and stored without complaint.
  test("a comma is a decimal point, not a character to delete", () => {
    expect(decimalText("1,5")).toBe("1.5");
    expect(Number(decimalText("1,5"))).toBe(1.5);
    expect(Number(decimalText("1,5"))).not.toBe(15);
  });

  test("a full stop still works, because most keepers type one", () => {
    expect(decimalText("1.5")).toBe("1.5");
  });

  test("a second separator is a typo, not a thousands mark", () => {
    // "1.2.3" -> "123" would be the same tenfold error by another route.
    expect(decimalText("1.2.3")).toBe("1.23");
    expect(decimalText("1,2,3")).toBe("1.23");
  });

  test("a leading separator is kept so the field can be typed into", () => {
    // Someone typing ".5" must see ".5" mid-keystroke, not have it eaten.
    expect(decimalText(",5")).toBe(".5");
    expect(Number(decimalText(",5"))).toBe(0.5);
  });

  test("spaces and currency symbols are dropped", () => {
    expect(decimalText("$1 234,56")).toBe("1234.56");
  });

  test("letters are dropped rather than becoming zeros", () => {
    expect(decimalText("abc")).toBe("");
  });

  test("nothing in, empty string out — never null into a TextInput", () => {
    // A null value prop makes a controlled TextInput uncontrolled.
    for (const v of [null, undefined, ""]) expect(decimalText(v)).toBe("");
  });

  test("a trailing separator survives so the next digit can be typed", () => {
    expect(decimalText("1.")).toBe("1.");
    expect(decimalText("1,")).toBe("1.");
  });
});

describe("integerText", () => {
  test("no separator survives at all", () => {
    expect(integerText("1,5")).toBe("15");
    expect(integerText("1.5")).toBe("15");
  });

  test("counts and intervals stay whole", () => {
    expect(integerText("30 days")).toBe("30");
    expect(integerText("")).toBe("");
  });
});

describe("toNumber, for values that never met a sanitised field", () => {
  // CSV imports, synced profiles, records written before the fix.
  test("parses a comma decimal that Number() would reject", () => {
    expect(Number("1,5")).toBeNaN();
    expect(toNumber("1,5")).toBe(1.5);
  });

  test("numbers pass through untouched", () => {
    expect(toNumber(1.5)).toBe(1.5);
    expect(toNumber(0)).toBe(0);
  });

  test("nothing becomes NaN, not zero", () => {
    // Number(null) is 0, which is a lie the caller cannot detect.
    for (const v of [null, undefined, ""]) expect(toNumber(v)).toBeNaN();
  });
});

describe("no field sanitises numbers on its own again", () => {
  const files = ["components", "screens"].flatMap((dir) =>
    fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".js")).map((f) => path.join(dir, f)));

  test("no component strips characters from a typed number inline", () => {
    const offenders = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      // Only onChangeText matters: that is where a keeper's keystrokes are
      // sanitised. Stripping non-digits from a six-digit code before submitting
      // it (AuthScreen, OtpCodeInput) is a different job — a comma there is
      // genuinely not a decimal point and should stay deleted.
      for (const m of src.matchAll(/onChangeText=\{[^}]{0,200}?replace\(\/\[\^0-9\.?\]\/g/g)) {
        offenders.push(`${f}:${src.slice(0, m.index).split("\n").length}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("one rounding rule", () => {
  // Thirteen modules each declared their own. Ten defaulted to two decimals
  // and three to one, so `round(x)` meant different precisions depending on
  // which file you were reading.
  test("round defaults to two places", () => {
    expect(round(1.2345)).toBe(1.23);
    expect(round1(1.25)).toBe(1.3);
    expect(round2(1.004)).toBe(1);
  });

  test("binary floating point still bites at the exact half", () => {
    // 1.005 is not 1.005 in binary — it is a hair under, so scaling gives
    // 100.4999… and rounds down. Documented rather than worked around: every
    // engine has used this rounding since the first release, and changing the
    // arithmetic to fix a case nobody hits would shift numbers everywhere.
    expect(round2(1.005)).toBe(1);
    expect(round(-1.235, 2)).toBe(-1.24);
  });

  test("non-numbers come back unchanged rather than as NaN surprises", () => {
    expect(round(NaN)).toBeNaN();
    expect(round(Infinity)).toBe(Infinity);
  });

  test("negatives round toward positive infinity, as Math.round does", () => {
    expect(round(-1.25, 1)).toBe(-1.2);
    expect(round(-2.5, 0)).toBe(-2);
  });

  test("no module declares its own round any more", () => {
    const libs = fs.readdirSync(path.join(ROOT, "lib")).filter((f) => f.endsWith(".js"));
    const offenders = libs.filter((f) =>
      /^const round = \(n, dp/m.test(fs.readFileSync(path.join(ROOT, "lib", f), "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("one money formatter", () => {
  const files = ["components", "screens"].flatMap((dir) =>
    fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".js")).map((f) => path.join(dir, f)));

  test("no component defines its own", () => {
    // Two did, and both rendered an unknown total as "$0.00" — the exact bug
    // fmtMoney had been fixed for, still live because they never adopted it.
    const offenders = files.filter((f) =>
      /^const money = /m.test(fs.readFileSync(path.join(ROOT, f), "utf8")));
    expect(offenders).toEqual([]);
  });
});
