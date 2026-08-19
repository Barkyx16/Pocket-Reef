jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import { buildReminders, nextOccurrence, secondsUntilHour, CATEGORY, nameTanks } from "../lib/notifications";

const T = (id, name, extra = {}) => ({ id, name, testDue: false, changeDue: false, ...extra });
const byKey = (list, key) => list.find((r) => r.key === key);

describe("which reminders exist at all", () => {
  // This decides what wakes a keeper up. It was unreachable from a test — the
  // whole file sat at 38% covered because of it — so changing it could only be
  // verified by reading the source back, which proves what was written rather
  // than what it produces.
  const prefs = { waterTest: "weekly", waterChange: "biweekly", feeding: "daily" };

  test("a cadence of 'off' produces no reminder for that job", () => {
    const out = buildReminders({ reminderPrefs: { ...prefs, waterTest: "off" }, tanks: [T("a", "Reef")] });
    expect(byKey(out, "waterTest")).toBeUndefined();
    expect(byKey(out, "waterChange")).toBeDefined();
  });

  test("every reminder carries an interval, an hour and a category", () => {
    for (const r of buildReminders({ reminderPrefs: prefs, tanks: [T("a", "Reef")] })) {
      expect(r.intervalDays).toBeGreaterThan(0);
      expect(r.hour).toBeGreaterThanOrEqual(0);
      expect(r.hour).toBeLessThan(24);
      expect(Object.values(CATEGORY)).toContain(r.category);
      expect(typeof r.title).toBe("string");
      expect(r.title.length).toBeGreaterThan(0);
    }
  });

  test("a chore can be answered from the shade; an alert cannot", () => {
    const out = buildReminders({ reminderPrefs: prefs, tanks: [T("a", "Reef")] });
    expect(byKey(out, "waterChange").category).toBe(CATEGORY.chore);
  });
});

describe("which tank a reminder is about", () => {
  // The bug this exists for: ticking a chore off from the lock screen recorded
  // it against whichever tank happened to be open in the app.
  const prefs = { waterTest: "weekly", waterChange: "weekly" };

  test("only the tanks actually due for that job", () => {
    const tanks = [T("a", "Reef", { testDue: true }), T("b", "Frag", { changeDue: true }), T("c", "QT")];
    const out = buildReminders({ reminderPrefs: prefs, tanks });
    expect(byKey(out, "waterTest").tankIds).toEqual(["a"]);
    expect(byKey(out, "waterChange").tankIds).toEqual(["b"]);
  });

  test("several due tanks are all named", () => {
    const tanks = [T("a", "Reef", { testDue: true }), T("b", "Frag", { testDue: true })];
    expect(byKey(buildReminders({ reminderPrefs: prefs, tanks }), "waterTest").tankIds).toEqual(["a", "b"]);
  });

  test("none due means an empty list, not a missing one", () => {
    // The handler reads length to decide whether it can act; undefined would
    // send it down the "ask the keeper" path for the wrong reason.
    const out = byKey(buildReminders({ reminderPrefs: prefs, tanks: [T("a", "Reef")] }), "waterTest");
    expect(Array.isArray(out.tankIds)).toBe(true);
    expect(out.tankIds).toEqual([]);
  });

  test("a tank with no id is dropped rather than carried as undefined", () => {
    const out = buildReminders({ reminderPrefs: prefs, tanks: [T(undefined, "Nameless", { testDue: true })] });
    expect(byKey(out, "waterTest").tankIds).toEqual([]);
  });
});

describe("the wording adapts to how many tanks there are", () => {
  test("one tank keeps the specific Today action", () => {
    const out = buildReminders({
      reminderPrefs: { waterTest: "weekly" }, tanks: [T("a", "Reef", { testDue: true })],
      topAction: { text: "Test your water — last test 9 days ago" },
    });
    expect(byKey(out, "waterTest").body).toMatch(/last test 9 days ago/);
  });

  test("several tanks name which one instead", () => {
    const out = buildReminders({
      reminderPrefs: { waterTest: "weekly" },
      tanks: [T("a", "Reef", { testDue: true }), T("b", "Frag")],
      topAction: { text: "Test your water — last test 9 days ago" },
    });
    expect(byKey(out, "waterTest").body).toMatch(/Reef/);
  });

  test("nameTanks reads like a sentence at every count", () => {
    expect(nameTanks(["Reef"])).toMatch(/Reef/);
    expect(nameTanks(["Reef", "Frag"])).toMatch(/Reef and Frag/);
    expect(nameTanks(["A", "B", "C"])).toMatch(/A and 2 others/);
    expect(nameTanks([])).toBe("");
  });
});

describe("when it fires", () => {
  test("the next occurrence is at the stated hour, never in the past", () => {
    for (const days of [1, 7, 14, 30]) {
      const d = nextOccurrence(days, 9);
      expect(d.getHours()).toBe(9);
      expect(d.getTime()).toBeGreaterThan(Date.now());
    }
  });

  test("a cadence of zero days still schedules tomorrow, not now", () => {
    // Math.max(1, days): a same-day reminder would fire immediately and
    // repeatedly, which is how an app gets its notifications switched off.
    expect(nextOccurrence(0, 9).getTime()).toBeGreaterThan(Date.now());
  });

  test("seconds until an hour is never less than a minute", () => {
    // Zero would schedule in the past; the OS drops those silently.
    for (let h = 0; h < 24; h++) expect(secondsUntilHour(h)).toBeGreaterThanOrEqual(60);
  });

  test("and never more than a day and a bit", () => {
    for (let h = 0; h < 24; h++) expect(secondsUntilHour(h)).toBeLessThanOrEqual(24 * 3600 + 60);
  });
});
