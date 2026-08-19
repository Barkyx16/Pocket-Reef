jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import fs from "fs";
import path from "path";
import renderer from "react-test-renderer";
import { Text } from "react-native";
import { ScrollToTopContext, useScrollToTop } from "../lib/scrollToTop";

const ROOT = path.join(__dirname, "..");

// A ScrollView ref is the class instance, not a host node, so createNodeMock
// never applies. What matters is the hook's contract — when the signal
// changes, call the right method on whatever the ref is holding — so the test
// puts a recorder in the ref and checks exactly that.
function harness(node) {
  const calls = [];
  let captured = null;
  function Screen() {
    const ref = useScrollToTop();
    captured = ref;
    return <Text>content</Text>;
  }
  const render = (signal) => renderer.create(
    <ScrollToTopContext.Provider value={signal}><Screen /></ScrollToTopContext.Provider>);
  let tree;
  renderer.act(() => { tree = render(0); });
  if (node) captured.current = node(calls);
  const bump = (v) => renderer.act(() => {
    tree.update(<ScrollToTopContext.Provider value={v}><Screen /></ScrollToTopContext.Provider>);
  });
  return { calls, bump, refOf: () => captured };
}

const scrollView = (calls) => ({ scrollTo: (arg) => calls.push(arg) });
const flatList = (calls) => ({ scrollToOffset: (arg) => calls.push(arg) });

describe("tapping the tab you are already on returns you to the top", () => {
  test("nothing scrolls on mount", () => {
    // Otherwise every screen would scroll itself the moment it appeared.
    const { calls } = harness(scrollView);
    expect(calls).toEqual([]);
  });

  test("a bump scrolls to the top, animated", () => {
    const h = harness(scrollView);
    h.bump(1);
    expect(h.calls).toEqual([{ y: 0, animated: true }]);
  });

  test("two taps are two scrolls, which is why it is a counter", () => {
    // A boolean already true is indistinguishable from one that never changed,
    // so the second tap would do nothing.
    const h = harness(scrollView);
    h.bump(1); h.bump(2); h.bump(3);
    expect(h.calls).toHaveLength(3);
  });

  test("a re-render that does not bump scrolls nothing", () => {
    const h = harness(scrollView);
    h.bump(1);
    h.bump(1);
    expect(h.calls).toHaveLength(1);
  });

  test("a FlatList is scrolled by its own method", () => {
    const h = harness(flatList);
    h.bump(1);
    expect(h.calls).toEqual([{ offset: 0, animated: true }]);
  });

  test("a screen with no scroller attached does not throw", () => {
    const h = harness(null);
    expect(() => h.bump(1)).not.toThrow();
  });

  test("a node that throws mid-animation does not take the screen down", () => {
    const h = harness(() => ({ scrollTo: () => { throw new Error("unmounted"); } }));
    expect(() => h.bump(1)).not.toThrow();
  });
});

describe("it is wired everywhere it should be", () => {
  const screens = fs.readdirSync(path.join(ROOT, "screens")).filter((f) => f.endsWith(".js"));

  test("every tab screen attaches the ref to its own scroller", () => {
    const offenders = [];
    for (const f of screens) {
      // AuthScreen is not a tab; it has no tab bar to tap.
      if (f === "AuthScreen.js") continue;
      const src = fs.readFileSync(path.join(ROOT, "screens", f), "utf8");
      if (!src.includes("useScrollToTop()")) offenders.push(f);
      else if (!src.includes("ref={scrollRef}")) offenders.push(`${f} (hook without ref)`);
    }
    expect(offenders).toEqual([]);
  });

  test("App only bumps when the tab is already active", () => {
    // Bumping on every tab change would scroll a screen you are arriving at,
    // which is not the same gesture and not what anyone asked for.
    const app = fs.readFileSync(path.join(ROOT, "App.js"), "utf8");
    expect(app).toMatch(/if \(id === activeTab\) \{ setScrollSignal\(\(n\) => n \+ 1\); return; \}/);
  });

  test("the provider wraps the screens", () => {
    const app = fs.readFileSync(path.join(ROOT, "App.js"), "utf8");
    expect(app).toContain("<ScrollToTopContext.Provider value={scrollSignal}>");
    expect(app).toContain("</ScrollToTopContext.Provider>");
  });
});
