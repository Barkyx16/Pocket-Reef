jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

const renderer = require("react-test-renderer");
const { Text } = require("react-native");
const { EquipmentCard } = require("../components/EquipmentCard");
const { nameTanks } = require("../lib/notifications");

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
  let t; renderer.act(() => { t = renderer.create(el); });
  const raw = t.unmount.bind(t); t.unmount = () => renderer.act(() => { raw(); });
  return t;
}
const flatten = (c) => Array.isArray(c) ? c.map(flatten).join("") : (typeof c === "string" || typeof c === "number") ? String(c) : "";
const textOf = (t) => t.root.findAllByType(Text).map((n) => flatten(n.props.children)).join(" | ");
const byLabel = (t, l) => t.root.findAll((n) => n.props.accessibilityLabel === l);
const field = (t, l) => byLabel(t, l).find((n) => typeof n.props.onChangeText === "function");
const day = (n) => localDay(Date.now() - n * 86400000);
const noop = () => {};



describe("the equipment record", () => {
  test("an empty rack explains why it's worth filling in", () => {
    const tree = mount(<EquipmentCard equipment={[]} onAdd={noop} onRemove={noop} />);
    expect(textOf(tree)).toContain("when something fails");
    tree.unmount();
  });

  test("adding a item reports name, category, price and warranty", () => {
    const onAdd = jest.fn();
    const tree = mount(<EquipmentCard equipment={[]} onAdd={onAdd} onRemove={noop} />);
    renderer.act(() => { byLabel(tree, "Add equipment")[0].props.onPress(); });
    renderer.act(() => { byLabel(tree, "Category: Heating & cooling")[0].props.onPress(); });
    renderer.act(() => { field(tree, "Name of the equipment").props.onChangeText("Eheim Jager 300W"); });
    renderer.act(() => { field(tree, "Price paid").props.onChangeText("45"); });
    renderer.act(() => { field(tree, "Warranty length in months").props.onChangeText("24"); });
    renderer.act(() => { byLabel(tree, "Save this equipment")[0].props.onPress(); });

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      name: "Eheim Jager 300W", category: "heating", price: 45, warrantyMonths: 24,
    }));
    tree.unmount();
  });

  test("a nameless item can't be saved", () => {
    const onAdd = jest.fn();
    const tree = mount(<EquipmentCard equipment={[]} onAdd={onAdd} onRemove={noop} />);
    renderer.act(() => { byLabel(tree, "Add equipment")[0].props.onPress(); });
    renderer.act(() => { byLabel(tree, "Save this equipment")[0].props.onPress(); });
    expect(onAdd).not.toHaveBeenCalled();
    tree.unmount();
  });

  test("items group under their category with age and warranty", () => {
    const equipment = [
      { id: "1", name: "Vectra M2", category: "flow", price: 250, installedAt: day(400), warrantyMonths: 24 },
      { id: "2", name: "Skimmer", category: "filtration", installedAt: day(700) },
      // Imported or hand-edited data can arrive with nothing at all.
      { id: "3", name: "Mystery pump", category: "flow" },
    ];
    const tree = mount(<EquipmentCard equipment={equipment} onAdd={noop} onRemove={noop} />);
    const text = textOf(tree);
    expect(text).toContain("Flow");
    expect(text).toContain("Filtration");
    expect(text).toContain("Vectra M2");
    expect(text).toContain("Under warranty");
    // Age counts as a detail; an item with genuinely nothing says so rather
    // than rendering a blank line.
    expect(text).toContain("1.9 years old");
    expect(text).toContain("No details recorded");
    tree.unmount();
  });

  test("a warranty about to expire is surfaced while a claim is still possible", () => {
    const equipment = [{ id: "1", name: "Return pump", category: "flow", installedAt: day(365 - 10), warrantyMonths: 12 }];
    const tree = mount(<EquipmentCard equipment={equipment} onAdd={noop} onRemove={noop} />);
    const text = textOf(tree);
    expect(text).toContain("Warranty ending");
    expect(text).toContain("while a claim is still possible");
    tree.unmount();
  });

  test("the build total is honest about how much of it is priced", () => {
    const equipment = [
      { id: "1", name: "A", category: "flow", price: 100, installedAt: day(10) },
      { id: "2", name: "B", category: "flow", installedAt: day(10) },
    ];
    const tree = mount(<EquipmentCard equipment={equipment} onAdd={noop} onRemove={noop} />);
    expect(textOf(tree)).toContain("1 of 2 priced");
    tree.unmount();
  });

  test("removing an item reports which one", () => {
    const onRemove = jest.fn();
    const equipment = [{ id: "1", name: "Heater", category: "heating", installedAt: day(10) }];
    const tree = mount(<EquipmentCard equipment={equipment} onAdd={noop} onRemove={onRemove} />);
    renderer.act(() => { byLabel(tree, "Remove Heater")[0].props.onPress(); });
    expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));
    tree.unmount();
  });
});

describe("reminders name the tanks that are actually due", () => {
  // They were built from the active tank alone, so a keeper with three tanks —
  // a paid feature — heard about whichever one they last opened.
  test("one, two and many read naturally", () => {
    expect(nameTanks(["The Reef"])).toBe(" in The Reef");
    expect(nameTanks(["The Reef", "Nano"])).toBe(" in The Reef and Nano");
    expect(nameTanks(["The Reef", "Nano", "Frag", "QT"])).toBe(" in The Reef and 3 others");
  });

  test("no tanks produces no dangling phrase", () => {
    expect(nameTanks([])).toBe("");
    expect(nameTanks([null, undefined])).toBe("");
  });
});
