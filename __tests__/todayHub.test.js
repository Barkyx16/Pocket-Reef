jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// The home screen on a tank that has been neglected.
//
// The analysis engines nearly tripled what Today can say — a neglected tank
// went from four items to eleven, including three separate "Out of X" lines.
// Eleven urgent things is zero actionable things, and a wall on the screen
// somebody opens every morning teaches them to scroll past it.

const renderer = require("react-test-renderer");
const { Text } = require("react-native");
const { TodayCard } = require("../components/TodayCard");
const { getExtraActions, withExtras } = require("../lib/todayExtras");
const { newInventoryItem } = require("../lib/inventory");
const { newLightSchedule } = require("../lib/lighting");

const ago = (n) => new Date(Date.now() - n * 86400000).toISOString();
const key = (n) => ago(n).slice(0, 10);

const mount = (el) => { let t; renderer.act(() => { t = renderer.create(el); }); return t; };
const flatten = (c) =>
  Array.isArray(c) ? c.map(flatten).join("") : typeof c === "string" || typeof c === "number" ? String(c) : "";
const textOf = (t) => t.root.findAllByType(Text).map((n) => flatten(n.props.children)).join(" | ");
const btn = (t, s) =>
  t.root.findAll((n) => typeof n.props?.onPress === "function"
    && n.findAllByType(Text).map((x) => flatten(x.props.children)).join(" ").includes(s))[0];

const emptyShelf = (names) => names.map((n) => newInventoryItem({ name: n, kind: "media", stock: 0, perDay: 1 }));

describe("consumables are one trip to the shop, not one line each", () => {
  test("three empty tubs produce one action", () => {
    const tank = { inventory: emptyShelf(["Salt mix", "Carbon", "Test kit"]), waterTests: [] };
    const shopping = getExtraActions(tank, {}).filter((a) => a.icon === "🛒");
    expect(shopping).toHaveLength(1);
    expect(shopping[0].text).toMatch(/Out of 3 things/);
    expect(shopping[0].text).toMatch(/Salt mix, Carbon and 1 more/);
  });

  test("a single empty tub still names it plainly", () => {
    const tank = { inventory: emptyShelf(["Salt mix"]), waterTests: [] };
    const shopping = getExtraActions(tank, {}).filter((a) => a.icon === "🛒");
    expect(shopping).toHaveLength(1);
    expect(shopping[0].text).toMatch(/Out of Salt mix/);
  });

  test("two are named without an 'and more'", () => {
    const tank = { inventory: emptyShelf(["Salt mix", "Carbon"]), waterTests: [] };
    expect(getExtraActions(tank, {})[0].text).toMatch(/Salt mix and Carbon/);
  });
});

describe("numbers read like numbers", () => {
  test("a swing is rounded for the home screen, not printed to four decimals", () => {
    const tank = {
      waterTests: [
        { date: key(0), water: "salt", values: { alk: 6 } },
        { date: key(3), water: "salt", values: { alk: 10 } },
        { date: key(6), water: "salt", values: { alk: 7 } },
      ],
    };
    const swing = getExtraActions(tank, { waterType: "salt" }).find((a) => /swinging/.test(a.text));
    expect(swing).toBeTruthy();
    expect(swing.text).not.toMatch(/\d\.\d{3,}/);
  });
});

describe("the Today card", () => {
  const actions = (n) =>
    Array.from({ length: n }, (_, i) => ({ rank: i < 2 ? 0 : 1, icon: "💧", to: "log", text: `thing ${i}` }));

  test("an empty list celebrates rather than rendering nothing", () => {
    expect(textOf(mount(<TodayCard actions={[]} />))).toMatch(/all caught up/i);
  });

  test("a short list is shown whole, with no control", () => {
    const tree = mount(<TodayCard actions={actions(4)} />);
    expect(textOf(tree)).toContain("thing 3");
    expect(btn(tree, "more things need attention")).toBeUndefined();
  });

  test("a long list is capped, and says how much is behind the cut", () => {
    const tree = mount(<TodayCard actions={actions(11)} />);
    const shown = textOf(tree);
    expect(shown).toContain("thing 0");
    expect(shown).not.toContain("thing 9");
    expect(shown).toMatch(/6 more things need attention/);
  });

  test("nothing is hidden — the rest is one tap away", () => {
    const tree = mount(<TodayCard actions={actions(11)} />);
    renderer.act(() => { btn(tree, "more things need attention").props.onPress(); });
    expect(textOf(tree)).toContain("thing 10");
  });

  test("and it can be collapsed again", () => {
    const tree = mount(<TodayCard actions={actions(11)} />);
    renderer.act(() => { btn(tree, "more things need attention").props.onPress(); });
    renderer.act(() => { btn(tree, "Show fewer").props.onPress(); });
    expect(textOf(tree)).not.toContain("thing 10");
  });

  test("the cut falls on the least urgent, because the list arrives sorted", () => {
    const mixed = [
      { rank: 2, icon: "💧", to: "log", text: "minor" },
      { rank: 0, icon: "🔴", to: "log", text: "ammonia" },
    ];
    const sorted = withExtras(mixed, { waterTests: [], inventory: [] }, {});
    expect(sorted[0].text).toBe("ammonia");
  });
});
