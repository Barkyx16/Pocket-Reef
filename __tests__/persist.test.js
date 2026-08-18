jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// The scheduler sits between every edit in the app and the disk. Its two jobs
// pull against each other — coalesce writes so a stepper drag doesn't
// serialise the whole store twelve times, but never lose the last edit — so
// both halves need holding down by tests.
const AsyncStorage = require("@react-native-async-storage/async-storage");
const { scheduleWrite, writeNow, flushWrites, hasPendingWrites, __resetWrites, WRITE_DELAY_MS } = require("../lib/persist");

// Timers are faked so the debounce can be advanced, but promises must stay
// real or nothing the writer awaits ever settles.
const settle = () => new Promise((r) => setImmediate(r));

beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ["setImmediate", "nextTick", "queueMicrotask"] });
  __resetWrites();
  await AsyncStorage.clear();
});
afterEach(() => { __resetWrites(); jest.useRealTimers(); });

const readJSON = async (key) => JSON.parse(await AsyncStorage.getItem(key));

describe("coalescing", () => {
  test("a burst of writes to one key lands once, with the last value", async () => {
    let n = 0;
    for (let i = 1; i <= 12; i++) { n = i; scheduleWrite("pr_q", () => n); }
    expect(hasPendingWrites()).toBe(true);
    // Nothing has hit the disk yet — that's the whole point.
    expect(await AsyncStorage.getItem("pr_q")).toBeNull();

    await flushWrites();
    expect(await readJSON("pr_q")).toBe(12);
  });

  test("the value is read at write time, not at schedule time", async () => {
    // The thunk is what makes coalescing safe: a stale snapshot captured on the
    // first call of a burst would write an old value over a newer one.
    const box = { v: "first" };
    scheduleWrite("pr_late", () => box.v);
    box.v = "latest";
    await flushWrites();
    expect(await readJSON("pr_late")).toBe("latest");
  });

  test("separate keys don't collide", async () => {
    scheduleWrite("pr_a", () => 1);
    scheduleWrite("pr_b", () => 2);
    await flushWrites();
    expect(await readJSON("pr_a")).toBe(1);
    expect(await readJSON("pr_b")).toBe(2);
  });

  test("a thunk returning undefined writes nothing rather than clobbering", async () => {
    await writeNow("pr_gone", { real: true });
    scheduleWrite("pr_gone", () => undefined);
    await flushWrites();
    expect(await readJSON("pr_gone")).toEqual({ real: true });
  });
});

describe("timers", () => {
  test("a scheduled write lands on its own after the delay", async () => {
    scheduleWrite("pr_timer", () => "written");
    jest.advanceTimersByTime(WRITE_DELAY_MS + 1);
    await settle();
    expect(await readJSON("pr_timer")).toBe("written");
    expect(hasPendingWrites()).toBe(false);
  });

  test("flush clears the queue so a later timer can't double-write", async () => {
    scheduleWrite("pr_once", () => "a");
    await flushWrites();
    expect(hasPendingWrites()).toBe(false);
    await AsyncStorage.setItem("pr_once", JSON.stringify("changed-elsewhere"));
    jest.advanceTimersByTime(WRITE_DELAY_MS * 3);
    await settle();
    expect(await readJSON("pr_once")).toBe("changed-elsewhere");
  });
});

describe("writeNow", () => {
  test("bypasses the delay", async () => {
    await writeNow("pr_now", { immediate: true });
    expect(await readJSON("pr_now")).toEqual({ immediate: true });
  });

  test("cancels a pending write for the same key", async () => {
    // Otherwise the queued stale value would land 400ms after the urgent one
    // and silently undo it.
    scheduleWrite("pr_race", () => "stale");
    await writeNow("pr_race", "urgent");
    jest.advanceTimersByTime(WRITE_DELAY_MS * 3);
    await settle();
    expect(await readJSON("pr_race")).toBe("urgent");
    expect(hasPendingWrites()).toBe(false);
  });
});

describe("commit mode", () => {
  test("tank-shaped writes go through the two-phase commit and clean up", async () => {
    scheduleWrite("pr_tanks", () => [{ id: "1", name: "Reef" }], "commit");
    await flushWrites();
    expect(await readJSON("pr_tanks")).toEqual([{ id: "1", name: "Reef" }]);
    // The staging slot must not survive a completed write, or the next launch's
    // recovery path finds a phantom pending copy.
    expect(await AsyncStorage.getItem("pr_tanks__pending")).toBeNull();
  });
});
