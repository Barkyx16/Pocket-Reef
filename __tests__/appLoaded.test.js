jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// The app booted onto a real tank.
//
// appBoot covers a fresh install, which is the state with the least data in it
// and therefore the fewest ways to go wrong. Almost every defect this app can
// have needs records to show up: a chart with two points, a stability grade
// over a swinging parameter, an empty bucket of salt, four years of history
// behind a maturity badge. This seeds storage first and then boots.

const AsyncStorageMod = require("@react-native-async-storage/async-storage");
const AsyncStorage = AsyncStorageMod.default || AsyncStorageMod;
const renderer = require("react-test-renderer");
const { Text } = require("react-native");

jest.mock("expo-font", () => ({ useFonts: () => [true, null], isLoaded: () => true, loadAsync: jest.fn() }));
jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("../lib/supabase", () => ({ supabase: null, isCloudConfigured: () => false }));

// Premium on. The Log tab — water testing and the whole analysis toolkit — is
// behind the paywall, so an unentitled test walks straight into the upsell and
// never renders a single tool. Entitlement is owned by RevenueCat, so it can
// only be faked at that boundary.
jest.mock("../lib/purchases", () => ({
  ENTITLEMENT_ID: "premium",
  isPurchasesReady: () => true,
  initPurchases: async () => true,
  identifyUser: async () => {},
  forgetUser: async () => {},
  hasPremiumEntitlement: () => true,
  checkEntitlement: async () => true,
  onEntitlementChange: () => () => {},
  getPackages: async () => [],
  getOfferingPlans: async () => [],
  purchasePackage: async () => ({ ok: true, entitled: true }),
  restorePurchases: async () => ({ ok: true, entitled: true }),
}));

const { newInventoryItem } = require("../lib/inventory");
const { newSourceProfile } = require("../lib/sourceWater");
const { newLightSchedule } = require("../lib/lighting");
const { newObservation } = require("../lib/observations");

jest.setTimeout(30000);

const flatten = (c) =>
  Array.isArray(c) ? c.map(flatten).join("") : typeof c === "string" || typeof c === "number" ? String(c) : "";
const textOf = (t) => t.root.findAllByType(Text).map((n) => flatten(n.props.children)).join(" | ");
const byLabel = (t, s) =>
  t.root.findAll((n) => typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.includes(s))[0];

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

const day = (n) => localDay(Date.now() - n * 86400000);

