const {
  defaultTasks, allTasks, newUpkeepTask, taskStatus, sortedByUrgency,
  upkeepSummary, statusLabel, suggestionsFor,
} = require("../lib/upkeep");

const DAY = 86400000;
const NOW = new Date("2026-08-10T12:00:00Z").getTime();
const daysAgo = (n) => new Date(NOW - n * DAY).toISOString();

describe("what a tank is offered", () => {
  test("a reef gets the jobs that actually fill a reefer's calendar", () => {
    // The app shipped four chores total. None of these existed.
    const ids = defaultTasks("salt").map((t) => t.id);
    for (const id of ["skimmerclean", "filtersock", "carbon", "atotop", "probecal", "rodi", "pumpclean", "saltmix"]) {
      expect(ids).toContain(id);
    }
  });

  test("a freshwater tank isn't nagged about skimmers", () => {
    const ids = defaultTasks("fresh").map((t) => t.id);
    expect(ids).toContain("gravelvac");
    expect(ids).toContain("plantrim");
    expect(ids).not.toContain("skimmerclean");
    expect(ids).not.toContain("saltmix");
  });

  test("both water types keep the universal chores", () => {
    for (const w of ["fresh", "salt"]) {
      const ids = defaultTasks(w).map((t) => t.id);
      expect(ids).toContain("waterchange");
      expect(ids).toContain("filterclean");
      expect(ids).toContain("glassclean");
    }
  });

  test("every built-in is well formed", () => {
    for (const w of ["fresh", "salt"]) {
      for (const t of defaultTasks(w)) {
        expect(t.id).toBeTruthy();
        expect(t.label.length).toBeGreaterThan(0);
        expect(t.days).toBeGreaterThan(0);
        expect(["chore", "gear"]).toContain(t.kind);
      }
    }
    const ids = defaultTasks("salt").map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("suggestions exist for both water types and carry an interval", () => {
    for (const w of ["fresh", "salt"]) {
      const s = suggestionsFor(w);
      expect(s.length).toBeGreaterThan(0);
      for (const item of s) expect(item.days).toBeGreaterThan(0);
    }
  });
});

describe("custom tasks", () => {
  test("a task needs only a label", () => {
    const t = newUpkeepTask({ label: "Replace UV bulb" });
    expect(t.label).toBe("Replace UV bulb");
    expect(t.days).toBe(30);
    expect(t.custom).toBe(true);
    expect(t.id).toMatch(/^u_/);
  });

  test("a blank label is refused rather than creating a nameless row", () => {
    expect(newUpkeepTask({ label: "   " })).toBeNull();
    expect(newUpkeepTask({})).toBeNull();
  });

  test("an interval is clamped, not rejected", () => {
    // Somebody typing 0 means "often", not "divide by zero in the due maths".
    expect(newUpkeepTask({ label: "x", days: 0 }).days).toBe(1);
    expect(newUpkeepTask({ label: "x", days: -5 }).days).toBe(1);
    expect(newUpkeepTask({ label: "x", days: 99999 }).days).toBe(3650);
    expect(newUpkeepTask({ label: "x", days: "14" }).days).toBe(14);
  });

  test("custom tasks join the built-ins", () => {
    const custom = newUpkeepTask({ label: "ICP test", days: 90 });
    const tank = { water: "salt", upkeep: [custom] };
    const ids = allTasks(tank).map((t) => t.id);
    expect(ids).toContain(custom.id);
    expect(ids).toContain("skimmerclean");
  });

  test("a built-in can be switched off for a tank that doesn't have that gear", () => {
    // A tank without a skimmer shouldn't be nagged about the skimmer cup forever.
    const tank = { water: "salt", upkeep: [{ id: "skimmerclean", label: "Clean the skimmer cup", disabled: true }] };
    expect(allTasks(tank).map((t) => t.id)).not.toContain("skimmerclean");
  });

  test("a built-in's interval can be overridden without losing the rest of it", () => {
    const tank = { water: "salt", upkeep: [{ id: "filtersock", label: "Change filter socks", days: 2 }] };
    const sock = allTasks(tank).find((t) => t.id === "filtersock");
    expect(sock.days).toBe(2);
    expect(sock.emoji).toBe("🧦"); // the built-in's other fields survive
  });

  test("malformed custom entries are ignored", () => {
    const tank = { water: "fresh", upkeep: [null, {}, { id: "x" }, { label: "no id" }] };
    expect(() => allTasks(tank)).not.toThrow();
    expect(allTasks(tank).length).toBe(defaultTasks("fresh").length);
  });
});

describe("when a task is due", () => {
  const task = { id: "waterchange", label: "Water change", days: 7 };

  test("never logged is distinct from overdue", () => {
    // "Never logged" is not a failure — it's a tank that just started.
    const s = taskStatus(task, {}, NOW);
    expect(s.state).toBe("never");
    expect(s.daysSince).toBeNull();
  });

  test("fresh, due soon, due today and overdue are each their own state", () => {
    expect(taskStatus(task, { waterchange: daysAgo(0) }, NOW).state).toBe("ok");
    expect(taskStatus(task, { waterchange: daysAgo(6) }, NOW).state).toBe("soon");
    expect(taskStatus(task, { waterchange: daysAgo(7) }, NOW).state).toBe("due");
    expect(taskStatus(task, { waterchange: daysAgo(9) }, NOW).state).toBe("overdue");
    expect(taskStatus(task, { waterchange: daysAgo(9) }, NOW).dueIn).toBe(-2);
  });

  test("the warning window scales with the interval", () => {
    // Two days out matters on a 4-day sock change and not on a 90-day pump strip.
    const sock = { id: "filtersock", days: 4 };
    const pump = { id: "pumpclean", days: 90 };
    expect(taskStatus(sock, { filtersock: daysAgo(3) }, NOW).state).toBe("soon");
    expect(taskStatus(pump, { pumpclean: daysAgo(3) }, NOW).state).toBe("ok");
  });

  test("a corrupt date reads as never logged rather than crashing", () => {
    expect(taskStatus(task, { waterchange: "whenever" }, NOW).state).toBe("never");
  });

  test("progress never runs past full", () => {
    expect(taskStatus(task, { waterchange: daysAgo(70) }, NOW).pct).toBe(100);
  });
});

describe("ordering and summary", () => {
  const tank = {
    water: "salt",
    maintenance: {
      waterchange: daysAgo(10),  // overdue by 3
      filtersock: daysAgo(4),    // due today
      skimmerclean: daysAgo(1),  // ok
      carbon: daysAgo(40),       // overdue by 10
    },
  };

  test("the most overdue thing is what you're shown first", () => {
    const rows = sortedByUrgency(allTasks(tank), tank.maintenance, NOW);
    expect(rows[0].task.id).toBe("carbon");   // -10
    expect(rows[1].task.id).toBe("waterchange"); // -3
  });

  test("the summary counts each state and names what to do next", () => {
    const s = upkeepSummary(tank, NOW);
    expect(s.overdue).toBe(2);
    expect(s.due).toBe(1);
    expect(s.next.task.id).toBe("carbon");
    expect(s.total).toBe(allTasks(tank).length);
  });

  test("a brand-new tank reports nothing overdue", () => {
    const s = upkeepSummary({ water: "fresh", maintenance: {} }, NOW);
    expect(s.overdue).toBe(0);
    expect(s.due).toBe(0);
    expect(s.neverLogged).toBe(s.total);
    // Nothing is urgent, so there is nothing to nag about.
    expect(s.next).toBeNull();
  });

  test("an empty tank object doesn't throw", () => {
    expect(() => upkeepSummary({}, NOW)).not.toThrow();
  });
});

describe("phrasing", () => {
  const task = { id: "waterchange", days: 7 };
  const label = (iso) => statusLabel(taskStatus(task, { waterchange: iso }, NOW));

  test("says the thing a keeper would say", () => {
    expect(label(daysAgo(9))).toBe("Overdue by 2d");
    expect(label(daysAgo(7))).toBe("Due today");
    expect(label(daysAgo(0))).toBe("Done today · next in 7d");
    expect(label(daysAgo(3))).toBe("Done 3d ago · due in 4d");
    expect(statusLabel(taskStatus(task, {}, NOW))).toBe("Every 7d · never logged");
  });
});
