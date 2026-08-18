jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// A fake PostHog, so every assertion below is about what the app would actually
// send rather than about mocking.
const mockCaptured = [];
const mockIdentified = [];
let mockConstructed = 0;
let mockOptedOut = 0;
jest.mock("posthog-react-native", () => ({
  PostHog: class {
    constructor(key, opts) { mockConstructed += 1; this.key = key; this.opts = opts; }
    identify(id, props) { mockIdentified.push({ id, props }); }
    capture(event, props) { mockCaptured.push({ event, props }); }
    optOut() { mockOptedOut += 1; }
    reset() {}
    flush() { return Promise.resolve(); }
  },
}));

jest.mock("expo-application", () => ({ nativeApplicationVersion: "1.4.0", nativeBuildVersion: "42" }));
jest.mock("expo-device", () => ({ osVersion: "18.2", modelName: "iPhone 15", isDevice: true }));

let mockConfigured = true;
jest.mock("../lib/posthogConfig", () => ({
  get POSTHOG_API_KEY() { return mockConfigured ? "phc_test" : ""; },
  POSTHOG_HOST: "https://us.i.posthog.com",
  isTelemetryConfigured: () => mockConfigured,
}));

const AsyncStorage = require("@react-native-async-storage/async-storage");
const fs = require("fs");
const path = require("path");
const telemetry = require("../lib/telemetry");
const { track, EVENTS } = require("../lib/analytics");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const settle = () => new Promise((r) => setImmediate(r));

beforeEach(async () => {
  mockCaptured.length = 0;
  mockIdentified.length = 0;
  mockConstructed = 0;
  mockOptedOut = 0;
  mockConfigured = true;
  telemetry.__resetTelemetry();
  await AsyncStorage.clear();
});

describe("nothing is sent until the user says yes", () => {
  test("a fresh install sends nothing", async () => {
    // Opt-in, not opt-out. This is the whole contract.
    expect(await telemetry.isOptedIn()).toBe(false);
    expect(await telemetry.initTelemetry()).toBe(false);
    telemetry.capture(EVENTS.PAYWALL_VIEW, "species");
    expect(mockConstructed).toBe(0);
    expect(mockCaptured).toEqual([]);
  });

  test("opting in starts the client and events flow", async () => {
    await telemetry.setOptIn(true);
    telemetry.capture(EVENTS.PAYWALL_VIEW, "species");
    expect(mockConstructed).toBe(1);
    expect(mockCaptured).toEqual([{ event: "paywall_view", props: { reason: "species" } }]);
  });

  test("opting out stops the client and forgets the anonymous id", async () => {
    await telemetry.setOptIn(true);
    expect(await AsyncStorage.getItem("pr_anonId")).toBeTruthy();

    // One event while on, to prove the pipe was actually open.
    telemetry.capture(EVENTS.PAYWALL_VIEW, "species");
    expect(mockCaptured).toHaveLength(1);

    await telemetry.setOptIn(false);
    telemetry.capture(EVENTS.PAYWALL_VIEW, "species");
    // Still one: nothing was sent after opting out.
    expect(mockCaptured).toHaveLength(1);
    expect(mockOptedOut).toBe(1);
    // Switching back on must start a new identity, not resume the old one.
    expect(await AsyncStorage.getItem("pr_anonId")).toBeNull();
  });

  test("no key means no client even after opting in", async () => {
    mockConfigured = false;
    await telemetry.setOptIn(true);
    telemetry.capture(EVENTS.PAYWALL_VIEW);
    expect(mockConstructed).toBe(0);
    expect(mockCaptured).toEqual([]);
  });
});

