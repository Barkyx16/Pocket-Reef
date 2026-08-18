jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Five upgrades, each tested at the level it actually fails at.
//
// The attention verdict is pure logic and is tested directly. The rest are
// rendered, because every one of them is a claim about what is on screen at a
// particular moment — a delta that only appears once there's something to
// compare to, a warning that only appears after a dangerous reading is logged,
// a history that only grows when asked.

const renderer = require("react-test-renderer");
const { Text } = require("react-native");

const { WaterTestCard } = require("../components/WaterTestCard");
const { TrendsCard } = require("../components/TrendsCard");
const { TankMenu } = require("../components/AppHeader");
const { tankAttention, attentionFor } = require("../lib/attention");

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


function mount(element) {
  let tree;
  renderer.act(() => { tree = renderer.create(element); });
  const raw = tree.unmount.bind(tree);
  tree.unmount = () => renderer.act(() => { raw(); });
  return tree;
}

const flatten = (c) =>
  Array.isArray(c) ? c.map(flatten).join("") : typeof c === "string" || typeof c === "number" ? String(c) : "";
const textOf = (tree) => tree.root.findAllByType(Text).map((n) => flatten(n.props.children)).join(" | ");
const pressables = (tree) => tree.root.findAll((n) => typeof n.props?.onPress === "function");
const labelOf = (node) => node.findAllByType(Text).map((t) => flatten(t.props.children)).join(" ").trim();
const btn = (tree, text) => {
  const hit = pressables(tree).find((n) => labelOf(n).includes(text));
  if (!hit) throw new Error(`No control containing "${text}". Present: ${pressables(tree).map(labelOf).filter(Boolean).map((s) => JSON.stringify(s)).join(", ")}`);
  return hit;
};
// Field labels read "Ammonia in ppm, target 0 ppm" — or "pH, target 6.0–8.0"
// where the parameter is unitless.
const fieldFor = (tree, label) => {
  const hit = tree.root.findAll((n) =>
    typeof n.props?.accessibilityLabel === "string" &&
    typeof n.props.onChangeText === "function" &&
    (n.props.accessibilityLabel.startsWith(`${label},`) || n.props.accessibilityLabel.startsWith(`${label} in `)))[0];
  if (!hit) throw new Error(`No field for "${label}"`);
  return hit;
};
const type = (node, value) => renderer.act(() => { node.props.onChangeText(value); });
const press = (node) => renderer.act(() => { node.props.onPress(); });

const test0 = (date, values) => ({ date, water: "fresh", values });



