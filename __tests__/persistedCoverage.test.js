jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

const fs = require("fs");
const path = require("path");
const { SYNCED_FIELDS } = require("../lib/cloudSync");

const APP = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");

// Every value the app persists must be a deliberate decision: it either travels
// with the account, or it's device-local for a stated reason.
//
// This exists because the previous guard couldn't catch the bug that prompted
// it. That test compared the export payload against SYNCED_FIELDS — and when
// `strengths` was missing from BOTH, it passed happily. Supplement strengths
// are copied off a bottle by hand and the entire consumption calculation is
// inert without them, so a new device silently stopped measuring.
//
// The mapping below is the documentation. A newly persisted key with no entry
// fails this test, which forces the question rather than letting it slip.
const STORAGE_TO_FIELD = {
  pr_tanks: "tanks",
  pr_activeTank: "activeTankId",
  pr_xp: "xp",
  pr_activeDays: "activeDays",
  pr_careDone: "careDone",
  pr_wishlist: "wishlist",
  pr_reminders: "reminderPrefs",
  pr_profileName: "profileName",
  pr_since: "since",
  pr_recent: "recent",
  pr_speciesNotes: "speciesNotes",
  pr_challengesDone: "challengesDone",
  pr_banner: "bannerId",
  pr_lang: "lang",
  pr_unit: "unit",
  pr_doseStrengths: "strengths",
  pr_tankSized: "tankSized",
};

// Deliberately device-local, with the reason each one doesn't travel.
const DEVICE_LOCAL = {
  pr_lastEdit: "A write timestamp used to stop an older cloud copy overwriting newer local work. Syncing it would be circular.",
  pr_onboarded: "Whether this device has shown onboarding. A new device should decide for itself.",
  pr_fodSeen: "Which day's Fish of the Day was dismissed — cosmetic and per-device.",
  pr_lastBackup: "When this device last exported a file. Meaningless on another device.",
};

const persistedKeys = [...APP.matchAll(/scheduleWrite\("(pr_[A-Za-z]+)"/g)].map((m) => m[1]);

describe("everything persisted is accounted for", () => {
  test("the scan actually found the writes", () => {
    // A regex that silently matched nothing would make this whole file vacuous.
    expect(persistedKeys.length).toBeGreaterThan(15);
    expect(persistedKeys).toContain("pr_tanks");
  });

  test("every persisted key is either synced or declared device-local", () => {
    for (const key of new Set(persistedKeys)) {
      const known = key in STORAGE_TO_FIELD || key in DEVICE_LOCAL;
      // If this fails, the new key needs a decision — not a default.
      expect({ key, known }).toEqual({ key, known: true });
    }
  });

  test("every key mapped to a field is actually in SYNCED_FIELDS", () => {
    for (const [key, field] of Object.entries(STORAGE_TO_FIELD)) {
      expect({ key, synced: SYNCED_FIELDS.includes(field) }).toEqual({ key, synced: true });
    }
  });

  test("the hand-entered ones travel, because nothing else holds a copy", () => {
    // speciesNotes was lost this way once; strengths was lost the same way.
    for (const field of ["speciesNotes", "strengths"]) {
      expect(SYNCED_FIELDS).toContain(field);
    }
  });
});

describe("sync, export and restore agree", () => {
  const payload = (() => {
    const marker = APP.indexOf('app: "Pocket Reef"');
    const start = APP.lastIndexOf("const payload = {", marker);
    const body = APP.slice(APP.indexOf("{", start) + 1, APP.indexOf("};", start));
    return body.split(",").map((p) => (p.match(/^\s*([A-Za-z_$][\w$]*)\s*(:|$)/) || [])[1]).filter(Boolean);
  })();

  test("the export payload carries every synced field", () => {
    for (const field of SYNCED_FIELDS) expect(payload).toContain(field);
  });

  test("both cloud pushes carry every synced field", () => {
    // Two queueSnapshot call sites; one drifting from the other means a field
    // syncs on a timer but not when you tap "Sync now", or vice versa.
    const calls = [...APP.matchAll(/queueSnapshot\(user\.id,\s*\{([\s\S]*?)\}/g)].map((m) => m[1]);
    expect(calls.length).toBe(2);
    for (const body of calls) {
      for (const field of SYNCED_FIELDS) {
        expect({ field, present: new RegExp(`\\b${field}\\b`).test(body) }).toEqual({ field, present: true });
      }
    }
  });

  test("a pulled snapshot restores the newly synced values", () => {
    // Syncing a field up and never reading it back down is the same data loss
    // wearing a different hat.
    const body = APP.slice(APP.indexOf("const applySnapshot"), APP.indexOf("// Writes the snapshot") + 1 || undefined);
    expect(APP).toContain("if (snap.strengths");
    expect(APP).toContain("if (typeof snap.tankSized === \"boolean\")");
    expect(body.length).toBeGreaterThan(0);
  });

  test("an imported file restores them too", () => {
    expect(APP).toContain("if (p.strengths");
    expect(APP).toContain("if (typeof p.tankSized === \"boolean\")");
  });
});

describe("destructive controls announce themselves", () => {
  // A screen-reader user hearing only "button" on a control that replaces every
  // tank, log and photo on the device is being asked to gamble.
  const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

  const DESTRUCTIVE = [
    ["components/ImportSheet.js", "Restore this backup, replacing everything on this device"],
    ["screens/ProfileTab.js", "Import a backup, replacing everything on this device"],
    ["screens/ProfileTab.js", "Export a backup of all your data"],
  ];

  test.each(DESTRUCTIVE)("%s labels its action, and says what it replaces", (file, label) => {
    expect(read(file)).toContain(label);
  });

  test("the import label makes the consequence explicit, not just the verb", () => {
    // "Import" alone doesn't tell you it overwrites.
    for (const [file, label] of DESTRUCTIVE.filter(([, l]) => /Import|Restore/.test(l))) {
      expect(label).toMatch(/replacing everything/);
      expect(read(file)).toContain(label);
    }
  });

  test("account actions are labelled too", () => {
    const src = read("components/AccountCloudCard.js");
    for (const label of ["Sync now", "Change the email address on this account", "Send a password reset email"]) {
      expect(src).toContain(label);
    }
  });
});
