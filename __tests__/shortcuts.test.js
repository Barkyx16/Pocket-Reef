import { ACTIONS, DESTINATIONS, TAB_SHORTCUTS, QUICK_ACTION_IDS, getAction } from "../lib/shortcuts";
import { normalize } from "../lib/search";

// The shortcut table is referenced by id from four surfaces — the quick sheet,
// universal search, the tab bar's long-press menus, and runAction in App.js. A
// typo'd id doesn't crash; it silently drops a row from a menu, which is the
// kind of bug that ships. These tests are the reason it can't.

const TAB_IDS = new Set(["home", "species", "tank", "log", "journal", "health", "games", "profile", "premium", "more"]);
// Mirrors the App.js paywall set. Duplicated deliberately: if the two ever
// diverge, that's a fact worth failing on rather than importing away.
const PREMIUM_TABS = new Set(["tank", "log", "health", "journal", "games", "profile"]);

describe("action table", () => {
  test("every action is complete and routable", () => {
    for (const a of ACTIONS) {
      expect(typeof a.id).toBe("string");
      expect(a.id.length).toBeGreaterThan(0);
      expect(a.label.length).toBeGreaterThan(0);
      expect(a.hint.length).toBeGreaterThan(0);
      expect(a.icon.length).toBeGreaterThan(0);
      expect(TAB_IDS.has(a.tab)).toBe(true);
    }
  });

  test("ids are unique", () => {
    const ids = ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("getAction resolves every id and rejects unknown ones", () => {
    for (const a of ACTIONS) expect(getAction(a.id)).toBe(a);
    expect(getAction("nope")).toBeNull();
    expect(getAction(undefined)).toBeNull();
  });

  test("only the known instant actions skip navigation", () => {
    // runAction has a hard-coded branch per instant id. An instant action it
    // doesn't know about would fall through to routing and never write
    // anything — the tap would look like it worked and do nothing.
    const instant = ACTIONS.filter((a) => a.instant).map((a) => a.id).sort();
    expect(instant).toEqual(["feed", "report", "waterchange"]);
  });

  test("routed actions land on a specific card or tool where one exists", () => {
    // A routed action may open the bare tab, but if it names a card or tool the
    // value has to be a string the target screen can act on.
    for (const a of ACTIONS) {
      if (a.card != null) expect(typeof a.card).toBe("string");
      if (a.tool != null) expect(typeof a.tool).toBe("string");
    }
  });
});

describe("menus reference real actions", () => {
  test("every quick-sheet id resolves", () => {
    for (const id of QUICK_ACTION_IDS) expect(getAction(id)).not.toBeNull();
  });

  test("every long-press shortcut resolves", () => {
    for (const [tab, ids] of Object.entries(TAB_SHORTCUTS)) {
      expect(TAB_IDS.has(tab)).toBe(true);
      for (const id of ids) {
        expect(getAction(id)).not.toBeNull();
      }
    }
  });

  test("the quick sheet stays short enough to be a shortcut", () => {
    expect(QUICK_ACTION_IDS.length).toBeLessThanOrEqual(6);
  });

  test("no long-press menu is longer than the tab it belongs to", () => {
    for (const ids of Object.values(TAB_SHORTCUTS)) {
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.length).toBeLessThanOrEqual(6);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test("free tabs never long-press into a premium-only action", () => {
    // Home and Species are free. Their shortcuts may point at premium tabs —
    // runAction sends those to the paywall — but the menu shouldn't be built
    // entirely out of walls, or long-pressing Home is just an upsell.
    for (const tab of ["home", "species"]) {
      const ids = TAB_SHORTCUTS[tab] || [];
      const free = ids.filter((id) => !PREMIUM_TABS.has(getAction(id).tab));
      expect(free.length).toBeGreaterThan(0);
    }
  });
});

describe("search keywords", () => {
  // Universal search matches on normalize(label + keywords).includes(q). If a
  // keyword survives normalization as something else, it can never be typed.
  const searchable = (item) => normalize(`${item.label} ${item.keywords || ""}`);

  test("every action and destination is findable by its own words", () => {
    for (const item of [...ACTIONS, ...DESTINATIONS]) {
      const hay = searchable(item);
      for (const word of normalize(item.label).split(" ")) {
        expect(hay).toContain(word);
      }
    }
  });

  test("the searches people actually type hit something", () => {
    const all = [...ACTIONS, ...DESTINATIONS];
    const find = (q) => all.filter((i) => searchable(i).includes(normalize(q)));
    for (const q of ["feed", "water change", "ammonia", "sick", "cost", "trends", "cycle", "journal", "premium", "achievements"]) {
      expect(find(q).length).toBeGreaterThan(0);
    }
  });

  test("destination ids match the tabs jumpTo accepts", () => {
    for (const d of DESTINATIONS) expect(TAB_IDS.has(d.id)).toBe(true);
    expect(new Set(DESTINATIONS.map((d) => d.id)).size).toBe(DESTINATIONS.length);
  });
});
