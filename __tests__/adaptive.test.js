jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Two columns on a tablet, and byte-for-byte unchanged on a phone.
//
// The second half matters more than the first: a responsive layout that quietly
// changes the phone experience is a regression dressed as a feature, and phones
// are where essentially every user is.

const renderer = require("react-test-renderer");
const { Text, View } = require("react-native");
const { AdaptiveColumns } = require("../components/AdaptiveColumns");

// react-native's useWindowDimensions reports a fixed size under jest, so the
// screen size is faked at the source the layout hook actually reads.
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 })),
}));
const useWD = require("react-native/Libraries/Utilities/useWindowDimensions").default;

const phone = () => useWD.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
const tablet = () => useWD.mockReturnValue({ width: 1024, height: 1366, scale: 2, fontScale: 1 });
const phoneLandscape = () => useWD.mockReturnValue({ width: 844, height: 390, scale: 3, fontScale: 1 });

const mount = (el) => {
  let tree;
  renderer.act(() => { tree = renderer.create(el); });
  return tree;
};
const flatten = (c) =>
  Array.isArray(c) ? c.map(flatten).join("") : typeof c === "string" || typeof c === "number" ? String(c) : "";
const textOf = (t) => t.root.findAllByType(Text).map((n) => flatten(n.props.children)).join(" ");

const cards = (n) => Array.from({ length: n }, (_, i) => <Text key={i}>{`card${i}`}</Text>);

// A row container is how the reflow shows up in the tree.
const rows = (tree) => tree.root.findAll((n) => n.type === View && n.props.style && n.props.style.flexDirection === "row");

describe("AdaptiveColumns", () => {
  test("a phone renders the children exactly as given", () => {
    phone();
    const tree = mount(<AdaptiveColumns lead={1}>{cards(6)}</AdaptiveColumns>);
    expect(rows(tree)).toHaveLength(0);
    expect(textOf(tree)).toBe("card0 card1 card2 card3 card4 card5");
  });

  test("a tablet splits into two columns", () => {
    tablet();
    const tree = mount(<AdaptiveColumns lead={1}>{cards(6)}</AdaptiveColumns>);
    expect(rows(tree).length).toBeGreaterThan(0);
    // Nothing is dropped or duplicated in the reflow.
    expect(textOf(tree).split(" ").sort()).toEqual(["card0", "card1", "card2", "card3", "card4", "card5"]);
  });

  test("the lead cards stay full width", () => {
    tablet();
    const tree = mount(<AdaptiveColumns lead={2}>{cards(6)}</AdaptiveColumns>);
    const row = rows(tree)[0];
    // The hero and the card under it sit above the row, not inside it.
    expect(flatten(row.findAllByType(Text).map((t) => t.props.children))).not.toContain("card0");
    expect(flatten(row.findAllByType(Text).map((t) => t.props.children))).not.toContain("card1");
  });

  test("columns alternate rather than halving, so one can't run away", () => {
    tablet();
    const tree = mount(<AdaptiveColumns lead={0}>{cards(6)}</AdaptiveColumns>);
    const row = rows(tree)[0];
    // The two columns are the flex:1 Views inside the row. `row.children`
    // returns every descendant, not the immediate two, so it can't be used.
    const columns = row.findAll((n) => n.type === View && n.props.style && n.props.style.flex === 1).slice(0, 2);
    const texts = columns.map((c) => c.findAllByType(Text).map((t) => flatten(t.props.children)));
    expect(texts[0]).toEqual(["card0", "card2", "card4"]);
    expect(texts[1]).toEqual(["card1", "card3", "card5"]);
  });

  test("a phone in landscape is wide enough to earn the second column", () => {
    phoneLandscape();
    const tree = mount(<AdaptiveColumns lead={1}>{cards(6)}</AdaptiveColumns>);
    expect(rows(tree).length).toBeGreaterThan(0);
  });

  test("too few children to be worth splitting are left alone", () => {
    tablet();
    const tree = mount(<AdaptiveColumns lead={1}>{cards(2)}</AdaptiveColumns>);
    expect(rows(tree)).toHaveLength(0);
  });

  test("it can be switched off", () => {
    tablet();
    const tree = mount(<AdaptiveColumns lead={1} enabled={false}>{cards(6)}</AdaptiveColumns>);
    expect(rows(tree)).toHaveLength(0);
  });

  test("nulls and falsy children don't create empty columns", () => {
    tablet();
    const tree = mount(
      <AdaptiveColumns lead={1}>
        <Text>a</Text>
        {null}
        {false}
        <Text>b</Text>
        <Text>c</Text>
      </AdaptiveColumns>
    );
    expect(textOf(tree).split(" ").sort()).toEqual(["a", "b", "c"]);
  });
});
