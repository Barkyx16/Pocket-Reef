jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

const fs = require("fs");
const path = require("path");
const renderer = require("react-test-renderer");
const { Text } = require("react-native");
const { DoseLogCard } = require("../components/DoseLogCard");

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


const APP = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");
const mount = (el) => { let t; renderer.act(() => { t = renderer.create(el); }); return t; };
const flat = (c) => Array.isArray(c) ? c.map(flat).join("") : (typeof c === "string" || typeof c === "number") ? String(c) : "";
const textOf = (t) => t.root.findAllByType(Text).map((n) => flat(n.props.children)).join(" | ");
const byLabel = (t, l) => t.root.findAll((n) => n.props.accessibilityLabel === l).filter((n) => typeof n.props.onPress === "function");
const day = (n) => localDay(Date.now() - n * 86400000);
const noop = () => {};



describe("marking a job done is undoable", () => {
  // The last-done date is the only record of when the work actually happened.
  // Every other logging action in the app is undoable; this one silently
  // destroyed a 90-day counter on a mis-tap — and the round, a dense column of
  // Done buttons, makes mis-taps likelier rather than less.
  test("the handler captures the prior date and offers undo", () => {
    const body = APP.slice(APP.indexOf("const markJobDone"), APP.indexOf("const logMaintenance"));
    expect(body).toContain("const prior =");
    expect(body).toContain("showUndo(");
  });

  test("restoring a never-logged job removes the key rather than leaving today", () => {
    // Putting today's date back on a job that had never been done would be
    // worse than the mis-tap it's undoing.
    const body = APP.slice(APP.indexOf("const markJobDone"), APP.indexOf("const logMaintenance"));
    expect(body).toContain("delete next[taskId]");
  });

  test("both routes into it share the same undoable path", () => {
    // The Upkeep card and the round must not diverge — one undoable, one not.
    expect(APP).toContain("const logMaintenance = useStableCallback((taskId) => markJobDone(activeTankId, taskId));");
    expect(APP).toContain("markJobDone(item.tankId, item.taskId, item.label)");
  });
});

describe("a mistyped dose can be removed", () => {
  const doses = [
    { id: "d1", key: "alk", ml: 200, date: day(1) },
    { id: "d2", key: "calcium", ml: 15, date: day(2) },
  ];

  test("each dose is listed individually, not merged into a day total", () => {
    // A day-total row reads nicely and leaves nothing to correct.
    const tree = mount(<DoseLogCard tank={{ doses }} tankGallons={100} waterTests={[]} strengths={{}} onLogDose={noop} onDeleteDose={noop} onSetStrength={noop} />);
    const text = textOf(tree);
    expect(text).toContain("Alkalinity 200ml");
    expect(text).toContain("Calcium 15ml");
    renderer.act(() => { tree.unmount(); });
  });

  test("deleting reports the specific entry", () => {
    const onDeleteDose = jest.fn();
    const tree = mount(<DoseLogCard tank={{ doses }} tankGallons={100} waterTests={[]} strengths={{}} onLogDose={noop} onDeleteDose={onDeleteDose} onSetStrength={noop} />);
    renderer.act(() => { byLabel(tree, "Delete the 200ml Alkalinity dose from " + day(1))[0].props.onPress(); });
    expect(onDeleteDose).toHaveBeenCalledWith("d1");
    renderer.act(() => { tree.unmount(); });
  });

  test("without a handler the log stays read-only", () => {
    // The prop used to be declared and never passed — a control that does
    // nothing is worse than no control.
    const tree = mount(<DoseLogCard tank={{ doses }} tankGallons={100} waterTests={[]} strengths={{}} onLogDose={noop} onSetStrength={noop} />);
    expect(tree.root.findAll((n) => typeof n.props.accessibilityLabel === "string" && /^Delete the/.test(n.props.accessibilityLabel)).length).toBe(0);
    renderer.act(() => { tree.unmount(); });
  });

  test("deletion is wired all the way through and undoable", () => {
    expect(APP).toContain("const deleteDose = useStableCallback");
    const body = APP.slice(APP.indexOf("const deleteDose"), APP.indexOf("const setDoseStrength"));
    expect(body).toContain("showUndo(");
    expect(APP).toContain("onDeleteDose={deleteDose}");
  });
});
