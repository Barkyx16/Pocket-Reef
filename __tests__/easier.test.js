jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Five things that made the app harder to use than it needed to be. Four are
// invisible in a screenshot and only show up on a real phone, which is why they
// survived this long.
const fs = require("fs");
const path = require("path");
const renderer = require("react-test-renderer");
const { Text } = require("react-native");
const { WaterTestCard } = require("../components/WaterTestCard");
const { getTodayKey } = require("../core");

const APP = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");
const readScreen = (f) => fs.readFileSync(path.join(__dirname, "..", "screens", f), "utf8");

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
const byLabelMatch = (tree, re) =>
  tree.root.findAll((n) => typeof n.props.accessibilityLabel === "string" && re.test(n.props.accessibilityLabel));

describe("Android's back button", () => {
  // Species detail, disease detail and every non-Home tab are conditional
  // renders, not routes — so with nothing registered, back QUIT THE APP from
  // the middle of a care sheet. On Android that reads as a crash.
  test("a hardware back handler is registered", () => {
    expect(APP).toContain("BackHandler.addEventListener");
    expect(APP).toContain('"hardwareBackPress"');
  });

  test("it closes overlays before detail screens before tabs", () => {
    const body = APP.slice(APP.indexOf("const onBack = () =>"), APP.indexOf("BackHandler.addEventListener"));
    const order = ["showSearch", "recordFor", "tabMenu", "showQuick", "showTankMenu", "showImport", "tankSheet", "selectedDisease", "selectedSpecies", "activeTab"];
    const positions = order.map((k) => body.indexOf(k));
    // Every branch present, and in visual-stacking order so back always closes
    // the nearest thing first.
    positions.forEach((pos, i) => expect(pos).toBeGreaterThan(i === 0 ? -1 : positions[i - 1]));
  });

  test("it hands control back to the OS on Home", () => {
    // Returning true everywhere would trap the user in the app.
    const body = APP.slice(APP.indexOf("const onBack = () =>"), APP.indexOf("BackHandler.addEventListener"));
    expect(body).toContain("return false;");
  });

  test("the listener is removed on teardown", () => {
    const body = APP.slice(APP.indexOf('BackHandler.addEventListener'), APP.indexOf('BackHandler.addEventListener') + 400);
    expect(body).toContain("sub.remove()");
  });
});

describe("the keyboard stops fighting the forms", () => {
  test("the content region is wrapped in a KeyboardAvoidingView", () => {
    // Only the auth screen handled this, so every actual data-entry form hid
    // the field the moment you tapped it.
    expect(APP).toContain("<KeyboardAvoidingView");
    expect(APP).toContain('behavior={Platform.OS === "ios" ? "padding" : undefined}');
  });

  test("every scrolling screen keeps taps alive while the keyboard is up", () => {
    // Without this the first tap on Save/Log is swallowed dismissing the
    // keyboard, so every form needed the button pressed twice.
    for (const f of ["LogTab.js", "TankTab.js", "HomeTab.js", "JournalTab.js", "ProfileTab.js", "SpeciesTab.js"]) {
      expect(readScreen(f)).toContain('keyboardShouldPersistTaps="handled"');
    }
  });
});

