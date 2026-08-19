jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import fs from "fs";
import path from "path";
import renderer from "react-test-renderer";
import React from "react";
import { type, space, radius, elevation, theme } from "../styles";

const ROOT = path.join(__dirname, "..");
const SCALES = { type, space, radius, elevation, theme };
const FILES = ["components", "screens"].flatMap((dir) =>
  fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".js")).map((f) => path.join(dir, f)));
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

describe("every token reference resolves to something", () => {
  // The design system is now ~1,650 spacing values, ~900 font sizes and ~900
  // tracking values deep, nearly all of it applied by automated transforms.
  // The failure mode that creates is silent: `fontSize: undefined` does not
  // throw, it quietly falls back to the platform default, and nothing in a
  // test suite notices a heading rendering at the wrong size.

  test("no reference names a key its scale does not have", () => {
    const bad = [];
    for (const f of [...FILES, "styles.js", "App.js"]) {
      const src = read(f);
      // Bare identifier only: `t.type.displayName` on a React element is not a
      // reference to the type scale, and a file that never imports a scale
      // cannot be referencing it.
      for (const m of src.matchAll(/(^|[^.\w])(type|space|radius|elevation|theme)\.([a-zA-Z]\w*)/g)) {
        const [, , obj, prop] = m;
        if (prop in SCALES[obj]) continue;
        if (!new RegExp(`import \\{[^}]*\\b${obj}\\b[^}]*\\} from "(\\.\\./)?styles"`).test(src)) continue;
        bad.push(`${f}:${src.slice(0, m.index).split("\n").length} ${obj}.${prop}`);
      }
    }
    expect(bad).toEqual([]);
  });

  test("nothing shadows a scale it also imports", () => {
    // GamesTab did: `const type = rand(kinds)` inside a helper, in a file that
    // imports the type scale. `type.bodyLg` then read a property off the string
    // "water" and came out undefined, so the trivia question rendered at the
    // platform default instead of 15pt. It threw nothing and no test failed.
    const bad = [];
    for (const f of FILES) {
      const src = read(f);
      for (const name of Object.keys(SCALES)) {
        if (!new RegExp(`import \\{[^}]*\\b${name}\\b[^}]*\\} from "\\.\\./styles"`).test(src)) continue;
        for (const m of src.matchAll(new RegExp(`\\b(?:const|let|var)\\s+${name}\\b`, "g"))) {
          bad.push(`${f}:${src.slice(0, m.index).split("\n").length} shadows ${name}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("nothing renders with an undefined measurement", () => {
  const NUMERIC = /^(fontSize|lineHeight|letterSpacing|borderRadius|padding|margin|gap|width|height|top|left|right|bottom|borderWidth|shadowRadius|shadowOpacity|elevation|minHeight|maxWidth|rowGap|columnGap)/;

  function scan(node, out, where) {
    if (!node || typeof node !== "object") return;
    const flat = (s) => {
      if (Array.isArray(s)) return s.forEach(flat);
      if (!s || typeof s !== "object") return;
      for (const [k, v] of Object.entries(s)) {
        if (!NUMERIC.test(k)) continue;
        if (v === undefined || (typeof v === "number" && Number.isNaN(v))) out.push(`${where} ${k}=${v}`);
      }
    };
    flat(node.props && node.props.style);
    (node.children || []).forEach((c) => scan(c, out, where));
  }

  const blank = () => ({ id: "t1", name: "T", gallons: 40, water: "salt", stock: [], quantities: {},
    waterTests: [], waterChanges: [], journal: [], losses: [], equipment: [], inventory: [], doses: [],
    feedings: [], costs: [], maintenance: {}, upkeep: [], observations: {}, stockMeta: {} });

  test("every component that mounts has fully resolved styles", () => {
    const bad = [];
    let mounted = 0;
    for (const f of FILES) {
      let mod;
      try { mod = require(path.join(ROOT, f)); } catch (e) { continue; }
      for (const [name, C] of Object.entries(mod)) {
        if (typeof C !== "function" || !/^[A-Z]/.test(name)) continue;
        const tank = blank();
        try {
          let t;
          renderer.act(() => {
            t = renderer.create(React.createElement(C, {
              tank, tanks: [tank], activeTank: tank, visible: true, species: [], steps: [],
              onChange: () => {}, onClose: () => {}, onSave: () => {}, waterType: "salt",
            }));
          });
          mounted++;
          scan(t.toJSON(), bad, `${f}:${name}`);
          renderer.act(() => t.unmount());
        } catch (e) { /* a prop-shape mismatch is the harness, not the app */ }
      }
    }
    // Guard against the walker silently mounting nothing and passing forever.
    expect(mounted).toBeGreaterThan(40);
    expect([...new Set(bad)]).toEqual([]);
  });
});
