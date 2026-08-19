jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

// The shared mock reports no insets, which is the one device shape where this
// bug doesn't exist. A configurable one is the only way to test the phones
// that actually have a home indicator.
let mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };
jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  return {
    SafeAreaProvider: ({ children }) => React.createElement(React.Fragment, null, children),
    SafeAreaView: ({ children, ...rest }) => React.createElement(require("react-native").View, rest, children),
    useSafeAreaInsets: () => mockInsets,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
    SafeAreaInsetsContext: React.createContext(mockInsets),
    initialWindowMetrics: { insets: mockInsets, frame: { x: 0, y: 0, width: 390, height: 844 } },
  };
});

import fs from "fs";
import path from "path";
import renderer from "react-test-renderer";
import { View } from "react-native";
import { StockRecordSheet } from "../components/StockRecordSheet";
import { QuickActionsSheet } from "../components/QuickActionsSheet";
import { styles } from "../styles";

const ROOT = path.join(__dirname, "..");
const HOME_INDICATOR = 34;   // every iPhone since the X
const NO_INDICATOR = 0;      // SE, and every iPad

const mount = (el) => { let t; renderer.act(() => { t = renderer.create(el); }); return t; };
const flat = (s) => (Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean).map(flat)) : s || {});
const paddings = (tree) => tree.root.findAllByType(View)
  .map((n) => flat(n.props.style).paddingBottom)
  .filter((v) => typeof v === "number");

afterEach(() => { mockInsets = { top: 0, right: 0, bottom: 0, left: 0 }; });

describe("nothing sits underneath the home indicator", () => {
  // A sheet is anchored to the bottom edge, which is exactly where the
  // indicator lives. At a fixed 28pt of padding the last control sat inside
  // the 34pt the system reserves — the indicator line drew across it, and it
  // competed with the system's own swipe-up gesture.
  test("a sheet clears the indicator when there is one", () => {
    mockInsets = { top: 47, right: 0, bottom: HOME_INDICATOR, left: 0 };
    const tree = mount(
      <StockRecordSheet visible mode="edit" name="Clownfish" record={{}} onSave={() => {}} onClose={() => {}} />);
    expect(Math.max(...paddings(tree))).toBeGreaterThanOrEqual(HOME_INDICATOR);
  });

  test("and keeps its designed gap when there isn't", () => {
    // An iPhone SE must not grow a band of empty space it doesn't need.
    mockInsets = { top: 20, right: 0, bottom: NO_INDICATOR, left: 0 };
    const tree = mount(
      <StockRecordSheet visible mode="edit" name="Clownfish" record={{}} onSave={() => {}} onClose={() => {}} />);
    const max = Math.max(...paddings(tree));
    expect(max).toBeGreaterThanOrEqual(28);
    expect(max).toBeLessThan(HOME_INDICATOR + 12);
  });

  test("the quick-actions sheet too", () => {
    mockInsets = { top: 47, right: 0, bottom: HOME_INDICATOR, left: 0 };
    const tree = mount(<QuickActionsSheet visible onClose={() => {}} actions={[]} />);
    expect(Math.max(...paddings(tree))).toBeGreaterThanOrEqual(HOME_INDICATOR);
  });

  test("every bottom-anchored sheet reads the inset", () => {
    const SHEETS = ["StockRecordSheet", "QuickActionsSheet", "TabShortcutSheet",
                    "LossReviewSheet", "WhatsNewSheet"];
    for (const name of SHEETS) {
      const src = fs.readFileSync(path.join(ROOT, "components", `${name}.js`), "utf8");
      expect([name, src.includes("useSafeAreaInsets()")]).toEqual([name, true]);
      expect([name, /paddingBottom: Math\.max\(\d+, insets\.bottom/.test(src)]).toEqual([name, true]);
    }
  });

  test("none of them still uses a bare number", () => {
    for (const f of fs.readdirSync(path.join(ROOT, "components")).filter((n) => n.endsWith("Sheet.js"))) {
      const src = fs.readFileSync(path.join(ROOT, "components", f), "utf8");
      if (!src.includes("justifyContent: \"flex-end\"")) continue;
      expect([f, /paddingBottom: \d+[,\s}]/.test(src)]).toEqual([f, false]);
    }
  });
});

describe("the tab bar sits above the indicator, not on it", () => {
  const app = fs.readFileSync(path.join(ROOT, "App.js"), "utf8");

  test("its offset comes from the inset", () => {
    // The bar is absolutely positioned at a fixed 16pt, which is inside the
    // 34pt the indicator reserves — so on every modern iPhone the indicator
    // line was drawn across the tab labels.
    expect(app).toMatch(/bottom: Math\.max\(16, insets\.bottom\)/);
    expect(app).toContain("useSafeAreaInsets");
  });

  test("content still clears the bar in its new position", () => {
    // Raising the bar by the difference means scroll content needs the same
    // difference again, or the floating action button lands back on top of the
    // last card's controls.
    expect(styles.scroll.paddingBottom).toBeGreaterThanOrEqual(168 + (HOME_INDICATOR - 16));
  });

  test("the inset is read live rather than at launch", () => {
    // Split View and rotation both change it.
    expect(app).toMatch(/const insets = useSafeAreaInsets\(\);/);
  });
});