describe("a water test can be dated, corrected and removed", () => {
  const HISTORY = [
    { date: "2026-08-08", water: "fresh", values: { ammonia: 0, nitrate: 20, ph: 8.7 } },
    { date: "2026-08-01", water: "fresh", values: { ammonia: 0, nitrate: 10, ph: 7.2 } },
  ];

  test("a new test defaults to today and says so", () => {
    const tree = mount(<WaterTestCard waterType="fresh" history={[]} onLog={() => {}} />);
    expect(textOf(tree)).toContain("today");
    tree.unmount();
  });

  test("the date can be changed, so yesterday's reading files under yesterday", () => {
    // Everything was stamped getTodayKey() with no way to say otherwise, so a
    // Saturday test logged on Sunday went into the trends on the wrong day.
    const onLog = jest.fn();
    const tree = mount(<WaterTestCard waterType="fresh" history={[]} onLog={onLog} />);
    renderer.act(() => { byLabelMatch(tree, /Tap to change the date/)[0].props.onPress(); });
    renderer.act(() => { byLabel(tree, "Date this test was taken")[0].props.onChangeText("2026-08-01"); });
    renderer.act(() => { byLabel(tree, "Mark ammonia and nitrite as zero")[0].props.onPress(); });

    renderer.act(() => { byLabel(tree, "Log this water test")[0].props.onPress(); });

    expect(onLog).toHaveBeenCalledWith(expect.objectContaining({ date: "2026-08-01" }));
    tree.unmount();
  });

  test("an unparseable date is refused rather than stored", () => {
    // A date the app can't parse sorts to the wrong place in every trend.
    const onLog = jest.fn();
    const tree = mount(<WaterTestCard waterType="fresh" history={[]} onLog={onLog} />);
    renderer.act(() => { byLabelMatch(tree, /Tap to change the date/)[0].props.onPress(); });
    renderer.act(() => { byLabel(tree, "Date this test was taken")[0].props.onChangeText("last tuesday"); });
    renderer.act(() => { byLabel(tree, "Mark ammonia and nitrite as zero")[0].props.onPress(); });
    renderer.act(() => { byLabel(tree, "Log this water test")[0].props.onPress(); });
    expect(onLog).not.toHaveBeenCalled();
    tree.unmount();
  });

  test("tapping a logged test loads it back for correction", () => {
    // A pH typed as 8.7 instead of 8.1 passes the plausibility check and was
    // then permanent — baked into every average, delta, forecast and score.
    const onUpdate = jest.fn();
    const tree = mount(<WaterTestCard waterType="fresh" history={HISTORY} onLog={() => {}} onUpdate={onUpdate} onDelete={() => {}} />);
    renderer.act(() => { byLabel(tree, "Test from 2026-08-08. Tap to correct it.")[0].props.onPress(); });

    expect(textOf(tree)).toContain("Correcting the test from 2026-08-08");
    // The stored values are in the form, ready to edit.
    const ph = tree.root.findAll((n) => typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.startsWith("pH"))[0];
    expect(ph.props.value).toBe("8.7");

    renderer.act(() => { ph.props.onChangeText("8.1"); });
    // Targeted by label: the submit button is no longer the last button on the
    // card now that each history row carries a delete.
    renderer.act(() => { byLabel(tree, "Save the corrected test")[0].props.onPress(); });

    expect(onUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ date: "2026-08-08" }));
    expect(onUpdate.mock.calls[0][1].values.ph).toBe(8.1);
    tree.unmount();
  });

  test("the button says update, not log, while correcting", () => {
    const tree = mount(<WaterTestCard waterType="fresh" history={HISTORY} onLog={() => {}} onUpdate={() => {}} onDelete={() => {}} />);
    renderer.act(() => { byLabel(tree, "Test from 2026-08-08. Tap to correct it.")[0].props.onPress(); });
    expect(textOf(tree)).toContain("Update 3 readings");
    tree.unmount();
  });

  test("a correction can be abandoned", () => {
    const tree = mount(<WaterTestCard waterType="fresh" history={HISTORY} onLog={() => {}} onUpdate={() => {}} onDelete={() => {}} />);
    renderer.act(() => { byLabel(tree, "Test from 2026-08-08. Tap to correct it.")[0].props.onPress(); });
    renderer.act(() => { byLabel(tree, "Cancel the correction")[0].props.onPress(); });
    expect(textOf(tree)).not.toContain("Correcting the test");
    expect(textOf(tree)).toContain("Enter a reading to log");
    tree.unmount();
  });

  test("a stored test can be deleted by index", () => {
    const onDelete = jest.fn();
    const tree = mount(<WaterTestCard waterType="fresh" history={HISTORY} onLog={() => {}} onUpdate={() => {}} onDelete={onDelete} />);
    renderer.act(() => { byLabel(tree, "Delete the test from 2026-08-01")[0].props.onPress(); });
    expect(onDelete).toHaveBeenCalledWith(1);
    tree.unmount();
  });

  test("the correct and delete controls are siblings, not nested buttons", () => {
    // A <button> inside a <button> is invalid on web, and on native the parent
    // touchable can swallow the child's press. SpeciesCard and TankSwitcher
    // both carry comments about fixing exactly this shape; the history row had
    // reintroduced it.
    const tree = mount(<WaterTestCard waterType="fresh" history={HISTORY} onLog={() => {}} onUpdate={() => {}} onDelete={() => {}} />);
    const rowButtons = tree.root.findAll(
      (n) => typeof n.props.accessibilityLabel === "string" && /Tap to correct it/.test(n.props.accessibilityLabel)
    );
    for (const row of rowButtons) {
      const nestedDeletes = row.findAll(
        (n) => typeof n.props.accessibilityLabel === "string" && /^Delete the test/.test(n.props.accessibilityLabel),
        { deep: true }
      );
      expect(nestedDeletes).toEqual([]);
    }
    // Both controls still exist — they're just not inside one another.
    expect(byLabelMatch(tree, /^Delete the test/).length).toBeGreaterThan(0);
    tree.unmount();
  });

  test("without the handlers the history stays read-only", () => {
    // The card is used in contexts that don't pass them; it must not offer
    // controls that do nothing.
    const tree = mount(<WaterTestCard waterType="fresh" history={HISTORY} onLog={() => {}} />);
    expect(byLabelMatch(tree, /Tap to correct/).length).toBe(0);
    expect(byLabelMatch(tree, /^Delete the test/).length).toBe(0);
    tree.unmount();
  });
});

describe("backfilled tests land in date order", () => {
  // Position 0 is read as "most recent" by every delta, trend and forecast, so
  // prepending a backdated reading would make last Tuesday look like today.
  const sortTests = (list) => [...list].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  test("an older entry sorts below the newer ones", () => {
    const sorted = sortTests([
      { date: "2026-08-01" },
      { date: "2026-08-09" },
      { date: "2026-08-05" },
    ]);
    expect(sorted.map((t) => t.date)).toEqual(["2026-08-09", "2026-08-05", "2026-08-01"]);
  });

  test("App.js sorts rather than prepends", () => {
    expect(APP).toContain("const sortTests =");
    expect(APP).toContain("sortTests([entry, ...tk.waterTests])");
  });

  test("today's key is the format the sort compares", () => {
    // String comparison only orders correctly for zero-padded ISO dates.
    expect(getTodayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
