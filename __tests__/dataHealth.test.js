jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// "If my phone went in the tank tonight, what would I lose?"
//
// The single output that could actually cost somebody their records is a
// reassuring one on a device with no account and no export — because that's the
// output that stops them making a backup. So the tests lead with the cases
// where this must refuse to say everything is fine.

const { assessDataHealth, countRecords } = require("../lib/dataHealth");
const { newObservation } = require("../lib/observations");

// Day keys built the way the app builds them: local calendar fields, not UTC.
// These fixtures previously used toISOString(), which is the exact assumption
// the app was fixed for — so in any non-UTC zone the fixture's "today" and the
// app's "today" were different days.
function localDay(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}


const NOW = new Date("2026-08-17T12:00:00Z").getTime();
const ago = (days) => NOW - days * 86400000;
const day = (n) => localDay(NOW - n * 86400000);

const tank = () => ({
  id: "t1",
  waterTests: [{ date: day(400), values: { nitrate: 10 } }, { date: day(1), values: { nitrate: 12 } }],
  journal: [{ id: 1, date: day(5), text: "note", photo: "file:///a.jpg" }, { id: 2, date: day(6), text: "no photo" }],
  observations: { Clown: [newObservation({ text: "spawned", photo: "file:///b.jpg", date: day(3) })] },
  costs: [{ id: 3, amount: 10 }],
  feedings: [], waterChanges: [], doses: [], medDoses: [], losses: [], equipment: [], upkeep: [], inventory: [], quarantine: [],
});

const healthy = (over = {}) => assessDataHealth({


  tanks: [tank()],
  signedIn: true,
  lastSyncedAt: ago(0),
  lastBackup: ago(2),
  restorePoints: [{ id: "p1", at: new Date(ago(0)).toISOString() }],
  remindersState: "on",
  now: NOW,
  ...over,
});

describe("counting what's at stake", () => {
  test("records are counted across every log, in the things you typed", () => {
    const c = countRecords([tank()]);
    // 2 tests + 2 journal + 1 observation + 1 cost.
    expect(c.records).toBe(6);
    expect(c.photos).toBe(2);
    expect(c.tanks).toBe(1);
  });

  test("an empty install counts nothing and doesn't throw", () => {
    expect(countRecords([]).records).toBe(0);
    expect(countRecords([{ id: "old" }]).records).toBe(0);
  });
});

describe("it refuses to be reassuring when it shouldn't be", () => {
  test("no account is called out as at-risk, not as a minor gap", () => {
    const h = healthy({ signedIn: false });
    expect(h.level).toBe("at-risk");
    expect(h.checks.find((c) => c.id === "cloud").state).toBe("missing");
    // Stated in what would be lost, not as a percentage.
    expect(h.headline).toMatch(/no off-device copy/i);
  });

  test("never exported is a missing protection", () => {
    const h = healthy({ lastBackup: null });
    expect(h.checks.find((c) => c.id === "file").state).toBe("missing");
    expect(h.level).toBe("at-risk");
  });

  test("with neither, the score is far worse than with one", () => {
    const neither = healthy({ signedIn: false, lastBackup: null });
    const one = healthy({ signedIn: false });
    expect(neither.score).toBeLessThan(one.score);
  });

  test("a stale export is a warning, because restoring it would lose work", () => {
    const h = healthy({ lastBackup: ago(90) });
    const file = h.checks.find((c) => c.id === "file");
    expect(file.state).toBe("warn");
    expect(file.detail).toMatch(/would lose everything since/i);
  });

  test("a failed sync is reported even though an account exists", () => {
    const h = healthy({ syncError: true });
    expect(h.checks.find((c) => c.id === "cloud").state).toBe("warn");
  });

  test("photos are flagged when there's no account — an export doesn't hold them", () => {
    const h = healthy({ signedIn: false });
    const photos = h.checks.find((c) => c.id === "photos");
    expect(photos.state).toBe("warn");
    expect(photos.detail).toMatch(/entries, not the images/i);
  });

  test("reminders that can't fire are surfaced here too", () => {
    expect(healthy({ remindersState: "blocked" }).checks.find((c) => c.id === "reminders")).toBeTruthy();
    expect(healthy({ remindersState: "on" }).checks.find((c) => c.id === "reminders")).toBeFalsy();
  });
});

describe("and it does say yes when everything is in place", () => {
  test("a fully protected tank reads as safe", () => {
    const h = healthy();
    expect(h.level).toBe("safe");
    expect(h.score).toBe(100);
    expect(h.headline).toMatch(/backed up and current/i);
  });

  test("every check offers a fix wherever there's something to fix", () => {
    const h = healthy({ signedIn: false, lastBackup: null, restorePoints: [] });
    h.checks.filter((c) => c.state !== "ok").forEach((c) => {
      expect(typeof c.fix).toBe("string");
      expect(c.fix.length).toBeGreaterThan(5);
    });
  });

  test("it knows how long the log actually runs", () => {
    expect(healthy().yearsLogged).toBeGreaterThan(1);
  });
});
