jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Every screen and every shortcut surface, actually rendered.
//
// The suite had 264 tests and not one of them mounted a component — all of it
// tested core.js and lib/. That left the entire UI layer, which is most of the
// code, covered only by whether someone happened to open that screen in Expo
// before shipping. A typo'd import, a prop read off undefined, a hook called
// conditionally: none of it was catchable by CI.
//
// These are deliberately shallow. They aren't asserting layout — they assert
// that each screen mounts, survives its effects, and puts its own words on
// screen. That's the class of failure that turns into a white screen on a
// user's phone.
const renderer = require("react-test-renderer");

const { HomeTab } = require("../screens/HomeTab");
const { SpeciesTab } = require("../screens/SpeciesTab");
const { TankTab } = require("../screens/TankTab");
const { LogTab } = require("../screens/LogTab");
const { JournalTab } = require("../screens/JournalTab");
const { HealthTab } = require("../screens/HealthTab");
const { GamesTab } = require("../screens/GamesTab");
const { MoreTab } = require("../screens/MoreTab");
const { ProfileTab } = require("../screens/ProfileTab");
const { PremiumTab } = require("../screens/PremiumTab");

const { QuickActionsSheet, QuickActionsFab } = require("../components/QuickActionsSheet");
const { UniversalSearch } = require("../components/UniversalSearch");
const { AppHeader, TankMenu } = require("../components/AppHeader");
const { TabShortcutSheet } = require("../components/TabShortcutSheet");
const { UndoSnackbar } = require("../components/UndoSnackbar");
const { ACTIONS, QUICK_ACTION_IDS } = require("../lib/shortcuts");
const { getSpecies } = require("../core");

// Real catalog names. An invented one renders an empty state instead of the
// populated path the test means to exercise, and passes anyway — so the names
// are asserted to exist before anything uses them.
const FISH_A = "Ocellaris Clownfish";
const FISH_B = "Blue Tang";

const TANK = {
  id: "t1", name: "My Reef", gallons: 40, water: "salt", emoji: "🐠",
  stock: [], quantities: {}, notes: "", waterTests: [], journal: [], costs: [],
  maintenance: {}, quarantine: [], feedings: [], treatments: [], createdAt: new Date().toISOString(),
};

// Renders inside act() so effects run, then returns the tree. unmount() is
// wrapped too — tearing down outside act() lets cleanup-triggered updates
// escape, which React reports as an act() warning on an otherwise green test.
function mount(element) {
  let tree;
  renderer.act(() => { tree = renderer.create(element); });
  const raw = tree.unmount.bind(tree);
  tree.unmount = () => renderer.act(() => { raw(); });
  return tree;
}

// Reads text out of the React tree rather than the rendered JSON. Modal
// children don't appear in toJSON() under the native preset, and half the
// shortcut surfaces are modals.
// Children arrive as arrays whenever a <Text> interpolates ("Log" + " shortcuts"),
// so they're flattened before joining or every interpolated string is unmatchable.
const { Text } = require("react-native");
const flatten = (c) =>
  Array.isArray(c) ? c.map(flatten).join("") : typeof c === "string" || typeof c === "number" ? String(c) : "";
const textOf = (tree) => tree.root.findAllByType(Text).map((n) => flatten(n.props.children)).join(" | ");

// findAll matches composite *and* host nodes, so one labelled Pressable can
// come back three times. Callers care whether the control exists, not how many
// nodes RN used to draw it.
const byLabel = (tree, label) => tree.root.findAll((n) => n.props.accessibilityLabel === label);
const hasControl = (tree, label) => byLabel(tree, label).length > 0;

test("the fixtures name species the catalog actually has", () => {
  expect(getSpecies(FISH_A)).toBeTruthy();
  expect(getSpecies(FISH_B)).toBeTruthy();
});

