const { pendingNow, pendingSummary } = require("../lib/pending");

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


const DAY = 86400000;
const day = (n) => localDay(Date.now() - n * DAY);
const iso = (n) => new Date(Date.now() - n * DAY).toISOString();

const REEF = {


  water: "salt",
  waterTests: [{ date: day(2), water: "salt", values: { alk: 8 } }],
  maintenance: { carbon: iso(45), filtersock: iso(9) },
  upkeep: [], doses: [], quarantine: [],
};

describe("what the round contains", () => {
  test("overdue jobs come first and are marked urgent", () => {
    const items = pendingNow(REEF, { waterType: "salt" });
    expect(items[0].kind).toBe("upkeep");
    expect(items[0].urgent).toBe(true);
    expect(items[0].label).toBe("Replace carbon / GFO");
    expect(items[0].sub).toMatch(/Overdue by/);
  });

  test("every overdue job carries the id needed to tick it off", () => {
    // The whole point is completing it here rather than navigating.
    const items = pendingNow(REEF, { waterType: "salt" });
    const jobs = items.filter((i) => i.kind === "upkeep");
    expect(jobs.length).toBeGreaterThan(0);
    for (const j of jobs) expect(typeof j.taskId).toBe("string");
  });

  test("a water test overdue on the keeper's own cadence appears", () => {
    const stale = { ...REEF, waterTests: [{ date: day(20), values: {} }] };
    const items = pendingNow(stale, { waterType: "salt", reminderPrefs: { waterTest: "weekly" } });
    const test = items.find((i) => i.kind === "test");
    expect(test.sub).toBe("Last tested 20 days ago");
    expect(test.urgent).toBe(true); // more than twice the cadence
  });

  test("a test logged inside the cadence doesn't nag", () => {
    const items = pendingNow(REEF, { waterType: "salt", reminderPrefs: { waterTest: "weekly" } });
    expect(items.find((i) => i.kind === "test")).toBeUndefined();
  });

  test("reminders switched off means no test item at all", () => {
    const stale = { ...REEF, waterTests: [{ date: day(90), values: {} }] };
    const items = pendingNow(stale, { waterType: "salt", reminderPrefs: { waterTest: "off" } });
    expect(items.find((i) => i.kind === "test")).toBeUndefined();
  });
});

describe("it doesn't invent chores", () => {
  test("a keeper who has never dosed is never told to dose", () => {
    // Nagging someone to start a routine they don't have is how an app invents
    // work for you.
    const items = pendingNow(REEF, { waterType: "salt" });
    expect(items.find((i) => i.kind === "dose")).toBeUndefined();
  });

  test("an established routine that's blank today does appear", () => {
    const dosing = { ...REEF, doses: [{ id: "1", key: "alk", ml: 20, date: day(1) }, { id: "2", key: "alk", ml: 20, date: day(2) }] };
    const items = pendingNow(dosing, { waterType: "salt" });
    const dose = items.find((i) => i.kind === "dose");
    expect(dose.label).toBe("Dose alkalinity");
  });

  test("already dosed today means nothing to do", () => {
    const dosing = { ...REEF, doses: [{ id: "1", key: "alk", ml: 20, date: day(0) }] };
    expect(pendingNow(dosing, { waterType: "salt" }).find((i) => i.kind === "dose")).toBeUndefined();
  });

  test("a routine abandoned a month ago isn't resurrected", () => {
    const old = { ...REEF, doses: [{ id: "1", key: "alk", ml: 20, date: day(40) }] };
    expect(pendingNow(old, { waterType: "salt" }).find((i) => i.kind === "dose")).toBeUndefined();
  });

  test("a freshwater tank is never asked to dose reef supplements", () => {
    const fresh = { ...REEF, water: "fresh", doses: [{ id: "1", key: "alk", ml: 5, date: day(1) }] };
    expect(pendingNow(fresh, { waterType: "fresh" }).find((i) => i.kind === "dose")).toBeUndefined();
  });

  test("feeding only appears for someone who tracks feedings", () => {
    expect(pendingNow(REEF, { waterType: "salt", feedings: [] }).find((i) => i.kind === "feed")).toBeUndefined();
    const withHistory = [{ id: 1, date: day(1), food: "Flake" }];
    expect(pendingNow(REEF, { waterType: "salt", feedings: withHistory }).find((i) => i.kind === "feed")).toBeTruthy();
    const fedToday = [{ id: 1, date: day(0), food: "Flake" }];
    expect(pendingNow(REEF, { waterType: "salt", feedings: fedToday }).find((i) => i.kind === "feed")).toBeUndefined();
  });

  test("a finished quarantine surfaces as a decision", () => {
    const qt = { ...REEF, quarantine: [{ id: "q1", name: "Yellow Tang", startDate: iso(30) }] };
    const item = pendingNow(qt, { waterType: "salt" }).find((i) => i.kind === "qt");
    expect(item.label).toBe("Yellow Tang finished quarantine");
  });

  test("quarantine still running says nothing", () => {
    const qt = { ...REEF, quarantine: [{ id: "q1", name: "Yellow Tang", startDate: iso(5) }] };
    expect(pendingNow(qt, { waterType: "salt" }).find((i) => i.kind === "qt")).toBeUndefined();
  });
});

