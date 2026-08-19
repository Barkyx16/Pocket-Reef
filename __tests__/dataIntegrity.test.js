// The static data the whole app is built on.
//
// None of this is reachable by a render test: a duplicate achievement title
// renders perfectly, a species missing a field only breaks the one screen that
// reads it, and an asymmetric compatibility verdict is only visible if you
// happen to look up the same pair in both directions.

const { SPECIES, DISEASES, ACHIEVEMENTS, getCompatibility, getSpecies } = require("../core");

describe("the species catalog", () => {
  test("every name is unique — it's the key everything else joins on", () => {
    const names = SPECIES.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test("every entry carries the fields the app reads", () => {
    const REQUIRED = ["name", "kind", "water", "emoji", "minGallons", "tempMinF", "tempMaxF",
      "phMin", "phMax", "temperament", "careLevel", "diet", "adultInches", "summary"];
    const incomplete = SPECIES.filter((s) => REQUIRED.some((k) => s[k] === undefined || s[k] === null || s[k] === ""));
    expect(incomplete.map((s) => s.name)).toEqual([]);
  });

  test("no range is inverted", () => {
    // A min above a max grades every reading as out of range, silently.
    const bad = SPECIES.filter((s) => s.tempMinF >= s.tempMaxF || s.phMin >= s.phMax);
    expect(bad.map((s) => s.name)).toEqual([]);
  });

  test("kinds and water types are from the known set", () => {
    SPECIES.forEach((s) => {
      expect(["fish", "invert", "coral"]).toContain(s.kind);
      expect(["fresh", "salt"]).toContain(s.water);
    });
  });

  test("every summary is distinct — the catalog's whole claim", () => {
    const sums = SPECIES.map((s) => s.summary);
    expect(new Set(sums).size).toBe(sums.length);
  });
});

describe("compatibility", () => {
  test("reads the same in both directions", () => {
    // The verdict must not depend on which fish you tapped first. Sampled
    // rather than exhaustive: 316² is 100k pairs and this runs on every commit.
    const asymmetric = [];
    for (let i = 0; i < SPECIES.length; i += 3) {
      for (let j = i + 1; j < SPECIES.length; j += 5) {
        const a = SPECIES[i].name;
        const b = SPECIES[j].name;
        if (getCompatibility(a, b).level !== getCompatibility(b, a).level) asymmetric.push(`${a} / ${b}`);
      }
    }
    expect(asymmetric.slice(0, 5)).toEqual([]);
  });

  test("every verdict carries a reason a keeper can act on", () => {
    for (let i = 0; i < SPECIES.length; i += 17) {
      for (let j = i + 1; j < SPECIES.length; j += 23) {
        const c = getCompatibility(SPECIES[i].name, SPECIES[j].name);
        expect(["excellent", "caution", "avoid"]).toContain(c.level);
        expect(typeof c.reason).toBe("string");
        expect(c.reason.length).toBeGreaterThan(10);
      }
    }
  });
});

describe("achievements", () => {
  test("ids are unique", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("titles are unique too", () => {
    // Two rows reading "On a Roll" in a list of 107 is a scoreboard nobody can
    // read: you can't tell which you just earned, and the locked one gives no
    // hint what to do about it.
    // Compared case- and space-insensitively. The exact-match version of this
    // test passed while "By the Book" and "By The Book" sat in the same list,
    // one capital letter apart — indistinguishable on screen, and the whole
    // point of the check.
    const norm = (t) => String(t).toLowerCase().replace(/\s+/g, " ").trim();
    const titles = ACHIEVEMENTS.map((a) => norm(a.title));
    const dupes = titles.filter((t, i) => titles.indexOf(t) !== i);
    expect([...new Set(dupes)]).toEqual([]);
  });

  test("descriptions are unique too, for the same reason", () => {
    // A title tells you which one it is; the description tells you what to do.
    // Two identical descriptions is the same unreadable scoreboard one row down.
    const norm = (t) => String(t).toLowerCase().replace(/\s+/g, " ").trim();
    const descs = ACHIEVEMENTS.map((a) => norm(a.desc));
    const dupes = descs.filter((t, i) => descs.indexOf(t) !== i);
    expect([...new Set(dupes)]).toEqual([]);
  });

  test("each has a check, an emoji and a description", () => {
    ACHIEVEMENTS.forEach((a) => {
      expect(typeof a.check).toBe("function");
      expect(a.emoji.length).toBeGreaterThan(0);
      expect(a.desc.length).toBeGreaterThan(8);
    });
  });

  test("none throws on an empty account", () => {
    // The state every user is in on day one.
    ACHIEVEMENTS.forEach((a) => expect(() => a.check({})).not.toThrow());
  });
});

describe("disease guides", () => {
  test("every species a guide names actually exists in the catalog", () => {
    const bad = [];
    DISEASES.forEach((d) => (d.species || []).forEach((n) => { if (!getSpecies(n)) bad.push(`${d.name} → ${n}`); }));
    expect(bad).toEqual([]);
  });

  test("each guide carries the parts the detail screen renders", () => {
    DISEASES.forEach((d) => {
      expect(d.name.length).toBeGreaterThan(0);
      expect(d.description.length).toBeGreaterThan(10);
      expect(Array.isArray(d.symptoms)).toBe(true);
    });
  });
});
