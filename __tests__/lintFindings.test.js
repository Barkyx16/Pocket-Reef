jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Three bugs the linter found on its first run, pinned so they can't come back.
// None of them were reachable by the existing suite, and none of them were
// style: a crash, a miscount, and a dead mapping.
const renderer = require("react-test-renderer");
const { ACHIEVEMENTS } = require("../data/achievements");
const { iconForEmoji } = require("../lib/icons");
const { PhotoGalleryCard } = require("../components/PhotoGalleryCard");

describe("achievements array has no holes", () => {
  // A stray double comma left a sparse array: length said 97, but only 96
  // entries existed. forEach, map and filter all skip holes, so every existing
  // test passed while the app showed a total nobody could ever reach.
  test("length matches the number of real entries", () => {
    let real = 0;
    for (let i = 0; i < ACHIEVEMENTS.length; i++) if (i in ACHIEVEMENTS) real += 1;
    expect(real).toBe(ACHIEVEMENTS.length);
  });

  test("100% completion is arithmetically reachable", () => {
    // The thing the miscount actually broke.
    const earnable = ACHIEVEMENTS.filter((a) => a && typeof a.check === "function").length;
    expect(earnable).toBe(ACHIEVEMENTS.length);
  });

  test("every achievement is well-formed and uniquely identified", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ACHIEVEMENTS) {
      expect(typeof a.id).toBe("string");
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.desc.length).toBeGreaterThan(0);
    }
  });
});

describe("icon map has no shadowed entries", () => {
  test("a duplicated key can't silently drop a mapping", () => {
    // '⏱️' was listed twice. The second won, so whichever mapping was written
    // first was dead code — and would stay dead through any later edit to it.
    const src = require("fs").readFileSync(require.resolve("../lib/icons.js"), "utf8");
    const keys = [...src.matchAll(/^\s*"([^"]+)":\s*"[a-z-]+",/gm)].map((m) => m[1]);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(dupes).toEqual([]);
  });

  test("the mapping it shadowed still resolves", () => {
    expect(iconForEmoji("⏱️")).toBe("stopwatch-outline");
  });
});

describe("PhotoGalleryCard hook order", () => {
  // The real crash: useWindowDimensions sat below the empty-state early return,
  // so the component called one hook when it had photos and zero when it
  // didn't. Rendering it empty and then adding the first photo — the exact
  // thing a new user does — changed the hook count between two renders of the
  // same component instance.
  const withPhoto = [{ id: 1, date: "2026-08-08", text: "First coral", photo: "file:///a.jpg" }];

  // React 19 does not throw on this particular violation — it reports
  // "Internal React error: Expected static flag was missing" through
  // console.error and carries on with a corrupted hook record. So asserting
  // "doesn't throw" would have passed against the broken version, and did.
  // The console is the only place the damage surfaces, so that's what's
  // asserted.
  function transitionsCleanly(from, to) {
    const errors = [];
    const spy = jest.spyOn(console, "error").mockImplementation((...args) => errors.push(String(args[0])));
    let tree;
    try {
      renderer.act(() => { tree = renderer.create(<PhotoGalleryCard journal={from} />); });
      renderer.act(() => { tree.update(<PhotoGalleryCard journal={to} />); });
      renderer.act(() => { tree.unmount(); });
    } finally {
      spy.mockRestore();
    }
    return errors;
  }

  test("going from empty to populated in place reports no React error", () => {
    // The exact thing a new user does: open the gallery, then add a first photo.
    expect(transitionsCleanly([], withPhoto)).toEqual([]);
  });

  test("going from populated back to empty reports no React error", () => {
    expect(transitionsCleanly(withPhoto, [])).toEqual([]);
  });

  test("entries without a photo don't count toward the grid", () => {
    let tree;
    const mixed = [...withPhoto, { id: 2, date: "2026-08-09", text: "No photo", photo: null }];
    renderer.act(() => { tree = renderer.create(<PhotoGalleryCard journal={mixed} />); });
    const { Text } = require("react-native");
    const text = tree.root.findAllByType(Text).map((n) => JSON.stringify(n.props.children)).join(" ");
    expect(text).toContain("1");
    renderer.act(() => { tree.unmount(); });
  });
});
