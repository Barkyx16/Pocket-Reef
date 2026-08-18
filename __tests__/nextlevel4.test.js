jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// The five new surfaces.
//
// The migration case leads: a stored tank predates every field added this
// round, and the way that goes wrong is not a crash but a confident wrong
// message on a screen the keeper has never opened before.

const renderer = require("react-test-renderer");
const { Text } = require("react-native");

const { LightScheduleCard } = require("../components/LightScheduleCard");
const { AlgaeCard } = require("../components/AlgaeCard");
const { RunningCostCard } = require("../components/RunningCostCard");
const { ObservationsCard } = require("../components/ObservationsCard");
const { ExistingTankCard } = require("../components/ExistingTankCard");
const { ensureTankShape } = require("../lib/migrations");
const { assessLighting, newLightSchedule } = require("../lib/lighting");
const { newEquipment } = require("../lib/equipment");
const { newObservation, addObservation } = require("../lib/observations");

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
const type = (n, v) => renderer.act(() => { n.props.onChangeText(v); });
const byLabel = (t, s) =>
  t.root.findAll((n) => typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.includes(s))[0];
const btn = (t, text) =>
  t.root.findAll((n) => typeof n.props?.onPress === "function"
    && n.findAllByType(Text).map((x) => flatten(x.props.children)).join(" ").trim() === text)[0];

const NOW = Date.now();
const dayAgo = (n) => localDay(NOW - n * 86400000);
const test0 = (date, values, water = "salt") => ({ date, water, values });



describe("a tank stored before any of this existed", () => {
  // ensureTankShape fills a missing field from its default, and typeof null is
  // "object" — so a null default arrives as {}. Every pre-existing tank hits
  // this path, which makes it the most-travelled case in the whole round.
  test("is asked to set a light schedule, not told its schedule is broken", () => {
    const shaped = ensureTankShape({ id: "t1", name: "Old tank" });
    const a = assessLighting(shaped);
    expect(a.ok).toBe(false);
    expect(a.reason).toMatch(/set your light schedule/i);
  });

  test("and the card opens on the form rather than an error", () => {
    const tree = mount(<LightScheduleCard tank={ensureTankShape({ id: "t1" })} onSave={() => {}} />);
    const shown = textOf(tree);
    expect(shown).toMatch(/photoperiod drives algae/i);
    expect(shown).not.toMatch(/couldn't be read/i);
    tree.unmount();
  });
});

describe("the light schedule card", () => {
  test("saving builds a schedule from the times typed", () => {
    const onSave = jest.fn();
    const tree = mount(<LightScheduleCard tank={{ stock: [] }} onSave={onSave} />);
    type(byLabel(tree, "Time the lights come on"), "09:00");
    type(byLabel(tree, "Time the lights go off"), "21:00");
    press(btn(tree, "Save schedule"));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ on: "09:00", off: "21:00" }));
    tree.unmount();
  });

  test("a twelve-hour day on a fish-only tank is called out, with a one-tap fix", () => {
    const tank = { stock: [], water: "fresh", lightSchedule: newLightSchedule({ on: "09:00", off: "21:00" }) };
    const onSave = jest.fn();
    const tree = mount(<LightScheduleCard tank={tank} onSave={onSave} />);
    expect(textOf(tree)).toMatch(/grow algae/i);

    press(byLabel(tree, "Change the schedule to"));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ off: "17:00" }));
    tree.unmount();
  });
});

describe("the algae card", () => {
  const reef = {
    createdAt: new Date(NOW - 700 * 86400000).toISOString(),
    waterTests: [test0(dayAgo(1), { nitrate: 40, phosphate: 0.3 })],
    lightSchedule: newLightSchedule({ on: "08:00", off: "22:00", profile: "sps" }),
  };

  test("it asks what you're looking at before saying anything", () => {
    const tree = mount(<AlgaeCard tank={reef} waterType="salt" />);
    const shown = textOf(tree);
    expect(shown).toMatch(/what are you actually looking at/i);
    expect(shown).not.toMatch(/from your own readings/i);
    tree.unmount();
  });

  test("picking a type diagnoses it from this tank's numbers", () => {
    const tree = mount(<AlgaeCard tank={reef} waterType="salt" />);
    press(byLabel(tree, "Green hair algae"));
    const shown = textOf(tree);
    expect(shown).toMatch(/from your own readings/i);
    expect(shown).toContain("0.3");
    expect(shown).toContain("FREE");
    tree.unmount();
  });

  test("a new tank's brown dust is defended rather than treated", () => {
    const young = { createdAt: new Date(NOW - 20 * 86400000).toISOString(), waterTests: [test0(dayAgo(1), { nitrate: 0 })] };
    const tree = mount(<AlgaeCard tank={young} waterType="salt" />);
    press(byLabel(tree, "Brown dust"));
    expect(textOf(tree)).toMatch(/makes it last longer/i);
    tree.unmount();
  });

  test("with no readings it points at the water test instead of guessing", () => {
    const onGoToTab = jest.fn();
    const tree = mount(<AlgaeCard tank={{ createdAt: new Date(NOW - 700 * 86400000).toISOString() }} waterType="salt" onGoToTab={onGoToTab} />);
    press(byLabel(tree, "Green hair algae"));
    press(btn(tree, "Log a water test to narrow this down"));
    expect(onGoToTab).toHaveBeenCalledWith("log");
    tree.unmount();
  });
});

