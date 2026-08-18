jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// The quarantine card and the observation photos, plus the Today hub actually
// carrying the analysis. The quarantine one matters most: the old card
// congratulated the keeper on day 21 regardless of what the fish looked like,
// which is the app causing the exact thing quarantine exists to prevent.

const renderer = require("react-test-renderer");
const { Text } = require("react-native");

const { QuarantineCard } = require("../components/QuarantineCard");
const { ObservationsCard } = require("../components/ObservationsCard");
const { HomeTab } = require("../screens/HomeTab");
const { newObservation, addObservation } = require("../lib/observations");
const { newInventoryItem } = require("../lib/inventory");
const { CRITERIA, DEFAULT_DAYS } = require("../lib/quarantine");

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


function mount(el) {
  let tree;
  renderer.act(() => { tree = renderer.create(el); });
  const raw = tree.unmount.bind(tree);
  tree.unmount = () => renderer.act(() => { raw(); });
  return tree;
}
const flatten = (c) =>
  Array.isArray(c) ? c.map(flatten).join("") : typeof c === "string" || typeof c === "number" ? String(c) : "";
const textOf = (t) => t.root.findAllByType(Text).map((n) => flatten(n.props.children)).join(" | ");
const press = (n) => renderer.act(() => { n.props.onPress(); });
const byLabel = (t, s) =>
  t.root.findAll((n) => typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.includes(s))[0];
const btn = (t, text) =>
  t.root.findAll((n) => typeof n.props?.onPress === "function"
    && n.findAllByType(Text).map((x) => flatten(x.props.children)).join(" ").trim() === text)[0];

const NOW = Date.now();
const dayAgo = (n) => new Date(NOW - n * 86400000).toISOString();
const dayKey = (n) => localDay(NOW - n * 86400000);

const allChecked = () => {


  const c = {};
  CRITERIA.filter((x) => !x.auto).forEach((x) => { c[x.id] = true; });
  return c;
};

describe("the quarantine card", () => {
  test("it says what to look for today, not just how many days are left", () => {
    const items = [{ id: 1, name: "Yellow Tang", startDate: dayAgo(6), checks: {} }];
    const tree = mount(<QuarantineCard items={items} onAdd={() => {}} onRemove={() => {}} />);
    const shown = textOf(tree);
    expect(shown).toMatch(/white spots/i);
    expect(shown).toMatch(/day 7 of 21/i);
    tree.unmount();
  });

  test("21 days with unmet checks is NOT declared ready", () => {
    const items = [{ id: 1, name: "Yellow Tang", startDate: dayAgo(30), checks: {} }];
    const tree = mount(<QuarantineCard items={items} onAdd={() => {}} onRemove={() => {}} onGraduate={() => {}} />);
    const shown = textOf(tree);
    expect(shown).toMatch(/still outstanding/i);
    expect(btn(tree, "＋ Move into the display")).toBeUndefined();
    tree.unmount();
  });

  test("every check met, and the clock done, clears it", () => {
    const items = [{ id: 1, name: "Yellow Tang", startDate: dayAgo(25), checks: allChecked() }];
    const onGraduate = jest.fn();
    const tree = mount(<QuarantineCard items={items} onAdd={() => {}} onRemove={() => {}} onGraduate={onGraduate} />);
    expect(textOf(tree)).toMatch(/clear to move/i);
    press(btn(tree, "＋ Move into the display"));
    expect(onGraduate).toHaveBeenCalled();
    tree.unmount();
  });

  test("a check can be ticked, and the time check can't", () => {
    const onSetCheck = jest.fn();
    const items = [{ id: 1, name: "Tang", startDate: dayAgo(5), checks: {} }];
    const tree = mount(<QuarantineCard items={items} onAdd={() => {}} onRemove={() => {}} onSetCheck={onSetCheck} />);
    press(byLabel(tree, "Clearance checks for Tang"));

    press(byLabel(tree, "Eating well for the last week"));
    expect(onSetCheck).toHaveBeenCalledWith(1, "eating", true);

    // The auto criterion is disabled — the keeper can't tick the clock forward.
    const auto = byLabel(tree, `Full ${DEFAULT_DAYS} days completed`);
    expect(auto.props.accessibilityState.disabled).toBe(true);
    tree.unmount();
  });

  test("adding an arrival starts it with an empty check list", () => {
    const onAdd = jest.fn();
    const tree = mount(<QuarantineCard items={[]} onAdd={onAdd} onRemove={() => {}} />);
    renderer.act(() => { byLabel(tree, "Name of the new arrival").props.onChangeText("Clownfish"); });
    press(btn(tree, "Start"));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ name: "Clownfish", checks: {} }));
    tree.unmount();
  });
});

describe("observation photos", () => {
  const name = "Torch Coral";

  test("two photos on different days render as then-and-now", () => {
    let obs = {};
    obs = addObservation(obs, name, newObservation({ photo: "file:///old.jpg", date: dayKey(200) }));
    obs = addObservation(obs, name, newObservation({ photo: "file:///new.jpg", date: dayKey(1) }));
    const tree = mount(<ObservationsCard tank={{ observations: obs }} name={name} onAdd={() => {}} />);
    const shown = textOf(tree);
    expect(shown).toMatch(/then/i);
    // 199 or 200 depending on which side of local midnight the fixture lands.
    expect(shown).toMatch(/(199|200) days apart/);
    tree.unmount();
  });

  test("one photo isn't presented as a comparison", () => {
    let obs = {};
    obs = addObservation(obs, name, newObservation({ photo: "file:///a.jpg", date: dayKey(1) }));
    const tree = mount(<ObservationsCard tank={{ observations: obs }} name={name} onAdd={() => {}} />);
    expect(textOf(tree)).not.toMatch(/days apart/);
    tree.unmount();
  });

  test("the form offers a photo, and a photo alone is enough to record", () => {
    const tree = mount(<ObservationsCard tank={{}} name={name} onAdd={() => {}} />);
    press(byLabel(tree, `Add an observation for ${name}`));
    expect(byLabel(tree, "Add a photo to this observation")).toBeTruthy();
    tree.unmount();
  });
});

describe("the daily hub carries the analysis", () => {
  const baseProps = {
    tankGallons: 40, tank: [], waterTests: [], journal: [], feedings: [],
    activeDays: [], maintenance: {}, quarantine: [], quantities: {},
    tankWater: "fresh", tanks: [{ id: "t1", name: "Reef", gallons: 40, stock: [] }],
    activeTankId: "t1", onGoToTab: () => {}, openSpecies: () => {},
  };

  test("an empty consumable reaches the home screen", () => {
    const activeTank = {
      id: "t1", stock: [], waterTests: [],
      inventory: [newInventoryItem({ name: "Salt mix", kind: "salt", stock: 0, perGallon: 0.5 })],
    };
    const tree = mount(<HomeTab {...baseProps} activeTank={activeTank} />);
    expect(textOf(tree)).toMatch(/out of salt mix/i);
    tree.unmount();
  });

  test("a tank with nothing to say adds nothing", () => {
    const tree = mount(<HomeTab {...baseProps} activeTank={{ id: "t1", stock: [], waterTests: [], inventory: [] }} />);
    expect(textOf(tree)).not.toMatch(/out of /i);
    tree.unmount();
  });

  test("Home still renders when the tank predates all of this", () => {
    const tree = mount(<HomeTab {...baseProps} activeTank={{ id: "t1" }} />);
    expect(tree.toJSON()).toBeTruthy();
    tree.unmount();
  });
});
