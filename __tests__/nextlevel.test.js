jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// The chart geometry and the four surfaces built on the new engines.
//
// The geometry gets the most attention here. It's the one part of a
// Views-drawn chart that can be wrong in a way that still *looks* like a chart:
// points landing at plausible-but-incorrect heights, a band drawn against the
// wrong scale, a flat series dividing by a zero span. None of that is visible
// in a screenshot, and all of it is arithmetic.

const renderer = require("react-test-renderer");
const { Text } = require("react-native");

const { layoutSeries, layoutEvents, niceScale, axisDates } = require("../lib/chart");
const { StabilityCard } = require("../components/StabilityCard");
const { InventoryCard } = require("../components/InventoryCard");
const { WeeklyReviewCard } = require("../components/WeeklyReviewCard");
const { ParameterChart } = require("../components/ParameterChart");
const { newInventoryItem } = require("../lib/inventory");

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
const byLabelContaining = (tree, s) =>
  tree.root.findAll((n) => typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.includes(s))[0];

// Cards read the clock, so every one that does takes an injectable `now` and
// these tests pin it. Without that they pass on the day they're written and
// start failing quietly a week later — which is exactly what happened to the
// weekly-review test, and a suite that rots on a calendar is worse than one
// that never covered the case.
const NOW = new Date("2026-08-17T12:00:00Z").getTime();
const dayAgo = (n) => localDay(NOW - n * 86400000);
const test0 = (date, values) => ({ date, water: "salt", values });



