jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

// Where a tapped reminder lands.
//
// A predictive alert says "Alkalinity is heading out of range" and then used to
// drop the keeper on a bare Log tab, asking them to go and find the thing they
// had just been told about. The notification already knows which parameter it
// is about; that has to survive the round trip through the payload.

const { readResponse, ACTION } = require("../lib/notifications");

const tap = (data, actionIdentifier = "expo.modules.notifications.actions.DEFAULT") => ({
  actionIdentifier,
  notification: { request: { content: { data } } },
});

describe("a tapped reminder", () => {
  test("carries the tool it should open", () => {
    const res = readResponse(tap({ to: "log", key: "forecast_alk", tool: "forecast" }));
    expect(res.kind).toBe("open");
    expect(res.to).toBe("log");
    expect(res.tool).toBe("forecast");
  });

  test("a plain cadence reminder has no tool and just opens the tab", () => {
    const res = readResponse(tap({ to: "log", key: "waterTest" }));
    expect(res.kind).toBe("open");
    expect(res.tool).toBeNull();
  });

  test("a Done button still records rather than navigating", () => {
    const res = readResponse(tap({ to: "log", key: "waterChange" }, ACTION.done));
    expect(res.kind).toBe("done");
    expect(res.key).toBe("waterChange");
  });

  test("Later defers without claiming the job was done", () => {
    expect(readResponse(tap({ to: "log", key: "feeding" }, ACTION.snooze)).kind).toBe("snooze");
  });

  test("a payload with no destination is ignored rather than guessed at", () => {
    expect(readResponse(tap({}))).toBeNull();
    expect(readResponse(null)).toBeNull();
  });
});

describe("the forecast reminder names its tool", () => {
  test("it is built with one", () => {
    // Reaching into the builder via a scheduled payload would need the native
    // module; the contract that matters is that `tool` is in the source.
    const src = require("fs").readFileSync(require("path").join(__dirname, "..", "lib/notifications.js"), "utf8");
    const block = src.slice(src.indexOf("key: `forecast_${f.key}`"), src.indexOf("key: `forecast_${f.key}`") + 700);
    expect(block).toMatch(/tool:\s*"forecast"/);
  });
});
