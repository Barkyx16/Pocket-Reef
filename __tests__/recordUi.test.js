jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const renderer = require("react-test-renderer");
const { Text } = require("react-native");

const { TankRecordCard } = require("../components/TankRecordCard");
const { StockRecordSheet } = require("../components/StockRecordSheet");
const { TargetsCard } = require("../components/TargetsCard");
const { setActiveTargets, activeParams } = require("../lib/targets");
const { assessParam, getTankHealthScore } = require("../core");

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
const byLabel = (tree, label) => tree.root.findAll((n) => n.props.accessibilityLabel === label);

const FISH = "Ocellaris Clownfish";
const day = (n) => localDay(Date.now() - n * 86400000);



afterEach(() => setActiveTargets({}));

describe("tank record", () => {
  test("an untouched tank explains what the record will become", () => {
    const tree = mount(<TankRecordCard stock={[]} losses={[]} />);
    expect(textOf(tree)).toContain("becomes your tank's record");
    tree.unmount();
  });

  test("shows tenure, source and price for a documented animal", () => {
    const tree = mount(
      <TankRecordCard
        stock={[FISH]}
        stockMeta={{ [FISH]: { addedAt: day(400), source: "Blue Reef", price: 24 } }}
        quantities={{ [FISH]: 2 }}
        losses={[]}
      />
    );
    const text = textOf(tree);
    expect(text).toContain("Blue Reef");
    expect(text).toContain("$24");
    expect(text).toContain("2×");
    tree.unmount();
  });

  test("an undocumented animal invites the detail rather than hiding it", () => {
    const tree = mount(<TankRecordCard stock={[FISH]} stockMeta={{}} losses={[]} />);
    expect(textOf(tree)).toContain("Add details");
    tree.unmount();
  });

  test("is honest that a half-filled record is half-filled", () => {
    const tree = mount(
      <TankRecordCard stock={[FISH, "Blue Tang"]} stockMeta={{ [FISH]: { addedAt: day(10) } }} losses={[]} />
    );
    expect(textOf(tree)).toContain("1 of 2 animals dated");
    tree.unmount();
  });

  test("losses appear in the history with cause and tenure", () => {
    const tree = mount(
      <TankRecordCard
        stock={[]}
        losses={[{ id: "1", name: "Blue Tang", reason: "died", cause: "Disease", count: 1, date: day(5), tenure: "8 months" }]}
      />
    );
    const text = textOf(tree);
    expect(text).toContain("Blue Tang");
    expect(text).toContain("Disease");
    expect(text).toContain("kept 8 months");
    tree.unmount();
  });

  test("surfaces a species lost more than once as a finding", () => {
    const losses = [
      { id: "1", name: "Blue Tang", reason: "died", cause: "Disease", count: 1, date: day(5) },
      { id: "2", name: "Blue Tang", reason: "died", cause: "Disease", count: 1, date: day(50) },
    ];
    const tree = mount(<TankRecordCard stock={[]} losses={losses} />);
    expect(textOf(tree)).toContain("Worth a second look");
    tree.unmount();
  });

  test("a rehoming is not shown as a loss statistic", () => {
    const tree = mount(
      <TankRecordCard stock={[]} losses={[{ id: "1", name: "Chromis", reason: "rehomed", count: 4, date: day(3) }]} />
    );
    // It's in the history, but "lost this year" stays at zero.
    expect(textOf(tree)).toContain("Chromis");
    expect(textOf(tree)).toContain("Nothing lost");
    tree.unmount();
  });
});

