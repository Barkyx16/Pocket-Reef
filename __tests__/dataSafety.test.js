jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// The actions that can destroy more than one record.
//
// Undo covers a mistap and dies with the session. Anything that takes out a
// whole tank, the entire stock list, or a synced account's unsent work needs
// more than that, because the person who does it by accident is exactly the
// person who then force-quits.
//
// Source-level checks: these are one-line guards inside App's callbacks, and
// driving them through a mounted App would test the Alert mock rather than the
// guard. What matters is that the guard exists on every destructive path.

const fs = require("fs");
const path = require("path");
const APP = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");

// The body of a `const NAME = useStableCallback(...)` declaration.
function callbackBody(name) {
  const start = APP.indexOf(`const ${name} = useStableCallback(`);
  if (start === -1) return null;
  let i = APP.indexOf("{", start), depth = 0, j = i;
  while (j < APP.length) {
    if (APP[j] === "{") depth++;
    else if (APP[j] === "}") { depth--; if (!depth) break; }
    j++;
  }
  return APP.slice(start, j + 1);
}

describe("a snapshot is taken before anything irreversible", () => {
  test.each([
    ["deleteTank", "a tank holds every reading and photo ever written for it"],
    ["clearStock", "it takes the stock list, counts and per-animal records"],
    ["applyImport", "an import overwrites everything the keeper owns"],
    ["importTests", "backfilling years of readings rewrites the history"],
  ])("%s", (name) => {
    const body = callbackBody(name);
    expect(body).toBeTruthy();
    expect(body).toMatch(/createRestorePoint\(/);
  });

  test("the restore point is named, so the list is readable weeks later", () => {
    ["deleteTank", "clearStock", "applyImport"].forEach((name) => {
      const call = callbackBody(name).match(/createRestorePoint\("([^"]+)"/);
      expect(call).toBeTruthy();
      expect(call[1].length).toBeGreaterThan(8);
    });
  });

  test("taking one can never block the action it protects", () => {
    // A rejected snapshot must not stop a delete the user asked for.
    ["deleteTank", "clearStock"].forEach((name) => {
      expect(callbackBody(name)).toMatch(/createRestorePoint\([^)]*\)\.catch\(/);
    });
  });
});

describe("signing out with unsynced work", () => {
  const body = callbackBody("handleSignOut");

  test("is caught rather than done silently", () => {
    expect(body).toMatch(/syncPending/);
    expect(body).toMatch(/Alert\.alert/);
  });

  test("offers to sync first, and to leave anyway", () => {
    expect(body).toMatch(/Sync, then sign out/);
    expect(body).toMatch(/Sign out anyway/);
    expect(body).toMatch(/style: "destructive"/);
  });

  test("signing out anyway still signs out", () => {
    // The escape hatch has to actually work — a warning you can't get past is
    // worse than no warning.
    expect(body).toMatch(/signOutNow\(\)/);
  });

  test("a clean, fully-synced account isn't interrupted", () => {
    // The guard is conditional, not unconditional.
    expect(body).toMatch(/if \(syncPending && user\)/);
    expect(body.trimEnd().endsWith("signOutNow();\n  }")).toBe(true);
  });

  test("the actual sign-out still detaches the account properly", () => {
    const out = callbackBody("signOutNow");
    expect(out).toMatch(/forgetUser\(/);
    expect(out).toMatch(/cancelPendingSync\(/);
    expect(out).toMatch(/cloudLoaded\.current = false/);
  });
});
