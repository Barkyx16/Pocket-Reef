jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// One card breaking must not take the screen with it.
//
// This became a real risk rather than a theoretical one as the analysis engines
// piled up: twenty-odd cards now do arithmetic over user data, and each is a
// place where one keeper's edge case blanks everybody's Home screen.

const renderer = require("react-test-renderer");
const { Text, View } = require("react-native");
const { CardBoundary } = require("../components/CardBoundary");
const { AdaptiveColumns } = require("../components/AdaptiveColumns");

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 })),
}));

const mount = (el) => {
  let tree;
  renderer.act(() => { tree = renderer.create(el); });
  return tree;
};
const flatten = (c) =>
  Array.isArray(c) ? c.map(flatten).join("") : typeof c === "string" || typeof c === "number" ? String(c) : "";
const textOf = (t) => t.root.findAllByType(Text).map((n) => flatten(n.props.children)).join(" ");
const btn = (t, label) =>
  t.root.findAll((n) => typeof n.props?.onPress === "function"
    && typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.includes(label))[0];

function Boom() { throw new Error("nitrate of undefined"); }
function Fine({ label }) { return <Text>{label}</Text>; }

// React logs caught render errors; the test asserts behaviour, not the noise.
let spy;
beforeEach(() => { spy = jest.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => spy.mockRestore());

describe("a card that throws", () => {
  test("is contained, and says so rather than vanishing", () => {
    const tree = mount(<CardBoundary name="Stability"><Boom /></CardBoundary>);
    const shown = textOf(tree);
    expect(shown).toContain("Stability couldn't be shown");
    // A silently missing card is worse than a broken one — nobody reports what
    // they never saw.
    expect(shown.length).toBeGreaterThan(0);
  });

  test("says the data is safe, which is the actual fear", () => {
    const tree = mount(<CardBoundary name="Stability"><Boom /></CardBoundary>);
    expect(textOf(tree)).toMatch(/records are safe/i);
  });

  test("offers a retry that remounts it", () => {
    let shouldThrow = true;
    function Flaky() {
      if (shouldThrow) throw new Error("transient");
      return <Text>recovered</Text>;
    }
    const tree = mount(<CardBoundary name="Trends"><Flaky /></CardBoundary>);
    expect(textOf(tree)).toContain("couldn't be shown");

    shouldThrow = false;
    renderer.act(() => { btn(tree, "Try showing Trends again").props.onPress(); });
    expect(textOf(tree)).toContain("recovered");
  });

  test("reports upward so a crash can still be counted", () => {
    const onError = jest.fn();
    mount(<CardBoundary name="Forecast" onError={onError}><Boom /></CardBoundary>);
    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls[0][2]).toBe("Forecast");
  });

  test("a healthy card is untouched — no wrapper text, no chrome", () => {
    const tree = mount(<CardBoundary name="Stability"><Fine label="all good" /></CardBoundary>);
    expect(textOf(tree)).toBe("all good");
  });
});

describe("a screen full of cards", () => {
  test("keeps rendering the others when one throws", () => {
    const tree = mount(
      <AdaptiveColumns lead={1}>
        <Fine label="hero" />
        <Fine label="before" />
        <Boom />
        <Fine label="after" />
      </AdaptiveColumns>
    );
    const shown = textOf(tree);
    // The whole screen used to go blank here.
    expect(shown).toContain("hero");
    expect(shown).toContain("before");
    expect(shown).toContain("after");
    expect(shown).toContain("couldn't be shown");
  });

  test("the broken card is named after the component that broke", () => {
    const tree = mount(
      <AdaptiveColumns lead={0}>
        <Fine label="a" />
        <Boom />
        <Fine label="b" />
      </AdaptiveColumns>
    );
    expect(textOf(tree)).toContain("Boom couldn't be shown");
  });

  test("guarding can be switched off without changing the output", () => {
    const tree = mount(
      <AdaptiveColumns lead={1} guard={false}>
        <Fine label="a" />
        <Fine label="b" />
        <Fine label="c" />
      </AdaptiveColumns>
    );
    expect(textOf(tree)).toBe("a b c");
  });
});
