jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// The app itself, actually mounted and driven.
//
// Everything else in this suite tests a screen, a card or a function. Nothing
// had ever rendered App — which is where tab routing, the hydration effects,
// the deep-link handlers, the auth listener and roughly ninety props per screen
// all meet. A broken import, a hook called conditionally, a prop renamed on one
// side of a call: none of it was catchable, and all of it is a white screen on
// a real phone.
//
// Getting past the splash matters as much as mounting. The gate is
// `!hydrated || !splashDone || !authChecked || !fontsLoaded`, and a test that
// stops at the splash proves only that the import graph resolves — which is
// exactly what the first version of this file did.

const renderer = require("react-test-renderer");
const { Text } = require("react-native");

jest.mock("expo-font", () => ({ useFonts: () => [true, null], isLoaded: () => true, loadAsync: jest.fn() }));
jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));

// Local-only mode. The real client points at a live project, so in a test its
// getSession() never settles and authChecked never flips — the app sits behind
// the splash forever. Unconfigured is also a real, shipping state.
jest.mock("../lib/supabase", () => ({ supabase: null, isCloudConfigured: () => false }));

const App = require("../App").default;

jest.setTimeout(30000);

const flatten = (c) =>
  Array.isArray(c) ? c.map(flatten).join("") : typeof c === "string" || typeof c === "number" ? String(c) : "";
const textOf = (t) => t.root.findAllByType(Text).map((n) => flatten(n.props.children)).join(" | ");
const byLabel = (t, s) =>
  t.root.findAll((n) => typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.includes(s))[0];
const btn = (t, text) =>
  t.root.findAll((n) => typeof n.props?.onPress === "function"
    && n.findAllByType(Text).map((x) => flatten(x.props.children)).join(" ").trim() === text)[0];

// setImmediate drains the whole microtask queue; a bare `await Promise.resolve()`
// advances it by one tick, and hydration is a long chain of awaits — the first
// version of this helper stopped several dozen ticks short and never left the
// splash.

// Tab labels are the tab name exactly, or "Name, Premium" when locked. A
// substring match is not good enough: `byLabel(tree, "Log")` happily matched
// `Mark "Log a feeding" complete`, so the tab walk was pressing a Today action
// and asserting the app survived it — passing while testing nothing.
const tab = (t, name) =>
  t.root.findAll((n) => {
    const l = n.props && n.props.accessibilityLabel;
    return typeof l === "string" && (l === name || l === `${name}, Premium`) && typeof n.props.onPress === "function";
  })[0];
const settle = async (n = 5) => {
  for (let i = 0; i < n; i++) await renderer.act(async () => { await new Promise((r) => setImmediate(r)); });
};

// Boots, waits out the 1.9s splash, and lands in the app proper. Real timers
// throughout: the splash timeout is armed inside an effect during mount, and a
// fake clock installed afterwards can't fire a timer it never saw.
async function boot() {
  let tree;
  await renderer.act(async () => { tree = renderer.create(<App />); });
  await settle();
  await renderer.act(async () => { await new Promise((r) => setTimeout(r, 2100)); });
  await settle();
  return tree;
}

// Onboarding stands between a fresh install and the tabs.
async function passOnboarding(tree) {
  for (let i = 0; i < 8; i++) {
    const skip = btn(tree, "Skip") || btn(tree, "Next") || btn(tree, "Start exploring");
    if (!skip) break;
    await renderer.act(async () => { skip.props.onPress(); });
    await settle(2);
  }
}

describe("the app boots and is usable", () => {
  let tree;
  afterEach(async () => {
    if (tree) await renderer.act(async () => { tree.unmount(); });
    tree = null;
  });

  test("it gets past the splash to a real screen", async () => {
    tree = await boot();
    const shown = textOf(tree);
    // An empty tree here means the app is still behind the splash, which is
    // how this test was vacuous the first time it was written.
    expect(shown.length).toBeGreaterThan(0);
    expect(shown).toMatch(/Pocket Reef/i);
  });

  test("onboarding leads into the app rather than dead-ending", async () => {
    tree = await boot();
    await passOnboarding(tree);
    expect(tree.toJSON()).toBeTruthy();
    expect(textOf(tree).length).toBeGreaterThan(0);
  });

  test("every tab renders without throwing", async () => {
    tree = await boot();
    await passOnboarding(tree);

    const tabs = ["Home", "Species", "Tank", "Log", "Journal", "Health", "Games", "More", "Profile"];
    const visited = [];
    for (const name of tabs) {
      const control = tab(tree, name);
      if (!control || typeof control.props.onPress !== "function") continue;
      await renderer.act(async () => { control.props.onPress(); });
      await settle(3);
      expect(tree.toJSON()).toBeTruthy();
      visited.push(name);
    }
    // If the tab bar can't be found this test passes while proving nothing.
    expect(visited.length).toBeGreaterThan(2);
  });

  test("nothing renders as undefined, NaN or [object Object]", async () => {
    tree = await boot();
    await passOnboarding(tree);
    const seen = [];
    for (const name of ["Home", "Species", "Tank", "Log", "Journal", "Health", "Profile"]) {
      const control = tab(tree, name);
      if (!control || typeof control.props.onPress !== "function") continue;
      await renderer.act(async () => { control.props.onPress(); });
      await settle(3);
      seen.push(textOf(tree));
    }
    const all = seen.join(" ");
    // The three ways a template literal betrays a missing value on screen.
    expect(all).not.toMatch(/\bundefined\b/);
    expect(all).not.toMatch(/\bNaN\b/);
    expect(all).not.toContain("[object Object]");
  });

  test("no console errors escape a full boot and tab walk", async () => {
    const errors = [];
    const spy = jest.spyOn(console, "error").mockImplementation((...a) => errors.push(a.join(" ")));
    tree = await boot();
    await passOnboarding(tree);
    for (const name of ["Home", "Tank", "Log", "Profile"]) {
      const control = tab(tree, name);
      if (control && typeof control.props.onPress === "function") {
        await renderer.act(async () => { control.props.onPress(); });
        await settle(3);
      }
    }
    spy.mockRestore();
    // Prop-type complaints, key warnings and "cannot update during render" all
    // land here, and all of them are real defects.
    expect(errors).toEqual([]);
  });
});
