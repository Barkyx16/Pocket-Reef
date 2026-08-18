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
  const handler = APP.slice(APP.indexOf("useEffect(() => onReminderTap"), APP.indexOf("useEffect(() => onReminderTap") + 1200);

  test("an open navigates", () => {
    expect(handler).toMatch(/kind === "open"[\s\S]{0,40}jumpTo\(to\)/);
  });

  test("Done records the job rather than navigating", () => {
    expect(handler).toContain('logMaintenance("waterchange")');
    expect(handler).toContain("addFeeding(");
  });

  test("Later records nothing at all", () => {
    // The single most important rule here: a deferral that logs something is
    // a lie in the tank's history.
    const snoozeBranch = handler.slice(handler.indexOf('"Later"'));
    expect(snoozeBranch).not.toMatch(/logMaintenance|addFeeding|logTest/);
  });

  test("an unrecognised key invents nothing", () => {
    // Every branch is an explicit key; there is no fallback that writes.
    expect(handler).toMatch(/res\.key === "waterChange"/);
    expect(handler).toMatch(/res\.key === "feeding"/);
    expect(handler).not.toMatch(/else\s*\{\s*(logMaintenance|addFeeding)/);
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
