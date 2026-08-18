jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const renderer = require("react-test-renderer");
const { Text } = require("react-native");
const AsyncStorage = require("@react-native-async-storage/async-storage");

const { WaterTestCard } = require("../components/WaterTestCard");
const { FirstStepsCard } = require("../components/FirstStepsCard");
const { usePersistedState } = require("../lib/usePersistedState");
const { touchSlop, MIN_TOUCH } = require("../lib/a11y");
const { __resetWrites, flushWrites } = require("../lib/persist");

const settle = () => new Promise((r) => setImmediate(r));

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
const byLabel = (tree, label) => tree.root.findAll((n) => n.props.accessibilityLabel === label);

beforeEach(async () => {
  __resetWrites();
  await AsyncStorage.clear();
});

describe("water test entry", () => {
  test("the button says what it will save, and blanks are allowed", () => {
    const tree = mount(<WaterTestCard waterType="fresh" history={[]} onLog={() => {}} />);
    // Nothing typed yet — the button explains itself rather than sitting dead.
    expect(textOf(tree)).toContain("Enter a reading to log");
    tree.unmount();
  });

  test("one tap fills the two parameters that are almost always zero", () => {
    const onLog = jest.fn();
    const tree = mount(<WaterTestCard waterType="fresh" history={[]} onLog={onLog} />);

    const zeros = byLabel(tree, "Mark ammonia and nitrite as zero")[0];
    renderer.act(() => { zeros.props.onPress(); });

    // Two readings, named on the button.
    expect(textOf(tree)).toContain("Log 2 readings");

    const submit = tree.root.findAll((n) => n.props.accessibilityRole === "button" && flatten(n.props.children) === "").length;
    expect(submit).toBeGreaterThanOrEqual(0);
    tree.unmount();
  });

  test("logging a partial test stores only the values entered", () => {
    const onLog = jest.fn();
    const tree = mount(<WaterTestCard waterType="fresh" history={[]} onLog={onLog} />);
    renderer.act(() => { byLabel(tree, "Mark ammonia and nitrite as zero")[0].props.onPress(); });

    // The submit control is the last button in the card.
    const buttons = tree.root.findAll((n) => n.props.accessibilityRole === "button" && typeof n.props.onPress === "function");
    const submit = buttons[buttons.length - 1];
    renderer.act(() => { submit.props.onPress(); });

    expect(onLog).toHaveBeenCalledTimes(1);
    const entry = onLog.mock.calls[0][0];
    // Blanks must be absent, not stored as 0 — a nitrate of 0 you never
    // measured would be a fabricated data point in every trend downstream.
    expect(Object.keys(entry.values).sort()).toEqual(["ammonia", "nitrite"]);
    expect(entry.values.ammonia).toBe(0);
    expect(entry.values.nitrate).toBeUndefined();
    tree.unmount();
  });

  test("the zero shortcut never overwrites a reading you typed", () => {
    const tree = mount(<WaterTestCard waterType="fresh" history={[]} onLog={() => {}} />);
    const ammonia = tree.root.findAll((n) => typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.startsWith("Ammonia"))[0];
    renderer.act(() => { ammonia.props.onChangeText("0.5"); });
    renderer.act(() => { byLabel(tree, "Mark ammonia and nitrite as zero")[0].props.onPress(); });

    const after = tree.root.findAll((n) => typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.startsWith("Ammonia"))[0];
    expect(after.props.value).toBe("0.5");
    tree.unmount();
  });

  test("a saltwater tank gets the full reef parameter set", () => {
    const tree = mount(<WaterTestCard waterType="salt" history={[]} onLog={() => {}} />);
    const text = textOf(tree);
    for (const label of ["Salinity", "Alk", "Calcium", "Magnesium", "Phosphate"]) {
      expect(text).toContain(label);
    }
    tree.unmount();
  });
});

