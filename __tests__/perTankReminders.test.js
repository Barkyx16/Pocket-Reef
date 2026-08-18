jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// A tank on its own schedule.
//
// One cadence applied to every tank, so a bare quarantine box was measured
// against the display reef's rhythm — reported overdue for a water change it
// should never have, and named in the notification for it. Multi-tank is the
// paid feature; sharing one schedule across all of them made it incoherent.

const { cadenceFor } = require("../lib/notifications");
const { ensureTankShape } = require("../lib/migrations");
const renderer = require("react-test-renderer");
const { Text } = require("react-native");
const { RemindersCard } = require("../components/RemindersCard");

const GLOBAL = { waterTest: "weekly", waterChange: "weekly", feeding: "off" };

describe("which cadence applies", () => {
  test("a tank with no override follows the account default", () => {
    expect(cadenceFor({}, GLOBAL, "waterTest")).toBe("weekly");
    expect(cadenceFor({ reminders: {} }, GLOBAL, "waterChange")).toBe("weekly");
  });

  test("an override wins", () => {
    const qt = { reminders: { waterChange: "off", waterTest: "biweekly" } };
    expect(cadenceFor(qt, GLOBAL, "waterChange")).toBe("off");
    expect(cadenceFor(qt, GLOBAL, "waterTest")).toBe("biweekly");
  });

  test("a partial override only covers what it sets", () => {
    const qt = { reminders: { waterChange: "off" } };
    expect(cadenceFor(qt, GLOBAL, "waterChange")).toBe("off");
    expect(cadenceFor(qt, GLOBAL, "waterTest")).toBe("weekly");
  });

  test("a tank from an older build has the field and inherits", () => {
    const old = ensureTankShape({ id: "t1", name: "Legacy" });
    expect(old.reminders).toEqual({});
    expect(cadenceFor(old, GLOBAL, "waterTest")).toBe("weekly");
  });

  test("junk doesn't throw", () => {
    expect(cadenceFor(null, GLOBAL, "waterTest")).toBe("weekly");
    expect(cadenceFor({}, {}, "waterTest")).toBeUndefined();
  });
});

describe("the card", () => {
  // The card checks notification permission on mount and sets state when that
  // promise resolves, so a purely synchronous mount leaves an update pending
  // outside act(). Settling here keeps the run clean without mocking it away.
  const mount = async (el) => {
    let t;
    await renderer.act(async () => { t = renderer.create(el); });
    await renderer.act(async () => { await new Promise((r) => setImmediate(r)); });
    return t;
  };
  const flatten = (c) =>
    Array.isArray(c) ? c.map(flatten).join("") : typeof c === "string" || typeof c === "number" ? String(c) : "";
  const textOf = (t) => t.root.findAllByType(Text).map((n) => flatten(n.props.children)).join(" | ");
  const pill = (t, label) =>
    t.root.findAll((n) => typeof n.props?.onPress === "function"
      && n.findAllByType(Text).map((x) => flatten(x.props.children)).join(" ").trim() === label);

  test("a single-tank keeper is never shown the choice", async () => {
    const tree = await mount(<RemindersCard prefs={GLOBAL} onChange={() => {}} />);
    expect(textOf(tree)).not.toMatch(/just for/i);
  });

  test("with a second tank, the override appears and names the tank", async () => {
    const tank = { id: "t2", name: "Quarantine", reminders: {} };
    const tree = await mount(<RemindersCard prefs={GLOBAL} onChange={() => {}} tank={tank} onChangeTankReminders={() => {}} />);
    expect(textOf(tree)).toMatch(/just for quarantine/i);
    expect(textOf(tree)).toMatch(/same as above/i);
  });

  test("choosing an override reports only that key", async () => {
    const onChangeTankReminders = jest.fn();
    const tank = { id: "t2", name: "Quarantine", reminders: {} };
    const tree = await mount(<RemindersCard prefs={GLOBAL} onChange={() => {}} tank={tank} onChangeTankReminders={onChangeTankReminders} />);
    // The first "Off" inside the per-tank block.
    const offs = pill(tree, "Off");
    renderer.act(() => { offs[offs.length - 1].props.onPress(); });
    expect(onChangeTankReminders).toHaveBeenCalledWith(expect.objectContaining({ feeding: "off" }));
  });

  test("clearing an override is the same gesture as never setting one", async () => {
    const onChangeTankReminders = jest.fn();
    const tank = { id: "t2", name: "QT", reminders: { waterTest: "biweekly" } };
    const tree = await mount(<RemindersCard prefs={GLOBAL} onChange={() => {}} tank={tank} onChangeTankReminders={onChangeTankReminders} />);
    const inherit = pill(tree, "Same as above")[0];
    renderer.act(() => { inherit.props.onPress(); });
    // Undefined, which App strips — so the tank goes back to inheriting.
    expect(onChangeTankReminders.mock.calls[0][0].waterTest).toBeUndefined();
  });
});