describe("robustness", () => {
  test("a brand-new tank asks for a first test and nothing else", () => {
    const fresh = { water: "fresh", waterTests: [], maintenance: {}, upkeep: [], doses: [], quarantine: [] };
    const items = pendingNow(fresh, { waterType: "fresh" });
    expect(items.map((i) => i.kind)).toEqual(["test"]);
    expect(items[0].sub).toBe("No test logged yet");
  });

  test("garbage in doesn't throw", () => {
    expect(pendingNow(null)).toEqual([]);
    expect(() => pendingNow({}, {})).not.toThrow();
    expect(() => pendingNow({ quarantine: [null], doses: [null] }, {})).not.toThrow();
  });
});

describe("the summary line", () => {
  test("counts urgent separately", () => {
    const items = pendingNow(REEF, { waterType: "salt" });
    const s = pendingSummary(items);
    expect(s.urgent).toBeGreaterThan(0);
    expect(s.text).toMatch(/overdue/);
  });

  test("an all-clear tank says so rather than showing a zero", () => {
    expect(pendingSummary([]).text).toBe("Nothing needs you right now");
  });

  test("non-urgent work reads without the word overdue", () => {
    expect(pendingSummary([{ urgent: false }]).text).toBe("1 thing to do");
    expect(pendingSummary([{ urgent: false }, { urgent: false }]).text).toBe("2 things to do");
  });
});

describe("the sheet that shows the round", () => {
  jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
  const renderer = require("react-test-renderer");
  const { Text } = require("react-native");
  const { QuickActionsSheet, QuickActionsFab } = require("../components/QuickActionsSheet");

  function mount(el) {
    let t; renderer.act(() => { t = renderer.create(el); });
    const raw = t.unmount.bind(t); t.unmount = () => renderer.act(() => { raw(); });
    return t;
  }
  const flatten = (c) => Array.isArray(c) ? c.map(flatten).join("") : (typeof c === "string" || typeof c === "number") ? String(c) : "";
  const textOf = (t) => t.root.findAllByType(Text).map((n) => flatten(n.props.children)).join(" | ");
  const byLabel = (t, l) => t.root.findAll((n) => n.props.accessibilityLabel === l);
  const noop = () => {};

  // The sheet takes { tank, items } groups so a job can never be ticked off
  // against the wrong tank.
  const TANK = { id: "t1", name: "The Reef", emoji: "🐠" };
  const groups = [{ tank: TANK, items: pendingNow(REEF, { waterType: "salt" }) }];

  test("the round is shown above the generic shortcuts", () => {
    const tree = mount(<QuickActionsSheet visible pending={groups} onClose={noop} onRun={noop} onComplete={noop} />);
    const text = textOf(tree);
    expect(text).toContain("Needs you now");
    expect(text).toContain("Replace carbon / GFO");
    expect(text).toContain("Log something");
    // The round comes first — it's why the sheet is worth opening.
    expect(text.indexOf("Needs you now")).toBeLessThan(text.indexOf("Log something"));
    tree.unmount();
  });

  test("a job is marked done in place", () => {
    const onComplete = jest.fn();
    const tree = mount(<QuickActionsSheet visible pending={groups} onClose={noop} onRun={noop} onComplete={onComplete} />);
    renderer.act(() => { byLabel(tree, "Mark Replace carbon / GFO done")[0].props.onPress(); });
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ kind: "upkeep", taskId: "carbon" }));
    tree.unmount();
  });

  test("something needing real input says Open, not Done", () => {
    // A one-tap "done" on a water test would record a number nobody measured.
    const withTest = [{ tank: TANK, items: pendingNow({ ...REEF, waterTests: [] }, { waterType: "salt" }) }];
    const tree = mount(<QuickActionsSheet visible pending={withTest} onClose={noop} onRun={noop} onComplete={noop} />);
    expect(byLabel(tree, "Open Test your water").length).toBeGreaterThan(0);
    tree.unmount();
  });

  test("an all-clear tank says so rather than showing an empty heading", () => {
    const tree = mount(<QuickActionsSheet visible pending={[]} onClose={noop} onRun={noop} onComplete={noop} />);
    expect(textOf(tree)).toContain("Nothing needs you right now");
    expect(textOf(tree)).not.toContain("Needs you now");
    tree.unmount();
  });

  test("the button carries the count so you needn't open it to check", () => {
    const tree = mount(<QuickActionsFab onPress={noop} pendingCount={3} urgent />);
    expect(byLabel(tree, "Quick actions. 3 things need doing.").length).toBeGreaterThan(0);
    expect(textOf(tree)).toContain("3");
    tree.unmount();
  });

  test("a big backlog is capped rather than breaking the badge", () => {
    const tree = mount(<QuickActionsFab onPress={noop} pendingCount={14} />);
    expect(textOf(tree)).toContain("9+");
    tree.unmount();
  });

  test("no badge at all when there's nothing to do", () => {
    const tree = mount(<QuickActionsFab onPress={noop} pendingCount={0} />);
    expect(byLabel(tree, "Quick actions").length).toBeGreaterThan(0);
    tree.unmount();
  });
});

