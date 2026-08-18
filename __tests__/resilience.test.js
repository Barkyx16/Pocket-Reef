jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// A crash in one screen, and what survives it.
//
// The app was wrapped in a single boundary, so a render error anywhere replaced
// the tab bar, the header and nine working screens with one apology. The blast
// radius should be the thing that broke.

const renderer = require("react-test-renderer");
const { Text, View } = require("react-native");
const AsyncStorageMod = require("@react-native-async-storage/async-storage");
const AsyncStorage = AsyncStorageMod.default || AsyncStorageMod;

const { ErrorBoundary } = require("../components/ErrorBoundary");
const { recordCrash, listCrashes, clearCrashes, formatCrashes, newCrashRecord, MAX_CRASHES } = require("../lib/crashLog");

const flatten = (c) =>
  Array.isArray(c) ? c.map(flatten).join("") : typeof c === "string" || typeof c === "number" ? String(c) : "";
const textOf = (t) => t.root.findAllByType(Text).map((n) => flatten(n.props.children)).join(" | ");
const btn = (t, s) =>
  t.root.findAll((n) => typeof n.props?.onPress === "function"
    && n.findAllByType(Text).map((x) => flatten(x.props.children)).join(" ").trim() === s)[0];

// A component that throws on demand. The flag is module-scoped rather than a
// prop: retry remounts the SAME element, so a prop captured when the element
// was created would still be the old value and the retry could never pass.
let bombLive = true;
function Bomb() {
  if (bombLive) throw new Error("Nitrate is not a function");
  return <Text>screen is fine</Text>;
}

const mount = (el) => {
  let tree;
  renderer.act(() => { tree = renderer.create(el); });
  return tree;
};

describe("a screen that throws", () => {
  // React logs caught errors; that's expected here and would otherwise drown
  // the run in stack traces.
  let spy;
  beforeEach(() => { bombLive = true; spy = jest.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => spy.mockRestore());

  test("is contained, and says the data is safe", () => {
    const tree = mount(<ErrorBoundary compact><Bomb /></ErrorBoundary>);
    const shown = textOf(tree);
    expect(shown).toMatch(/this screen hit a problem/i);
    expect(shown).toMatch(/data is safe/i);
    // The message is shown so a report can name it.
    expect(shown).toMatch(/Nitrate is not a function/);
  });

  test("offers a retry that remounts the subtree", () => {
    const tree = mount(<ErrorBoundary compact><Bomb /></ErrorBoundary>);
    expect(textOf(tree)).toMatch(/hit a problem/i);

    // Whatever caused it has been fixed — most render crashes are one screen's
    // transient state, which is why retry is offered before anything drastic.
    bombLive = false;
    renderer.act(() => { btn(tree, "Try again").props.onPress(); });
    expect(textOf(tree)).toContain("screen is fine");
  });

  test("the compact form doesn't take over the whole app", () => {
    // Siblings outside the boundary keep rendering — the tab bar and header
    // live there.
    const tree = mount(
      <View>
        <Text>tab bar</Text>
        <ErrorBoundary compact><Bomb /></ErrorBoundary>
      </View>
    );
    expect(textOf(tree)).toContain("tab bar");
  });

  test("a healthy screen renders untouched", () => {
    bombLive = false;
    const tree = mount(<ErrorBoundary compact><Bomb /></ErrorBoundary>);
    expect(textOf(tree)).toBe("screen is fine");
  });

  test("the boundary hands the error to its reporter", () => {
    const onError = jest.fn();
    mount(<ErrorBoundary compact onError={onError}><Bomb /></ErrorBoundary>);
    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls[0][0].message).toMatch(/not a function/);
  });

  test("a reporter that itself throws can't take the boundary down", () => {
    const tree = mount(
      <ErrorBoundary compact onError={() => { throw new Error("reporter exploded"); }}>
        <Bomb />
      </ErrorBoundary>
    );
    expect(textOf(tree)).toMatch(/hit a problem/i);
  });
});

describe("the crash log", () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  test("records what failed, where", async () => {
    await recordCrash(new Error("boom"), { componentStack: "at HomeTab" }, { screen: "home", version: "1.1.0 (1)" });
    const list = await listCrashes();
    expect(list).toHaveLength(1);
    expect(list[0].message).toBe("boom");
    expect(list[0].screen).toBe("home");
    expect(list[0].componentStack).toContain("HomeTab");
  });

  test("keeps only the most recent few, newest first", async () => {
    for (let i = 0; i < MAX_CRASHES + 3; i++) await recordCrash(new Error(`crash ${i}`), {}, { screen: "log" });
    const list = await listCrashes();
    expect(list).toHaveLength(MAX_CRASHES);
    expect(list[0].message).toBe(`crash ${MAX_CRASHES + 2}`);
  });

  test("long stacks are truncated rather than filling storage", () => {
    const err = new Error("x");
    err.stack = "y".repeat(9000);
    expect(newCrashRecord(err, {}, {}).stack.length).toBeLessThan(2000);
  });

  test("recording never throws, whatever it's handed", async () => {
    await expect(recordCrash(undefined, undefined, undefined)).resolves.toBeDefined();
    await expect(recordCrash("just a string", null, {})).resolves.toBeDefined();
  });

  test("the report is plain text that survives an email", async () => {
    await recordCrash(new Error("boom"), { componentStack: "at TankTab" }, { screen: "tank", version: "1.1.0 (1)" });
    const text = formatCrashes(await listCrashes());
    expect(text).toContain("boom");
    expect(text).toContain("tank");
    expect(text).toContain("When:");
    expect(text).toContain("Error:");
    // Not JSON or markup — a real stack legitimately contains <anonymous>, so
    // the check is that the report isn't a serialised object.
    expect(text.trim().startsWith("{")).toBe(false);
    expect(text).not.toContain("[object Object]");
  });

  test("an empty log says so rather than producing a blank report", () => {
    expect(formatCrashes([])).toMatch(/no crashes recorded/i);
  });

  test("it can be cleared", async () => {
    await recordCrash(new Error("boom"), {}, {});
    expect(await clearCrashes()).toEqual([]);
    expect(await listCrashes()).toEqual([]);
  });
});
