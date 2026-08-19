jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import fs from "fs";
import path from "path";
import renderer from "react-test-renderer";
import { Text } from "react-native";
import { FirstStepsCard } from "../components/FirstStepsCard";

const ROOT = path.join(__dirname, "..");
const files = ["App.js", ...["components", "screens"].flatMap((dir) =>
  fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".js")).map((f) => path.join(dir, f)))];

const mount = (el) => { let t; renderer.act(() => { t = renderer.create(el); }); return t; };

describe("VoiceOver can skip between cards", () => {
  // Every screen is a long vertical stack of cards, and the rotor's Headings
  // mode is how anyone using VoiceOver moves through one. With no headings the
  // only way to reach the fourth card is to swipe through everything in the
  // first three — on Home that is dozens of swipes to reach something a sighted
  // keeper sees immediately.
  test("every card heading carries the header role", () => {
    const offenders = [];
    for (const f of files) {
      // CollapsibleCard's title sits inside a Pressable that already carries a
      // role and a label, so the whole row is one accessible element and a role
      // on the Text is never reached. It is a button, and stays one.
      if (f.includes("CollapsibleCard")) continue;
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      for (const m of src.matchAll(/<Text([^>]{0,200}?)style=\{\[?styles\.(cardEyebrow|cardTitle|heroTitle)/g)) {
        if (!m[1].includes("accessibilityRole")) {
          offenders.push(`${f}:${src.slice(0, m.index).split("\n").length} ${m[2]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test("there are actually headings to find", () => {
    // A walker that matches nothing passes forever.
    const n = files.reduce((sum, f) =>
      sum + (fs.readFileSync(path.join(ROOT, f), "utf8").match(/accessibilityRole="header"/g) || []).length, 0);
    expect(n).toBeGreaterThan(60);
  });

  test("the role survives into the rendered tree, not just the source", () => {
    // Source greps prove the prop is written; this proves it arrives.
    const tree = mount(<FirstStepsCard steps={[{ id: "size", label: "Set your tank size", done: false }]} />);
    const headers = tree.root.findAllByType(Text).filter((n) => n.props.accessibilityRole === "header");
    expect(headers.length).toBeGreaterThan(0);
  });

  test("a heading still reads its own text", () => {
    // A header with no accessible label is a landmark that announces nothing.
    const tree = mount(<FirstStepsCard steps={[{ id: "size", label: "Set your tank size", done: false }]} />);
    const headers = tree.root.findAllByType(Text).filter((n) => n.props.accessibilityRole === "header");
    for (const h of headers) {
      const label = h.props.accessibilityLabel
        || (typeof h.props.children === "string" ? h.props.children : "");
      expect(String(label).trim().length).toBeGreaterThan(0);
    }
  });
});

describe("headings are headings, not buttons", () => {
  test("no element claims both roles", () => {
    // accessibilityRole takes one value; a tappable card title should be a
    // button, and a label should be a header. Claiming both silently drops one.
    for (const f of files) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      expect(src).not.toMatch(/accessibilityRole="header"[^>]{0,200}accessibilityRole=/);
    }
  });

  test("the eyebrow style is still the app's heading pattern", () => {
    // If cards stop using it, this suite silently stops covering anything.
    const uses = files.reduce((sum, f) =>
      sum + (fs.readFileSync(path.join(ROOT, f), "utf8").match(/styles\.cardEyebrow/g) || []).length, 0);
    expect(uses).toBeGreaterThan(50);
  });
});