// ─────────────────────────────────────────────────────────────────────────────
// 1. Last time's reading, beside the field you're typing into
// ─────────────────────────────────────────────────────────────────────────────
describe("the previous reading is on screen while you type", () => {
  const history = [test0("2026-08-10", { nitrate: 15, ph: 7.4 })];

  test("an empty field shows what it read last time", () => {
    const tree = mount(<WaterTestCard waterType="fresh" history={history} onLog={() => {}} />);
    expect(textOf(tree)).toContain("was 15");
    tree.unmount();
  });

  test("typing turns it into the movement since then", () => {
    const tree = mount(<WaterTestCard waterType="fresh" history={history} onLog={() => {}} />);
    type(fieldFor(tree, "Nitrate"), "25");
    expect(textOf(tree)).toContain("↑10");
    tree.unmount();
  });

  test("a drop reads as a drop", () => {
    const tree = mount(<WaterTestCard waterType="fresh" history={history} onLog={() => {}} />);
    type(fieldFor(tree, "Nitrate"), "5");
    expect(textOf(tree)).toContain("↓10");
    tree.unmount();
  });

  test("an unchanged reading shows no arrow at all", () => {
    const tree = mount(<WaterTestCard waterType="fresh" history={history} onLog={() => {}} />);
    type(fieldFor(tree, "Nitrate"), "15");
    const shown = textOf(tree);
    expect(shown).not.toContain("↑");
    expect(shown).not.toContain("↓");
    tree.unmount();
  });

  test("float noise never leaks into the delta", () => {
    const tree = mount(<WaterTestCard waterType="fresh" history={[test0("2026-08-10", { ph: 8.1 })]} onLog={() => {}} />);
    type(fieldFor(tree, "pH"), "8.2");
    // 8.2 - 8.1 is 0.10000000000000053 in IEEE 754.
    expect(textOf(tree)).toContain("↑0.1");
    tree.unmount();
  });

  test("with no history there is nothing to compare to, and no delta is invented", () => {
    const tree = mount(<WaterTestCard waterType="fresh" history={[]} onLog={() => {}} />);
    type(fieldFor(tree, "Nitrate"), "25");
    const shown = textOf(tree);
    expect(shown).not.toContain("was ");
    expect(shown).not.toContain("↑");
    tree.unmount();
  });

  test("correcting a test compares to the one before it, not to itself", () => {
    const two = [test0("2026-08-10", { nitrate: 40 }), test0("2026-08-03", { nitrate: 10 })];
    const tree = mount(<WaterTestCard waterType="fresh" history={two} onUpdate={() => {}} onLog={() => {}} />);
    // Load the newest test back into the form for correction.
    press(btn(tree, "2026-08-10"));
    // Its own 40 must be measured against the 10 before it, not against 40.
    expect(textOf(tree)).toContain("↑30");
    tree.unmount();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. A dangerous reading gets answered on the spot
// ─────────────────────────────────────────────────────────────────────────────
describe("logging a dangerous reading", () => {
  test("names what is wrong and gives the emergency steps", () => {
    const onLog = jest.fn();
    const tree = mount(<WaterTestCard waterType="fresh" history={[]} onLog={onLog} />);
    type(fieldFor(tree, "Ammonia"), "2");
    press(btn(tree, "Log 1 reading"));

    expect(onLog).toHaveBeenCalled(); // the reading is still saved
    const shown = textOf(tree);
    expect(shown).toContain("Ammonia is dangerous");
    // Straight out of the ammonia emergency flow.
    expect(shown).toMatch(/water change right now/i);
    tree.unmount();
  });

  test("two dangerous readings are one emergency, not two copies of it", () => {
    const tree = mount(<WaterTestCard waterType="fresh" history={[]} onLog={() => {}} />);
    type(fieldFor(tree, "Ammonia"), "2");
    type(fieldFor(tree, "Nitrite"), "1");
    press(btn(tree, "Log 2 readings"));

    const shown = textOf(tree);
    expect(shown).toContain("2 readings are dangerous");
    // Ammonia and nitrite share a flow; its first step must appear once.
    const occurrences = shown.split(/water change right now/i).length - 1;
    expect(occurrences).toBe(1);
    tree.unmount();
  });

  test("a safe reading raises nothing", () => {
    const tree = mount(<WaterTestCard waterType="fresh" history={[]} onLog={() => {}} />);
    type(fieldFor(tree, "Nitrate"), "10");
    press(btn(tree, "Log 1 reading"));
    expect(textOf(tree)).not.toMatch(/dangerous/i);
    tree.unmount();
  });

  test("a merely cautionary reading raises nothing either", () => {
    // Nitrate 60 is "watch", not "act" — the panel is reserved for danger so
    // that seeing it always means something.
    const tree = mount(<WaterTestCard waterType="fresh" history={[]} onLog={() => {}} />);
    type(fieldFor(tree, "Nitrate"), "60");
    press(btn(tree, "Log 1 reading"));
    expect(textOf(tree)).not.toMatch(/dangerous/i);
    tree.unmount();
  });

  test("it can be dismissed", () => {
    const tree = mount(<WaterTestCard waterType="fresh" history={[]} onLog={() => {}} />);
    type(fieldFor(tree, "Ammonia"), "2");
    press(btn(tree, "Log 1 reading"));
    const close = tree.root.findAll((n) => n.props.accessibilityLabel === "Dismiss this warning")[0];
    press(close);
    expect(textOf(tree)).not.toMatch(/dangerous/i);
    tree.unmount();
  });

  test("a parameter with no emergency flow still gets actionable advice", () => {
    // pH has no TROUBLESHOOTING entry, so its own tip has to carry the panel.
    const tree = mount(<WaterTestCard waterType="fresh" history={[]} onLog={() => {}} />);
    type(fieldFor(tree, "pH"), "9.5");
    press(btn(tree, "Log 1 reading"));
    const shown = textOf(tree);
    expect(shown).toContain("pH is dangerous");
    expect(shown).toMatch(/stability matters/i);
    tree.unmount();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. The history past the sixth reading
// ─────────────────────────────────────────────────────────────────────────────
describe("the full test history", () => {
  // Newest first, the order the app stores and renders them in.
  const many = Array.from({ length: 9 }, (_, i) => test0(`2026-08-${String(9 - i).padStart(2, "0")}`, { nitrate: 10 + i }));

  test("six tests need no expander", () => {
    const tree = mount(<WaterTestCard waterType="fresh" history={many.slice(0, 6)} onLog={() => {}} />);
    expect(textOf(tree)).not.toContain("Show all");
    tree.unmount();
  });

  test("older readings are reachable, and the count is honest", () => {
    const tree = mount(<WaterTestCard waterType="fresh" history={many} onLog={() => {}} />);
    // The seventh-oldest date is off the end of the default list.
    expect(textOf(tree)).not.toContain("2026-08-01");
    expect(textOf(tree)).toContain("Show all 9 tests");

    press(btn(tree, "Show all 9 tests"));
    expect(textOf(tree)).toContain("2026-08-01");
    expect(textOf(tree)).toContain("All 9 tests");
    tree.unmount();
  });

  test("expanding reports the range each parameter has covered", () => {
    const tree = mount(<WaterTestCard waterType="fresh" history={many} onLog={() => {}} />);
    press(btn(tree, "Show all 9 tests"));
    // Nitrate ran 10 through 18 across the nine readings.
    expect(textOf(tree)).toContain("10–18");
    expect(textOf(tree)).toContain("avg 14");
    tree.unmount();
  });

  test("it collapses again", () => {
    const tree = mount(<WaterTestCard waterType="fresh" history={many} onLog={() => {}} />);
    press(btn(tree, "Show all 9 tests"));
    press(btn(tree, "Show fewer"));
    expect(textOf(tree)).not.toContain("2026-08-01");
    tree.unmount();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Which tank needs you
// ─────────────────────────────────────────────────────────────────────────────
describe("tank attention", () => {
  const NOW = new Date("2026-08-17T12:00:00Z").getTime();
  const days = (n) => localDay(NOW - n * 86400000);
  const tank = (over = {}) => ({ id: "t1", name: "Reef", water: "fresh", stock: ["Neon Tetra"], maintenance: {}, waterTests: [], ...over });

  test("a tank tested today with nothing wrong is quiet", () => {
    const a = tankAttention(tank({
      waterTests: [test0(days(0), { ammonia: 0, nitrate: 10 })],
      maintenance: { waterchange: days(1) },
    }), { now: NOW });
    expect(a.needsAttention).toBe(false);
    expect(a.level).toBe("ok");
  });

  test("a dangerous reading is urgent and says which parameter", () => {
    const a = tankAttention(tank({
      waterTests: [test0(days(0), { ammonia: 2 })],
      maintenance: { waterchange: days(1) },
    }), { now: NOW });
    expect(a.level).toBe("urgent");
    expect(a.reasons.join(" ")).toContain("Ammonia dangerous");
  });

  test("danger outranks an overdue schedule rather than queuing behind it", () => {
    const a = tankAttention(tank({
      waterTests: [test0(days(30), { ammonia: 2 })],
      maintenance: { waterchange: days(60) },
    }), { now: NOW });
    expect(a.level).toBe("urgent");
    expect(a.reasons[0]).toContain("Ammonia");
  });

  test("an overdue test is due, with the number of days", () => {
    const a = tankAttention(tank({ waterTests: [test0(days(12), { nitrate: 10 })] }), { now: NOW });
    expect(a.level).toBe("due");
    expect(a.reasons.join(" ")).toContain("Test 12d ago");
  });

  test("the reminder cadence is respected when one is set", () => {
    const t = tank({ waterTests: [test0(days(10), { nitrate: 10 })] });
    // 10 days is overdue weekly, but not yet overdue fortnightly.
    expect(tankAttention(t, { now: NOW, reminderPrefs: { waterTest: "weekly" } }).level).toBe("due");
    expect(tankAttention(t, { now: NOW, reminderPrefs: { waterTest: "biweekly" } }).reasons.join(" ")).not.toContain("Test");
  });

  test("reminders switched off still leaves the tank judged, not blinded", () => {
    const a = tankAttention(tank({ waterTests: [test0(days(30), { nitrate: 10 })] }), { now: NOW, reminderPrefs: { waterTest: "off" } });
    expect(a.level).toBe("due");
  });

  test("an empty tank is unused, not overdue", () => {
    const a = tankAttention(tank({ stock: [], waterTests: [] }), { now: NOW });
    expect(a.needsAttention).toBe(false);
  });

  test("a stocked tank that has never been tested is flagged", () => {
    expect(tankAttention(tank(), { now: NOW }).reasons).toContain("Never tested");
  });

  test("the summary ignores the tank you are already looking at", () => {
    const bad = { ...tank({ id: "t2", waterTests: [test0(days(0), { ammonia: 2 })] }) };
    const good = tank({ id: "t1", waterTests: [test0(days(0), { nitrate: 10 })], maintenance: { waterchange: days(1) } });

    // Looking at the healthy tank: the bad one is news.
    expect(attentionFor([good, bad], { now: NOW, exceptId: "t1" }).elsewhere).toBe("urgent");
    // Looking at the bad one: Home is already covered in it, so the chip stays quiet.
    expect(attentionFor([good, bad], { now: NOW, exceptId: "t2" }).anyElsewhere).toBe(false);
  });
});

describe("the tank switcher", () => {
  const tanks = [
    { id: "t1", name: "Reef", gallons: 40, water: "salt", stock: [] },
    { id: "t2", name: "Quarantine", gallons: 10, water: "fresh", stock: [] },
  ];

  test("a tank with nothing wrong still shows its specs", () => {
    const tree = mount(<TankMenu visible tanks={tanks} activeTankId="t1" onClose={() => {}} onSwitch={() => {}} onAdd={() => {}} onEdit={() => {}} />);
    expect(textOf(tree)).toContain("10 gal");
    tree.unmount();
  });

  test("a tank that needs something says so instead", () => {
    const attention = { t2: { level: "urgent", reasons: ["Ammonia dangerous"], needsAttention: true } };
    const tree = mount(<TankMenu visible tanks={tanks} activeTankId="t1" attention={attention} onClose={() => {}} onSwitch={() => {}} onAdd={() => {}} onEdit={() => {}} />);
    const shown = textOf(tree);
    expect(shown).toContain("Ammonia dangerous");
    // The specs line gave up the row — Reef still has its.
    expect(shown).toContain("40 gal");
    tree.unmount();
  });

  test("the reason is announced to a screen reader too", () => {
    const attention = { t2: { level: "due", reasons: ["Test 12d ago"], needsAttention: true } };
    const tree = mount(<TankMenu visible tanks={tanks} activeTankId="t1" attention={attention} onClose={() => {}} onSwitch={() => {}} onAdd={() => {}} onEdit={() => {}} />);
    const row = tree.root.findAll((n) => typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.includes("Switch to Quarantine"))[0];
    expect(row.props.accessibilityLabel).toContain("Needs attention: Test 12d ago");
    tree.unmount();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. A trends chart you can actually read
// ─────────────────────────────────────────────────────────────────────────────
describe("trends", () => {
  const rising = [
    test0("2026-08-15", { nitrate: 30 }),
    test0("2026-08-08", { nitrate: 20 }),
    test0("2026-08-01", { nitrate: 10 }),
  ];

  test("the chart is dated at both ends", () => {
    const tree = mount(<TrendsCard waterTests={rising} waterType="fresh" premiumUnlocked />);
    const shown = textOf(tree);
    expect(shown).toContain("Aug 1");
    expect(shown).toContain("Aug 15");
    tree.unmount();
  });

  test("the movement is stated in words, across the whole series", () => {
    const tree = mount(<TrendsCard waterTests={rising} waterType="fresh" premiumUnlocked />);
    expect(textOf(tree)).toContain("Up 20 ppm over 3 tests");
    tree.unmount();
  });

  test("a flat series says steady rather than inventing a direction", () => {
    const flat = [test0("2026-08-15", { nitrate: 10 }), test0("2026-08-08", { nitrate: 12 }), test0("2026-08-01", { nitrate: 10 })];
    const tree = mount(<TrendsCard waterTests={flat} waterType="fresh" premiumUnlocked />);
    expect(textOf(tree)).toContain("Steady across 3 tests");
    tree.unmount();
  });

  test("a value walking toward the edge of its range is called out while still 'good'", () => {
    // Freshwater nitrate is good to 40. 35 grades as good, but it got there
    // climbing, which is the thing a trend is for.
    const creeping = [
      test0("2026-08-15", { nitrate: 35 }),
      test0("2026-08-08", { nitrate: 22 }),
      test0("2026-08-01", { nitrate: 12 }),
    ];
    const tree = mount(<TrendsCard waterTests={creeping} waterType="fresh" premiumUnlocked />);
    expect(textOf(tree)).toContain("nearing the edge");
    tree.unmount();
  });

  test("a comfortable reading is not nagged about", () => {
    const tree = mount(<TrendsCard waterTests={rising} waterType="fresh" premiumUnlocked />);
    expect(textOf(tree)).not.toContain("nearing the edge");
    tree.unmount();
  });

  test("it stays behind the paywall", () => {
    const tree = mount(<TrendsCard waterTests={rising} waterType="fresh" premiumUnlocked={false} />);
    expect(textOf(tree)).toContain("Unlock with Premium");
    tree.unmount();
  });
});