describe("the running cost card", () => {
  const tank = {
    equipment: [
      newEquipment({ name: "Heater", category: "heating", watts: 300 }),
      newEquipment({ name: "Light", category: "lighting", watts: 100 }),
    ],
    lightSchedule: newLightSchedule({ on: "10:00", off: "20:00" }),
    createdAt: new Date(NOW - 365 * 86400000).toISOString(),
  };

  test("no equipment means no invented bill", () => {
    const tree = mount(<RunningCostCard tank={{}} costs={[]} />);
    expect(textOf(tree)).toMatch(/nothing to cost yet/i);
    tree.unmount();
  });

  test("it prices the month and names each draw", () => {
    const tree = mount(<RunningCostCard tank={tank} costs={[]} />);
    const shown = textOf(tree);
    expect(shown).toMatch(/electricity, per month/i);
    expect(shown).toContain("Heater");
    expect(shown).toMatch(/kWh/);
    tree.unmount();
  });

  test("a guessed wattage is disclosed rather than passed off as measured", () => {
    const guessed = { equipment: [newEquipment({ name: "Mystery pump", category: "flow" })] };
    const tree = mount(<RunningCostCard tank={guessed} costs={[]} />);
    expect(textOf(tree)).toMatch(/typical wattage/i);
    tree.unmount();
  });

  test("an hour of photoperiod gets a price on it", () => {
    const tree = mount(<RunningCostCard tank={tank} costs={[]} />);
    expect(textOf(tree)).toMatch(/each hour of photoperiod/i);
    tree.unmount();
  });
});

describe("observations", () => {
  const name = "Ocellaris Clownfish";

  test("an empty log explains what it's for", () => {
    const tree = mount(<ObservationsCard tank={{}} name={name} onAdd={() => {}} />);
    expect(textOf(tree)).toMatch(/nothing recorded yet/i);
    tree.unmount();
  });

  test("recording an observation hands back a dated entry", () => {
    const onAdd = jest.fn();
    const tree = mount(<ObservationsCard tank={{}} name={name} onAdd={onAdd} />);
    press(byLabel(tree, `Add an observation for ${name}`));
    type(byLabel(tree, "What you observed"), "Spawned overnight");
    press(btn(tree, "Record it"));
    expect(onAdd).toHaveBeenCalledWith(name, expect.objectContaining({ text: "Spawned overnight" }));
    tree.unmount();
  });

  test("two measurements produce a growth figure, not an adjective", () => {
    let obs = {};
    obs = addObservation(obs, name, newObservation({ size: 2, date: dayAgo(90) }));
    obs = addObservation(obs, name, newObservation({ size: 3, date: dayAgo(0) }));
    const tree = mount(<ObservationsCard tank={{ observations: obs }} name={name} onAdd={() => {}} />);
    expect(textOf(tree)).toMatch(/grew 1 in/i);
    tree.unmount();
  });
});

describe("setting up an existing tank", () => {
  test("it offers ages people actually say out loud", () => {
    const tree = mount(<ExistingTankCard tank={{}} waterType="fresh" onApply={() => {}} />);
    expect(textOf(tree)).toMatch(/how long has it been running/i);
    tree.unmount();
  });

  test("applying dates the tank and logs the readings given", () => {
    const onApply = jest.fn();
    const tree = mount(<ExistingTankCard tank={{}} waterType="fresh" onApply={onApply} />);
    press(btn(tree, "Years"));
    type(byLabel(tree, "Nitrate today"), "15");
    press(btn(tree, "Set up my existing tank"));

    const patch = onApply.mock.calls[0][0];
    expect(patch.waterTests[0].values.nitrate).toBe(15);
    // Dated years back, not today.
    expect(new Date(patch.createdAt).getTime()).toBeLessThan(NOW - 300 * 86400000);
    tree.unmount();
  });

  test("it says what's still missing and what each thing unlocks", () => {
    const tree = mount(<ExistingTankCard tank={{ gallons: 40 }} waterType="fresh" onApply={() => {}} />);
    const shown = textOf(tree);
    expect(shown).toMatch(/still to fill in/i);
    expect(shown).toMatch(/source water/i);
    tree.unmount();
  });
});
