jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

const renderer = require("react-test-renderer");
const { Text } = require("react-native");
const { UniversalSearch } = require("../components/UniversalSearch");
const { ACTIONS, TAB_SHORTCUTS, getAction } = require("../lib/shortcuts");
const { buildTankReport } = require("../lib/report");

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


function mount(el) {
  let t; renderer.act(() => { t = renderer.create(el); });
  const raw = t.unmount.bind(t); t.unmount = () => renderer.act(() => { raw(); });
  return t;
}
const flatten = (c) => Array.isArray(c) ? c.map(flatten).join("") : (typeof c === "string" || typeof c === "number") ? String(c) : "";
const textOf = (t) => t.root.findAllByType(Text).map((n) => flatten(n.props.children)).join(" | ");
const byLabel = (t, l) => t.root.findAll((n) => n.props.accessibilityLabel === l);

const day = (n) => localDay(Date.now() - n * 86400000);

const TANK = {


  id: "t1", name: "The Reef", gallons: 120, water: "salt",
  createdAt: new Date(Date.now() - 500 * 86400000).toISOString(),
  stock: [], quantities: {}, stockMeta: {}, losses: [], journal: [], costs: [],
  waterTests: [
    { date: day(0), water: "salt", values: { alk: 8.0 } },
    { date: day(5), water: "salt", values: { alk: 8.5 } },
    { date: day(10), water: "salt", values: { alk: 9.0 } },
  ],
  maintenance: { carbon: new Date(Date.now() - 45 * 86400000).toISOString() },
  quarantine: [], feedings: [], treatments: [], targets: {}, upkeep: [],
  doses: [{ id: "d1", key: "alk", ml: 20, date: day(1) }],
  equipment: [
    // Named the way the card's own "Protein skimmer" suggestion seeds it.
    { id: "e1", name: "Protein skimmer", category: "filtration", brand: "Reef Octopus", installedAt: day(700) },
    { id: "e2", name: "Vectra M2", category: "flow", installedAt: day(100), warrantyMonths: 24 },
  ],
};

describe("the new features have shortcuts", () => {
  test("dosing, upkeep and equipment are all reachable as actions", () => {
    // Three whole features were built and none had a fast path — a feature you
    // can only reach by scrolling to the right card is one most people never find.
    for (const id of ["dose", "upkeep", "equipment"]) {
      expect(getAction(id)).not.toBeNull();
    }
  });

  test("each names the card or tool it should land on", () => {
    // Landing on the tab with the card still folded shut is the shortcut
    // failing at the last step.
    expect(getAction("dose").card).toBe("doselog");
    expect(getAction("equipment").card).toBe("equipment");
    expect(getAction("upkeep").tool).toBe("care");
  });

  test("the Log and Tank long-press menus lead with them", () => {
    expect(TAB_SHORTCUTS.log).toContain("upkeep");
    expect(TAB_SHORTCUTS.log).toContain("dose");
    expect(TAB_SHORTCUTS.tank).toContain("equipment");
  });

  test("every action still resolves and routes somewhere real", () => {
    const tabs = new Set(["home", "species", "tank", "log", "journal", "health", "games", "profile", "premium", "more"]);
    for (const a of ACTIONS) expect(tabs.has(a.tab)).toBe(true);
  });
});