describe("every screen mounts", () => {
  // Props are the same shape App.js passes, with empty data — the state a
  // brand-new install is in, which is the one most likely to hit an undefined.
  const cases = [
    ["HomeTab", () => <HomeTab tank={[]} tankGallons={40} tanks={[TANK]} activeTankId="t1" onGoToTab={() => {}} openSpecies={() => {}} />],
    ["SpeciesTab", () => <SpeciesTab tank={[]} tankGallons={40} openSpecies={() => {}} openDisease={() => {}} premiumUnlocked />],
    ["TankTab", () => <TankTab tank={[]} tankGallons={40} tankWater="salt" tanks={[TANK]} activeTankId="t1" openSpecies={() => {}} />],
    ["LogTab", () => <LogTab tank={[]} tankGallons={40} tankWater="salt" waterTests={[]} journal={[]} activeDays={[]} costs={[]} maintenance={{}} />],
    ["JournalTab", () => <JournalTab journal={[]} />],
    ["HealthTab", () => <HealthTab openDisease={() => {}} />],
    ["GamesTab", () => <GamesTab onEarnXp={() => {}} />],
    ["MoreTab", () => <MoreTab items={[{ id: "profile", icon: "person-outline", label: "Profile", desc: "Account" }]} onNavigate={() => {}} />],
    ["ProfileTab", () => <ProfileTab profileName="" tanks={[TANK]} since={Date.now()} />],
    ["PremiumTab", () => <PremiumTab loadPlans={async () => []} />],
  ];

  test.each(cases)("%s renders without throwing", (_name, build) => {
    const tree = mount(build());
    expect(tree.toJSON()).toBeTruthy();
    tree.unmount();
  });
});

describe("screens survive real data too", () => {
  // An empty tank exercises every empty state; a populated one exercises every
  // list, average and derived stat. Both have shipped broken before.
  const full = {
    ...TANK,
    stock: [FISH_A, FISH_B],
    quantities: { [FISH_A]: 2 },
    waterTests: [
      { date: "2026-08-01", water: "salt", values: { ammonia: 0, nitrite: 0, nitrate: 10, ph: 8.1 } },
      { date: "2026-08-05", water: "salt", values: { ammonia: 0, nitrite: 0, nitrate: 15, ph: 8.2 } },
      { date: "2026-08-08", water: "salt", values: { ammonia: 0, nitrite: 0, nitrate: 20, ph: 8.0 } },
    ],
    journal: [{ id: 1, date: "2026-08-08", text: "Added a clown", mood: "🐠", photo: null }],
    costs: [{ id: 1, date: "2026-08-08", label: "Salt mix", amount: 42, category: "Other" }],
    feedings: [{ id: 1, date: "2026-08-08", food: "Frozen", note: "" }],
  };

  test("HomeTab with stock, tests and history", () => {
    const tree = mount(
      <HomeTab
        tank={full.stock} tankGallons={40} quantities={full.quantities} tankWater="salt"
        waterTests={full.waterTests} journal={full.journal} feedings={full.feedings}
        tanks={[full]} activeTankId="t1" activeDays={["2026-08-07", "2026-08-08"]} xp={120}
        onGoToTab={() => {}} openSpecies={() => {}}
      />
    );
    expect(tree.toJSON()).toBeTruthy();
    tree.unmount();
  });

  test("LogTab offers the forecast as a tool once there are enough readings", () => {
    const tree = mount(
      <LogTab
        tank={full.stock} tankGallons={40} tankWater="salt" waterTests={full.waterTests}
        journal={full.journal} activeDays={[]} costs={full.costs} feedings={full.feedings}
        maintenance={{}} premiumUnlocked
      />
    );
    // Three readings is the documented threshold. The forecast moved from a
    // top-level card into the tools row — the Log tab is for entering data, and
    // six collapsed headers stood between the keeper and the form.
    expect(textOf(tree)).toContain("Forecast");
    // And the entry form is still the first thing on the screen.
    const text = textOf(tree);
    expect(text.indexOf("Water Test")).toBeLessThan(text.indexOf("Tank Tools"));
    tree.unmount();
  });
});

