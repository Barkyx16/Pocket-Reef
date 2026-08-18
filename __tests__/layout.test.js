const fs = require("fs");
const path = require("path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const LOG = read("screens/LogTab.js");
const TANK = read("screens/TankTab.js");
const TOOLKIT = read("components/TankToolkitCard.js");

const cardsIn = (src) => [...src.matchAll(/storageKey="([a-z]+)"/g)].map((m) => m[1]);
const toolsIn = (src) => [...src.matchAll(/\{ id: "([a-z]+)", emoji: "[^"]*", label: "([^"]+)"/g)].map((m) => ({ id: m[1], label: m[2] }));

// The Log tab had grown to six collapsed card headers plus a nine-tool row.
// Every one was reasonable on its own, and together they put six headers
// between a keeper and the form they opened the tab to use — on the most
// frequent action in the app.
//
// The split now is: Log is what you DO; Tank is what DESCRIBES the tank.

describe("the Log tab stays a place you do things", () => {
  test("only the two entry forms are top-level", () => {
    // Water test and dose log. Anything else added here should be a deliberate
    // decision, not a default.
    expect(cardsIn(LOG).sort()).toEqual(["doselog", "watertest"]);
  });

  test("the water test is first and open by default", () => {
    // It's the single most frequent action; it shouldn't need a tap to reach.
    expect(LOG.indexOf('storageKey="watertest"')).toBeLessThan(LOG.indexOf('storageKey="doselog"'));
    expect(LOG).toMatch(/storageKey="watertest"[^>]*defaultOpen={true}/);
  });

  test("read-only analysis lives in the tools row", () => {
    const ids = toolsIn(TOOLKIT).map((t) => t.id);
    for (const id of ["forecast", "delta", "correct"]) expect(ids).toContain(id);
  });
});

describe("the Tank tab describes the tank", () => {
  test("targets moved here, because they're set once and describe the tank", () => {
    expect(cardsIn(TANK)).toContain("targets");
    expect(cardsIn(LOG)).not.toContain("targets");
    expect(TANK).toContain("<TargetsCard");
    expect(LOG).not.toContain("<TargetsCard");
  });

  test("it holds the tank's own records, not its daily logging", () => {
    for (const key of ["record", "equipment", "targets"]) expect(cardsIn(TANK)).toContain(key);
  });
});

describe("the tools row stays readable", () => {
  const tools = toolsIn(TOOLKIT);

  test("no two tools share a label", () => {
    // Moving the delta view in produced a second tool called "Change" beside
    // the water-change calculator — two different things, one word.
    const labels = tools.map((t) => t.label);
    const dupes = labels.filter((l, i) => labels.indexOf(l) !== i);
    expect(dupes).toEqual([]);
  });

  test("labels stay short enough to sit in a pill", () => {
    for (const t of tools) expect(t.label.length).toBeLessThanOrEqual(12);
  });

  test("every tool has a unique id", () => {
    const ids = tools.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("shortcuts still land where the cards now live", () => {
  const { getAction } = require("../lib/shortcuts");

  test("a shortcut naming a card names one that still exists on that tab", () => {
    // Moving a card without moving its shortcut leaves a fast path that opens
    // the right tab and nothing else.
    const byTab = { log: cardsIn(LOG), tank: cardsIn(TANK) };
    for (const id of ["watertest", "dose", "equipment"]) {
      const a = getAction(id);
      if (!a || !a.card) continue;
      expect({ id, ok: byTab[a.tab].includes(a.card) }).toEqual({ id, ok: true });
    }
  });

  test("a shortcut naming a tool names one that still exists", () => {
    const ids = toolsIn(TOOLKIT).map((t) => t.id);
    for (const id of ["upkeep", "trends", "cycle", "maintenance", "cost", "feed", "waterchange"]) {
      const a = getAction(id);
      if (!a || !a.tool) continue;
      expect({ id, tool: a.tool, ok: ids.includes(a.tool) }).toEqual({ id, tool: a.tool, ok: true });
    }
  });
});
