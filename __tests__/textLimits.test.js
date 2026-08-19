jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import fs from "fs";
import path from "path";
import { TEXT_LIMITS, limitText } from "../lib/textLimits";

const ROOT = path.join(__dirname, "..");
const files = ["components", "screens"].flatMap((dir) =>
  fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".js")).map((f) => path.join(dir, f))
);

// Pulls the opening tag of every <TextInput …/> out of a source file.
function textInputTags(src) {
  const out = [];
  for (const m of src.matchAll(/<TextInput\b/g)) {
    let i = m.index + m[0].length;
    let depth = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === "/" && depth === 0 && src[i + 1] === ">") break;
      i++;
    }
    out.push({ tag: src.slice(m.index, i), line: src.slice(0, m.index).split("\n").length });
  }
  return out;
}

describe("every typed field has a ceiling", () => {
  // Everything typed in this app lands in one per-profile object that is
  // serialised to storage on every keystroke-batch and pushed to Supabase as a
  // single JSON blob. An uncapped paste doesn't just make one note long — it
  // slows every subsequent save and can push the synced row past the request
  // limit, at which point sync fails for the whole profile.
  const offenders = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    for (const { tag, line } of textInputTags(src)) {
      if (!/maxLength=/.test(tag)) offenders.push(`${f}:${line}`);
    }
  }

  test("no TextInput is unbounded", () => {
    expect(offenders).toEqual([]);
  });

  test("there are actually inputs being checked", () => {
    // Guards against the walker silently matching nothing and the suite going
    // green because it tested an empty list.
    const total = files.reduce(
      (n, f) => n + textInputTags(fs.readFileSync(path.join(ROOT, f), "utf8")).length, 0);
    expect(total).toBeGreaterThan(50);
  });

  test("limits come from the shared table, not inline numbers", () => {
    // An inline maxLength={40} is a limit nobody can find or reason about.
    const inline = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      for (const { tag, line } of textInputTags(src)) {
        const m = /maxLength=\{(\d+)\}/.exec(tag);
        // OtpCodeInput derives its length from the number of cells it draws,
        // which is the one place the limit and the layout must stay identical.
        if (m && !f.includes("OtpCodeInput")) inline.push(`${f}:${line} maxLength={${m[1]}}`);
      }
    }
    expect(inline).toEqual([]);
  });
});

describe("the limits themselves are sane", () => {
  test("every limit is a positive integer", () => {
    for (const [_k, v] of Object.entries(TEXT_LIMITS)) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
  });

  test("long-form fields are generous enough that nobody meets them", () => {
    // 4000 characters is roughly two pages about a tank. If a keeper hits this
    // writing in good faith the limit is wrong, not the keeper.
    expect(TEXT_LIMITS.note).toBeGreaterThanOrEqual(2000);
    expect(TEXT_LIMITS.name).toBeGreaterThanOrEqual(40);
  });

  test("the email limit matches the spec rather than a guess", () => {
    expect(TEXT_LIMITS.email).toBe(254);
  });

  test("every limit named in a component exists in the table", () => {
    const used = new Set();
    for (const f of files) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      for (const m of src.matchAll(/TEXT_LIMITS\.(\w+)/g)) used.add(m[1]);
    }
    expect([...used].filter((k) => !(k in TEXT_LIMITS))).toEqual([]);
    expect(used.size).toBeGreaterThan(5);
  });
});