describe("search finds the tank's own records", () => {
  const render = (query) => {
    const tree = mount(
      <UniversalSearch visible onClose={() => {}} tanks={[TANK]} activeTankId="t1" activeTank={TANK}
        journal={[]} recent={[]} onOpenSpecies={() => {}} onOpenDisease={() => {}}
        onRunAction={() => {}} onGoToTab={() => {}} onSwitchTank={() => {}} />
    );
    renderer.act(() => { byLabel(tree, "Search everything")[0].props.onChangeText(query); });
    return tree;
  };

  test("'skimmer' finds both the job and the equipment", () => {
    // The tank had a skimmer job AND a skimmer in its rack, and searching for
    // it returned nothing at all.
    const tree = render("skimmer");
    const text = textOf(tree);
    expect(text).toContain("Jobs");
    expect(text).toContain("Clean the skimmer cup");
    expect(text).toContain("Equipment");
    expect(text).toContain("Protein skimmer");
    tree.unmount();
  });

  test("a job shows its live status, not just its name", () => {
    const tree = render("carbon");
    expect(textOf(tree)).toContain("Overdue by");
    tree.unmount();
  });

  test("equipment can be found by brand", () => {
    const tree = render("reef octopus");
    expect(textOf(tree)).toContain("Protein skimmer");
    tree.unmount();
  });

  test("an item named only by model is found by its model, not by its type", () => {
    // A deliberate limit worth stating: the app cannot know "Vectra M2" is a
    // return pump unless the keeper says so, so "pump" won't surface it while
    // "vectra" will. The suggestions exist to steer names toward the common
    // noun for exactly this reason.
    expect(textOf(render("vectra"))).toContain("Vectra M2");
    const tree = render("return pump");
    expect(textOf(tree)).not.toContain("Vectra M2");
    tree.unmount();
  });

  test("a tank with no equipment doesn't render an empty section", () => {
    const bare = { ...TANK, equipment: [] };
    const tree = mount(
      <UniversalSearch visible onClose={() => {}} tanks={[bare]} activeTankId="t1" activeTank={bare}
        journal={[]} recent={[]} onOpenSpecies={() => {}} onOpenDisease={() => {}}
        onRunAction={() => {}} onGoToTab={() => {}} onSwitchTank={() => {}} />
    );
    renderer.act(() => { byLabel(tree, "Search everything")[0].props.onChangeText("octopus"); });
    expect(textOf(tree)).not.toContain("Equipment");
    tree.unmount();
  });

  test("searching still works with no active tank passed", () => {
    const tree = mount(
      <UniversalSearch visible onClose={() => {}} tanks={[]} activeTankId={null}
        journal={[]} recent={[]} onOpenSpecies={() => {}} onOpenDisease={() => {}}
        onRunAction={() => {}} onGoToTab={() => {}} onSwitchTank={() => {}} />
    );
    expect(() => {
      renderer.act(() => { byLabel(tree, "Search everything")[0].props.onChangeText("skimmer"); });
    }).not.toThrow();
    tree.unmount();
  });
});

describe("the report carries the whole setup", () => {
  const report = () => buildTankReport(TANK, { now: new Date(), strengths: { alk: 0.05 } });

  test("equipment is listed by category with age and warranty", () => {
    // "What's on the tank?" is question two in any diagnostic conversation.
    const r = report();
    expect(r).toContain("EQUIPMENT");
    expect(r).toContain("Protein skimmer");
    expect(r).toContain("Vectra M2");
    expect(r).toContain("Under warranty");
  });

  test("dosing reports the measured rate and what went in recently", () => {
    const r = report();
    expect(r).toContain("DOSING");
    expect(r).toContain("Alkalinity: Using about");
    expect(r).toContain("Recent doses:");
    expect(r).toContain("Alkalinity 20ml");
  });

  test("a tank with neither omits both sections rather than printing empty headings", () => {
    const bare = { ...TANK, equipment: [], doses: [], waterTests: [] };
    const r = buildTankReport(bare, { now: new Date() });
    expect(r).not.toContain("EQUIPMENT");
    expect(r).not.toContain("DOSING");
  });

  test("it stays plain text a forum can carry", () => {
    const r = report();
    expect(r).not.toContain("{");
    expect(r).not.toMatch(/<[a-zA-Z/]/);
  });
});

describe("a shortcut beats the card's stored collapsed state", () => {
  const AsyncStorage = require("@react-native-async-storage/async-storage");
  const { CollapsibleCard } = require("../components/CollapsibleCard");
  const settle = () => new Promise((r) => setImmediate(r));

  test("forceOpen wins even when the stored value says collapsed", async () => {
    // The two race: the stored read starts on mount, forceOpen sets open and
    // writes "1", then the read — begun before that write — resolves with the
    // old "0" and closes the card. The flag said open while the card was shut,
    // so the shortcut looked like it did nothing.
    await AsyncStorage.setItem("pr_collapse_racecard", "0");

    let tree;
    await renderer.act(async () => {
      tree = renderer.create(
        <CollapsibleCard storageKey="racecard" title="🧪 Race" forceOpen={12345}>
          <Text>inner content</Text>
        </CollapsibleCard>
      );
      await settle();
    });

    expect(textOf(tree)).toContain("inner content");
    await renderer.act(async () => { tree.unmount(); });
  });

  test("without a shortcut the stored state is still respected", async () => {
    await AsyncStorage.setItem("pr_collapse_normalcard", "0");
    let tree;
    await renderer.act(async () => {
      tree = renderer.create(
        <CollapsibleCard storageKey="normalcard" title="🧪 Normal" defaultOpen>
          <Text>inner content</Text>
        </CollapsibleCard>
      );
      await settle();
    });
    expect(textOf(tree)).not.toContain("inner content");
    await renderer.act(async () => { tree.unmount(); });
  });
});
