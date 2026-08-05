import { matchesQuery, scoreMatch, normalize, buildHaystack } from "../lib/search";
import SPECIES from "../data/speciesData";

// The old search was a raw substring match, which failed silently on the way
// people actually type. An empty result for a fish the app definitely has reads
// as a missing species, not a missed match — so these pin the real queries.

const find = (name) => SPECIES.find((s) => s.name === name);
const search = (q) => SPECIES.filter((s) => matchesQuery(s, q)).map((s) => s.name);
const top = (q) =>
  SPECIES.filter((s) => matchesQuery(s, q))
    .sort((a, b) => scoreMatch(b, q) - scoreMatch(a, q) || a.name.localeCompare(b.name))[0];

describe("normalization", () => {
  test("case, punctuation and spacing don't matter", () => {
    expect(normalize("  Endler's  Livebearer ")).toBe("endlers livebearer");
    expect(normalize("X-ray Tetra")).toBe("xray tetra");
  });

  test("a trailing space no longer kills the query", () => {
    expect(search("neon tetra ")).toContain("Neon Tetra");
  });
});

describe("finds what people type", () => {
  test("'clown fish' as two words finds the clownfish", () => {
    expect(search("clown fish").some((n) => n.includes("Clownfish"))).toBe(true);
  });

  test("'cory' and 'corydoras' both find the corys", () => {
    expect(search("cory").some((n) => n.includes("Cory"))).toBe(true);
    expect(search("corydoras").some((n) => n.includes("Cory"))).toBe(true);
  });

  test("'oto' and 'otto' find Otocinclus", () => {
    expect(search("oto")).toContain("Otocinclus");
    expect(search("otto")).toContain("Otocinclus");
  });

  test("'plec' and 'plecostomus' find plecos", () => {
    expect(search("plec").some((n) => n.includes("Pleco"))).toBe(true);
    expect(search("plecostomus").some((n) => n.includes("Pleco"))).toBe(true);
  });

  test("nicknames work — nemo and dory", () => {
    expect(search("nemo").some((n) => n.includes("Clownfish"))).toBe(true);
    expect(search("dory")).toContain("Blue Tang");
  });

  test("reef shorthand works — sps, lps, zoas, cuc", () => {
    expect(search("sps")).toContain("Acropora");
    expect(search("lps").some((n) => /Frogspawn|Hammer|Torch/.test(n))).toBe(true);
    expect(search("zoas").some((n) => /Zoanthid/.test(n))).toBe(true);
    expect(search("cuc").length).toBeGreaterThan(0);
  });

  test("plurals resolve", () => {
    expect(search("tetras").some((n) => n.includes("Tetra"))).toBe(true);
    expect(search("snails").some((n) => n.includes("Snail"))).toBe(true);
  });
});

describe("typo tolerance", () => {
  test("one-character slips still match", () => {
    expect(search("clownfsh").some((n) => n.includes("Clownfish"))).toBe(true);
    expect(search("acropra")).toContain("Acropora");
  });

  test("short queries are NOT fuzzed — that would match everything", () => {
    // "ram" must not fuzz into "ray"/"raw"/etc. It should stay precise.
    const results = search("ram");
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThan(SPECIES.length / 2);
  });
});

describe("all tokens must match", () => {
  test("multi-word queries narrow rather than widen", () => {
    const both = search("peaceful tetra");
    const justPeaceful = search("peaceful");
    expect(both.length).toBeLessThan(justPeaceful.length);
    both.forEach((n) => {
      const s = find(n);
      expect(s.temperament === "peaceful" || /tetra/i.test(s.summary) || /Tetra/.test(n)).toBe(true);
    });
  });
});

describe("ranking", () => {
  test("an exact name comes first", () => {
    expect(top("Neon Tetra").name).toBe("Neon Tetra");
    expect(top("Discus").name).toBe("Discus");
  });

  test("a name prefix beats a description mention", () => {
    expect(top("neon").name.startsWith("Neon")).toBe(true);
  });
});

describe("safety", () => {
  test("an empty query matches everything", () => {
    expect(search("").length).toBe(SPECIES.length);
  });

  test("nonsense matches nothing rather than throwing", () => {
    expect(() => search("qqqzzzxxx")).not.toThrow();
    expect(search("qqqzzzxxx")).toEqual([]);
  });

  test("haystacks build for every species without throwing", () => {
    expect(() => SPECIES.forEach(buildHaystack)).not.toThrow();
  });
});
