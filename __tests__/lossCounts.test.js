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
