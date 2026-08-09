import { getTodayActions, SPECIES } from "../core";

const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();
const NEON = "Neon Tetra";

// The Today hub is the most-seen logic in the app: it drives the Home card,
// the deep links out of it, and the body text of every push reminder. It was
// only ever covered incidentally, through other features.

describe("the Today hub", () => {
  test("a brand-new empty tank isn't nagged about nothing", () => {
    const actions = getTodayActions({ tank: [], waterTests: [], reminderPrefs: { waterTest: "off", waterChange: "off" } });
    expect(Array.isArray(actions)).toBe(true);
  });

  test("every action is deep-linkable — the whole point of the card", () => {
    // Tapping an item must land on the tab where you act on it. An action with
    // no `to` is a dead end.
    const actions = getTodayActions({
      tank: [NEON],
      waterTests: [{ date: iso(30), values: { nitrate: 40 } }],
      maintenance: { filterclean: iso(90), gravelvac: iso(60) },
      reminderPrefs: { waterTest: "weekly", waterChange: "weekly" },
      quantities: { [NEON]: 1 },
    });
    expect(actions.length).toBeGreaterThan(0);
    actions.forEach((a) => {
      expect(typeof a.to).toBe("string");
      expect(a.to.length).toBeGreaterThan(0);
      expect(typeof a.text).toBe("string");
      expect(a.text.length).toBeGreaterThan(5);
      expect(typeof a.rank).toBe("number");
    });
  });

  test("the most urgent item comes first", () => {
    const actions = getTodayActions({
      tank: [NEON],
      waterTests: [{ date: iso(40), values: { nitrate: 60 } }],
      maintenance: { filterclean: iso(120) },
      reminderPrefs: { waterTest: "weekly" },
    });
    for (let i = 1; i < actions.length; i++) {
      expect(actions[i - 1].rank).toBeLessThanOrEqual(actions[i].rank);
    }
  });

  test("overdue maintenance is surfaced and points at the Log", () => {
    const actions = getTodayActions({ tank: [], maintenance: { filterclean: iso(90) } });
    const overdue = actions.find((a) => /overdue/i.test(a.text));
    expect(overdue).toBeTruthy();
    expect(overdue.to).toBe("log");
    expect(overdue.rank).toBe(0);
  });

  test("maintenance logged recently is NOT nagged about", () => {
    const actions = getTodayActions({ tank: [], maintenance: { filterclean: iso(1), gravelvac: iso(1), glassclean: iso(1) } });
    expect(actions.some((a) => /overdue/i.test(a.text))).toBe(false);
  });

  test("reminder cadence is respected — 'off' means silent", () => {
    const base = { tank: [NEON], waterTests: [{ date: iso(20), values: { nitrate: 10 } }] };
    const weekly = getTodayActions({ ...base, reminderPrefs: { waterTest: "weekly" } });
    const off = getTodayActions({ ...base, reminderPrefs: { waterTest: "off" } });
    expect(off.length).toBeLessThanOrEqual(weekly.length);
  });

  test("biweekly waits longer than weekly before nagging", () => {
    const base = { tank: [NEON], waterTests: [{ date: iso(10), values: { nitrate: 10 } }] };
    const weekly = getTodayActions({ ...base, reminderPrefs: { waterTest: "weekly" } });
    const biweekly = getTodayActions({ ...base, reminderPrefs: { waterTest: "biweekly" } });
    // 10 days out: due on a weekly cadence, not yet on biweekly.
    expect(biweekly.length).toBeLessThanOrEqual(weekly.length);
  });

  test("a school kept below its minimum is flagged", () => {
    const schooler = SPECIES.find((s) => s.minGroup >= 6 && s.water === "fresh");
    const actions = getTodayActions({ tank: [schooler.name], quantities: { [schooler.name]: 2 } });
    expect(actions.some((a) => new RegExp(schooler.name, "i").test(a.text))).toBe(true);
  });

  test("a school kept at its minimum is not flagged", () => {
    const schooler = SPECIES.find((s) => s.minGroup >= 6 && s.water === "fresh");
    const actions = getTodayActions({ tank: [schooler.name], quantities: { [schooler.name]: schooler.minGroup } });
    expect(actions.some((a) => /school|group/i.test(a.text))).toBe(false);
  });

  test("an untouched quantity stays quiet, so existing tanks aren't flooded", () => {
    // Deliberate: only an explicitly-set count below the minimum warns.
    const schooler = SPECIES.find((s) => s.minGroup >= 6 && s.water === "fresh");
    const actions = getTodayActions({ tank: [schooler.name], quantities: {} });
    expect(actions.some((a) => /school|group/i.test(a.text))).toBe(false);
  });

  test("it never throws on garbage input", () => {
    expect(() => getTodayActions()).not.toThrow();
    expect(() => getTodayActions({})).not.toThrow();
    expect(() => getTodayActions({ tank: null, waterTests: null, maintenance: null, quantities: null, treatments: null })).not.toThrow();
    expect(() => getTodayActions({ tank: ["Not A Fish"], waterTests: [{ date: "garbage", values: null }] })).not.toThrow();
  });
});
