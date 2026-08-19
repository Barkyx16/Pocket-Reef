// Reminders you can answer without opening the app.
//
// The routing is the risky part and the part a device can't easily test: a
// button press must NOT navigate, a tap must, and "Later" must record nothing
// at all — because a deferral that quietly logs a feeding is worse than the
// reminder it replaced. readResponse exists so those rules are testable rather
// than only observable on a phone.

const fs = require("fs");
const path = require("path");
const { readResponse, CATEGORY, ACTION } = require("../lib/notifications");

const response = (actionIdentifier, data) => ({
  actionIdentifier,
  notification: { request: { content: { data } } },
});

describe("reading a notification response", () => {
  test("tapping the body is an open, routed to its screen", () => {
    const r = readResponse(response("expo.modules.notifications.actions.DEFAULT", { to: "log", key: "waterTest" }));
    // `tool` is part of the payload now: a reminder that names a parameter
    // opens the card explaining it rather than a bare tab. Null when the
    // reminder is a plain cadence nudge with nothing specific to show.
    expect(r).toEqual({ kind: "open", to: "log", key: "waterTest", tool: null });
  });

  test("Done is an action, and carries which reminder it answered", () => {
    const r = readResponse(response(ACTION.done, { to: "log", key: "waterChange", action: "waterChange" }));
    expect(r.kind).toBe("done");
    expect(r.key).toBe("waterChange");
  });

  test("Later is a deferral, distinct from Done", () => {
    expect(readResponse(response(ACTION.snooze, { to: "log", key: "feeding" })).kind).toBe("snooze");
  });

  test("a payload with nothing to route to yields nothing rather than a bad open", () => {
    expect(readResponse(response("DEFAULT", {}))).toBeNull();
    expect(readResponse(null)).toBeNull();
    expect(readResponse({})).toBeNull();
  });

  test("a button press still reports its key even with no destination", () => {
    // The app can record it without navigating anywhere.
    expect(readResponse(response(ACTION.done, { key: "feeding" }))).toMatchObject({ kind: "done", key: "feeding", to: null });
  });

  test("the two categories are distinct", () => {
    expect(CATEGORY.chore).not.toBe(CATEGORY.info);
  });
});

describe("what the app does with each", () => {
  const APP = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");
  const handler = APP.slice(APP.indexOf("useEffect(() => onReminderTap"), APP.indexOf("useEffect(() => onReminderTap") + 2200);

  test("an open navigates", () => {
    expect(handler).toMatch(/kind === "open"[\s\S]{0,40}jumpTo\(to\)/);
  });

  test("Done records the job rather than navigating", () => {
    expect(handler).toContain('markJobDone(only, "waterchange"');
    expect(handler).toContain("addFeedingToTank(only,");
  });

  test("and records it against the tank the reminder was about", () => {
    // A reminder rolls several tanks into one line and fires hours later, so
    // "whichever tank is open" is not an answer. It was the old one, and it
    // filed the reef's water change against the quarantine tank while leaving
    // the reef overdue — both wrong, from one tap on the lock screen.
    expect(handler).toMatch(/res\.tankIds/);
    expect(handler).toMatch(/ids\.length === 1/);
    // The by-id writers, never the active-tank ones.
    expect(handler).not.toMatch(/\blogMaintenance\(/);
    expect(handler).not.toMatch(/\baddFeeding\(/);
  });

  test("an ambiguous reminder asks rather than guesses", () => {
    // More than one tank due, or an id that no longer exists: open the app and
    // let the keeper say which. Guessing writes to a tank they did not touch.
    expect(handler).toMatch(/if \(!only\) \{ jumpTo\(/);
    expect(handler).toMatch(/tanks\.some\(\(tk\) => tk\.id === id\)/);
  });

  test("Later records nothing at all", () => {
    // The single most important rule here: a deferral that logs something is
    // a lie in the tank's history.
    const snoozeBranch = handler.slice(handler.indexOf('"Later"'));
    expect(snoozeBranch).not.toMatch(/markJobDone|addFeeding|logTest/);
  });

  test("an unrecognised key invents nothing", () => {
    // Every branch is an explicit key; there is no fallback that writes.
    expect(handler).toMatch(/res\.key === "waterChange"/);
    expect(handler).toMatch(/res\.key === "feeding"/);
    expect(handler).not.toMatch(/else\s*\{\s*(markJobDone|addFeedingToTank)/);
  });
});

describe("scheduling attaches the category", () => {
  const SRC = fs.readFileSync(path.join(__dirname, "..", "lib", "notifications.js"), "utf8");

  test("cadence reminders are chores, so they get Done and Later", () => {
    expect(SRC).toMatch(/category: CATEGORY\.chore/);
  });

  test("anything without a category still schedules, as info", () => {
    // A missing category must not drop the notification.
    expect(SRC).toContain("categoryIdentifier: r.category || CATEGORY.info");
  });

  test("categories are registered before anything is scheduled", () => {
    const sync = SRC.slice(SRC.indexOf("export async function syncReminders"));
    expect(sync.indexOf("registerCategories()")).toBeLessThan(sync.indexOf("scheduleNotificationAsync"));
  });
});

describe("a reminder says which tanks it is about", () => {
  // The chain that makes the handler's tank resolution possible at all: the id
  // has to survive from App's tank state, through the reminder builder, into
  // the notification payload, and back out of the response. It was dropped at
  // the very first step — tankStates carried `name` and not `id`.
  const fs = require("fs");
  const path = require("path");
  const ROOT = path.join(__dirname, "..");
  const notif = fs.readFileSync(path.join(ROOT, "lib/notifications.js"), "utf8");
  const app = fs.readFileSync(path.join(ROOT, "App.js"), "utf8");

  test("App sends each tank's id with its due flags", () => {
    const block = app.slice(app.indexOf("const tankStates = tanks.map"), app.indexOf("const reminderPayload"));
    expect(block).toMatch(/\bid: tk\.id,/);
    expect(block).toMatch(/testDue:/);
  });

  test("a chore reminder carries the ids it is due for", () => {
    expect(notif).toMatch(/tankIds: dueIds\(key\)/);
  });

  test("only the tanks actually due, per key", () => {
    // A water-change reminder must not claim the tanks that only need testing.
    const fn = notif.slice(notif.indexOf("const dueIds ="), notif.indexOf("const dueFor ="));
    expect(fn).toMatch(/waterTest.*testDue/s);
    expect(fn).toMatch(/waterChange.*changeDue/s);
  });

  test("feeding has no per-tank signal, so it claims them all", () => {
    // Deliberate: the handler then treats "many" as ambiguous and opens the
    // app, rather than this file inventing a tank it cannot know.
    const fn = notif.slice(notif.indexOf("const dueIds ="), notif.indexOf("const dueFor ="));
    expect(fn).toMatch(/flag \? tanks\.filter[\s\S]{0,40}: tanks/);
  });

  test("the ids ride in the payload and come back out", () => {
    expect(notif).toMatch(/data: \{[^}]*tankIds: r\.tankIds \|\| null/);
    expect(notif).toMatch(/tankIds: Array\.isArray\(data\.tankIds\) \? data\.tankIds : \[\]/);
  });

  test("a payload without ids yields an empty list, not undefined", () => {
    // Reminders scheduled by an older build have no tankIds; the handler must
    // read that as "unknown" and ask, not crash or guess.
    const { readResponse } = require("../lib/notifications");
    const res = readResponse({
      actionIdentifier: "done",
      notification: { request: { content: { data: { key: "waterChange", to: "log" } } } },
    });
    expect(res.tankIds).toEqual([]);
  });
});
