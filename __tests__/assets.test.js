const fs = require("fs");
const path = require("path");

// Images on disk versus images the app asks for.
//
// Three species images were typo'd duplicates — croceaa-clam.png next to
// crocea-clam.png — sitting in the repo referenced by nothing, plus a .DS_Store
// that had been committed into the assets folder. Metro only bundles what's
// required, so none of it shipped; it was repo weight and confusion rather than
// app weight, and the reverse mistake is the dangerous one: a map entry
// pointing at a file that isn't there is a crash on the species detail screen.

const root = path.join(__dirname, "..");
const speciesDir = path.join(root, "assets", "species");
const map = fs.readFileSync(path.join(root, "data", "speciesImageMap.js"), "utf8");

const referenced = [...map.matchAll(/species\/([a-z0-9-]+\.png)/g)].map((m) => m[1]);
const onDisk = fs.readdirSync(speciesDir).filter((f) => f.endsWith(".png"));

describe("species artwork", () => {
  test("every image the map points at exists on disk", () => {
    // The dangerous direction: a missing file is a crash, not dead weight.
    const missing = referenced.filter((f) => !onDisk.includes(f));
    expect(missing).toEqual([]);
  });

  test("every image on disk is referenced by the map", () => {
    const orphans = onDisk.filter((f) => !referenced.includes(f));
    expect(orphans).toEqual([]);
  });

  test("the map covers the whole catalog", () => {
    const { SPECIES } = require("../core");
    expect(referenced.length).toBe(SPECIES.length);
  });

  test("no finder metadata is committed into assets", () => {
    const junk = [];
    const walk = (dir) => {
      fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
        if (e.name === ".DS_Store" || e.name === "Thumbs.db") junk.push(path.join(dir, e.name));
        else if (e.isDirectory()) walk(path.join(dir, e.name));
      });
    };
    walk(path.join(root, "assets"));
    expect(junk).toEqual([]);
  });

  test("the disease and banner maps hold up too", () => {
    // Same contract, smaller sets — checked so the next artwork addition can't
    // half-land in only one of the three maps.
    [["diseases", "data/diseaseImageMap.js"], ["banners", "data/bannerImageMap.js"]].forEach(([dirName, mapFile]) => {
      const dir = path.join(root, "assets", dirName);
      if (!fs.existsSync(dir)) return;
      const src = fs.readFileSync(path.join(root, mapFile), "utf8");
      const refs = [...src.matchAll(/([a-z0-9-]+\.(?:png|jpg))/g)].map((m) => m[1]);
      const disk = fs.readdirSync(dir).filter((f) => /\.(png|jpg)$/.test(f));
      expect(refs.filter((f) => !disk.includes(f))).toEqual([]);
      expect(disk.filter((f) => !refs.includes(f))).toEqual([]);
      expect(refs.length).toBeGreaterThan(0);
    });
  });

  test(".gitignore keeps it out in future", () => {
    expect(fs.readFileSync(path.join(root, ".gitignore"), "utf8")).toMatch(/^\.DS_Store$/m);
  });
});