// ─────────────────────────────────────────────────────────────────────────────
// Chart geometry
// ─────────────────────────────────────────────────────────────────────────────
describe("chart geometry", () => {
  const pts = [
    { value: 10, date: "2026-08-01" },
    { value: 20, date: "2026-08-11" },
    { value: 30, date: "2026-08-21" },
  ];

  test("time drives the x position, not the index", () => {
    // An unevenly spaced series must not be drawn evenly spaced.
    const uneven = [
      { value: 10, date: "2026-08-01" },
      { value: 20, date: "2026-08-03" },
      { value: 30, date: "2026-08-21" },
    ];
    const { dots } = layoutSeries(uneven, { width: 100, height: 100 });
    expect(dots[0].x).toBe(0);
    expect(dots[2].x).toBe(100);
    // 2 days into a 20-day span is 10% across, not the 50% an index would give.
    expect(dots[1].x).toBeCloseTo(10, 0);
  });

  test("higher readings sit higher on screen", () => {
    const { dots } = layoutSeries(pts, { width: 100, height: 100 });
    // Origin is top-left, so a bigger value means a smaller y.
    expect(dots[2].y).toBeLessThan(dots[0].y);
  });

  test("input order doesn't matter", () => {
    const a = layoutSeries(pts, { width: 100, height: 100 });
    const b = layoutSeries([...pts].reverse(), { width: 100, height: 100 });
    expect(b.dots.map((d) => d.value)).toEqual(a.dots.map((d) => d.value));
  });

  test("segments join consecutive dots", () => {
    const { dots, segments } = layoutSeries(pts, { width: 100, height: 100 });
    expect(segments).toHaveLength(dots.length - 1);
    expect(segments[0].x).toBe(dots[0].x);
    // A rising line in screen space goes up, so the angle is negative.
    expect(segments[0].angle).toBeLessThan(0);
  });

  test("a dead-flat series doesn't divide by a zero span", () => {
    const flat = [
      { value: 8.4, date: "2026-08-01" },
      { value: 8.4, date: "2026-08-08" },
    ];
    const { dots, scale } = layoutSeries(flat, { width: 100, height: 100 });
    expect(scale.max).toBeGreaterThan(scale.min);
    dots.forEach((d) => expect(Number.isFinite(d.y)).toBe(true));
    // It should sit in the middle rather than at an edge.
    expect(dots[0].y).toBeCloseTo(50, 0);
  });

  test("two readings on one day still lay out finitely", () => {
    const same = [{ value: 8, date: "2026-08-01" }, { value: 9, date: "2026-08-01" }];
    const { dots } = layoutSeries(same, { width: 100, height: 100 });
    dots.forEach((d) => expect(Number.isFinite(d.x)).toBe(true));
  });

  test("the target band is placed on the same scale as the line", () => {
    const { band, scale } = layoutSeries(pts, { width: 100, height: 100, band: [15, 25] });
    expect(band).toBeTruthy();
    // Band top corresponds to the HIGHER value, so it's nearer y=0.
    const expectedTop = 100 - ((25 - scale.min) / (scale.max - scale.min)) * 100;
    expect(band.top).toBeCloseTo(expectedTop, 0);
    expect(band.height).toBeGreaterThan(0);
  });

  test("the scale always contains the band, so an out-of-range tank still shows its target", () => {
    const high = [{ value: 100, date: "2026-08-01" }, { value: 110, date: "2026-08-08" }];
    const { scale } = layoutSeries(high, { width: 100, height: 100, band: [0, 20] });
    expect(scale.min).toBeLessThanOrEqual(20);
  });

  test("a parameter that can't go negative gets no negative axis", () => {
    const s = niceScale([0, 5, 10]);
    expect(s.min).toBe(0);
  });

  test("empty input returns an empty chart rather than throwing", () => {
    const { dots, segments, scale } = layoutSeries([], { width: 100, height: 100 });
    expect(dots).toEqual([]);
    expect(segments).toEqual([]);
    expect(scale).toBeNull();
  });

  test("unparseable dates and values are dropped, not plotted at zero", () => {
    const messy = [
      { value: 10, date: "2026-08-01" },
      { value: "nonsense", date: "2026-08-05" },
      { value: 20, date: "not a date" },
      { value: 30, date: "2026-08-21" },
    ];
    const { dots } = layoutSeries(messy, { width: 100, height: 100 });
    expect(dots.map((d) => d.value)).toEqual([10, 30]);
  });

  test("events land on the same axis as the readings", () => {
    const { span } = layoutSeries(pts, { width: 100, height: 100 });
    const marks = layoutEvents(
      [{ type: "waterchange", date: "2026-08-11" }],
      { width: 100, tMin: span.tMin, tMax: span.tMax }
    );
    expect(marks[0].x).toBeCloseTo(50, 0);
  });

  test("events outside the window are dropped rather than pinned to the edge", () => {
    const { span } = layoutSeries(pts, { width: 100, height: 100 });
    const marks = layoutEvents(
      [{ type: "waterchange", date: "2020-01-01" }, { type: "feeding", date: "2026-08-11" }],
      { width: 100, tMin: span.tMin, tMax: span.tMax }
    );
    expect(marks).toHaveLength(1);
    expect(marks[0].type).toBe("feeding");
  });

  test("axis labels span both ends", () => {
    const { span } = layoutSeries(pts, { width: 100, height: 100 });
    const ticks = axisDates(span.tMin, span.tMax, 3);
    expect(ticks[0]).toBe("2026-08-01");
    expect(ticks[2]).toBe("2026-08-21");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Surfaces
// ─────────────────────────────────────────────────────────────────────────────
describe("the stability card", () => {
  const swinging = {
    waterTests: [
      test0(dayAgo(0), { alk: 7.8 }),
      test0(dayAgo(3), { alk: 9.6 }),
      test0(dayAgo(6), { alk: 7.4 }),
    ],
  };

  test("grades the tank and names the parameter, not the grade", () => {
    const tree = mount(<StabilityCard tank={swinging} waterType="salt" now={NOW} />);
    const shown = textOf(tree);
    expect(shown).toContain("Alk");
    // The bug this caught once: the grade's label overwrote the parameter's.
    expect(shown).not.toContain("Unstable is unstable");
    tree.unmount();
  });

  test("explains that it measures movement, not position", () => {
    const tree = mount(<StabilityCard tank={swinging} waterType="salt" now={NOW} />);
    expect(textOf(tree)).toMatch(/movement/i);
    tree.unmount();
  });

  test("a thin history asks for readings instead of scoring", () => {
    const tree = mount(<StabilityCard tank={{ waterTests: [test0(dayAgo(0), { alk: 8.4 })] }} waterType="salt" now={NOW} />);
    expect(textOf(tree)).toMatch(/at least three tests/i);
    tree.unmount();
  });

  test("tapping a parameter opens its chart", () => {
    const tree = mount(<StabilityCard tank={swinging} waterType="salt" now={NOW} />);
    press(byLabelContaining(tree, "Tap for the full chart"));
    // The chart's own range selector proves the modal is up.
    expect(byLabelContaining(tree, "Show all readings")).toBeTruthy();
    tree.unmount();
  });
});

describe("the parameter chart", () => {
  const tank = {
    waterTests: [0, 7, 14, 21].map((d) => test0(dayAgo(d), { nitrate: 10 + d })),
    waterChanges: [{ id: "w1", date: dayAgo(10), pct: 25, gallons: 25 }],
  };

  test("draws the series with its dates and a legend for the events", () => {
    const tree = mount(<ParameterChart visible paramKey="nitrate" tank={tank} waterType="salt" onClose={() => {}} />);
    const shown = textOf(tree);
    expect(shown).toContain("4 readings");
    expect(shown).toContain("Water change");
    tree.unmount();
  });

  test("one reading is not a chart, and it says so", () => {
    const thin = { waterTests: [test0(dayAgo(0), { nitrate: 10 })] };
    const tree = mount(<ParameterChart visible paramKey="nitrate" tank={thin} waterType="salt" onClose={() => {}} />);
    expect(textOf(tree)).toMatch(/not enough readings/i);
    tree.unmount();
  });

  test("it closes", () => {
    const onClose = jest.fn();
    const tree = mount(<ParameterChart visible paramKey="nitrate" tank={tank} waterType="salt" onClose={onClose} />);
    press(byLabelContaining(tree, "Close chart"));
    expect(onClose).toHaveBeenCalled();
    tree.unmount();
  });
});

describe("the supplies card", () => {
  const saltTank = {
    gallons: 100,
    waterChanges: [0, 14, 28, 42].map((d) => ({ id: `w${d}`, date: dayAgo(d), pct: 25, gallons: 25 })),
  };

  test("an empty shelf offers a starting point rather than a blank form", () => {
    const tree = mount(<InventoryCard tank={{}} waterType="salt" onAdd={() => {}} onRemove={() => {}} now={NOW} />);
    const shown = textOf(tree);
    expect(shown).toMatch(/nothing on the shelf/i);
    expect(shown).toContain("Salt mix");
    tree.unmount();
  });

  test("a stocked item shows its predicted run-out and what that's based on", () => {
    const tank = { ...saltTank, inventory: [newInventoryItem({ name: "Salt mix", kind: "salt", stock: 50, perGallon: 0.5 })] };
    const tree = mount(<InventoryCard tank={tank} waterType="salt" onAdd={() => {}} onRemove={() => {}} now={NOW} />);
    const shown = textOf(tree);
    expect(shown).toMatch(/days left/i);
    // The basis is never hidden — a measured rate is worth more than a stated one.
    expect(shown).toContain("water changes");
    tree.unmount();
  });

  test("a low item raises the restock banner", () => {
    const tank = { ...saltTank, inventory: [newInventoryItem({ name: "Salt mix", kind: "salt", stock: 2, perGallon: 0.5 })] };
    const tree = mount(<InventoryCard tank={tank} waterType="salt" onAdd={() => {}} onRemove={() => {}} now={NOW} />);
    expect(textOf(tree)).toMatch(/to restock/i);
    tree.unmount();
  });

  test("an unpredictable item says so instead of inventing a date", () => {
    const tank = { inventory: [newInventoryItem({ name: "Carbon", kind: "media", stock: 5 })] };
    const tree = mount(<InventoryCard tank={tank} waterType="salt" onAdd={() => {}} onRemove={() => {}} now={NOW} />);
    expect(textOf(tree)).toMatch(/not enough usage/i);
    tree.unmount();
  });

  test("freshwater keepers aren't offered salt mix", () => {
    const tree = mount(<InventoryCard tank={{}} waterType="fresh" onAdd={() => {}} onRemove={() => {}} now={NOW} />);
    expect(textOf(tree)).not.toContain("Salt mix");
    tree.unmount();
  });
});

describe("the weekly review", () => {
  const tank = {
    gallons: 100,
    waterTests: [test0(dayAgo(1), { nitrate: 8 }), test0(dayAgo(6), { nitrate: 20 })],
    waterChanges: [{ id: "w1", date: dayAgo(3), pct: 25, gallons: 25 }],
    feedings: [{ id: "f1", date: dayAgo(2) }],
  };

  test("summarises the week and what moved in it", () => {
    const tree = mount(<WeeklyReviewCard tank={tank} waterType="salt" now={NOW} />);
    const shown = textOf(tree);
    expect(shown).toContain("2 tests");
    expect(shown).toContain("What moved");
    expect(shown).toContain("↓12");
    tree.unmount();
  });

  test("a month can be reviewed as well as a week", () => {
    const tree = mount(<WeeklyReviewCard tank={tank} waterType="salt" now={NOW} />);
    press(byLabelContaining(tree, "Review the last 30 days"));
    expect(textOf(tree)).toContain("Your month");
    tree.unmount();
  });

  test("it hides entirely rather than rendering a card of zeroes", () => {
    const tree = mount(<WeeklyReviewCard tank={{ waterTests: [] }} waterType="salt" now={NOW} />);
    expect(tree.toJSON()).toBeNull();
    tree.unmount();
  });

  test("an empty bucket becomes the thing worth attention, with a way to it", () => {
    const onGoToTab = jest.fn();
    const withOut = { ...tank, inventory: [newInventoryItem({ name: "Salt mix", kind: "salt", stock: 0, perGallon: 0.5 })] };
    const tree = mount(<WeeklyReviewCard tank={withOut} waterType="salt" onGoToTab={onGoToTab} now={NOW} />);
    const shown = textOf(tree);
    expect(shown).toContain("Worth your attention");
    expect(shown).toContain("Salt mix");

    // The route out lands on the tab that actually holds the shelf.
    const link = tree.root.findAll((n) => typeof n.props?.onPress === "function"
      && n.findAllByType(Text).some((t) => flatten(t.props.children).includes("Open the shelf")))[0];
    press(link);
    expect(onGoToTab).toHaveBeenCalledWith("tank");
    tree.unmount();
  });
});
