const fs = require("fs");
const path = require("path");
const glob = { count: (dir, ext) => fs.readdirSync(path.join(__dirname, "..", dir)).filter((f) => f.endsWith(ext)).length };

// The README is a claim about the product, and claims drift.
//
// It advertised 96 achievements when there were 107 and 61 components when
// there were 98 — both because I added things and never went back. Numbers
// nobody checks are numbers that quietly become false, and a feature table is
// the first thing anyone reads.
//
// This pins the ones that are mechanically checkable, so the next person to add
// an achievement is told to update the table rather than discovering months
// later that it lies.

const README = fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8");
const { SPECIES, ACHIEVEMENTS, DISEASES, TROUBLESHOOTING, TIPS } = require("../core");

// Pulls the number out of a table row like "| **Achievements** | 107 |".
function claimed(label) {
  const row = README.split("\n").find((l) => l.includes(`**${label}**`));
  expect(row).toBeTruthy();
  const m = row.replace(`**${label}**`, "").match(/(\d[\d,]*)/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

describe("the feature table is true", () => {
  test("species catalog", () => {
    expect(claimed("Species catalog")).toBe(SPECIES.length);
    const row = README.split("\n").find((l) => l.includes("**Species catalog**"));
    expect(row).toContain(`${SPECIES.filter((s) => s.water === "fresh").length} freshwater`);
    expect(row).toContain(`${SPECIES.filter((s) => s.water === "salt").length} saltwater`);
  });

  test("by kind", () => {
    const row = README.split("\n").find((l) => l.includes("**By kind**"));
    ["fish", "invert", "coral"].forEach((k) => {
      expect(row).toContain(String(SPECIES.filter((s) => s.kind === k).length));
    });
  });

  test("achievements", () => {
    expect(claimed("Achievements")).toBe(ACHIEVEMENTS.length);
  });

  test("disease guides and emergency flows", () => {
    expect(claimed("Disease guides")).toBe(DISEASES.length);
    expect(claimed("Emergency scenarios")).toBe(TROUBLESHOOTING.length);
  });

  test("daily tips", () => {
    expect(claimed("Daily tips")).toBe(TIPS.length);
  });

  test("app surface", () => {
    const row = README.split("\n").find((l) => l.includes("**App surface**"));
    expect(row).toContain(`${glob.count("screens", ".js")} screens`);
    expect(row).toContain(`${glob.count("components", ".js")} components`);
  });
});

describe("it doesn't overstate what isn't there", () => {
  test("the language row is honest about Spanish coverage", () => {
    const row = README.split("\n").find((l) => l.includes("**Languages**"));
    // The bare claim "English, Spanish" was false: the locale files cover the
    // tab bar and six headers, and everything else is hardcoded English.
    expect(row).not.toMatch(/^\|\s*\*\*Languages\*\*\s*\|\s*English,\s*Spanish\s*\|/);
    expect(README).toMatch(/### Localisation/);
  });

  test("and the claim matches the actual locale size", () => {
    // If somebody genuinely translates the app, this test should fail and be
    // deleted — that's the point of it.
    const en = fs.readFileSync(path.join(__dirname, "..", "lib", "locales", "en.js"), "utf8");
    const keys = (en.match(/^\s{4}\w+:/gm) || []).length;
    expect(keys).toBeLessThan(60);
  });

  test("no stale doc claims images are missing when they're bundled", () => {
    const needed = path.join(__dirname, "..", "SPECIES_IMAGES_NEEDED.md");
    if (!fs.existsSync(needed)) return;
    const bundled = fs.readdirSync(path.join(__dirname, "..", "assets", "species")).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).length;
    // The file lists images to source. If they're all bundled it's misleading.
    if (bundled >= SPECIES.length) {
      expect(fs.readFileSync(needed, "utf8")).toMatch(/complete|done|no longer needed|all bundled/i);
    }
  });
});
