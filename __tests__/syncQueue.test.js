jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// The queue's whole job is surviving a failing network, so the push is mocked
// and driven deliberately rather than left to chance.
const mockPush = jest.fn();
jest.mock("../lib/cloudSync", () => ({
  pushSnapshot: (...a) => mockPush(...a),
  buildSnapshot: (state) => ({ tanks: state.tanks || [] }),
}));

const AsyncStorage = require("@react-native-async-storage/async-storage");
const { queueSnapshot, resumePendingSync, cancelPendingSync, hasPendingSync } = require("../lib/syncQueue");

// Timers are faked so backoff can be advanced, but the promise plumbing must
// stay real or nothing the queue awaits ever resolves.
const settle = () => new Promise((r) => setImmediate(r));

beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ["setImmediate", "nextTick", "queueMicrotask"] });
  mockPush.mockReset();
  cancelPendingSync();
  await AsyncStorage.clear();
});
afterEach(() => { cancelPendingSync(); jest.useRealTimers(); });

describe("durable outbound sync", () => {
  test("a successful send leaves nothing pending", async () => {
    mockPush.mockResolvedValue({ ok: true });
    await queueSnapshot("user-1", { tanks: [{ id: "t" }] });
    await settle();
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(await hasPendingSync()).toBe(false);
  });

  test("a failed send is KEPT, not forgotten — the bug this exists to fix", async () => {
    mockPush.mockResolvedValue({ ok: false, error: "offline" });
    await queueSnapshot("user-1", { tanks: [{ id: "t" }] });
    await settle();
    expect(await hasPendingSync()).toBe(true);
  });

  test("it retries on a backoff until it lands", async () => {
    mockPush.mockResolvedValueOnce({ ok: false, error: "offline" }).mockResolvedValue({ ok: true });
    await queueSnapshot("user-1", { tanks: [{ id: "t" }] });
    await settle();
    expect(mockPush).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(3000);
    await settle();
    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(await hasPendingSync()).toBe(false);
  });

  test("every outcome is reported so the UI can be honest", async () => {
    const seen = [];
    mockPush.mockResolvedValueOnce({ ok: false, error: "offline" }).mockResolvedValue({ ok: true });
    await queueSnapshot("user-1", { tanks: [] }, (r) => seen.push(r));
    await settle();
    jest.advanceTimersByTime(3000);
    await settle();
    expect(seen[0]).toMatchObject({ ok: false, pending: true });
    expect(seen[seen.length - 1]).toMatchObject({ ok: true, pending: false });
  });

  test("a newer snapshot supersedes the one waiting", async () => {
    mockPush.mockResolvedValue({ ok: false, error: "offline" });
    await queueSnapshot("user-1", { tanks: [{ id: "old" }] });
    await settle();
    await queueSnapshot("user-1", { tanks: [{ id: "new" }] });
    await settle();
    // The payload is a full-state upsert, so pushing a stale queued copy later
    // would undo newer work.
    const last = mockPush.mock.calls[mockPush.mock.calls.length - 1];
    expect(last[1].tanks[0].id).toBe("new");
  });

  test("work left by a previous session resumes on launch", async () => {
    mockPush.mockResolvedValue({ ok: false, error: "offline" });
    await queueSnapshot("user-1", { tanks: [{ id: "t" }] });
    await settle();
    cancelPendingSync();
    mockPush.mockResolvedValue({ ok: true });

    const resumed = await resumePendingSync("user-1");
    await settle();
    expect(resumed).toBe(true);
    expect(await hasPendingSync()).toBe(false);
  });

  test("another account's snapshot is DROPPED, never pushed into this one", async () => {
    mockPush.mockResolvedValue({ ok: false, error: "offline" });
    await queueSnapshot("user-1", { tanks: [{ id: "t" }] });
    await settle();
    cancelPendingSync();
    mockPush.mockReset();

    const resumed = await resumePendingSync("user-2");
    await settle();
    expect(resumed).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();
    expect(await hasPendingSync()).toBe(false);
  });

  test("signing out stops the retries", async () => {
    mockPush.mockResolvedValue({ ok: false, error: "offline" });
    await queueSnapshot("user-1", { tanks: [] });
    await settle();
    const before = mockPush.mock.calls.length;
    cancelPendingSync();
    jest.advanceTimersByTime(300000);
    await settle();
    expect(mockPush.mock.calls.length).toBe(before);
  });

  test("a queue with no user is a no-op", async () => {
    await queueSnapshot(null, { tanks: [] });
    await settle();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
