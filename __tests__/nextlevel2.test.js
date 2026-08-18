jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// The five new surfaces, at the level each actually fails at.
//
// The anomaly gate gets the most attention: it sits between the keeper and the
// save button, and a gate that fires on ordinary readings is worse than no gate
// — people learn to tap through it, and then it's decoration in front of the
// one reading that mattered.

const renderer = require("react-test-renderer");
const { Text } = require("react-native");

const { WaterTestCard } = require("../components/WaterTestCard");
const { WhatIfCard } = require("../components/WhatIfCard");
const { TestScheduleCard } = require("../components/TestScheduleCard");
const { FleetCard } = require("../components/FleetCard");
const { SPECIES, getCompatibility } = require("../core");

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


function mount(element) {
  let tree;
  renderer.act(() => { tree = renderer.create(element); });
  const raw = tree.unmount.bind(tree);
  tree.unmount = () => renderer.act(() => { raw(); });
  return tree;
}
const flatten = (c) =>
  Array.isArray(c) ? c.map(flatten).join("") : typeof c === "string" || typeof c === "number" ? String(c) : "";
const textOf = (tree) => tree.root.findAllByType(Text).map((n) => flatten(n.props.children)).join(" | ");
const press = (node) => renderer.act(() => { node.props.onPress(); });
const byLabel = (tree, s) =>
  tree.root.findAll((n) => typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.includes(s))[0];
const fieldFor = (tree, label) =>
  tree.root.findAll((n) =>
    typeof n.props?.accessibilityLabel === "string" &&
    typeof n.props.onChangeText === "function" &&
    (n.props.accessibilityLabel.startsWith(`${label},`) || n.props.accessibilityLabel.startsWith(`${label} in `)))[0];
const type = (node, v) => renderer.act(() => { node.props.onChangeText(v); });
const btn = (tree, text) =>
  tree.root.findAll((n) => typeof n.props?.onPress === "function"
    && n.findAllByType(Text).map((t) => flatten(t.props.children)).join(" ").trim() === text)[0];

const NOW = Date.now();
const dayAgo = (n) => localDay(NOW - n * 86400000);
const test0 = (date, values) => ({ date, water: "fresh", values });



