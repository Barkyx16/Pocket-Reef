import { recommendFor, testSchedule } from "../lib/cadence";
import { activeParams } from "../lib/targets";

const day = (n) => {
  const x = new Date(Date.now() - n * 86400000);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const P = (k) => activeParams("salt").find((x) => x.key === k);
const flat = (k, v, n = 6) => Array.from({ length: n }, (_, i) => ({ date: day(i * 7), water: "salt", values: { [k]: v } }));

describe("a reading outside its safe range is tested until it is back inside", () => {
  // The engine asked one question — is this changing? — and answered the
  // interval from that alone. A tank sitting flat at 5 ppm ammonia is lethal
  // and not moving, because nothing has been done about it. It was told every
  // 30 days was plenty, and that testing weekly was "too often". The one case
  // where the answer has to be "keep looking" was the case it answered "stop".
  for (const v of [0.25, 1, 2, 5]) {
    test(`ammonia at ${v} ppm is a daily test, not a monthly one`, () => {
      const r = recommendFor(P("ammonia"), flat("ammonia", v));
      expect(r.outOfRange).toBe(true);
      expect(r.recommended).toBe(1);
      expect(r.reason).toMatch(/outside the safe range/i);
    });
  }

  test("and weekly testing is called too rare, not too often", () => {
    const r = recommendFor(P("ammonia"), flat("ammonia", 2));
    expect(r.verdict).toBe("too-rare");
  });

  test("it holds for the slow poisons too", () => {
    const r = recommendFor(P("nitrate"), flat("nitrate", 80));
    expect(r.outOfRange).toBe(true);
    expect(r.recommended).toBe(1);
  });

  test("distance no longer treats 'past the limit' as 'room to spare'", () => {
    // Math.abs made two units beyond the edge look identical to two units
    // inside it, which is what let a wildly unsafe reading look roomy.
    const bad = recommendFor(P("nitrate"), flat("nitrate", 80));
    const good = recommendFor(P("nitrate"), flat("nitrate", 5));
    expect(bad.recommended).toBeLessThan(good.recommended);
  });
});

describe("nothing in range changed", () => {
  // The risk of this fix is nagging someone whose tank is fine.
  const cases = [["alk", 8.5], ["nitrate", 5], ["calcium", 425], ["temp", 78], ["ammonia", 0]];
  for (const [k, v] of cases) {
    test(`${k} at ${v} still recommends the monthly check`, () => {
      const r = recommendFor(P(k), flat(k, v));
      expect(r.outOfRange).toBe(false);
      expect(r.recommended).toBe(30);
      expect(r.reason).toMatch(/test-kit error/i);
    });
  }

  test("a parameter genuinely drifting still gets a paced interval", () => {
    const drifting = Array.from({ length: 6 }, (_, i) => ({
      date: day(i * 7), water: "salt", values: { alk: 9.0 - i * 0.2 },
    }));
    const r = recommendFor(P("alk"), drifting);
    expect(r.outOfRange).toBe(false);
    expect(r.recommended).toBeGreaterThan(1);
    expect(r.recommended).toBeLessThan(30);
  });

  test("the schedule as a whole puts the unsafe parameter first", () => {
    const tests = Array.from({ length: 6 }, (_, i) => ({
      date: day(i * 7), water: "salt",
      values: { ammonia: 2, nitrate: 5, alk: 8.5, calcium: 425, temp: 78 },
    }));
    const s = testSchedule(tests, "salt");
    expect(s.ok).toBe(true);
    expect(s.tightest.key).toBe("ammonia");
    expect(s.tightest.recommended).toBe(1);
  });
});
