jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Writes failing, and being told about it.
//
// safeSetJSON has always returned false on failure, `write` returned that
// boolean, and every caller discarded it behind `.catch(() => {})`. On a device
// with no free space every save silently did nothing while the app kept showing
// the reading the keeper had just typed — it was still in memory. The next
// launch had none of it. That looks identical to success until the data is
// gone, which makes it the worst failure this app can have.

const AsyncStorageMod = require("@react-native-async-storage/async-storage");
const AsyncStorage = AsyncStorageMod.default || AsyncStorageMod;
const {
  scheduleWrite, flushWrites, writeHealth, onWriteFailure,
  __resetWrites, __resetWriteHealth, FAILURE_THRESHOLD, WRITE_DELAY_MS,
} = require("../lib/persist");

const settle = () => new Promise((r) => setTimeout(r, WRITE_DELAY_MS + 60));

describe("write health", () => {
  let setItem;
  beforeEach(async () => {
    __resetWrites();
    __resetWriteHealth();
    await AsyncStorage.clear();
    setItem = jest.spyOn(AsyncStorage, "setItem");
  });
  afterEach(() => setItem.mockRestore());

  test("a healthy device reports healthy", async () => {
    scheduleWrite("pr_test", () => ({ a: 1 }));
    await settle();
    await flushWrites();
    expect(writeHealth().ok).toBe(true);
    expect(writeHealth().consecutiveFailures).toBe(0);
  });

  test("a run of failures is noticed", async () => {
    setItem.mockRejectedValue(new Error("QuotaExceededError"));
    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      scheduleWrite(`pr_fail_${i}`, () => ({ a: i }));
      await settle();
    }
    await flushWrites();
    expect(writeHealth().ok).toBe(false);
    expect(writeHealth().consecutiveFailures).toBeGreaterThanOrEqual(FAILURE_THRESHOLD);
    expect(writeHealth().lastFailure).toBeTruthy();
  });

  test("subscribers are told, once it's a pattern rather than a blip", async () => {
    const onFail = jest.fn();
    const off = onWriteFailure(onFail);
    setItem.mockRejectedValue(new Error("full"));

    scheduleWrite("pr_one", () => ({ a: 1 }));
    await settle();
    await flushWrites();
    // One failure is a blip, not a broken device.
    expect(onFail).not.toHaveBeenCalled();

    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      scheduleWrite(`pr_more_${i}`, () => ({ a: i }));
      await settle();
    }
    await flushWrites();
    expect(onFail).toHaveBeenCalled();
    off();
  });

  test("recovery clears the count, so a transient blip doesn't stick", async () => {
    setItem.mockRejectedValueOnce(new Error("full"));
    scheduleWrite("pr_a", () => ({ a: 1 }));
    await settle();
    await flushWrites();
    expect(writeHealth().consecutiveFailures).toBe(1);

    scheduleWrite("pr_b", () => ({ b: 2 }));
    await settle();
    await flushWrites();
    expect(writeHealth().consecutiveFailures).toBe(0);
    expect(writeHealth().ok).toBe(true);
  });

  test("a subscriber that throws can't break the write path", async () => {
    onWriteFailure(() => { throw new Error("bad handler"); });
    setItem.mockRejectedValue(new Error("full"));
    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      scheduleWrite(`pr_x_${i}`, () => ({ a: i }));
      await settle();
    }
    await expect(flushWrites()).resolves.not.toThrow();
  });

  test("a writer that throws counts the same as one returning false", async () => {
    setItem.mockImplementation(() => { throw new Error("sync throw"); });
    scheduleWrite("pr_sync", () => ({ a: 1 }));
    await settle();
    await flushWrites();
    expect(writeHealth().consecutiveFailures).toBeGreaterThan(0);
  });
});