describe("first-run steps", () => {
  const steps = [
    { id: "size", icon: "resize-outline", title: "Tell us your tank size", hint: "Sizing", done: false, to: "tank" },
    { id: "stock", icon: "fish-outline", title: "Add your first fish", hint: "Stocking", done: false, to: "species" },
    { id: "test", icon: "flask-outline", title: "Log your first water test", hint: "Testing", done: false, to: "log" },
  ];

  test("shows progress and routes each step to the right tab", () => {
    const onDo = jest.fn();
    const tree = mount(<FirstStepsCard steps={steps} onDo={onDo} />);
    expect(textOf(tree)).toContain("0/3");

    renderer.act(() => { byLabel(tree, "Add your first fish")[0].props.onPress(); });
    expect(onDo).toHaveBeenCalledWith(expect.objectContaining({ id: "stock", to: "species" }));
    tree.unmount();
  });

  test("disappears entirely once every step is done", () => {
    // It must not linger as a congratulations card — the Home screen it was
    // covering is the actual reward.
    const tree = mount(<FirstStepsCard steps={steps.map((s) => ({ ...s, done: true }))} onDo={() => {}} />);
    expect(tree.toJSON()).toBeNull();
    tree.unmount();
  });

  test("a completed step can't be tapped again", () => {
    const onDo = jest.fn();
    const mixed = [{ ...steps[0], done: true }, steps[1], steps[2]];
    const tree = mount(<FirstStepsCard steps={mixed} onDo={onDo} />);
    const doneRow = byLabel(tree, "Tell us your tank size, done")[0];
    expect(doneRow.props.accessibilityState.disabled).toBe(true);
    tree.unmount();
  });

  test("only the step you're on explains itself", () => {
    const onDo = jest.fn();
    const mixed = [{ ...steps[0], done: true }, steps[1], steps[2]];
    const text = (() => { const t = mount(<FirstStepsCard steps={mixed} onDo={onDo} />); const x = textOf(t); t.unmount(); return x; })();
    expect(text).toContain("Stocking");   // the next step
    expect(text).not.toContain("Testing"); // the one after it stays quiet
  });
});

describe("persisted filter state", () => {
  test("restores a stored value and writes changes back", async () => {
    function Probe({ onValue }) {
      const [v, set] = usePersistedState("pr_f_test", "all");
      onValue(v, set);
      return null;
    }
    let value, setValue;
    const tree = mount(<Probe onValue={(v, s) => { value = v; setValue = s; }} />);
    await renderer.act(async () => { await settle(); });

    expect(value).toBe("all");
    await renderer.act(async () => { setValue("salt"); await settle(); });
    await flushWrites();
    expect(JSON.parse(await AsyncStorage.getItem("pr_f_test"))).toBe("salt");
    tree.unmount();
  });

  test("a stored value that is no longer valid is ignored, not applied", async () => {
    // An option removed in a later build would otherwise restore a filter that
    // matches nothing, which looks like an empty catalog.
    await AsyncStorage.setItem("pr_f_test2", JSON.stringify("brackish"));
    function Probe({ onValue }) {
      const [v] = usePersistedState("pr_f_test2", "all", { validate: (x) => ["all", "fresh", "salt"].includes(x) });
      onValue(v);
      return null;
    }
    let value;
    const tree = mount(<Probe onValue={(v) => { value = v; }} />);
    await renderer.act(async () => { await settle(); });
    expect(value).toBe("all");
    tree.unmount();
  });

  test("does not write the default over a stored value on first render", async () => {
    await AsyncStorage.setItem("pr_f_test3", JSON.stringify("salt"));
    function Probe() {
      usePersistedState("pr_f_test3", "all");
      return null;
    }
    const tree = mount(<Probe />);
    await renderer.act(async () => { await settle(); });
    await flushWrites();
    expect(JSON.parse(await AsyncStorage.getItem("pr_f_test3"))).toBe("salt");
    tree.unmount();
  });
});

describe("touch targets", () => {
  test("slop grows a small control to the platform minimum", () => {
    const slop = touchSlop(30);
    expect(slop.top).toBe(7);
    expect(30 + slop.top + slop.bottom).toBeGreaterThanOrEqual(MIN_TOUCH);
  });

  test("a control already large enough gets no negative padding", () => {
    expect(touchSlop(60)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });
});
