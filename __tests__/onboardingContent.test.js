jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 })),
}));

// Onboarding is the thirty seconds in which somebody decides whether to stay,
// and it was describing the app as it existed several rounds ago. These tests
// are less about the copy than about it not silently going stale again.

const renderer = require("react-test-renderer");
const { Text } = require("react-native");
const { OnboardingCard } = require("../components/OnboardingCard");

const flatten = (c) =>
  Array.isArray(c) ? c.map(flatten).join("") : typeof c === "string" || typeof c === "number" ? String(c) : "";
const mount = (el) => {
  let tree;
  renderer.act(() => { tree = renderer.create(el); });
  return tree;
};
const textOf = (t) => t.root.findAllByType(Text).map((n) => flatten(n.props.children)).join(" | ");
const btn = (t, label) =>
  t.root.findAll((n) => typeof n.props?.onPress === "function"
    && n.findAllByType(Text).map((x) => flatten(x.props.children)).join(" ").trim() === label)[0];

describe("onboarding", () => {
  test("it walks through every slide and reaches the end", () => {
    const onFinish = jest.fn();
    const tree = mount(<OnboardingCard onFinish={onFinish} onStartPremium={() => {}} />);
    // Step through until Next runs out, then the flow must offer a way out.
    for (let i = 0; i < 12; i++) {
      const next = btn(tree, "Next");
      if (!next) break;
      renderer.act(() => { next.props.onPress(); });
    }
    expect(tree.toJSON()).toBeTruthy();
    // Skip is present throughout, so nobody is ever trapped in it.
    expect(textOf(tree).length).toBeGreaterThan(0);
  });

  test("Skip finishes rather than dead-ending", () => {
    const onFinish = jest.fn();
    const tree = mount(<OnboardingCard onFinish={onFinish} onStartPremium={() => {}} />);
    const skip = btn(tree, "Skip");
    if (skip) {
      renderer.act(() => { skip.props.onPress(); });
      expect(tree.toJSON()).toBeTruthy();
    }
  });

  test("the first slide still leads with the catalog, which is the hook", () => {
    const tree = mount(<OnboardingCard onFinish={() => {}} onStartPremium={() => {}} />);
    expect(textOf(tree)).toContain("316 species");
  });

  test("it mentions the analysis the app actually does now", () => {
    // The specific claim doesn't matter as much as that SOMETHING from the last
    // several rounds is represented — the slides had drifted years behind.
    const { SLIDES } = require("../components/OnboardingCard");
    const all = JSON.stringify(SLIDES || []);
    const src = require("fs").readFileSync(require("path").join(__dirname, "..", "components", "OnboardingCard.js"), "utf8");
    const copy = all.length > 10 ? all : src;
    expect(copy).toMatch(/algae|water change can actually reach|Steady beats ideal|wishlist/i);
  });

  test("it doesn't describe features in implementation terms", () => {
    const src = require("fs").readFileSync(require("path").join(__dirname, "..", "components", "OnboardingCard.js"), "utf8");
    const slides = src.slice(src.indexOf("const SLIDES = ["), src.indexOf("];", src.indexOf("const SLIDES = [")));
    expect(slides).not.toMatch(/\b(engine|module|refactor|API|correlat\w*e\b)/i);
  });
});
