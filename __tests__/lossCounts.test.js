import { mortalitySummary, livestockSpend, newLoss } from "../lib/livestock";

const day = (n) => {
  const x = new Date(Date.now() - n * 86400000);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

describe("a loss record without a count is still one animal", () => {
  // newLoss defaults count to 1, so anything this app wrote has it. Records
  // arriving from elsewhere do not: an imported backup, a profile synced from a
  // build that predates the field, a hand-edited export. Every arithmetic use
  // was unguarded, and 0 + undefined is NaN — which JSON renders as null, so
  // the summary came back with a null total, a null top cause, and a null
  // against every cause. The card puts that where a number belongs.
  const legacy = [{ id: "a", name: "Yellow Tang", reason: "died", cause: "Disease", date: day(4) }];

  test("the total is a number, not null", () => {
    const m = mortalitySummary(legacy);
    expect(m.total).toBe(1);
    expect(Number.isFinite(m.total)).toBe(true);
  });

  test("so is every cause, and the top one", () => {
    const m = mortalitySummary(legacy);
    expect(m.byCause.Disease).toBe(1);
    expect(m.topCause).toEqual({ cause: "Disease", count: 1 });
  });

  test("repeat offenders count correctly too", () => {
    const twice = [
      { id: "a", name: "Yellow Tang", reason: "died", cause: "Disease", date: day(4) },
      { id: "b", name: "Yellow Tang", reason: "died", cause: "Aggression", date: day(20) },
    ];
    expect(mortalitySummary(twice).repeatOffenders).toEqual([{ name: "Yellow Tang", count: 2 }]);
  });

  test("spend does not become NaN either", () => {
    const priced = [{ id: "a", name: "Tang", reason: "died", date: day(4), price: 80 }];
    const s = livestockSpend([], {}, {}, priced);
    expect(s.lost).toBe(80);
    expect(Number.isFinite(s.total)).toBe(true);
  });

  test("a stated count is still honoured", () => {
    const three = [{ id: "a", name: "Chromis", reason: "died", cause: "Aggression", date: day(4), count: 3 }];
    expect(mortalitySummary(three).total).toBe(3);
    expect(livestockSpend([], {}, {}, [{ ...three[0], price: 10 }]).lost).toBe(30);
  });

  test("nonsense counts fall back to one rather than poisoning the sum", () => {
    for (const bad of [0, -2, NaN, "many", null, {}, Infinity]) {
      const m = mortalitySummary([{ id: "a", name: "X", reason: "died", date: day(1), count: bad }]);
      expect(m.total).toBe(1);
    }
  });

  test("records this app writes are unaffected", () => {
    const made = newLoss({ name: "Tang", reason: "died", cause: "Disease", date: day(2) });
    expect(made.count).toBe(1);
    expect(mortalitySummary([made]).total).toBe(1);
  });

  test("a non-death is still not counted as one", () => {
    // Rehomed, sold, returned — a loss record is not automatically a death.
    const rehomed = [{ id: "a", name: "Tang", reason: "rehomed", date: day(3) }];
    expect(mortalitySummary(rehomed).total).toBe(0);
  });
});

describe("records from an older build survive the rest of the app too", () => {
  // Same shape as the count bug, found by sweeping every field a factory gives
  // a numeric default and then looking for arithmetic on it that assumes the
  // default is there. Two more sites had it.
  const { forecastItem } = require("../lib/inventory");
  const fs = require("fs");
  const path = require("path");

  test("an inventory item with no stock figure is not forecast as NaN", () => {
    // The headline read "About NaN days left — null", beside a state of "ok".
    const legacy = { id: "i1", name: "Salt", kind: "salt", unit: "lb", perDay: 2, addedAt: day(60) };
    const f = forecastItem(legacy, { gallons: 90, waterChanges: [] }, {});
    expect(f.state).toBe("unknown");
    expect(f.daysLeft).toBe(null);
    expect(f.headline).not.toMatch(/NaN|null/);
    expect(f.headline).toMatch(/No amount recorded/i);
  });

  test("an item that does have stock still forecasts normally", () => {
    const ok = { id: "i2", name: "Salt", kind: "salt", unit: "lb", stock: 40, perDay: 2, addedAt: day(60) };
    const f = forecastItem(ok, { gallons: 90, waterChanges: [] }, {});
    expect(f.daysLeft).toBe(20);
    expect(f.state).not.toBe("unknown");
  });

  test("junk in the stock field is treated as unknown, not as zero", () => {
    // Zero would mean "you have none, buy some now", which is a different and
    // wrong claim about a record that simply never had the field.
    for (const bad of [undefined, null, "lots", NaN]) {
      const f = forecastItem({ id: "i", name: "S", kind: "salt", stock: bad, perDay: 2 }, { gallons: 90, waterChanges: [] }, {});
      expect(f.state).toBe("unknown");
    }
  });

  test("the loss sheet no longer renders NaN", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "components/StockRecordSheet.js"), "utf8");
    expect(src).toContain("countOf(loss)");
    expect(src).not.toMatch(/quantity - loss\.count/);
  });

  test("one helper answers 'how many animals', everywhere", () => {
    const { countOf } = require("../lib/livestock");
    expect(countOf({})).toBe(1);
    expect(countOf({ count: 4 })).toBe(4);
    expect(countOf(null)).toBe(1);
  });
});

describe("an empty shelf and an unrecorded one are different claims", () => {
  const { forecastItem } = require("../lib/inventory");
  const tank = { gallons: 90, waterChanges: [] };
  const mk = (stock) => forecastItem({ id: "i", name: "Salt", kind: "salt", stock, perDay: 2 }, tank, {});

  test("zero means buy some now", () => {
    expect(mk(0).state).toBe("out");
    expect(mk(0).headline).toMatch(/Out of stock/i);
  });

  test("absent means nobody has said", () => {
    // `null <= 0` is true and `undefined <= 0` is false, so the two ways of not
    // having a figure took different branches: one claimed the shelf was empty,
    // the other divided by it.
    for (const v of [null, undefined, "", "lots", NaN]) {
      expect([v, mk(v).state]).toEqual([v, "unknown"]);
      expect(mk(v).headline).not.toMatch(/Out of stock/i);
    }
  });

  test("a real figure still forecasts", () => {
    expect(mk(40).daysLeft).toBe(20);
  });
});