describe("shortcut surfaces", () => {
  test("the quick sheet lists every quick action", () => {
    const tree = mount(<QuickActionsSheet visible onClose={() => {}} onRun={() => {}} />);
    const text = textOf(tree);
    for (const id of QUICK_ACTION_IDS) {
      expect(text).toContain(ACTIONS.find((a) => a.id === id).label);
    }
    tree.unmount();
  });

  test("tapping a quick action reports which one", () => {
    const onRun = jest.fn();
    const tree = mount(<QuickActionsSheet visible onClose={() => {}} onRun={onRun} />);
    const row = byLabel(tree, "Log a feeding")[0];
    renderer.act(() => { row.props.onPress(); });
    expect(onRun).toHaveBeenCalledWith(expect.objectContaining({ id: "feed", instant: true }));
    tree.unmount();
  });

  test("the FAB is a button, not decoration", () => {
    const onPress = jest.fn();
    const tree = mount(<QuickActionsFab onPress={onPress} />);
    const fab = byLabel(tree, "Quick actions")[0];
    renderer.act(() => { fab.props.onPress(); });
    expect(onPress).toHaveBeenCalled();
    tree.unmount();
  });

  test("search shows recents and jump targets before anything is typed", () => {
    const tree = mount(
      <UniversalSearch visible onClose={() => {}} tanks={[TANK]} activeTankId="t1"
        recent={[FISH_A]} journal={[]} onOpenSpecies={() => {}} onOpenDisease={() => {}}
        onRunAction={() => {}} onGoToTab={() => {}} onSwitchTank={() => {}} />
    );
    const text = textOf(tree);
    expect(text).toContain("Recently viewed");
    expect(text).toContain(FISH_A);
    expect(text).toContain("Go to");
    tree.unmount();
  });

  test("the header names the active tank and offers search", () => {
    const tree = mount(<AppHeader tank={TANK} tankCount={2} onOpenTankMenu={() => {}} onOpenSearch={() => {}} />);
    expect(textOf(tree)).toContain("My Reef");
    expect(hasControl(tree, "Search")).toBe(true);
    tree.unmount();
  });

  test("the tank menu lists every tank and a way to add one", () => {
    const second = { ...TANK, id: "t2", name: "Quarantine" };
    const tree = mount(<TankMenu visible tanks={[TANK, second]} activeTankId="t1" onClose={() => {}} onSwitch={() => {}} onAdd={() => {}} onEdit={() => {}} />);
    const text = textOf(tree);
    expect(text).toContain("My Reef");
    expect(text).toContain("Quarantine");
    expect(text).toContain("New tank");
    tree.unmount();
  });

  test("switching tanks from the menu reports the id and closes", () => {
    const second = { ...TANK, id: "t2", name: "Quarantine" };
    const onSwitch = jest.fn();
    const onClose = jest.fn();
    const tree = mount(<TankMenu visible tanks={[TANK, second]} activeTankId="t1" onClose={onClose} onSwitch={onSwitch} onAdd={() => {}} onEdit={() => {}} />);
    const row = byLabel(tree, "Switch to Quarantine")[0];
    renderer.act(() => { row.props.onPress(); });
    expect(onSwitch).toHaveBeenCalledWith("t2");
    expect(onClose).toHaveBeenCalled();
    tree.unmount();
  });

  test("the long-press sheet renders that tab's shortcuts", () => {
    const tree = mount(<TabShortcutSheet visible tabId="log" tabLabel="Log" onClose={() => {}} onRun={() => {}} onOpenTab={() => {}} />);
    const text = textOf(tree);
    expect(text).toContain("Log shortcuts");
    expect(text).toContain("Log a water test");
    expect(text).toContain("See water trends");
    tree.unmount();
  });

  test("a tab with no shortcuts renders nothing rather than an empty sheet", () => {
    const tree = mount(<TabShortcutSheet visible tabId="games" tabLabel="Games" onClose={() => {}} onRun={() => {}} onOpenTab={() => {}} />);
    expect(tree.toJSON()).toBeNull();
    tree.unmount();
  });
});

describe("undo bar", () => {
  test("renders nothing when there is nothing to undo", () => {
    const tree = mount(<UndoSnackbar undo={null} onUndo={() => {}} onDismiss={() => {}} />);
    expect(tree.toJSON()).toBeNull();
    tree.unmount();
  });

  test("shows the message and calls back on Undo", () => {
    const onUndo = jest.fn();
    const undo = { id: 1, message: "Feeding deleted", icon: "restaurant-outline", onUndo: () => {} };
    const tree = mount(<UndoSnackbar undo={undo} onUndo={onUndo} onDismiss={() => {}} />);
    expect(textOf(tree)).toContain("Feeding deleted");
    const btn = byLabel(tree, "Undo: Feeding deleted")[0];
    renderer.act(() => { btn.props.onPress(); });
    expect(onUndo).toHaveBeenCalled();
    tree.unmount();
  });

  test("an undo with no restore closure offers dismiss instead of a dead button", () => {
    const tree = mount(<UndoSnackbar undo={{ id: 2, message: "Saved" }} onUndo={() => {}} onDismiss={() => {}} />);
    expect(hasControl(tree, "Dismiss")).toBe(true);
    tree.unmount();
  });
});
