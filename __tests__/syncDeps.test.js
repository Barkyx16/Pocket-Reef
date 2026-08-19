jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import fs from "fs";
import path from "path";
import { SYNCED_FIELDS } from "../lib/cloudSync";

const ROOT = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(ROOT, "App.js"), "utf8");

describe("changing a synced setting actually schedules a sync", () => {
  // The debounced push lists its inputs in a dependency array. A field that is
  // in the snapshot but missing from that array never triggers a push on its
  // own — it rides along with the next unrelated edit, which to the keeper
  // looks exactly like the setting not syncing. currency, since, strengths and
  // tankSized were all added to the snapshot at various points without anyone
  // touching the list.
  //
  // Found by reading eslint's exhaustive-deps warnings, which had been
  // suppressed by --quiet in the check script for as long as it existed.

  // The dependency array of the queueSnapshot effect.
  const deps = (() => {
    const at = app.indexOf("queueSnapshot(user.id, {");
    expect(at).toBeGreaterThan(0);
    const close = app.indexOf("}, [user, tanks,", at);
    const end = app.indexOf("]);", close);
    return app.slice(close + 4, end).split(",").map((s) => s.trim()).filter(Boolean);
  })();

  test("the effect's deps were found at all", () => {
    expect(deps.length).toBeGreaterThan(10);
    expect(deps).toContain("tanks");
  });

  test("every profile-level synced field is a dependency", () => {
    // Fields held per-tank travel inside `tanks`; these are the top-level ones.
    const PROFILE_FIELDS = [
      "xp", "activeDays", "careDone", "wishlist", "reminderPrefs", "profileName",
      "recent", "speciesNotes", "challengesDone", "bannerId", "lang", "unit",
      "currency", "since", "strengths", "tankSized", "activeTankId",
    ];
    expect(PROFILE_FIELDS.filter((f) => !deps.includes(f))).toEqual([]);
  });

  test("currency in particular, which was the one that regressed", () => {
    expect(SYNCED_FIELDS).toContain("currency");
    expect(deps).toContain("currency");
  });
});

describe("hook dependency exceptions are explained", () => {
  const files = ["App.js", ...["components", "screens", "lib"].flatMap((dir) =>
    fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".js")).map((f) => path.join(dir, f)))];

  test("every exhaustive-deps suppression says why", () => {
    // A bare disable is indistinguishable from a bug someone silenced. Each of
    // these is a case where adding the dependency would break the behaviour —
    // restarting a countdown, re-reading storage every render, overwriting text
    // as it is typed — and the reason belongs at the line.
    const bare = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      src.split("\n").forEach((line, i) => {
        if (!line.includes("eslint-disable-next-line react-hooks/exhaustive-deps")) return;
        if (!line.includes("--")) bare.push(`${f}:${i + 1}`);
      });
    }
    expect(bare).toEqual([]);
  });

  test("the check script fails on warnings rather than hiding them", () => {
    // `--quiet` suppressed every warning, so 37 of them accumulated unseen,
    // including the sync-dependency bug above.
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    expect(pkg.scripts.check).toContain("--max-warnings=0");
    expect(pkg.scripts.check).not.toContain("--quiet");
    expect(pkg.scripts.lint).toContain("--max-warnings=0");
  });
});