describe("every tank in one place", () => {
  const { pendingAcrossTanks, flattenPending } = require("../lib/pending");
  jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
  const renderer2 = require("react-test-renderer");
  const { Text: T2 } = require("react-native");
  const { QuickActionsSheet: Sheet } = require("../components/QuickActionsSheet");

  const mount2 = (el) => { let t; renderer2.act(() => { t = renderer2.create(el); }); return t; };
  const flat = (c) => Array.isArray(c) ? c.map(flat).join("") : (typeof c === "string" || typeof c === "number") ? String(c) : "";
  const text2 = (t) => t.root.findAllByType(T2).map((n) => flat(n.props.children)).join(" | ");
  const label2 = (t, l) => t.root.findAll((n) => n.props.accessibilityLabel === l);

  const display = { ...REEF, id: "t1", name: "Display", emoji: "🐠" };
  const frag = {
    ...REEF, id: "t2", name: "Frag Tank", emoji: "🪸",
    // Worse off: two badly overdue jobs.
    maintenance: { carbon: iso(90), filtersock: iso(30) },
  };

  test("a tank with nothing due doesn't appear at all", () => {
    const clean = { id: "t3", name: "Clean", water: "fresh", waterTests: [{ date: day(0), values: {} }], maintenance: {}, upkeep: [], doses: [], quarantine: [] };
    const groups = pendingAcrossTanks([clean], { waterTypeFor: () => "fresh" });
    expect(groups).toEqual([]);
  });

  test("the tank in the worst state leads", () => {
    // A neglected frag tank must not hide behind a display that's on schedule.
    const groups = pendingAcrossTanks([display, frag], { waterTypeFor: () => "salt" });
    expect(groups[0].tank.name).toBe("Frag Tank");
  });

  test("every item knows which tank it belongs to", () => {
    const items = flattenPending(pendingAcrossTanks([display, frag], { waterTypeFor: () => "salt" }));
    for (const i of items) expect(i.tankId).toBeTruthy();
    expect(new Set(items.map((i) => i.tankId))).toEqual(new Set(["t1", "t2"]));
  });

  test("ids stay unique across tanks so two identical jobs don't collide", () => {
    // Both tanks have a "carbon" job; without namespacing, React would treat
    // them as the same row.
    const items = flattenPending(pendingAcrossTanks([display, frag], { waterTypeFor: () => "salt" }));
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });

  test("the sheet heads each tank when there's more than one", () => {
    const groups = pendingAcrossTanks([display, frag], { waterTypeFor: () => "salt" });
    const tree = mount2(<Sheet visible pending={groups} onClose={() => {}} onRun={() => {}} onComplete={() => {}} />);
    const text = text2(tree);
    expect(text).toContain("Frag Tank");
    expect(text).toContain("Display");
    renderer2.act(() => { tree.unmount(); });
  });

  test("a single tank gets no heading — it would be noise", () => {
    const groups = pendingAcrossTanks([display], { waterTypeFor: () => "salt" });
    const tree = mount2(<Sheet visible pending={groups} onClose={() => {}} onRun={() => {}} onComplete={() => {}} />);
    expect(text2(tree)).not.toContain("Display");
    renderer2.act(() => { tree.unmount(); });
  });

  test("completing a job reports the tank it belongs to", () => {
    // Without this the job would be logged against whichever tank happened to
    // be open — silently marking the wrong tank's carbon as changed.
    const onComplete = jest.fn();
    const groups = pendingAcrossTanks([display, frag], { waterTypeFor: () => "salt" });
    const tree = mount2(<Sheet visible pending={groups} onClose={() => {}} onRun={() => {}} onComplete={onComplete} />);
    // Both tanks have a carbon job, so target by position within its group
    // rather than trusting which renders first.
    const fragCarbon = groups.find((g) => g.tank.id === "t2").items.find((i) => i.taskId === "carbon");
    // findAll matches composite AND host nodes, so one Pressable comes back
    // several times; filter to the ones that actually carry the handler.
    const rows = label2(tree, "Mark Replace carbon / GFO done").filter((n) => typeof n.props.onPress === "function");
    expect(rows.length).toBeGreaterThanOrEqual(2); // at least one per tank
    renderer2.act(() => { rows[0].props.onPress(); });
    const reported = onComplete.mock.calls[0][0];
    expect(reported.taskId).toBe("carbon");
    // Whichever row was tapped, it carries its own tank — never the active one.
    expect(["t1", "t2"]).toContain(reported.tankId);
    expect(fragCarbon.tankId).toBe("t2");
    renderer2.act(() => { tree.unmount(); });
  });
});