// ─────────────────────────────────────────────────────────────────────────────
// The anomaly gate, in the form
// ─────────────────────────────────────────────────────────────────────────────
describe("logging a reading that's wrong for this tank", () => {
  const steady = [0, 7, 14, 21, 28].map((d, i) => test0(dayAgo(d), { nitrate: [10, 8, 12, 9, 11][i] }));

  test("an ordinary reading saves without a word", () => {
    const onLog = jest.fn();
    const tree = mount(<WaterTestCard waterType="fresh" history={steady} onLog={onLog} />);
    type(fieldFor(tree, "Nitrate"), "11");
    press(btn(tree, "Log 1 reading"));
    expect(onLog).toHaveBeenCalled();
    tree.unmount();
  });

  test("an absurd-for-this-tank reading is held back and questioned", () => {
    const onLog = jest.fn();
    const tree = mount(<WaterTestCard waterType="fresh" history={steady} onLog={onLog} />);
    type(fieldFor(tree, "Nitrate"), "65");
    press(btn(tree, "Log 1 reading"));

    expect(onLog).not.toHaveBeenCalled();
    expect(textOf(tree)).toMatch(/unusual nitrate/i);
    tree.unmount();
  });

  test("the keeper can insist, and it saves", () => {
    const onLog = jest.fn();
    const tree = mount(<WaterTestCard waterType="fresh" history={steady} onLog={onLog} />);
    type(fieldFor(tree, "Nitrate"), "65");
    press(btn(tree, "Log 1 reading"));
    press(btn(tree, "It's right"));

    expect(onLog).toHaveBeenCalledWith(expect.objectContaining({ values: expect.objectContaining({ nitrate: 65 }) }));
    tree.unmount();
  });

  test("or go back and fix it, saving nothing", () => {
    const onLog = jest.fn();
    const tree = mount(<WaterTestCard waterType="fresh" history={steady} onLog={onLog} />);
    type(fieldFor(tree, "Nitrate"), "65");
    press(btn(tree, "Log 1 reading"));
    press(btn(tree, "Let me check"));

    expect(onLog).not.toHaveBeenCalled();
    expect(textOf(tree)).not.toMatch(/unusual nitrate/i);
    tree.unmount();
  });

  test("a slipped decimal offers the value you meant, in one tap", () => {
    // Nitrate, not pH: a pH of 74 is impossible and the existing plausibility
    // guard rejects it before this ever runs. The interesting case is a slip
    // that lands on a perfectly possible number.
    const onLog = jest.fn();
    const lowNitrate = [0, 7, 14, 21].map((d) => test0(dayAgo(d), { nitrate: 2.5 }));
    const tree = mount(<WaterTestCard waterType="fresh" history={lowNitrate} onLog={onLog} />);
    type(fieldFor(tree, "Nitrate"), "25");
    press(btn(tree, "Log 1 reading"));
    expect(textOf(tree)).toMatch(/decimal/i);
    expect(onLog).not.toHaveBeenCalled();

    press(btn(tree, "Use 2.5"));
    press(btn(tree, "Log 1 reading"));
    expect(onLog).toHaveBeenCalledWith(expect.objectContaining({ values: expect.objectContaining({ nitrate: 2.5 }) }));
    tree.unmount();
  });

  test("a new tank is never second-guessed", () => {
    const onLog = jest.fn();
    const tree = mount(<WaterTestCard waterType="fresh" history={[]} onLog={onLog} />);
    type(fieldFor(tree, "Nitrate"), "80");
    press(btn(tree, "Log 1 reading"));
    expect(onLog).toHaveBeenCalled();
    tree.unmount();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// What-if
// ─────────────────────────────────────────────────────────────────────────────
describe("the what-if card", () => {
  const fresh = SPECIES.filter((s) => s.water === "fresh");
  const huge = fresh.reduce((a, b) => (b.minGallons > a.minGallons ? b : a));
  // A small species that does NOT clash with the big one — otherwise the
  // simulation correctly rejects both and the fixture tests something else.
  const small = fresh.find((s) =>
    s.minGallons <= 15 && s.name !== huge.name && getCompatibility(s.name, huge.name).level !== "avoid") || fresh[0];

  test("an empty wishlist explains what starring a species would get you", () => {
    const tree = mount(<WhatIfCard tank={{ gallons: 40, water: "fresh", stock: [] }} wishlist={[]} />);
    expect(textOf(tree)).toMatch(/nothing on your wishlist/i);
    tree.unmount();
  });

  test("it says what would work and what wouldn't", () => {
    const tree = mount(<WhatIfCard tank={{ gallons: 20, water: "fresh", stock: [] }} wishlist={[small.name, huge.name]} />);
    const shown = textOf(tree);
    expect(shown).toMatch(/would work here/i);
    expect(shown).toContain("Won't work here");
    tree.unmount();
  });

  test("a candidate can be excluded, and the answer changes", () => {
    const tree = mount(<WhatIfCard tank={{ gallons: 20, water: "fresh", stock: [] }} wishlist={[small.name, huge.name]} />);
    expect(textOf(tree)).toContain("Won't work here");

    press(byLabel(tree, `${huge.name}, included`));
    expect(textOf(tree)).not.toContain("Won't work here");
    tree.unmount();
  });

  test("it reports the bioload of the whole basket", () => {
    const tree = mount(<WhatIfCard tank={{ gallons: 40, water: "fresh", stock: [] }} wishlist={[small.name]} />);
    expect(textOf(tree)).toContain("Stocking");
    tree.unmount();
  });

  test("when nothing fits, it offers something that does", () => {
    const tree = mount(<WhatIfCard tank={{ gallons: 10, water: "fresh", stock: [] }} wishlist={[huge.name]} />);
    expect(textOf(tree)).toMatch(/what would fit instead/i);
    tree.unmount();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test schedule
// ─────────────────────────────────────────────────────────────────────────────
describe("the test-schedule card", () => {
  test("it recommends an interval per parameter and explains the rule", () => {
    const tests = [0, 14, 28, 42].map((d, i) => test0(dayAgo(d), { nitrate: [10, 20, 30, 40][i] }));
    const tree = mount(<TestScheduleCard waterTests={tests} waterType="fresh" />);
    const shown = textOf(tree);
    expect(shown).toMatch(/every \d+d/);
    expect(shown).toMatch(/half the time/i);
    tree.unmount();
  });

  test("a thin log asks for readings rather than inventing a schedule", () => {
    const tree = mount(<TestScheduleCard waterTests={[test0(dayAgo(0), { nitrate: 10 })]} waterType="fresh" />);
    expect(textOf(tree)).toMatch(/not enough readings/i);
    tree.unmount();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fleet
// ─────────────────────────────────────────────────────────────────────────────
describe("the fleet card", () => {
  const good = {
    id: "t1", name: "Nano", water: "fresh", gallons: 20, emoji: "🐠",
    stock: [], quantities: {}, maintenance: { waterchange: dayAgo(2) },
    waterTests: [0, 3, 6, 9].map((d) => test0(dayAgo(d), { ammonia: 0, nitrate: 5 })),
    losses: [],
  };
  const bad = {
    id: "t2", name: "Display", water: "fresh", gallons: 20, emoji: "🐟",
    stock: [], quantities: {}, maintenance: { waterchange: dayAgo(70) },
    waterTests: [0, 25, 50].map((d) => test0(dayAgo(d), { ammonia: 0, nitrate: 60 })),
    losses: [],
  };

  test("one tank has nothing to compare against, and says so", () => {
    const tree = mount(<FleetCard tanks={[good]} activeTankId="t1" />);
    expect(textOf(tree)).toMatch(/second tank/i);
    tree.unmount();
  });

  test("two tanks are ranked, with the difference named", () => {
    const tree = mount(<FleetCard tanks={[bad, good]} activeTankId="t1" />);
    const shown = textOf(tree);
    expect(shown).toContain("Nano");
    expect(shown).toContain("Display");
    expect(shown).toMatch(/does differently/i);
    tree.unmount();
  });

  test("tapping an inactive tank switches to it", () => {
    const onSwitch = jest.fn();
    const tree = mount(<FleetCard tanks={[bad, good]} activeTankId="t1" onSwitch={onSwitch} />);
    press(byLabel(tree, "Display"));
    expect(onSwitch).toHaveBeenCalledWith("t2");
    tree.unmount();
  });

  test("the active tank doesn't switch to itself", () => {
    const onSwitch = jest.fn();
    const tree = mount(<FleetCard tanks={[bad, good]} activeTankId="t1" onSwitch={onSwitch} />);
    press(byLabel(tree, "Nano, active"));
    expect(onSwitch).not.toHaveBeenCalled();
    tree.unmount();
  });
});