// A tank a real keeper would recognise: two years old, stocked, swinging
// alkalinity, an empty bucket of salt and lights left on too long.
const seededTank = () => ({
  id: "t1", name: "The Reef", gallons: 120, water: "salt", emoji: "🐠",
  createdAt: new Date(Date.now() - 730 * 86400000).toISOString(),
  notes: "", stock: ["Ocellaris Clownfish"], quantities: { "Ocellaris Clownfish": 2 },
  stockMeta: { "Ocellaris Clownfish": { addedAt: day(400), source: "LFS", price: 45, notes: "" } },
  waterTests: [
    { date: day(0), water: "salt", values: { ammonia: 0, nitrite: 0, nitrate: 12, phosphate: 0.04, ph: 8.1, alk: 7.8, calcium: 420, magnesium: 1350, temp: 78, salinity: 1.025 } },
    { date: day(3), water: "salt", values: { ammonia: 0, nitrite: 0, nitrate: 18, alk: 9.6, calcium: 415, temp: 78 } },
    { date: day(6), water: "salt", values: { ammonia: 0, nitrite: 0, nitrate: 24, alk: 7.4, calcium: 410, temp: 79 } },
    { date: day(13), water: "salt", values: { ammonia: 0, nitrite: 0, nitrate: 30, alk: 8.2, calcium: 405, temp: 78 } },
  ],
  journal: [{ id: 1, date: day(2), text: "Clown pair spawned", mood: "🐠", photo: null }],
  costs: [{ id: 2, date: day(30), label: "Salt", amount: 40, category: "Other" }],
  maintenance: { waterchange: day(14), glassclean: day(3) },
  quarantine: [{ id: 3, name: "Yellow Tang", startDate: new Date(Date.now() - 25 * 86400000).toISOString(), checks: { eating: true } }],
  feedings: [{ id: 4, date: day(0), food: "Frozen" }],
  treatments: [], losses: [{ id: 5, name: "Blue Tang", count: 1, reason: "died", date: day(300) }],
  waterChanges: [
    { id: "w1", date: day(14), pct: 25, gallons: 30 },
    { id: "w2", date: day(28), pct: 25, gallons: 30 },
    { id: "w3", date: day(42), pct: 25, gallons: 30 },
  ],
  equipment: [
    { id: "e1", name: "Return pump", category: "flow", price: 180, watts: 30, warrantyMonths: 24, installedAt: day(700), notes: "" },
    { id: "e2", name: "Heater", category: "heating", price: 40, watts: 300, warrantyMonths: 12, installedAt: day(700), notes: "" },
    { id: "e3", name: "Reef light", category: "lighting", price: 600, watts: 150, warrantyMonths: 24, installedAt: day(700), notes: "" },
  ],
  doses: [
    { id: "d1", key: "alk", ml: 12, date: day(0), note: "" },
    { id: "d2", key: "alk", ml: 12, date: day(2), note: "" },
    { id: "d3", key: "alk", ml: 12, date: day(4), note: "" },
  ],
  medDoses: [], upkeep: [], targets: {},
  inventory: [
    newInventoryItem({ name: "Salt mix", kind: "salt", stock: 0, perGallon: 0.5 }),
    newInventoryItem({ name: "Alk supplement", kind: "supplement", stock: 500, doseKey: "alk" }),
  ],
  sourceWater: newSourceProfile({ kind: "tap", values: { nitrate: 20 } }),
  lightSchedule: newLightSchedule({ on: "08:00", off: "22:00", profile: "sps" }),
  observations: { "Ocellaris Clownfish": [newObservation({ text: "Spawned", size: 2.5, date: day(60) })] },
});

// App is required once, at module scope. Calling jest.resetModules() to get a
// "fresh" app hands react-test-renderer a second copy of React, and every hook
// then throws `Cannot read properties of null (reading 'useRef')`. Seeding
// storage before mounting is enough — App reads it in its hydration effect.
const App = require("../App").default;

// Day keys built the way the app builds them: local calendar fields, not UTC.
// These fixtures previously used toISOString(), which is the exact assumption
// the app was fixed for — so in any non-UTC zone the fixture's "today" and the
// app's "today" were different days.
function localDay(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}




async function bootLoaded() {
  await AsyncStorage.clear();
  await AsyncStorage.multiSet([
    ["pr_tanks", JSON.stringify([seededTank()])],
    ["pr_activeTank", "t1"],
    ["pr_onboarded", "1"],
    ["pr_tankSized", "1"],
    ["pr_since", String(Date.now() - 730 * 86400000)],
  ]);
  let tree;
  await renderer.act(async () => { tree = renderer.create(<App />); });
  await settle();
  await renderer.act(async () => { await new Promise((r) => setTimeout(r, 2100)); });
  await settle();
  return tree;
}

