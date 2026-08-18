jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Round two of upgrades: the money total, dated expenses, reminders that report
// their real state, a warning before a bad fish goes in, and volume that
// honours the metric setting.
//
// The unit tests here matter more than usual: three of these are cases where
// the app previously displayed something confidently wrong (a $0 total, a
// "Weekly" reminder that never fires, "40 gal" to a metric keeper), and a
// confident wrong answer is invisible until someone checks it deliberately.

const renderer = require("react-test-renderer");
const { Text } = require("react-native");

const { CostTrackerCard, costDate } = require("../components/CostTrackerCard");
const { RemindersCard, describeNext } = require("../components/RemindersCard");
const { SpeciesCard } = require("../components/SpeciesCard");
const { assessAddition, SPECIES, getSpecies } = require("../core");
const { nextFireDate } = require("../lib/notifications");
const { setUnit, formatVolume } = require("../lib/units");

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
const settle = async () => { await renderer.act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

afterEach(() => setUnit("imperial"));

// ─────────────────────────────────────────────────────────────────────────────
// 1. One honest total
// ─────────────────────────────────────────────────────────────────────────────
describe("what the tank has cost", () => {
  const costs = [{ id: 1, date: "2026-08-10", label: "Salt mix", amount: 40, category: "Food" }];
  const tank = {
    equipment: [
      { id: "e1", name: "Return pump", category: "flow", price: 180 },
      { id: "e2", name: "Heater", category: "heating", price: null },
    ],
    stock: ["Ocellaris Clownfish"],
    quantities: { "Ocellaris Clownfish": 2 },
    stockMeta: { "Ocellaris Clownfish": { price: 25 } },
    losses: [],
  };

  test("the headline counts gear and livestock, not just typed expenses", () => {
    const tree = mount(<CostTrackerCard costs={costs} tank={tank} onAdd={() => {}} onDelete={() => {}} />);
    // 40 typed + 180 gear + (25 × 2) livestock.
    expect(textOf(tree)).toContain("$270.00");
    tree.unmount();
  });

  test("it shows where the money came from rather than merging it", () => {
    const tree = mount(<CostTrackerCard costs={costs} tank={tank} onAdd={() => {}} onDelete={() => {}} />);
    const shown = textOf(tree);
    expect(shown).toContain("Expenses");
    expect(shown).toContain("Gear");
    expect(shown).toContain("Livestock");
    // A half-filled gear record must not imply a complete total.
    expect(shown).toContain("1 of 2 priced");
    tree.unmount();
  });

  test("with only typed expenses it stays the plain old total, no breakdown", () => {
    const tree = mount(<CostTrackerCard costs={costs} tank={{}} onAdd={() => {}} onDelete={() => {}} />);
    const shown = textOf(tree);
    expect(shown).toContain("$40.00");
    expect(shown).not.toContain("Gear");
    tree.unmount();
  });

  test("the double-count risk is disclosed, not hidden", () => {
    const withEquipExpense = [{ id: 2, date: "2026-08-10", label: "Return pump", amount: 180, category: "Equipment" }];
    const tree = mount(<CostTrackerCard costs={withEquipExpense} tank={tank} onAdd={() => {}} onDelete={() => {}} />);
    expect(textOf(tree)).toMatch(/counted here too/i);
    tree.unmount();
  });

  test("no warning when only one ledger holds gear money", () => {
    const foodOnly = [{ id: 3, date: "2026-08-10", label: "Frozen mysis", amount: 12, category: "Food" }];
    const tree = mount(<CostTrackerCard costs={foodOnly} tank={tank} onAdd={() => {}} onDelete={() => {}} />);
    expect(textOf(tree)).not.toMatch(/counted here too/i);
    tree.unmount();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Expenses belong to the day you bought the thing
// ─────────────────────────────────────────────────────────────────────────────
describe("expense dates", () => {
  test("a new expense carries the date, not just a timestamp", () => {
    const onAdd = jest.fn();
    const tree = mount(<CostTrackerCard costs={[]} tank={{}} onAdd={onAdd} onDelete={() => {}} />);
    const labelField = tree.root.findAll((n) => n.props.accessibilityLabel === "What you bought")[0];
    const amountField = tree.root.findAll((n) => n.props.accessibilityLabel === "Amount")[0];
    renderer.act(() => { labelField.props.onChangeText("Heater"); });
    renderer.act(() => { amountField.props.onChangeText("35"); });

    const addBtn = tree.root.findAll((n) => typeof n.props?.onPress === "function" && flatten(n.findAllByType(Text).map((t) => t.props.children)).includes("Add expense"))[0];
    renderer.act(() => { addBtn.props.onPress(); });

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ label: "Heater", amount: 35, date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));
    tree.unmount();
  });

  test("old undated entries keep their date rather than becoming undated", () => {
    // Entry ids have always been Date.now().
    const id = new Date("2026-03-04T10:00:00Z").getTime();
    expect(costDate({ id })).toBe("2026-03-04");
  });

  test("an explicit date wins over the id", () => {
    const id = new Date("2026-08-17T10:00:00Z").getTime();
    expect(costDate({ id, date: "2026-03-04" })).toBe("2026-03-04");
  });

  test("the ledger shows when each thing was bought", () => {
    const tree = mount(<CostTrackerCard costs={[{ id: 1, date: "2026-03-04", label: "Heater", amount: 35, category: "Equipment" }]} tank={{}} onAdd={() => {}} onDelete={() => {}} />);
    expect(textOf(tree)).toContain("2026-03-04");
    tree.unmount();
  });

  test("a backdated expense is excluded from this month's figure", () => {
    const old = [{ id: Date.now(), date: "2020-01-05", label: "Old heater", amount: 99, category: "Equipment" }];
    const tree = mount(<CostTrackerCard costs={old} tank={{}} onAdd={() => {}} onDelete={() => {}} />);
    const shown = textOf(tree);
    expect(shown).toContain("$99.00");        // still in the lifetime total
    expect(shown).not.toContain("this month"); // but not in this month's
    tree.unmount();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Reminders that say whether they will actually arrive
// ─────────────────────────────────────────────────────────────────────────────
describe("reminder status", () => {
  const prefs = { waterTest: "weekly", waterChange: "off", feeding: "off" };

  test("says nothing when every reminder is off", async () => {
    const tree = mount(<RemindersCard prefs={{ waterTest: "off", waterChange: "off", feeding: "off" }} onChange={() => {}} />);
    await settle();
    const shown = textOf(tree);
    expect(shown).not.toMatch(/scheduled|turned off|hasn't been allowed/i);
    tree.unmount();
  });

  test("reports how many are scheduled once permission is granted", async () => {
    const Notifications = require("expo-notifications");
    Notifications.getPermissionsAsync.mockResolvedValueOnce({ granted: true, canAskAgain: true });
    Notifications.getAllScheduledNotificationsAsync.mockResolvedValueOnce([
      { trigger: { type: "date", value: Date.now() + 3 * 86400000 } },
      { trigger: { type: "date", value: Date.now() + 7 * 86400000 } },
    ]);
    const tree = mount(<RemindersCard prefs={prefs} onChange={() => {}} />);
    await settle();
    const shown = textOf(tree);
    expect(shown).toContain("2 reminders scheduled");
    expect(shown).toContain("in 3 days");
    tree.unmount();
  });

  test("a denied permission is stated plainly, with a way out", async () => {
    const Notifications = require("expo-notifications");
    Notifications.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: false });
    const tree = mount(<RemindersCard prefs={prefs} onChange={() => {}} />);
    await settle();
    const shown = textOf(tree);
    expect(shown).toMatch(/turned off for Pocket Reef/i);
    expect(shown).toContain("Open Settings");
    tree.unmount();
  });

  test("never-asked offers the prompt rather than the Settings detour", async () => {
    const Notifications = require("expo-notifications");
    Notifications.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: true });
    const tree = mount(<RemindersCard prefs={prefs} onChange={() => {}} />);
    await settle();
    expect(textOf(tree)).toContain("Allow notifications");
    tree.unmount();
  });

  test("permission granted but nothing armed is still reported, not glossed over", async () => {
    const Notifications = require("expo-notifications");
    Notifications.getPermissionsAsync.mockResolvedValueOnce({ granted: true, canAskAgain: true });
    Notifications.getAllScheduledNotificationsAsync.mockResolvedValueOnce([]);
    const tree = mount(<RemindersCard prefs={prefs} onChange={() => {}} />);
    await settle();
    expect(textOf(tree)).toMatch(/nothing is scheduled/i);
    tree.unmount();
  });

  test("the soonest future trigger wins, and past ones are ignored", () => {
    const now = Date.now();
    const next = nextFireDate([
      { trigger: { value: now - 86400000 } },
      { trigger: { value: now + 5 * 86400000 } },
      { trigger: { value: now + 2 * 86400000 } },
    ]);
    expect(Math.round((next.getTime() - now) / 86400000)).toBe(2);
  });

  test("an interval trigger carries no recoverable instant and is skipped, not guessed", () => {
    expect(nextFireDate([{ trigger: { type: "timeInterval", seconds: 600 } }])).toBeNull();
  });

  test("relative wording", () => {
    const now = new Date("2026-08-17T09:00:00Z");
    expect(describeNext(new Date("2026-08-18T09:00:00Z"), now)).toBe("tomorrow");
    expect(describeNext(new Date("2026-08-20T09:00:00Z"), now)).toBe("in 3 days");
    expect(describeNext(new Date("2026-08-17T13:00:00Z"), now)).toBe("in 4 hours");
    expect(describeNext(new Date("2026-08-16T09:00:00Z"), now)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. A verdict before the fish is bought
// ─────────────────────────────────────────────────────────────────────────────
describe("assessing an addition", () => {
  // Real catalog entries, so the thresholds are the ones users actually hit.
  const BIG = SPECIES.filter((s) => s.water === "fresh" && s.minGallons >= 55)[0];
  const SMALL = SPECIES.filter((s) => s.water === "fresh" && s.minGallons <= 15 && s.minGroup <= 1)[0];

  test("the fixtures are real catalog entries", () => {
    expect(getSpecies(BIG.name)).toBeTruthy();
    expect(SMALL).toBeTruthy();
  });

  test("wrong water type is blocked outright — nothing survives that", () => {
    const salty = SPECIES.find((s) => s.water === "salt");
    const v = assessAddition(salty.name, { tank: [], tankGallons: 50, tankWater: "fresh" });
    expect(v.severity).toBe("blocked");
    expect(v.reason).toMatch(/can't share water/i);
  });

  test("too small a tank warns but stays the keeper's call", () => {
    const v = assessAddition(BIG.name, { tank: [], tankGallons: 10, tankWater: "fresh" });
    expect(v.severity).toBe("warn");
    expect(v.reason).toContain(String(BIG.minGallons));
  });

  test("an incompatible tankmate is named", () => {
    // Two aggressive freshwater species never share a tank.
    const aggressive = SPECIES.filter((s) => s.water === "fresh" && s.temperament === "aggressive");
    if (aggressive.length < 2) return;
    const [a, b] = aggressive;
    const v = assessAddition(a.name, { tank: [b.name], tankGallons: 500, tankWater: "fresh" });
    expect(v.severity).toBe("warn");
    expect(v.title).toContain(b.name);
  });

  test("a schooling fish is a note, never an interruption", () => {
    const schooler = SPECIES.find((s) => s.water === "fresh" && s.minGroup > 1);
    const v = assessAddition(schooler.name, { tank: [], tankGallons: 500, tankWater: "fresh" });
    expect(v.ok).toBe(true);
    expect(v.severity).toBe("note");
  });

  test("a good fit says so and gets out of the way", () => {
    const v = assessAddition(SMALL.name, { tank: [], tankGallons: 500, tankWater: "fresh" });
    expect(v.severity).toBe("ok");
    expect(v.ok).toBe(true);
  });

  test("an unsized tank can't be judged on size", () => {
    const v = assessAddition(BIG.name, { tank: [], tankGallons: 0, tankWater: "fresh" });
    expect(v.severity).not.toBe("warn");
  });

  test("an unknown species is never blocked on a guess", () => {
    expect(assessAddition("Not A Real Fish", { tankGallons: 10 }).ok).toBe(true);
  });

  test("a fish already in the tank isn't judged against itself", () => {
    const v = assessAddition(SMALL.name, { tank: [SMALL.name], tankGallons: 500, tankWater: "fresh" });
    expect(v.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Volume in the keeper's units
// ─────────────────────────────────────────────────────────────────────────────
describe("volume honours the unit setting", () => {
  test("formatVolume converts", () => {
    setUnit("imperial");
    expect(formatVolume(40)).toBe("40 gal");
    setUnit("metric");
    expect(formatVolume(40)).toBe("151 L");
  });

  test("a species card shows litres to a metric keeper", () => {
    const species = SPECIES.find((s) => s.minGallons === 20) || SPECIES[0];
    setUnit("metric");
    const tree = mount(<SpeciesCard species={species} onPress={() => {}} />);
    const shown = textOf(tree);
    expect(shown).toContain(" L");
    expect(shown).not.toMatch(/\d+ gal/);
    tree.unmount();
  });

  test("and gallons to an imperial one", () => {
    const species = SPECIES.find((s) => s.minGallons === 20) || SPECIES[0];
    setUnit("imperial");
    const tree = mount(<SpeciesCard species={species} onPress={() => {}} />);
    expect(textOf(tree)).toMatch(/\d+ gal/);
    tree.unmount();
  });

  test("the screen reader hears the same units the screen shows", () => {
    const species = SPECIES.find((s) => s.minGallons === 20) || SPECIES[0];
    setUnit("metric");
    const tree = mount(<SpeciesCard species={species} onPress={() => {}} />);
    const labelled = tree.root.findAll((n) => typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.includes(species.name))[0];
    expect(labelled.props.accessibilityLabel).toContain(" L");
    expect(labelled.props.accessibilityLabel).not.toContain("gallons");
    tree.unmount();
  });
});