describe("lib/ uses the same table the components do", () => {
  // The limits table covered components and nothing else, so lib/ kept its own
  // hardcoded slices — an equipment name capped at 60 in one place and a
  // model at 40 in another, with no way to tell which was deliberate. Two
  // sources of truth for one rule is the same defect as none.
  const libFiles = fs.readdirSync(path.join(ROOT, "lib"))
    .filter((f) => f.endsWith(".js")).map((f) => path.join("lib", f));

  test("no record builder truncates text with a bare slice", () => {
    const offenders = [];
    for (const f of libFiles) {
      if (f.endsWith("textLimits.js")) continue; // where the limits live
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      for (const m of src.matchAll(/\.trim\(\)\.slice\(0, *(\d+)\)|(?<=name|notes|text|body|label): *[\w.]+\.slice\(0, *(\d+)\)/g)) {
        offenders.push(`${f}:${src.slice(0, m.index).split("\n").length} ${m[0].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("the files that build records import the table", () => {
    // Named explicitly: these are the builders that persist keeper-typed text.
    for (const f of ["lib/equipment.js", "lib/inventory.js", "lib/observations.js"]) {
      expect(fs.readFileSync(path.join(ROOT, f), "utf8")).toContain("TEXT_LIMITS");
    }
  });
});

describe("limitText bounds what arrives from outside a TextInput", () => {
  // A CSV import, a restored backup, or a profile synced from an older build
  // never passes through a capped field.
  test("trims past the limit and leaves shorter values alone", () => {
    expect(limitText("abcdef", 3)).toBe("abc");
    expect(limitText("ab", 10)).toBe("ab");
    expect(limitText("", 10)).toBe("");
  });

  test("passes null and undefined through rather than stringifying them", () => {
    // "null" stored as a tank name would be worse than an absent one.
    expect(limitText(null, 10)).toBe(null);
    expect(limitText(undefined, 10)).toBe(undefined);
  });

  test("coerces non-strings rather than throwing", () => {
    expect(limitText(12345, 3)).toBe("123");
  });

  test("a nonsense limit leaves the value intact", () => {
    expect(limitText("abcdef", 0)).toBe("abcdef");
    expect(limitText("abcdef", NaN)).toBe("abcdef");
  });
});

describe("text arriving from outside a capped field is bounded on the way in", () => {
  // A pasted JSON import, a profile synced from a build that predates these
  // limits, or a restored backup never touches a TextInput. ensureTankShape is
  // the one gate all of them pass through.
  const { ensureTankShape } = require("../lib/migrations");

  test("an oversized tank name is trimmed on load", () => {
    const t = ensureTankShape({ id: "t1", name: "x".repeat(5000) });
    expect(t.name.length).toBe(TEXT_LIMITS.name);
  });

  test("oversized notes are trimmed on load", () => {
    const t = ensureTankShape({ id: "t1", notes: "y".repeat(50000) });
    expect(t.notes.length).toBe(TEXT_LIMITS.note);
  });

  test("an oversized journal entry is trimmed without losing the entry", () => {
    const t = ensureTankShape({
      id: "t1",
      journal: [{ id: "j1", date: "2026-01-01", mood: "🐠", text: "z".repeat(90000) }],
    });
    expect(t.journal).toHaveLength(1);
    expect(t.journal[0].text.length).toBe(TEXT_LIMITS.note);
    // Trimming the text must not drop the rest of the record.
    expect(t.journal[0].mood).toBe("🐠");
    expect(t.journal[0].date).toBe("2026-01-01");
  });

  test("normal-sized text is untouched", () => {
    const t = ensureTankShape({ id: "t1", name: "Living Room Reef", notes: "40 gallon mixed reef" });
    expect(t.name).toBe("Living Room Reef");
    expect(t.notes).toBe("40 gallon mixed reef");
  });

  test("absent and malformed text does not throw", () => {
    expect(() => ensureTankShape({ id: "t1" })).not.toThrow();
    expect(() => ensureTankShape({ id: "t1", journal: [null, 5, "x"] })).not.toThrow();
  });
});

describe("truncation lands on a character boundary, not a code unit", () => {
  // String.length counts UTF-16 code units. An emoji is two of them, and a cut
  // between the halves leaves a lone surrogate that renders as "�".
  const fish = "tank " + "🐠".repeat(5);

  test("never leaves a dangling surrogate", () => {
    for (let n = 1; n <= fish.length + 2; n++) {
      const cut = limitText(fish, n);
      expect(cut).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/); // high with no low
      expect(cut).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/); // low with no high
      expect(cut).not.toContain("�");
    }
  });

  test("retreats to before the emoji rather than splitting it", () => {
    expect(limitText(fish, 6)).toBe("tank ");
    expect(limitText(fish, 7)).toBe("tank 🐠");
  });

  test("never returns more than the limit", () => {
    for (let n = 1; n <= fish.length; n++) {
      expect(limitText(fish, n).length).toBeLessThanOrEqual(n);
    }
  });

  test("does not end on a zero-width joiner or variation selector", () => {
    // A trailing joiner is a promise of a character that got cut off.
    const family = "ab👩‍👩‍👧‍👦cd";
    for (let n = 1; n <= family.length; n++) {
      const cut = limitText(family, n);
      // Written as escapes rather than the literal characters, which are
      // invisible in a source file and impossible to review.
      // eslint-disable-next-line no-misleading-character-class -- see above
      expect(cut).not.toMatch(/[\u200D\uFE00-\uFE0F]$/);
    }
  });

  test("plain text is unaffected by any of this", () => {
    expect(limitText("abcdef", 3)).toBe("abc");
    expect(limitText("hello world", 5)).toBe("hello");
  });
});