describe("the app on a real, populated tank", () => {
  let tree;
  afterEach(async () => {
    if (tree) await renderer.act(async () => { tree.unmount(); });
    tree = null;
  });

  test("it boots straight into the tank, past onboarding", async () => {
    tree = await bootLoaded();
    const shown = textOf(tree);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown).toContain("The Reef");
  });

  test("every tab renders with real data in it", async () => {
    tree = await bootLoaded();
    const visited = [];
    for (const name of ["Home", "Species", "Tank", "Log", "Journal", "Health", "Games", "Profile"]) {
      const control = tab(tree, name);
      if (!control || typeof control.props.onPress !== "function") continue;
      await renderer.act(async () => { control.props.onPress(); });
      await settle(3);
      expect(tree.toJSON()).toBeTruthy();
      visited.push(name);
    }
    expect(visited.length).toBeGreaterThan(2);
  });

  test("the analysis reaches the home screen", async () => {
    tree = await bootLoaded();
    const home = tab(tree, "Home");
    if (home) { await renderer.act(async () => { home.props.onPress(); }); await settle(3); }
    const shown = textOf(tree);
    // An empty bucket of salt is rank 0 — it should be impossible to miss.
    expect(shown).toMatch(/Salt mix/i);
  });

  test("nothing renders as undefined, NaN or [object Object]", async () => {
    tree = await bootLoaded();
    const seen = [];
    for (const name of ["Home", "Species", "Tank", "Log", "Journal", "Health", "Profile"]) {
      const control = tab(tree, name);
      if (!control || typeof control.props.onPress !== "function") continue;
      await renderer.act(async () => { control.props.onPress(); });
      await settle(3);
      seen.push(textOf(tree));
    }
    const all = seen.join(" ");
    expect(all).not.toMatch(/\bundefined\b/);
    expect(all).not.toMatch(/\bNaN\b/);
    expect(all).not.toContain("[object Object]");
  });

  test("every tool in the Log toolkit opens without throwing", async () => {
    // The tab walk never reaches these: they sit behind a tool picker, so the
    // stability grade, the parameter chart, source water, the medication
    // calculator, the CSV importer, the light schedule and the running cost
    // are all one tap deeper than anything else tests.
    tree = await bootLoaded();
    const log = tab(tree, "Log");
    if (log) { await renderer.act(async () => { log.props.onPress(); }); await settle(3); }

    const labels = ["Cycle", "Upkeep", "Feeding", "Change", "Averages", "Forecast", "Since last",
      "Correct", "Stability", "How often", "Lights", "Running cost", "Source water",
      "Medicate", "Import", "Trends", "Ranges", "Timeline", "Costs"];
    const opened = [];
    for (const label of labels) {
      // Pills carry their label as child text; badges append " · n".
      const pill = tree.root.findAll((n) => typeof n.props?.onPress === "function"
        && n.findAllByType(Text).map((t) => flatten(t.props.children)).join(" ").trim().split(" · ")[0] === label)[0];
      if (!pill) continue;
      await renderer.act(async () => { pill.props.onPress(); });
      await settle(3);
      expect(tree.toJSON()).toBeTruthy();
      opened.push(label);
    }
    // If the picker can't be found this passes while proving nothing.
    expect(opened.length).toBeGreaterThan(10);
  });

  test("the parameter chart opens from the stability card", async () => {
    tree = await bootLoaded();
    const log = tab(tree, "Log");
    if (log) { await renderer.act(async () => { log.props.onPress(); }); await settle(3); }

    const stability = tree.root.findAll((n) => typeof n.props?.onPress === "function"
      && n.findAllByType(Text).map((t) => flatten(t.props.children)).join(" ").trim().split(" · ")[0] === "Stability")[0];
    expect(stability).toBeTruthy();
    await renderer.act(async () => { stability.props.onPress(); });
    await settle(3);

    // Alkalinity swings hard in this fixture, so it's graded and tappable.
    const row = byLabel(tree, "Tap for the full chart");
    expect(row).toBeTruthy();
    await renderer.act(async () => { row.props.onPress(); });
    await settle(3);
    expect(textOf(tree)).toMatch(/how steady it is/i);
  });

  test("no console errors with real data on screen", async () => {
    const errors = [];
    const spy = jest.spyOn(console, "error").mockImplementation((...a) => errors.push(a.join(" ")));
    tree = await bootLoaded();
    for (const name of ["Home", "Tank", "Log", "Health", "Profile"]) {
      const control = tab(tree, name);
      if (control && typeof control.props.onPress === "function") {
        await renderer.act(async () => { control.props.onPress(); });
        await settle(3);
      }
    }
    spy.mockRestore();
    expect(errors).toEqual([]);
  });
});
