import fs from "fs";
import path from "path";
import renderer from "react-test-renderer";
import { Text, View, useWindowDimensions } from "react-native";
import { AdaptiveColumns } from "../components/AdaptiveColumns";
import { LARGE_SCREEN_BREAKPOINT, CONTENT_MAX_WIDTH } from "../styles";

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 })),
}));
const useWD = useWindowDimensions;

const ROOT = path.join(__dirname, "..");

// Real device sizes in points, portrait and landscape.
const SIZES = {
  "iPhone 15": [393, 852],
  "iPad mini": [744, 1133],
  "iPad 10.9": [820, 1180],
  "iPad Pro 12.9": [1024, 1366],
};

const at = (w, h) => useWD.mockReturnValue({ width: w, height: h, scale: 2, fontScale: 1 });
const mount = (el) => { let t; renderer.act(() => { t = renderer.create(el); }); return t; };
const cards = (n) => Array.from({ length: n }, (_, i) => <Text key={i}>{`card${i}`}</Text>);
const flatten = (c) =>
  Array.isArray(c) ? c.map(flatten).join("") : typeof c === "string" || typeof c === "number" ? String(c) : "";
const textOf = (t) => t.root.findAllByType(Text).map((n) => flatten(n.props.children)).join(" ");

describe("the app is usable on an iPad in a stand", () => {
  // supportsTablet has always been true and every screen reflows, but app.json
  // declared portrait only — so an iPad propped in landscape beside the tank,
  // which is how anyone actually uses one while working on it, could not rotate
  // at all. The responsive layout was built and tested and then unreachable.
  test("iPad landscape is declared", () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "app.json"), "utf8")).expo;
    const orient = cfg.ios.infoPlist["UISupportedInterfaceOrientations~ipad"];
    expect(orient).toContain("UIInterfaceOrientationLandscapeLeft");
    expect(orient).toContain("UIInterfaceOrientationLandscapeRight");
    expect(orient).toContain("UIInterfaceOrientationPortrait");
  });

  test("iPad multitasking needs all four, which is why this must be complete", () => {
    // UIRequiresFullScreen is unset, so the app declares Split View support.
    // iOS requires every orientation to be declared in that case; portrait-only
    // is a combination Xcode warns about.
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "app.json"), "utf8")).expo;
    expect(cfg.ios.requireFullScreen).toBeUndefined();
    expect(cfg.ios.infoPlist["UISupportedInterfaceOrientations~ipad"]).toHaveLength(4);
  });

  test("the phone stays portrait, which is what its layout is built for", () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "app.json"), "utf8")).expo;
    expect(cfg.orientation).toBe("portrait");
  });
});

describe("every real iPad size reflows without losing a card", () => {
  for (const [name, [w, h]] of Object.entries(SIZES)) {
    for (const [label, [ww, hh]] of [["portrait", [w, h]], ["landscape", [h, w]]]) {
      test(`${name} ${label} (${ww}x${hh})`, () => {
        at(ww, hh);
        const tree = mount(<AdaptiveColumns lead={1}>{cards(7)}</AdaptiveColumns>);
        // Nothing dropped, nothing duplicated, whatever the reflow decided.
        expect(textOf(tree).split(" ").filter(Boolean).sort())
          .toEqual(["card0", "card1", "card2", "card3", "card4", "card5", "card6"]);
      });
    }
  }

  test("rotating an iPad Pro does not change what is on screen", () => {
    // The content is clamped, so landscape is portrait with wider margins —
    // which is exactly why enabling rotation is safe rather than a redesign.
    at(1024, 1366);
    const portrait = textOf(mount(<AdaptiveColumns lead={1}>{cards(7)}</AdaptiveColumns>));
    at(1366, 1024);
    const landscape = textOf(mount(<AdaptiveColumns lead={1}>{cards(7)}</AdaptiveColumns>));
    expect(landscape).toBe(portrait);
  });

  test("every iPad earns the second column in BOTH orientations", () => {
    // The iPad mini is 744pt across in portrait. At the classic 768 breakpoint
    // it got the phone layout standing up and the tablet layout lying down, so
    // rotating it changed the design rather than the shape of it.
    for (const [name, [w, h]] of Object.entries(SIZES)) {
      if (name.startsWith("iPhone")) continue;
      expect([name, Math.min(w, h) >= LARGE_SCREEN_BREAKPOINT]).toEqual([name, true]);
    }
  });

  test("and no phone can drift across the boundary", () => {
    // 430 is the widest iPhone in portrait; the narrowest iPad is 744.
    expect(LARGE_SCREEN_BREAKPOINT).toBeGreaterThan(430 + 100);
    expect(LARGE_SCREEN_BREAKPOINT).toBeLessThanOrEqual(744);
  });

  test("content is clamped, so a 1366pt screen is not a 1366pt line of text", () => {
    // An unclamped card on a 12.9" iPad gives a line length nobody can read.
    expect(CONTENT_MAX_WIDTH).toBeLessThanOrEqual(900);
    expect(CONTENT_MAX_WIDTH).toBeGreaterThan(LARGE_SCREEN_BREAKPOINT / 2);
  });
});

describe("iPad multitasking widths still work", () => {
  // Split View and Slide Over hand the app widths a phone would recognise, and
  // they arrive by resize rather than at launch.
  const NARROW = [["Slide Over", 320], ["Split View 1/2 on 10.9", 507], ["Split View 2/3", 694]];

  for (const [label, w] of NARROW) {
    test(`${label} (${w}pt) falls back to the single column`, () => {
      at(w, 1180);
      const tree = mount(<AdaptiveColumns lead={1}>{cards(6)}</AdaptiveColumns>);
      const rows = tree.root.findAll(
        (n) => n.type === View && n.props.style && n.props.style.flexDirection === "row");
      expect(rows).toHaveLength(0);
      expect(textOf(tree)).toBe("card0 card1 card2 card3 card4 card5");
    });
  }

  test("a resize mid-session is honoured, not read once at launch", () => {
    // useWindowDimensions is a live subscription; a module-level Dimensions.get
    // would freeze the layout at whatever size the app started in.
    const src = fs.readFileSync(path.join(ROOT, "styles.js"), "utf8");
    const fn = src.slice(src.indexOf("export function useResponsiveLayout"));
    expect(fn).toContain("useWindowDimensions()");
  });
});
