jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getJSON, getRaw, setJSON, safeSetJSON, commitJSON, snapshotAll, restoreAll } from "../lib/storage";

// lib/storage.js had no tests. It holds the two-phase commit that protects
// every tank write — the code that decides whether four years of readings
// survive a write interrupted by the app being killed — and the fallbacks that
// keep a corrupt value from taking the app down on launch.

// The async-storage mock's methods are already jest.fn()s, so a spy placed on
// one is not reliably put back by restoreAllMocks — a mockRejectedValue set in
// one test leaked into the next and made a passing write look like a failure.
// Saved and restored by hand instead.
const ORIGINAL = { getItem: AsyncStorage.getItem, setItem: AsyncStorage.setItem };
beforeEach(async () => {
  AsyncStorage.getItem = ORIGINAL.getItem;
  AsyncStorage.setItem = ORIGINAL.setItem;
  await AsyncStorage.clear();
});

describe("a value that cannot be read does not take the app down", () => {
  test("corrupt JSON yields the fallback, not a throw", async () => {
    await AsyncStorage.setItem("pr_x", "{not json");
    await expect(getJSON("pr_x", { safe: true })).resolves.toEqual({ safe: true });
  });

  test("a read that throws yields the fallback too", async () => {
    AsyncStorage.getItem = jest.fn(() => Promise.reject(new Error("read failed")));
    await expect(getJSON("pr_x", { safe: true })).resolves.toEqual({ safe: true });
  });

  test("a missing key yields the fallback", async () => {
    await expect(getJSON("pr_missing", 42)).resolves.toBe(42);
    await expect(getRaw("pr_missing", "none")).resolves.toBe("none");
  });

  test("a stored null reads as absent, which is how 'clear' is written", async () => {
    // Deliberate: getJSON returns the fallback for a stored null. syncQueue
    // clears its pending slot by writing null and reading it back as nothing,
    // so this is a contract rather than an accident.
    await setJSON("pr_null", null);
    await expect(getJSON("pr_null", "FALLBACK")).resolves.toBe("FALLBACK");
    await expect(getJSON("pr_null")).resolves.toBe(null);
  });
});

describe("a write that fails reports it rather than pretending", () => {
  test("safeSetJSON returns false on a full disk", async () => {
    AsyncStorage.setItem = jest.fn(() => Promise.reject(new Error("QUOTA_EXCEEDED")));
    await expect(safeSetJSON("pr_x", { a: 1 })).resolves.toBe(false);
  });

  test("and true when it lands", async () => {
    await expect(safeSetJSON("pr_x", { a: 1 })).resolves.toBe(true);
    await expect(getJSON("pr_x")).resolves.toEqual({ a: 1 });
  });
});

describe("a write interrupted halfway is recovered, not lost", () => {
  // safeSetJSON writes to a pending slot, then the real key, then clears the
  // pending slot. Killed between the first and second step, the committed key
  // still holds the OLD value and the pending slot holds the new one.
  const PENDING = "pr_tanks__pending";

  test("the newer value is recovered from the pending slot", async () => {
    // Simulate the kill: pending written, commit never happened.
    await AsyncStorage.setItem(PENDING, JSON.stringify([{ id: "t1", name: "Recovered" }]));
    const out = await commitJSON("pr_tanks", []);
    expect(out).toEqual([{ id: "t1", name: "Recovered" }]);
  });

  test("and promoted, so the next read is clean", async () => {
    await AsyncStorage.setItem(PENDING, JSON.stringify([{ id: "t1" }]));
    await commitJSON("pr_tanks", []);
    await expect(getJSON("pr_tanks")).resolves.toEqual([{ id: "t1" }]);
  });

  test("a completed write leaves no pending slot behind", async () => {
    await safeSetJSON("pr_tanks", [{ id: "t1" }]);
    await expect(AsyncStorage.getItem(PENDING)).resolves.toBe(null);
  });

  test("a stale pending slot beside a good value is cleaned up, not preferred", async () => {
    // The committed value won the race; the pending one is leftover.
    await AsyncStorage.setItem("pr_tanks", JSON.stringify([{ id: "committed" }]));
    await AsyncStorage.setItem(PENDING, JSON.stringify([{ id: "stale" }]));
    await expect(commitJSON("pr_tanks", [])).resolves.toEqual([{ id: "committed" }]);
  });

  test("nothing anywhere returns the fallback", async () => {
    await expect(commitJSON("pr_tanks", "EMPTY")).resolves.toBe("EMPTY");
  });

  test("MISSING is a Symbol so that recovery is not skipped by a null", async () => {
    // The subtlety the sentinel exists for: undefined as a fallback would
    // become null via getJSON's default parameter, and a null committed value
    // would then look like a real one — skipping the pending slot entirely.
    // A cleared key with a real pending value must still recover.
    await setJSON("pr_tanks", null);
    await AsyncStorage.setItem("pr_tanks__pending", JSON.stringify([{ id: "t1" }]));
    await expect(commitJSON("pr_tanks", "FALLBACK")).resolves.toEqual([{ id: "t1" }]);
  });
});

describe("the whole-store snapshot", () => {
  test("round-trips every key", async () => {
    await setJSON("pr_tanks", [{ id: "t1" }]);
    await AsyncStorage.setItem("pr_xp", "500");
    const snap = await snapshotAll();
    await AsyncStorage.clear();
    await restoreAll(snap);
    await expect(getJSON("pr_tanks")).resolves.toEqual([{ id: "t1" }]);
    await expect(getRaw("pr_xp")).resolves.toBe("500");
  });

  test("a backup cannot nest inside a backup", async () => {
    // Skipping the staging and quarantine slots is what stops each snapshot
    // containing the last one, doubling in size every time.
    await setJSON("pr_tanks", [{ id: "t1" }]);
    await AsyncStorage.setItem("pr_tanks__pending", JSON.stringify([{ id: "x" }]));
    const snap = await snapshotAll();
    expect(Object.keys(snap).some((k) => k.includes("__pending"))).toBe(false);
  });

  test("restoring rubbish does not throw", async () => {
    for (const v of [null, undefined, "text", 42, []]) {
      await expect(restoreAll(v)).resolves.not.toThrow?.();
    }
  });
});
