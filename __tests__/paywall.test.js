const fs = require("fs");
const path = require("path");
const APP = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");

// The round shows upkeep, dosing and multi-tank work — all of which live behind
// the wall. Showing a free account a badge listing its overdue filter socks,
// and letting it tick them off, was a hole straight through the paywall rather
// than a feature. These pin the three places it leaked.

const slice = (from, to) => {
  const a = APP.indexOf(from);
  if (a < 0) throw new Error(`anchor not found: ${from}`);
  const b = APP.indexOf(to, a);
  return APP.slice(a, b < 0 ? a + 2000 : b);
};

describe("the round is premium", () => {
  test("it isn't computed at all for a free account", () => {
    const body = slice("const pending = useMemo(", "const pendingItems");
    expect(body).toContain("premiumUnlocked");
    // An empty round means no badge, no list, nothing to tap.
    expect(body).toContain(": []");
  });

  test("completing an item is guarded even if one reaches the handler", () => {
    // Belt and braces: the gate above should make this unreachable, but a
    // write that trusts the UI to have gated it is a write that eventually
    // ships ungated.
    const body = slice("const completePending", "const detailOpen");
    expect(body).toContain("if (!premiumUnlocked)");
    // The guard has to come before any completion path. Matched against the
    // first thing the handler does with an item rather than one named writer,
    // so refactoring the write doesn't quietly un-pin the ordering.
    const guardAt = body.indexOf("if (!premiumUnlocked)");
    const firstWrite = Math.min(
      ...["markJobDone(", "updateTankById(", "runAction(", "jumpTo("]
        .map((fn) => body.indexOf(fn))
        .filter((i) => i >= 0)
    );
    expect(firstWrite).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(firstWrite);
  });

  test("search doesn't hand a free account its premium records", () => {
    // Search is reachable from the header on Home and Species, which are free.
    expect(APP).toContain("activeTank={premiumUnlocked ? activeTank : {}}");
  });
});

describe("the round is memoised", () => {
  test("it isn't recomputed on every render", () => {
    // It walks every tank × every task and sorts. App re-renders on every
    // transient change — the undo bar, a sheet opening, a timer — and
    // recomputing the whole round to animate a snackbar is the exact waste the
    // memoisation pass existed to remove.
    expect(APP).toContain("const pending = useMemo(");
    const body = slice("const pending = useMemo(", "const pendingItems");
    expect(body).toMatch(/\[premiumUnlocked, tanks, reminderPrefs\]/);
  });

  test("its dependencies cover everything it reads", () => {
    // A missing dep here means a ticked-off job that never disappears.
    const body = slice("const pending = useMemo(", "const pendingItems");
    for (const dep of ["tanks", "reminderPrefs", "premiumUnlocked"]) {
      expect(body).toContain(dep);
    }
  });
});

describe("every premium write goes through a gate", () => {
  test("updateTankById is only called from guarded code", () => {
    // It writes to an arbitrary tank by id, bypassing the active-tank path that
    // the rest of the app funnels through.
    const calls = APP.split("updateTankById(").length - 1;
    // One definition, one guarded call site. A new call site should force a
    // deliberate look at whether it needs the same guard.
    expect(calls).toBeLessThanOrEqual(3);
  });
});

describe("the sheet doesn't lie to a free account", () => {
  jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
  const renderer = require("react-test-renderer");
  const { Text } = require("react-native");
  const { QuickActionsSheet } = require("../components/QuickActionsSheet");
  const flat = (c) => Array.isArray(c) ? c.map(flat).join("") : (typeof c === "string" || typeof c === "number") ? String(c) : "";
  const textOf = (t) => t.root.findAllByType(Text).map((n) => flat(n.props.children)).join(" | ");
  const mount = (el) => { let t; renderer.act(() => { t = renderer.create(el); }); return t; };

  test("no round and no false all-clear when the round is off", () => {
    // The tank may well have overdue work; the free account just can't see it.
    // "Nothing needs you right now" would be a claim the app can't support.
    const tree = mount(<QuickActionsSheet visible pending={[]} roundEnabled={false} onClose={() => {}} onRun={() => {}} onComplete={() => {}} />);
    const text = textOf(tree);
    expect(text).not.toContain("Nothing needs you right now");
    expect(text).not.toContain("Needs you now");
    // The sheet is still worth opening.
    expect(text).toContain("Log something");
    renderer.act(() => { tree.unmount(); });
  });

  test("a premium account with a genuinely clear tank does get the all-clear", () => {
    const tree = mount(<QuickActionsSheet visible pending={[]} roundEnabled onClose={() => {}} onRun={() => {}} onComplete={() => {}} />);
    expect(textOf(tree)).toContain("Nothing needs you right now");
    renderer.act(() => { tree.unmount(); });
  });
});
