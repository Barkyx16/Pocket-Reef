jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const renderer = require("react-test-renderer");
const { Text } = require("react-native");
const { LossReviewSheet } = require("../components/LossReviewSheet");
const { reviewLoss } = require("../lib/afterLoss");
const { newLoss, newStockRecord } = require("../lib/livestock");

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


const NOW = Date.now();
const day = (n) => localDay(NOW - n * 86400000);
const mount = (el) => { let t; renderer.act(() => { t = renderer.create(el); }); return t; };
const flatten = (c) =>
  Array.isArray(c) ? c.map(flatten).join("") : typeof c === "string" || typeof c === "number" ? String(c) : "";
const textOf = (t) => t.root.findAllByType(Text).map((n) => flatten(n.props.children)).join(" | ");
const btn = (t, s) =>
  t.root.findAll((n) => typeof n.props?.onPress === "function"
    && n.findAllByType(Text).map((x) => flatten(x.props.children)).join(" ").trim() === s)[0];

const died = (name) => newLoss({ name, reason: "died", date: day(0) });



describe("the loss review sheet", () => {
  test("says nothing at all when there's nothing to say", () => {
    const r = reviewLoss(newLoss({ name: "Fish", reason: "rehomed" }), {}, { now: NOW });
    const tree = mount(<LossReviewSheet visible review={r} name="Fish" onClose={() => {}} />);
    // Rendering null is the whole point: a sheet that opens to say "nothing to
    // report" is one people dismiss before reading.
    expect(tree.toJSON()).toBeNull();
  });

  test("shows what the record found, worst first", () => {
    const tank = { waterTests: [], losses: [died("A"), died("B"), died("C")] };
    const r = reviewLoss(died("Clownfish"), tank, { now: NOW });
    const tree = mount(<LossReviewSheet visible review={r} name="Clownfish" onClose={() => {}} />);
    const shown = textOf(tree);
    expect(shown).toContain("About Clownfish");
    expect(shown).toMatch(/test the water now/i);
    expect(shown).toMatch(/more than bad luck/i);
  });

  test("it frames itself as evidence rather than a verdict", () => {
    const tank = { waterTests: [] };
    const r = reviewLoss(died("Clownfish"), tank, { now: NOW });
    const tree = mount(<LossReviewSheet visible review={r} name="Clownfish" onClose={() => {}} />);
    expect(textOf(tree)).toMatch(/not a verdict/i);
    expect(textOf(tree)).toMatch(/die of old age and of nothing at all/i);
  });

  test("an urgent finding offers the action, and closes on the way", () => {
    const onGoToTab = jest.fn();
    const onClose = jest.fn();
    const r = reviewLoss(died("Clownfish"), { waterTests: [] }, { now: NOW });
    const tree = mount(<LossReviewSheet visible review={r} name="Clownfish" onClose={onClose} onGoToTab={onGoToTab} />);
    renderer.act(() => { btn(tree, "Test the water").props.onPress(); });
    expect(onGoToTab).toHaveBeenCalledWith("log");
    expect(onClose).toHaveBeenCalled();
  });

  test("a calm loss offers no urgent action button", () => {
    const tank = {
      waterTests: [{ date: day(1), water: "fresh", values: { ammonia: 0, nitrite: 0, nitrate: 10, ph: 7.2 } }],
      stockMeta: { Clownfish: newStockRecord({ addedAt: day(500) }) },
      losses: [],
    };
    const r = reviewLoss(died("Clownfish"), tank, { now: NOW });
    const tree = mount(<LossReviewSheet visible review={r} name="Clownfish" onClose={() => {}} onGoToTab={() => {}} />);
    expect(btn(tree, "Test the water")).toBeUndefined();
    expect(textOf(tree)).toMatch(/isn't a failure|rules something out|in range/i);
  });

  test("it can always be closed", () => {
    const onClose = jest.fn();
    const r = reviewLoss(died("Clownfish"), { waterTests: [] }, { now: NOW });
    const tree = mount(<LossReviewSheet visible review={r} name="Clownfish" onClose={onClose} />);
    renderer.act(() => { btn(tree, "Close").props.onPress(); });
    expect(onClose).toHaveBeenCalled();
  });
});
