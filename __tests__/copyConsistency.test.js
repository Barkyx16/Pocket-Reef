import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const FILES = [
  ...["components", "screens", "lib", "data"].flatMap((dir) =>
    fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".js")).map((f) => path.join(dir, f))),
  "App.js", "core.js",
];
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// Genuine prose the keeper reads, not identifiers, style objects or code.
function prose(src) {
  const out = [];
  for (const m of src.matchAll(/"([^"\\\n]{12,240})"|`([^`\\]{12,240})`/g)) {
    const t = m[1] || m[2];
    if (/[<>{}\\]|https?:|rgba?\(|: theme\.|fontSize|letterSpacing/.test(t)) continue;
    if (t.split(/\s+/).length < 4) continue;
    out.push([t, src.slice(0, m.index).split("\n").length]);
  }
  return out;
}

describe("the copy reads as one voice", () => {
  // The app defaults to gallons, °F, US dollars and calls the species list a
  // "catalog" seven times over. It is written for that reader — and then said
  // "dull colour", "rust-coloured film" and "jewel-coloured discs" in the
  // middle of it. Nobody is confused by either, but mixing them is the sort of
  // seam that makes an app feel assembled rather than written.
  const BRITISH = ["colour", "coloured", "colours", "behaviour", "behaviours", "catalogue",
                   "metre", "metres", "practise", "analyse", "analysed", "organise",
                   "recognise", "localise", "minimise", "stabilise", "normalise"];

  test("no British spelling survives in user-facing prose", () => {
    const found = [];
    for (const f of FILES) {
      const src = read(f);
      for (const [t, line] of prose(src)) {
        for (const w of BRITISH) {
          if (new RegExp(`\\b${w}\\b`, "i").test(t)) found.push(`${f}:${line} "${w}" — ${t.slice(0, 60)}`);
        }
      }
    }
    expect(found).toEqual([]);
  });

  test("and the American forms it settled on are actually there", () => {
    // Guards against the check passing because the walker found no prose.
    const all = FILES.map(read).join("\n");
    expect(/\bcatalog\b/.test(all)).toBe(true);
    expect(prose(FILES.map(read).join("\n")).length).toBeGreaterThan(500);
  });
});

describe("the copy is clean", () => {
  test("no doubled words", () => {
    const found = [];
    for (const f of FILES) {
      const src = read(f);
      for (const [t, line] of prose(src)) {
        const m = /\b(\w+)\s+\1\b/i.exec(t);
        if (m) found.push(`${f}:${line} "${m[0]}"`);
      }
    }
    expect(found).toEqual([]);
  });

  test("no double spaces mid-sentence", () => {
    const found = [];
    for (const f of FILES) {
      const src = read(f);
      for (const [t, line] of prose(src)) {
        if (/[a-z],?  +[a-z]/.test(t)) found.push(`${f}:${line} ${t.slice(0, 50)}`);
      }
    }
    expect(found).toEqual([]);
  });

  test("no straight apostrophes where a curly one is used elsewhere", () => {
    // Mixed ' and ’ in the same interface is the same seam as mixed spelling.
    const all = FILES.map(read).join("\n");
    const curly = (all.match(/[a-z]’[a-z]/gi) || []).length;
    const straight = (all.match(/[a-z]'[a-z]/gi) || []).length;
    // One convention should clearly dominate; a near-even split means neither
    // was chosen. This app uses straight apostrophes throughout.
    expect(Math.min(curly, straight)).toBeLessThan(Math.max(curly, straight) * 0.1);
  });
});
