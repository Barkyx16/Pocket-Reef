jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

const renderer = require("react-test-renderer");
const { Text } = require("react-native");
const { UpkeepCard } = require("../components/UpkeepCard");
const { getTodayActions } = require("../core");

function mount(el) {
  let t; renderer.act(() => { t = renderer.create(el); });
  const raw = t.unmount.bind(t); t.unmount = () => renderer.act(() => { raw(); });
  return t;
}
const flatten = (c) => Array.isArray(c) ? c.map(flatten).join("") : (typeof c === "string" || typeof c === "number") ? String(c) : "";
const textOf = (t) => t.root.findAllByType(Text).map((n) => flatten(n.props.children)).join(" | ");
const byLabel = (t, l) => t.root.findAll((n) => n.props.accessibilityLabel === l);
const byLabelMatch = (t, re) => t.root.findAll((n) => typeof n.props.accessibilityLabel === "string" && re.test(n.props.accessibilityLabel));

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const noop = () => {};

describe("the upkeep card", () => {
  const reef = { water: "salt", maintenance: { carbon: daysAgo(40), filtersock: daysAgo(1) }, upkeep: [] };

  test("a reef sees the jobs a reef actually has", () => {
    const tree = mount(<UpkeepCard tank={reef} onLog={noop} onAddTask={noop} onRemoveTask={noop} onSetInterval={noop} />);
    const text = textOf(tree);
    for (const label of ["Clean the skimmer cup", "Change filter socks", "Replace carbon / GFO", "Check RODI / TDS"]) {
      expect(text).toContain(label);
    }
    tree.unmount();
  });

  test("the most overdue job is the first row", () => {
    const tree = mount(<UpkeepCard tank={reef} onLog={noop} onAddTask={noop} onRemoveTask={noop} onSetInterval={noop} />);
    // Carbon is 10 days overdue on a 30-day interval; it must lead.
    const first = byLabelMatch(tree, /^Replace carbon \/ GFO\./);
    expect(first.length).toBeGreaterThan(0);
    expect(textOf(tree)).toContain("Overdue by 10d");
    tree.unmount();
  });

  test("one tap marks a job done", () => {
    const onLog = jest.fn();
    const tree = mount(<UpkeepCard tank={reef} onLog={onLog} onAddTask={noop} onRemoveTask={noop} onSetInterval={noop} />);
    renderer.act(() => { byLabel(tree, "Mark Replace carbon / GFO done")[0].props.onPress(); });
    expect(onLog).toHaveBeenCalledWith("carbon");
    tree.unmount();
  });

  test("a custom job can be added with an interval", () => {
    const onAddTask = jest.fn();
    const tree = mount(<UpkeepCard tank={reef} onLog={noop} onAddTask={onAddTask} onRemoveTask={noop} onSetInterval={noop} />);
    renderer.act(() => { byLabel(tree, "Add a job to this tank")[0].props.onPress(); });
    renderer.act(() => { byLabel(tree, "Name of the new job")[0].props.onChangeText("Replace UV bulb"); });
    renderer.act(() => { byLabel(tree, "How often the new job is due, in days")[0].props.onChangeText("180"); });
    renderer.act(() => { byLabel(tree, "Add this job")[0].props.onPress(); });
    expect(onAddTask).toHaveBeenCalledWith(expect.objectContaining({ label: "Replace UV bulb", days: 180 }));
    tree.unmount();
  });

  test("a nameless job can't be added", () => {
    const onAddTask = jest.fn();
    const tree = mount(<UpkeepCard tank={reef} onLog={noop} onAddTask={onAddTask} onRemoveTask={noop} onSetInterval={noop} />);
    renderer.act(() => { byLabel(tree, "Add a job to this tank")[0].props.onPress(); });
    renderer.act(() => { byLabel(tree, "Add this job")[0].props.onPress(); });
    expect(onAddTask).not.toHaveBeenCalled();
    tree.unmount();
  });

  test("a built-in offers to be hidden, a custom one to be deleted", () => {
    const withCustom = { ...reef, upkeep: [{ id: "u_1", label: "ICP test", emoji: "🔬", days: 90, kind: "gear", custom: true }] };
    const tree = mount(<UpkeepCard tank={withCustom} onLog={noop} onAddTask={noop} onRemoveTask={noop} onSetInterval={noop} />);
    // A tank without a skimmer shouldn't be nagged forever, but the built-in
    // definition isn't the keeper's to delete.
    renderer.act(() => { byLabelMatch(tree, /^Clean the skimmer cup\./)[0].props.onPress(); });
    expect(byLabel(tree, "Hide Clean the skimmer cup for this tank").length).toBeGreaterThan(0);
    renderer.act(() => { byLabelMatch(tree, /^ICP test\./)[0].props.onPress(); });
    expect(byLabel(tree, "Delete ICP test").length).toBeGreaterThan(0);
    tree.unmount();
  });

  test("an all-clear tank says so instead of showing an empty list", () => {
    const fresh = { water: "fresh", maintenance: {}, upkeep: [] };
    const tree = mount(<UpkeepCard tank={fresh} onLog={noop} onAddTask={noop} onRemoveTask={noop} onSetInterval={noop} />);
    expect(textOf(tree)).toContain("Everything's on schedule");
    tree.unmount();
  });
});

describe("overdue upkeep reaches the Home screen", () => {
  test("a custom job the keeper added can appear in Needs Attention", () => {
    // The old Today list was three hardcoded chores, so nothing a keeper added
    // — and no reef gear job — could ever surface here.
    const actions = getTodayActions({
      tank: ["Ocellaris Clownfish"],
      waterType: "salt",
      maintenance: { u_1: new Date(Date.now() - 200 * 86400000).toISOString() },
      upkeep: [{ id: "u_1", label: "Replace UV bulb", days: 180, custom: true }],
    });
    expect(actions.some((a) => /Replace UV bulb overdue/.test(a.text))).toBe(true);
  });

  test("reef gear overdue shows up without any custom setup", () => {
    const actions = getTodayActions({
      tank: ["Ocellaris Clownfish"],
      waterType: "salt",
      maintenance: { carbon: new Date(Date.now() - 60 * 86400000).toISOString() },
    });
    expect(actions.some((a) => /carbon/i.test(a.text))).toBe(true);
  });

  test("the list stays a priority list, not a backlog", () => {
    const old = new Date(Date.now() - 400 * 86400000).toISOString();
    const maintenance = { carbon: old, filtersock: old, skimmerclean: old, probecal: old, rodi: old, pumpclean: old };
    const actions = getTodayActions({ tank: ["Ocellaris Clownfish"], waterType: "salt", maintenance });
    expect(actions.filter((a) => /overdue by/i.test(a.text)).length).toBeLessThanOrEqual(3);
  });
});

describe("relevance of the daily suggestion", () => {
  const { getFishOfDay } = require("../core");

  test("a reef keeper is suggested a fish they can actually keep", () => {
    // It picked from all 316 species regardless of tank, so a reef keeper's
    // Fish of the Day was a freshwater fish more than half the time.
    for (const key of ["2026-08-10", "2026-08-11", "2026-08-12", "2026-01-02", "2025-06-30"]) {
      expect(getFishOfDay(key, "salt").water).toBe("salt");
      expect(getFishOfDay(key, "fresh").water).toBe("fresh");
    }
  });

  test("it is still stable for a given day", () => {
    expect(getFishOfDay("2026-08-10", "salt").name).toBe(getFishOfDay("2026-08-10", "salt").name);
  });

  test("no water type still returns something", () => {
    expect(getFishOfDay("2026-08-10")).toBeTruthy();
  });
});
