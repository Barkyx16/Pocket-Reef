jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

const renderer = require("react-test-renderer");
const { Text } = require("react-native");
const { DoseLogCard } = require("../components/DoseLogCard");

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

const DAY = 86400000;
const day = (n) => localDay(Date.now() - n * DAY);
const alkTest = (n, v) => ({ date: day(n), water: "salt", values: { alk: v } });
const noop = () => {};



describe("logging a dose", () => {
  const tank = { doses: [] };

  test("a dose is reported with its amount", () => {
    const onLogDose = jest.fn();
    const tree = mount(<DoseLogCard tank={tank} tankGallons={100} waterTests={[]} strengths={{}} onLogDose={onLogDose} onSetStrength={noop} />);
    renderer.act(() => { field(tree, "Millilitres of Alkalinity dosed").props.onChangeText("20"); });
    renderer.act(() => { byLabel(tree, "Log Alkalinity dose")[0].props.onPress(); });
    expect(onLogDose).toHaveBeenCalledWith(expect.objectContaining({ key: "alk", ml: 20 }));
    tree.unmount();
  });

  test("an empty amount can't be logged", () => {
    const onLogDose = jest.fn();
    const tree = mount(<DoseLogCard tank={tank} tankGallons={100} waterTests={[]} strengths={{}} onLogDose={onLogDose} onSetStrength={noop} />);
    renderer.act(() => { byLabel(tree, "Log Alkalinity dose")[0].props.onPress(); });
    expect(onLogDose).not.toHaveBeenCalled();
    tree.unmount();
  });

  test("today's doses are marked so a daily routine doesn't lapse unnoticed", () => {
    const dosed = { doses: [{ id: "1", key: "alk", ml: 20, date: day(0) }] };
    const tree = mount(<DoseLogCard tank={dosed} tankGallons={100} waterTests={[]} strengths={{}} onLogDose={noop} onSetStrength={noop} />);
    expect(textOf(tree)).toContain("Dosed today");
    tree.unmount();
  });

  test("the log shows what went in and when", () => {
    const dosed = { doses: [{ id: "1", key: "alk", ml: 20, date: day(1) }, { id: "2", key: "calcium", ml: 15, date: day(1) }] };
    const tree = mount(<DoseLogCard tank={dosed} tankGallons={100} waterTests={[]} strengths={{}} onLogDose={noop} onSetStrength={noop} />);
    const text = textOf(tree);
    expect(text).toContain("Recent doses");
    expect(text).toContain("Alkalinity 20ml");
    expect(text).toContain("Calcium 15ml");
    tree.unmount();
  });
});

describe("what the card tells you about consumption", () => {
  test("with too little data it says exactly what's missing", () => {
    const tree = mount(<DoseLogCard tank={{ doses: [] }} tankGallons={100} waterTests={[]} strengths={{}} onLogDose={noop} onSetStrength={noop} />);
    // Never a blank, and never an invented figure.
    expect(textOf(tree)).toContain("Log 3 tests with alkalinity to measure this");
    tree.unmount();
  });

  test("a measured tank gets a rate and a daily maintenance dose", () => {
    const waterTests = [alkTest(0, 8.0), alkTest(5, 8.5), alkTest(10, 9.0)];
    const tree = mount(
      <DoseLogCard tank={{ doses: [] }} tankGallons={100} waterTests={waterTests} strengths={{ alk: 0.05 }} onLogDose={noop} onSetStrength={noop} />
    );
    const text = textOf(tree);
    expect(text).toContain("Using about 0.1 dKH/day, measured over 10 days");
    // 0.1 dKH/day across 90 real gallons at 0.05 per ml per gallon = 180ml.
    expect(text).toContain("Dose 180 ml/day to hold steady");
    tree.unmount();
  });

  test("dosing without a strength asks for the strength rather than mis-measuring", () => {
    const waterTests = [alkTest(0, 8.0), alkTest(5, 8.0), alkTest(10, 8.0)];
    const doses = [{ id: "1", key: "alk", ml: 200, date: day(5) }];
    const tree = mount(
      <DoseLogCard tank={{ doses }} tankGallons={100} waterTests={waterTests} strengths={{}} onLogDose={noop} onSetStrength={noop} />
    );
    expect(textOf(tree)).toContain("Enter your product strength");
    expect(textOf(tree)).not.toContain("Dose 0 ml/day");
    tree.unmount();
  });

  test("the strength field explains why there's no default", () => {
    const tree = mount(<DoseLogCard tank={{ doses: [] }} tankGallons={100} waterTests={[]} strengths={{}} onLogDose={noop} onSetStrength={noop} />);
    renderer.act(() => { byLabel(tree, "Set Alkalinity product strength")[0].props.onPress(); });
    expect(textOf(tree)).toContain("every product differs");
    tree.unmount();
  });

  test("a strength change is reported up", () => {
    const onSetStrength = jest.fn();
    const tree = mount(<DoseLogCard tank={{ doses: [] }} tankGallons={100} waterTests={[]} strengths={{}} onLogDose={noop} onSetStrength={onSetStrength} />);
    renderer.act(() => { byLabel(tree, "Set Alkalinity product strength")[0].props.onPress(); });
    renderer.act(() => { field(tree, "Alkalinity product strength, dKH per millilitre per gallon").props.onChangeText("0.05"); });
    expect(onSetStrength).toHaveBeenCalledWith("alk", "0.05");
    tree.unmount();
  });
});
