jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import fs from "fs";
import path from "path";
import renderer from "react-test-renderer";
import { KeyboardAvoidingView, Modal, TextInput, ScrollView } from "react-native";
import { ResetPasswordModal } from "../components/ResetPasswordModal";
import { StockRecordSheet } from "../components/StockRecordSheet";

const ROOT = path.join(__dirname, "..");
const mount = (el) => { let t; renderer.act(() => { t = renderer.create(el); }); return t; };

describe("the keyboard does not cover what you are typing into", () => {
  // A Modal renders outside the normal tree, so the KeyboardAvoidingView in
  // App.js cannot reach one. A sheet anchored to the bottom of the screen sits
  // exactly where the keyboard appears, and a centred card with no scroll
  // behind it has nowhere to go — in both, the field and the button that
  // submits it ended up behind the keyboard.

  test("the bottom sheet with six fields avoids the keyboard", () => {
    const tree = mount(
      <StockRecordSheet visible mode="edit" name="Clownfish" record={{}} onSave={() => {}} onClose={() => {}} />);
    expect(tree.root.findAllByType(KeyboardAvoidingView).length).toBeGreaterThan(0);
    expect(tree.root.findAllByType(TextInput).length).toBeGreaterThan(0);
  });

  test("the password modal avoids it too", () => {
    const tree = mount(<ResetPasswordModal visible onDone={() => {}} onCancel={() => {}} />);
    expect(tree.root.findAllByType(KeyboardAvoidingView).length).toBeGreaterThan(0);
  });

  test("the avoider wraps the content rather than sitting inside it", () => {
    // Placed under the card it is meant to lift, it lifts nothing.
    const tree = mount(<ResetPasswordModal visible onDone={() => {}} onCancel={() => {}} />);
    const kav = tree.root.findAllByType(KeyboardAvoidingView)[0];
    expect(kav.findAllByType(TextInput).length).toBeGreaterThan(0);
  });

  test("padding is the iOS behaviour; Android handles it in the manifest", () => {
    for (const f of ["components/ResetPasswordModal.js", "components/StockRecordSheet.js"]) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      expect(src).toMatch(/behavior=\{Platform\.OS === "ios" \? "padding" : undefined\}/);
    }
  });
});

describe("every modal that takes typing can cope with a keyboard", () => {
  const files = fs.readdirSync(path.join(ROOT, "components"))
    .filter((f) => f.endsWith(".js")).map((f) => path.join("components", f));

  test("a Modal containing a TextInput either avoids or scrolls", () => {
    // Scrolling is an acceptable answer — the keeper can reach the field — but
    // doing neither is not.
    const offenders = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      if (!src.includes("<Modal")) continue;
      if (!src.includes("<TextInput")) continue;
      const avoids = src.includes("KeyboardAvoidingView");
      const scrolls = src.includes("keyboardShouldPersistTaps");
      if (!avoids && !scrolls) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  test("the walker sees the modals it is meant to check", () => {
    const n = files.filter((f) => {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      return src.includes("<Modal") && src.includes("<TextInput");
    }).length;
    expect(n).toBeGreaterThanOrEqual(3);
  });

  test("full-screen entry screens scroll, which is answer enough", () => {
    // NewTankSheet and ImportSheet are ScrollViews rather than Modals: the
    // field can always be scrolled into view, so they need nothing added.
    for (const f of ["components/NewTankSheet.js", "components/ImportSheet.js"]) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      expect(src).not.toContain("<Modal");
      expect(src).toContain('keyboardShouldPersistTaps="handled"');
    }
  });

  test("tapping a control while the keyboard is up still works", () => {
    // Without keyboardShouldPersistTaps the first tap only dismisses the
    // keyboard, so every Save button needs pressing twice.
    const tree = mount(
      <StockRecordSheet visible mode="edit" name="Clownfish" record={{}} onSave={() => {}} onClose={() => {}} />);
    const scrolls = tree.root.findAllByType(ScrollView);
    expect(scrolls.length).toBeGreaterThan(0);
    expect(scrolls.some((s) => s.props.keyboardShouldPersistTaps === "handled")).toBe(true);
  });

  test("the modals still render as modals", () => {
    const tree = mount(<ResetPasswordModal visible onDone={() => {}} onCancel={() => {}} />);
    expect(tree.root.findAllByType(Modal).length).toBe(1);
  });
});
