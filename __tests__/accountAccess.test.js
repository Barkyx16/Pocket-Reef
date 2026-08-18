const fs = require("fs");
const path = require("path");

// A free account's own account controls must be reachable.
//
// Profile was gated with the rest of the paid tabs, which meant a free keeper
// who had signed up could not sign out, export their data, change their
// language or units, manage reminders — or delete the account. Charging
// somebody to delete an account they created for free is a trust problem in
// its own right, and App Store Review 5.1.1(v) requires in-app account
// deletion for any app offering account creation, which this one does.
//
// Asserted against the source because the gate is a single set in App and the
// consequence of it silently coming back is a store rejection.
const APP = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");
const PROFILE = fs.readFileSync(path.join(__dirname, "..", "screens", "ProfileTab.js"), "utf8");
const ACCOUNT = fs.readFileSync(path.join(__dirname, "..", "components", "AccountCloudCard.js"), "utf8");

const gatedTabs = () => {
  const m = APP.match(/const PREMIUM_TAB_IDS = new Set\(\[([^\]]*)\]\)/);
  expect(m).toBeTruthy();
  return m[1].split(",").map((s) => s.trim().replace(/["']/g, "")).filter(Boolean);
};

describe("the account is not behind the paywall", () => {
  test("Profile is not a premium-gated tab", () => {
    expect(gatedTabs()).not.toContain("profile");
  });

  test("the tabs that ARE gated are the paid features, and profile isn't one", () => {
    const gated = gatedTabs();
    expect(gated).toEqual(expect.arrayContaining(["log", "tank"]));
    expect(gated.length).toBeGreaterThan(0);
  });

  test("account deletion exists and lives on Profile", () => {
    // The rule only bites because the app offers account creation.
    expect(ACCOUNT).toContain("delete-account");
    expect(PROFILE).toContain("AccountCloudCard");
  });

  test("export and settings live on Profile too, so they're reachable as well", () => {
    expect(PROFILE).toContain("onExport");
    expect(PROFILE).toMatch(/onSetLanguage|onSetUnit/);
  });
});

describe("what stays paid", () => {
  test("multi-tank comparison is gated inside the screen, not in front of it", () => {
    // A free keeper should see what they'd get, not a wall where their
    // settings used to be.
    expect(PROFILE).toMatch(/premiumUnlocked \?[\s\S]{0,40}CollapsibleCard storageKey="fleet"/);
  });

  test("the paid tabs still render the wall rather than the screen", () => {
    // The gate itself must survive: the fix is about which tabs it covers.
    expect(APP).toContain("PREMIUM_TAB_IDS.has(activeTab) && !premiumUnlocked");
    expect(APP).toContain("<LockedTab");
  });
});
