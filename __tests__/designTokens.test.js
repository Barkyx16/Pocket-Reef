const fs = require("fs");
const path = require("path");
const { theme } = require("../styles");

// One colour per meaning.
//
// theme.danger is #ff7b7b. Cards written later used #ff6b6b — a different red
// for the same thing, eight times over, so "danger" rendered differently
// depending on which file you happened to be looking at. Same story for warn:
// #ffd372 in the theme, #ffd86b in the components.
//
// Nothing catches that by eye across a hundred components, and no render test
// asserts a hex. So it's checked here.

const root = path.join(__dirname, "..");
const files = ["components", "screens"].flatMap((dir) =>
  fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(".js")).map((f) => path.join(dir, f))
);

// These render when something has already thrown, and what threw may be the
// design system itself — importing `theme` to draw the apology would risk the
// apology throwing too.
const EXEMPT = new Set(["components/ErrorBoundary.js", "components/CardBoundary.js"]);

const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

describe("colours come from the theme", () => {
  test("no component reimplements a token's value as a literal", () => {
    const tokens = Object.entries(theme).filter(([, v]) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v));
    const offenders = [];
    files.forEach((f) => {
      if (EXEMPT.has(f)) return;
      const src = read(f);
      tokens.forEach(([name, hex]) => {
        // A bare literal in a style position, not inside an rgba() or a
        // gradient stop where an alpha variant is legitimately different.
        if (new RegExp(`["']${hex}["']`, "i").test(src)) offenders.push(`${f} uses ${hex} instead of theme.${name}`);
      });
    });
    expect(offenders).toEqual([]);
  });

  test("no two tokens share a value under different names", () => {
    const seen = new Map();
    const clashes = [];
    Object.entries(theme).forEach(([name, v]) => {
      if (typeof v !== "string" || !/^#[0-9a-f]{6}$/i.test(v)) return;
      const key = v.toLowerCase();
      if (seen.has(key)) clashes.push(`${name} and ${seen.get(key)} are both ${v}`);
      else seen.set(key, name);
    });
    expect(clashes).toEqual([]);
  });

  test("the tokens the app leans on all exist", () => {
    ["accent", "danger", "warn", "text", "bodyText", "secondaryText", "border", "well", "onAccent", "muted"]
      .forEach((k) => {
        expect(typeof theme[k]).toBe("string");
        expect(theme[k].length).toBeGreaterThan(3);
      });
  });

  test("the exempt files really are the boundaries, and say why", () => {
    // An exemption list that quietly grows is how the drift comes back.
    EXEMPT.forEach((f) => {
      expect(read(f)).toMatch(/inlined on purpose|design-system colours are inlined/i);
    });
    expect(EXEMPT.size).toBe(2);
  });
});
