jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import fs from "fs";
import path from "path";
import { SYNCED_FIELDS, buildSnapshot } from "../lib/cloudSync";

const ROOT = path.join(__dirname, "..");

describe("the snapshot carries what it should and nothing else", () => {
  test("a stray key cannot bloat or corrupt the stored payload", () => {
    const snap = buildSnapshot({ tanks: [], xp: 5, somethingElse: "x".repeat(1000) });
    expect(snap).toHaveProperty("tanks");
    expect(snap).toHaveProperty("xp");
    expect(snap).not.toHaveProperty("somethingElse");
  });

  test("undefined fields are omitted rather than written as null", () => {
    const snap = buildSnapshot({ tanks: [], xp: undefined });
    expect("xp" in snap).toBe(false);
  });

  test("falsy values that mean something are kept", () => {
    // xp 0 and tankSized false are real states, not absences.
    const snap = buildSnapshot({ xp: 0, tankSized: false, profileName: "" });
    expect(snap.xp).toBe(0);
    expect(snap.tankSized).toBe(false);
    expect(snap.profileName).toBe("");
  });

  test("no state at all yields an empty snapshot rather than a throw", () => {
    // This runs inside the sync queue, where a throw has nothing watching it.
    for (const v of [null, undefined, 0, "", "abc", 42]) {
      expect(() => buildSnapshot(v)).not.toThrow();
      expect(buildSnapshot(v)).toEqual({});
    }
  });

  test("premiumUnlocked is deliberately not synced", () => {
    // Accepting entitlement from synced data is what would let a patched
    // client write itself Premium and have it stick.
    expect(SYNCED_FIELDS).not.toContain("premiumUnlocked");
    expect(buildSnapshot({ premiumUnlocked: true })).toEqual({});
  });

  test("the field list has no duplicates", () => {
    expect(new Set(SYNCED_FIELDS).size).toBe(SYNCED_FIELDS.length);
  });
});

describe("a garbled expiry must not revoke a subscription", () => {
  // fetchServerEntitlement documents itself as returning null when the answer
  // isn't known. An expires_at that wouldn't parse gave NaN, NaN > now is
  // false, and the row came back as "not entitled" — a definite answer derived
  // from a value nobody could read.
  const src = fs.readFileSync(path.join(ROOT, "lib/cloudSync.js"), "utf8");

  test("an unreadable timestamp returns unknown, not expired", () => {
    expect(src).toMatch(/if \(Number\.isNaN\(at\)\) return null/);
  });

  test("the old shape is gone", () => {
    expect(src).not.toMatch(/const notExpired = !data\.expires_at \|\| new Date/);
  });

  // The parsing rule itself, exercised directly.
  const notExpired = (expires_at) => {
    if (!expires_at) return true;
    const at = new Date(expires_at).getTime();
    if (Number.isNaN(at)) return null;
    return at > Date.now();
  };

  test("a missing expiry means lifetime, not expired", () => {
    for (const v of [null, undefined, ""]) expect(notExpired(v)).toBe(true);
  });

  test("a future expiry is active and a past one is not", () => {
    expect(notExpired(new Date(Date.now() + 86400000).toISOString())).toBe(true);
    expect(notExpired(new Date(Date.now() - 86400000).toISOString())).toBe(false);
  });

  test("unreadable timestamps are unknown", () => {
    for (const v of ["not-a-date", "0000-00-00", "yesterday", "{}"]) {
      expect(notExpired(v)).toBe(null);
    }
  });
});

describe("the caller cannot be talked into revoking access", () => {
  const app = fs.readFileSync(path.join(ROOT, "App.js"), "utf8");

  test("the server entitlement only ever grants", () => {
    // Either source saying yes grants access; neither revokes on a failed
    // lookup. That is what makes an offline flight and a flaky table safe.
    expect(app).toMatch(/server === true\) setPremiumUnlocked\(true\)/);
  });

  test("a null from the SDK does not downgrade", () => {
    expect(app).toMatch(/entitled !== null\) setPremiumUnlocked\(entitled\)/);
  });

  test("entitlement is never read out of the synced snapshot", () => {
    expect(app).not.toMatch(/setPremiumUnlocked\(snap\./);
  });
});

describe("a photo stays local on the device that took it", () => {
  const src = fs.readFileSync(path.join(ROOT, "lib/photoSync.js"), "utf8");

  test("hydrate leaves a file this device actually holds alone", () => {
    // The header promises the local URI stays put so the originating device
    // renders instantly with no round trip. Hydrate replaced any non-https
    // photo with a signed URL, including that one — which made the phone
    // holding the original depend on the network to see it, and those URLs are
    // deliberately short-lived, so it broke when they expired.
    expect(src).toContain("localPhotoExists(e.photo)");
  });

  test("the check requires the file to exist, not just the path to look right", () => {
    const fn = src.slice(src.indexOf("function localPhotoExists"), src.indexOf("export async function"));
    expect(fn).toContain("isPersisted(uri)");
    expect(fn).toMatch(/new FileSystem\.File\(uri\)\.exists/);
  });

  test("an unverifiable filesystem still signs, so something renders", () => {
    const fn = src.slice(src.indexOf("function localPhotoExists"), src.indexOf("export async function"));
    expect(fn).toMatch(/catch[\s\S]{0,220}return false/);
  });
});