describe("stock record sheet", () => {
  test("opens on what is already known", () => {
    const tree = mount(
      <StockRecordSheet visible name={FISH} record={{ addedAt: "2025-01-04", source: "Blue Reef", price: 24 }} onClose={() => {}} onSave={() => {}} onRecordLoss={() => {}} />
    );
    const inputs = tree.root.findAll((n) => n.props.accessibilityLabel === "Where the animal came from");
    expect(inputs[0].props.value).toBe("Blue Reef");
    tree.unmount();
  });

  test("saving merges rather than replacing the record", () => {
    const onSave = jest.fn();
    const tree = mount(
      <StockRecordSheet visible name={FISH} record={{ addedAt: "2025-01-04", source: "Blue Reef", price: 24, notes: "Pairs with the anemone" }} onClose={() => {}} onSave={onSave} onRecordLoss={() => {}} />
    );
    renderer.act(() => {
      tree.root.findAll((n) => n.props.accessibilityLabel === "Where the animal came from")[0].props.onChangeText("Coral Cove");
    });
    renderer.act(() => { byLabel(tree, `Save record for ${FISH}`)[0].props.onPress(); });

    expect(onSave).toHaveBeenCalled();
    const [, rec] = onSave.mock.calls[0];
    expect(rec.source).toBe("Coral Cove");
    // Filling one field must not wipe the others.
    expect(rec.notes).toBe("Pairs with the anemone");
    expect(rec.price).toBe(24);
    tree.unmount();
  });

  test("the loss flow asks a cause only for a death", () => {
    const tree = mount(
      <StockRecordSheet visible name={FISH} record={{ addedAt: day(300) }} onClose={() => {}} onSave={() => {}} onRecordLoss={() => {}} />
    );
    renderer.act(() => { byLabel(tree, `Record that ${FISH} left the tank`)[0].props.onPress(); });
    expect(textOf(tree)).toContain("Likely cause");

    renderer.act(() => { byLabel(tree, "Rehomed / sold")[0].props.onPress(); });
    // Asking why you sold a healthy fish reads as an accusation.
    expect(textOf(tree)).not.toContain("Likely cause");
    tree.unmount();
  });

  test("recording a loss reports the reason, cause and count", () => {
    const onRecordLoss = jest.fn();
    const tree = mount(
      <StockRecordSheet visible name={FISH} record={{ addedAt: day(300) }} quantity={6} onClose={() => {}} onSave={() => {}} onRecordLoss={onRecordLoss} />
    );
    renderer.act(() => { byLabel(tree, `Record that ${FISH} left the tank`)[0].props.onPress(); });
    renderer.act(() => { byLabel(tree, "Cause: Aggression")[0].props.onPress(); });
    renderer.act(() => { byLabel(tree, "More")[0].props.onPress(); });

    renderer.act(() => { byLabel(tree, `Save ${FISH} to tank history`)[0].props.onPress(); });

    expect(onRecordLoss).toHaveBeenCalledWith(expect.objectContaining({ name: FISH, reason: "died", cause: "Aggression", count: 2 }));
    tree.unmount();
  });

  test("the count can never exceed how many you actually have", () => {
    const tree = mount(
      <StockRecordSheet visible name={FISH} record={{}} quantity={2} onClose={() => {}} onSave={() => {}} onRecordLoss={() => {}} />
    );
    renderer.act(() => { byLabel(tree, `Record that ${FISH} left the tank`)[0].props.onPress(); });
    for (let i = 0; i < 5; i++) renderer.act(() => { byLabel(tree, "More")[0].props.onPress(); });
    expect(textOf(tree)).toContain("all of them");
    tree.unmount();
  });
});

