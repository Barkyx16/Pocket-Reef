
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

const {
  newEquipment, ageLabel, warrantyStatus, warrantyLabel,
  byCategory, equipmentSummary, categoryOf, CATEGORIES, SUGGESTIONS,
} = require("../lib/equipment");

const DAY = 86400000;
const NOW = new Date("2026-08-10T12:00:00Z").getTime();
const daysAgo = (n) => localDay(NOW - n * DAY);



describe("recording a piece of kit", () => {
  test("a name is all that's required", () => {
    const e = newEquipment({ name: "Vectra M2" });
    expect(e.name).toBe("Vectra M2");
    expect(e.category).toBe("other");
    expect(e.installedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("a nameless item is refused", () => {
    expect(newEquipment({ name: "  " })).toBeNull();
    expect(newEquipment({})).toBeNull();
  });

  test("a missing price is null, never zero", () => {
    // Zero would claim the item was free and drag the build total down.
    expect(newEquipment({ name: "x" }).price).toBeNull();
    expect(newEquipment({ name: "x", price: "" }).price).toBeNull();
    expect(newEquipment({ name: "x", price: 0 }).price).toBe(0);
    expect(newEquipment({ name: "x", price: "249.99" }).price).toBe(249.99);
  });

  test("an unknown category falls back rather than vanishing from the list", () => {
    expect(newEquipment({ name: "x", category: "nonsense" }).category).toBe("other");
    expect(newEquipment({ name: "x", category: "heating" }).category).toBe("heating");
  });

  test("every category has an icon and some suggestions", () => {
    for (const c of CATEGORIES) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.emoji.length).toBeGreaterThan(0);
      expect(SUGGESTIONS[c.id].length).toBeGreaterThan(0);
    }
    expect(categoryOf("nope").id).toBe("other");
  });
});

describe("how old it is", () => {
  test("reads in the unit a keeper would say", () => {
    expect(ageLabel({ installedAt: daysAgo(20) }, NOW)).toBe("20 days old");
    expect(ageLabel({ installedAt: daysAgo(200) }, NOW)).toBe("7 months old");
    expect(ageLabel({ installedAt: daysAgo(900) }, NOW)).toBe("2.5 years old");
  });

  test("an undated item has no age rather than a wrong one", () => {
    expect(ageLabel({})).toBeNull();
    expect(ageLabel({ installedAt: "sometime" })).toBeNull();
  });
});

describe("warranty", () => {
  test("an item bought last month with a 2-year warranty is covered", () => {
    const item = { installedAt: daysAgo(30), warrantyMonths: 24 };
    expect(warrantyStatus(item, NOW).state).toBe("active");
    expect(warrantyLabel(item, NOW)).toMatch(/Under warranty · \d+ months left/);
  });

  test("it warns before the warranty runs out, not after", () => {
    // A month's notice is the difference between claiming and not.
    const item = { installedAt: daysAgo(365 - 10), warrantyMonths: 12 };
    const w = warrantyStatus(item, NOW);
    expect(w.state).toBe("ending");
    expect(warrantyLabel(item, NOW)).toMatch(/Warranty ends in \d+d/);
  });

  test("an expired warranty says so plainly", () => {
    const item = { installedAt: daysAgo(1000), warrantyMonths: 12 };
    expect(warrantyStatus(item, NOW).state).toBe("expired");
    expect(warrantyLabel(item, NOW)).toBe("Warranty expired");
  });

  test("no warranty recorded means no claim about one", () => {
    expect(warrantyStatus({ installedAt: daysAgo(30) }, NOW).state).toBe("none");
    expect(warrantyLabel({ installedAt: daysAgo(30) }, NOW)).toBeNull();
    expect(warrantyStatus({ warrantyMonths: 24 }, NOW).state).toBe("none");
  });

  test("month arithmetic doesn't drift on long warranties", () => {
    // 24 months from a January date must land in January, not 730 days later.
    const item = { installedAt: "2025-01-31", warrantyMonths: 24 };
    const end = new Date(warrantyStatus(item, NOW).endsAt);
    expect(end.getFullYear()).toBe(2027);
  });
});

describe("the build as a whole", () => {
  const items = [
    { id: "1", name: "Return pump", category: "flow", price: 250, installedAt: daysAgo(400), warrantyMonths: 24 },
    { id: "2", name: "Heater", category: "heating", price: 45, installedAt: daysAgo(30), warrantyMonths: 12 },
    { id: "3", name: "Skimmer", category: "filtration", installedAt: daysAgo(700) },
  ];

  test("totals only what's priced, and says how many that was", () => {
    // A half-filled record must not imply a complete total.
    const s = equipmentSummary(items, NOW);
    expect(s.spend).toBe(295);
    expect(s.priced).toBe(2);
    expect(s.count).toBe(3);
  });

  test("counts what's still covered and names the oldest item", () => {
    const s = equipmentSummary(items, NOW);
    expect(s.underWarranty).toBe(2);
    expect(s.oldest.name).toBe("Skimmer");
  });

  test("groups by category in a stable order", () => {
    const groups = byCategory(items);
    expect(groups.map((g) => g.category.id)).toEqual(["filtration", "heating", "flow"]);
    // Empty categories don't render as blank headings.
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
  });

  test("an empty rack summarises to zero rather than throwing", () => {
    const s = equipmentSummary([], NOW);
    expect(s.count).toBe(0);
    expect(s.spend).toBe(0);
    expect(s.oldest).toBeNull();
    expect(byCategory([])).toEqual([]);
  });
});