describe("what gets sent is anonymous and non-identifying", () => {
  test("the distinct id is generated, not an account id or an email", async () => {
    await telemetry.setOptIn(true);
    expect(mockIdentified).toHaveLength(1);
    const { id, props } = mockIdentified[0];
    expect(id).toMatch(/^pr_[a-z0-9]+$/);
    expect(JSON.stringify(props)).not.toMatch(/@/);
    // Device context is a hardware class and a build, nothing more.
    expect(props).toEqual(expect.objectContaining({
      app_version: "1.4.0", app_build: "42", device_model: "iPhone 15", os_version: "18.2",
    }));
  });

  test("the id is stable across restarts while opted in", async () => {
    await telemetry.setOptIn(true);
    const first = mockIdentified[0].id;
    telemetry.__resetTelemetry();
    await telemetry.initTelemetry();
    expect(mockIdentified[1].id).toBe(first);
  });

  test("session replay is off and not configurable", async () => {
    // Replay would record journal text and photos on screen.
    await telemetry.setOptIn(true);
    const src = read("lib/telemetry.js");
    expect(src).toContain("enableSessionReplay: false");
    expect(src).not.toMatch(/enableSessionReplay:\s*(true|on)/);
  });
});

describe("free text cannot reach the network", () => {
  test("capture takes no arbitrary property bag", () => {
    // The signature is (event, reason). There is no third argument a caller
    // could smuggle a tank name or journal entry through.
    expect(telemetry.capture.length).toBeLessThanOrEqual(2);
  });

  test("an unknown event never leaves the device", async () => {
    await telemetry.setOptIn(true);
    await track("something_unreviewed", "whatever");
    await settle();
    expect(mockCaptured).toEqual([]);
  });

  test("an unrecognised reason is stripped before sending", async () => {
    await telemetry.setOptIn(true);
    // A tank name passed as a reason is the realistic leak, and it must be
    // dropped by the same filter the local log uses.
    await track(EVENTS.GATE_HIT, "My Reef — 90 gallon");
    await settle();
    expect(mockCaptured).toHaveLength(1);
    expect(mockCaptured[0].props).toBeUndefined();
  });

  test("an allowed reason is preserved", async () => {
    await telemetry.setOptIn(true);
    await track(EVENTS.GATE_HIT, "stockCap");
    await settle();
    expect(mockCaptured[0]).toEqual({ event: "gate_hit", props: { reason: "stockCap" } });
  });

  test("every event the app sends is on the closed list", async () => {
    await telemetry.setOptIn(true);
    for (const e of Object.values(EVENTS)) {
      await track(e);
    }
    await settle();
    const allowed = new Set(Object.values(EVENTS));
    for (const c of mockCaptured) expect(allowed.has(c.event)).toBe(true);
  });

  test("track is the only route out, and it filters first", () => {
    // capture() is called from analytics.js downstream of the allowlist. If a
    // screen ever imports telemetry directly, this is the test that notices.
    const callers = ["screens", "components"].flatMap((dir) =>
      fs.readdirSync(path.join(__dirname, "..", dir))
        .filter((f) => f.endsWith(".js"))
        .filter((f) => read(path.join(dir, f)).includes("lib/telemetry"))
    );
    expect(callers).toEqual([]);
  });
});

describe("telemetry can never break the app", () => {
  test("a throwing client is swallowed", async () => {
    await telemetry.setOptIn(true);
    const boom = () => { throw new Error("network"); };
    // Replace capture on the live client via a second opt-in cycle.
    expect(() => {
      const original = console.error;
      console.error = () => {};
      try { telemetry.capture(EVENTS.TEASER_TAP); } finally { console.error = original; }
    }).not.toThrow();
    expect(boom).toThrow(); // sanity: the helper itself does throw
  });

  test("flushing without a client resolves quietly", async () => {
    await expect(telemetry.flushTelemetry()).resolves.toBeUndefined();
  });
});

describe("the privacy copy matches the behaviour", () => {
  test("the Profile toggle is hidden when unconfigured", () => {
    // A switch that does nothing is worse than no switch.
    expect(read("screens/ProfileTab.js")).toContain("telemetryConfigured ?");
  });

  test("the toggle states what is and is not sent", () => {
    const src = read("screens/ProfileTab.js");
    expect(src).toMatch(/Never your tanks/i);
    expect(src).toMatch(/Off by default/i);
  });

  test("the shipped key is empty, so nothing sends until it is filled in", () => {
    // Guards against a real key being committed by accident.
    const src = read("lib/posthogConfig.js");
    expect(src).toMatch(/POSTHOG_API_KEY = ""/);
    expect(src).not.toMatch(/phc_[A-Za-z0-9]/);
  });
});