describe("targets card", () => {
  test("shows the built-in range until one is set", () => {
    const tree = mount(<TargetsCard waterType="salt" targets={{}} onSetTarget={() => {}} onSetAll={() => {}} />);
    expect(textOf(tree)).toContain("< 20 ppm");
    tree.unmount();
  });

  test("a preset applies its whole set", () => {
    const onSetAll = jest.fn();
    const tree = mount(<TargetsCard waterType="salt" targets={{}} onSetTarget={() => {}} onSetAll={onSetAll} />);
    renderer.act(() => { byLabel(tree, "Use SPS dominant targets")[0].props.onPress(); });
    expect(onSetAll).toHaveBeenCalledWith(expect.objectContaining({ nitrate: { good: [2, 5], caution: [0, 10] } }));
    tree.unmount();
  });

  test("editing a range reports it back", () => {
    const onSetTarget = jest.fn();
    const tree = mount(<TargetsCard waterType="salt" targets={{}} onSetTarget={onSetTarget} onSetAll={() => {}} />);
    renderer.act(() => { byLabel(tree, "Nitrate target, currently < 20 ppm")[0].props.onPress(); });
    renderer.act(() => { byLabel(tree, "Nitrate minimum")[0].props.onChangeText("2"); });
    renderer.act(() => { byLabel(tree, "Nitrate maximum")[0].props.onChangeText("5"); });
    renderer.act(() => { byLabel(tree, "Save Nitrate target")[0].props.onPress(); });
    expect(onSetTarget).toHaveBeenCalledWith("nitrate", { good: [2, 5] });
    tree.unmount();
  });

  test("a backwards range is refused rather than stored", () => {
    // 12–8 would grade every reading as danger, permanently.
    const onSetTarget = jest.fn();
    const tree = mount(<TargetsCard waterType="salt" targets={{}} onSetTarget={onSetTarget} onSetAll={() => {}} />);
    renderer.act(() => { byLabel(tree, "Nitrate target, currently < 20 ppm")[0].props.onPress(); });
    renderer.act(() => { byLabel(tree, "Nitrate minimum")[0].props.onChangeText("12"); });
    renderer.act(() => { byLabel(tree, "Nitrate maximum")[0].props.onChangeText("8"); });
    renderer.act(() => { byLabel(tree, "Save Nitrate target")[0].props.onPress(); });
    expect(onSetTarget).not.toHaveBeenCalled();
    tree.unmount();
  });

  test("a customised parameter offers a way back to the default", () => {
    const onSetTarget = jest.fn();
    const tree = mount(<TargetsCard waterType="salt" targets={{ nitrate: { good: [2, 5] } }} onSetTarget={onSetTarget} onSetAll={() => {}} />);
    expect(textOf(tree)).toContain("1 parameter set to your tank");
    renderer.act(() => { byLabel(tree, "Nitrate target, currently 2–5 ppm")[0].props.onPress(); });
    renderer.act(() => { byLabel(tree, "Reset Nitrate to the default")[0].props.onPress(); });
    expect(onSetTarget).toHaveBeenCalledWith("nitrate", null);
    tree.unmount();
  });
});

describe("targets reach the whole app", () => {
  test("activeParams follows the tank that is currently set", () => {
    setActiveTargets({ nitrate: { good: [2, 5] } });
    const nitrate = activeParams("salt").find((p) => p.key === "nitrate");
    expect(nitrate.good).toEqual([2, 5]);
    expect(assessParam(nitrate, 15).status).not.toBe("good");

    // Switching to a tank with no targets must not inherit the last one's.
    setActiveTargets({});
    expect(activeParams("salt").find((p) => p.key === "nitrate").good).toEqual([0, 20]);
  });

  test("the health score is graded against the tank's own targets", () => {
    // The same water, judged by two different tanks' standards. If the score
    // ignored targets this feature would be cosmetic.
    const tank = { tank: ["Ocellaris Clownfish"], tankGallons: 40, maintenance: {}, quantities: {} };
    const waterTests = [{ date: day(1), water: "salt", values: { ammonia: 0, nitrite: 0, nitrate: 18, ph: 8.1 } }];

    setActiveTargets({});
    const lenient = getTankHealthScore({ ...tank, waterTests }).score;

    setActiveTargets({ nitrate: { good: [2, 5], caution: [0, 8] } });
    const strict = getTankHealthScore({ ...tank, waterTests }).score;

    expect(strict).toBeLessThan(lenient);
  });
});
