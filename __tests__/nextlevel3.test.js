jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// The four new surfaces. The import card gets the closest look: it is the only
// screen in the app that writes hundreds of records at once, and the thing that
// must never happen is a silent write before the keeper has seen the report.

const renderer = require("react-test-renderer");
const { Text } = require("react-native");

const { SourceWaterCard } = require("../components/SourceWaterCard");
const { MedDoseCard } = require("../components/MedDoseCard");
const { CsvImportCard } = require("../components/CsvImportCard");
const { VacationCard } = require("../components/VacationCard");
const { newSourceProfile } = require("../lib/sourceWater");

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

describe("the source-water card", () => {
  test("with no profile it asks for one and explains why", () => {
    const tree = mount(<SourceWaterCard tank={{}} waterType="fresh" onSave={() => {}} />);
    expect(textOf(tree)).toMatch(/assumes this is pure/i);
    tree.unmount();
  });

  test("saving builds a profile from what was typed", () => {
    const onSave = jest.fn();
    const tree = mount(<SourceWaterCard tank={{}} waterType="fresh" onSave={onSave} />);
    type(byLabel(tree, "Nitrate in your source water"), "20");
    press(btn(tree, "Save source water"));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ values: { nitrate: 20 } }));
    tree.unmount();
  });

  test("a dirty tap is reported as a ceiling on water changes", () => {
    const tank = {
      sourceWater: newSourceProfile({ kind: "tap", values: { nitrate: 60 } }),
      waterTests: [{ date: "2026-08-17", water: "fresh", values: { nitrate: 70 } }],
    };
    const tree = mount(<SourceWaterCard tank={tank} waterType="fresh" onSave={() => {}} />);
    const shown = textOf(tree);
    expect(shown).toMatch(/limiting what a water change can do/i);
    expect(shown).toMatch(/RO/);
    tree.unmount();
  });
});

describe("the medication calculator", () => {
  test("it refuses to produce a dose until the label figures are in", () => {
    const tree = mount(<MedDoseCard tank={{}} tankGallons={40} />);
    expect(textOf(tree)).toMatch(/enter the dose from the label/i);
    tree.unmount();
  });

  test("it computes on real volume and says so", () => {
    const tree = mount(<MedDoseCard tank={{}} tankGallons={75} />);
    type(byLabel(tree, "Dose from the label"), "5");
    type(byLabel(tree, "Gallons that dose treats"), "10");
    const shown = textOf(tree);
    expect(shown).toContain("33.75 ml");
    expect(shown).toMatch(/not the 75 on the box/i);
    tree.unmount();
  });

  test("carbon is warned about before anything goes in", () => {
    const tree = mount(<MedDoseCard tank={{}} tankGallons={40} />);
    expect(textOf(tree)).toMatch(/remove carbon/i);
    tree.unmount();
  });

  test("a top-up after a water change is a fraction, not another full dose", () => {
    const tree = mount(<MedDoseCard tank={{}} tankGallons={40} />);
    type(byLabel(tree, "Dose from the label"), "5");
    type(byLabel(tree, "Gallons that dose treats"), "10");
    type(byLabel(tree, "Percent of water changed"), "50");
    expect(textOf(tree)).toMatch(/not a full dose/i);
    tree.unmount();
  });
});

describe("the CSV import card", () => {
  const csv = "Date,Nitrate,pH\n2024-03-01,10,7.4\n2024-03-08,12,7.3\n";

  test("nothing is written until the report has been seen and confirmed", () => {
    const onImport = jest.fn();
    const tree = mount(<CsvImportCard waterType="fresh" existing={[]} onImport={onImport} />);
    type(byLabel(tree, "Paste your CSV here"), csv);
    // Report is on screen; still nothing written.
    expect(textOf(tree)).toMatch(/2 readings ready/i);
    expect(onImport).not.toHaveBeenCalled();

    press(btn(tree, "Import 2 readings"));
    expect(onImport).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ date: "2024-03-08" })]));
    tree.unmount();
  });

  test("it reports which columns it understood and which it ignored", () => {
    const tree = mount(<CsvImportCard waterType="fresh" existing={[]} onImport={() => {}} />);
    type(byLabel(tree, "Paste your CSV here"), "Date,Nitrate,Notes\n2024-03-01,10,fine\n");
    const shown = textOf(tree);
    expect(shown).toMatch(/columns understood/i);
    expect(shown).toContain("Notes");
    tree.unmount();
  });

  test("skipped rows are listed rather than quietly dropped", () => {
    const tree = mount(<CsvImportCard waterType="fresh" existing={[]} onImport={() => {}} />);
    type(byLabel(tree, "Paste your CSV here"), "Date,Nitrate\n2024-03-01,10\n2024-03-08,banana\n");
    expect(textOf(tree)).toMatch(/line 3/i);
    tree.unmount();
  });

  test("an unreadable paste can't be imported", () => {
    const tree = mount(<CsvImportCard waterType="fresh" existing={[]} onImport={() => {}} />);
    type(byLabel(tree, "Paste your CSV here"), "hello there");
    expect(textOf(tree)).toMatch(/can't read that yet/i);
    tree.unmount();
  });
});

describe("the going-away card", () => {
  const tank = { name: "Reef", gallons: 40, stock: [], waterTests: [] };

  test("a short trip is told to leave the tank alone", () => {
    const tree = mount(<VacationCard tank={tank} waterType="fresh" />);
    press(btn(tree, "3 days"));
    expect(textOf(tree)).toMatch(/safest plan is to do nothing/i);
    tree.unmount();
  });

  test("a longer trip asks who's watching it and what to tell them", () => {
    const tree = mount(<VacationCard tank={tank} waterType="fresh" />);
    press(btn(tree, "14 days"));
    const shown = textOf(tree);
    expect(shown).toMatch(/needs somebody/i);
    expect(shown).toMatch(/each day/i);
    tree.unmount();
  });

  test("the don't-list is shown even for a trip short enough to need no sitter", () => {
    const tree = mount(<VacationCard tank={tank} waterType="fresh" />);
    press(btn(tree, "3 days"));
    expect(textOf(tree)).toMatch(/please don't/i);
    tree.unmount();
  });

  test("preparation steps are there, folded away until wanted", () => {
    const tree = mount(<VacationCard tank={tank} waterType="fresh" />);
    expect(textOf(tree)).not.toMatch(/a week before/i);
    press(byLabel(tree, "Before you go"));
    expect(textOf(tree)).toMatch(/a week before/i);
    tree.unmount();
  });
});
