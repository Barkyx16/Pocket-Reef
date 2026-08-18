jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import fs from "fs";
import path from "path";
import { CURRENCIES, setCurrency, getCurrency, currencySymbol } from "../lib/currency";
import { fmtMoney } from "../lib/format";
import { SYNCED_FIELDS } from "../lib/cloudSync";

const ROOT = path.join(__dirname, "..");

afterEach(() => setCurrency("USD"));

describe("prices carry the keeper's own symbol", () => {
  // A keeper in Manchester logs 40 for a bag of salt, meaning £40, and the app
  // told them for the life of the tank that they spent $40. The app already
  // knew better: someone who has switched units to metric has said fairly
  // plainly that they are not in the United States.
  test("the symbol follows the preference", () => {
    setCurrency("GBP");
    expect(fmtMoney(40)).toBe("£40.00");
    setCurrency("EUR");
    expect(fmtMoney(40)).toBe("€40.00");
  });

  test("dollars remain the default, so nothing changes for existing keepers", () => {
    expect(getCurrency()).toBe("USD");
    expect(fmtMoney(40)).toBe("$40.00");
  });

  test("switching relabels and never converts", () => {
    // The figure the keeper typed is already in their money. Pocket Reef has
    // no exchange rates and no business inventing them.
    setCurrency("USD");
    const before = fmtMoney(40).replace(/[^\d.]/g, "");
    setCurrency("JPY");
    const after = fmtMoney(40).replace(/[^\d.]/g, "");
    expect(Number(after)).toBe(Number(before));
  });

  test("yen has no minor units — ¥1200.00 is wrong in a way £12.00 is not", () => {
    setCurrency("JPY");
    expect(fmtMoney(1200)).not.toMatch(/\.00/);
    setCurrency("GBP");
    expect(fmtMoney(12)).toBe("£12.00");
  });

  test("a symbol that follows the number does", () => {
    setCurrency("SEK");
    expect(fmtMoney(40)).toBe("40.00 kr");
  });

  test("an unknown code falls back rather than rendering undefined", () => {
    setCurrency("XYZ");
    expect(getCurrency()).toBe("USD");
    expect(currencySymbol()).toBe("$");
    for (const v of [null, undefined, "", 0]) {
      setCurrency(v);
      expect(currencySymbol()).toBe("$");
    }
  });

  test("an explicit symbol from a caller still wins", () => {
    setCurrency("GBP");
    expect(fmtMoney(40, "$")).toBe("$40.00");
  });

  test("nothing still renders as an em dash in every currency", () => {
    for (const c of CURRENCIES) {
      setCurrency(c.code);
      expect(fmtMoney(null)).toBe("—");
    }
  });
});

describe("the catalogue holds up", () => {
  test("every entry has a code, symbol and label", () => {
    for (const c of CURRENCIES) {
      expect(typeof c.code).toBe("string");
      expect(c.code).toMatch(/^[A-Z]{3}$/);
      expect(c.symbol.length).toBeGreaterThan(0);
      expect(c.label.length).toBeGreaterThan(0);
    }
  });

  test("codes are unique, and labels distinguish the shared symbols", () => {
    const codes = CURRENCIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    // USD, CAD and AUD all use "$" — the picker must still be readable.
    const labels = CURRENCIES.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  test("USD is present and first, since it is the default", () => {
    expect(CURRENCIES[0].code).toBe("USD");
  });
});

describe("the preference is remembered", () => {
  test("it syncs with the rest of the profile", () => {
    // A preference that doesn't sync means the keeper sets it again on every
    // device, which is how people conclude a setting doesn't work.
    expect(SYNCED_FIELDS).toContain("currency");
  });

  test("App persists and rehydrates it", () => {
    const app = fs.readFileSync(path.join(ROOT, "App.js"), "utf8");
    expect(app).toContain('scheduleWrite("pr_currency"');
    expect(app).toContain('"pr_currency"');
    expect(app).toMatch(/snap\.currency/);
  });

  test("no component renders a bare dollar sign in front of a figure", () => {
    const files = ["components", "screens"].flatMap((dir) =>
      fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".js")).map((f) => path.join(dir, f)));
    const offenders = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      for (const m of src.matchAll(/\$\$\{/g)) {
        offenders.push(`${f}:${src.slice(0, m.index).split("\n").length}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
