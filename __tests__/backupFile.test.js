import fs from "fs";
import path from "path";
import { serialise, backupFilename, humanSize, byteLength, writeBackupFile } from "../lib/backupFile";

const ROOT = path.join(__dirname, "..");

describe("the size shown to the keeper is the size of the file", () => {
  // `bytes: text.length` counts UTF-16 code units, not bytes. This app's data
  // is full of emoji — tank names, journal moods, species icons — so the number
  // reported was always smaller than the file actually on disk. Not fatal, but
  // it is the one number the export screen states as fact.
  test("emoji count as the bytes they occupy", () => {
    expect("🐠".length).toBe(2);        // two UTF-16 units
    expect(byteLength("🐠")).toBe(4);   // four UTF-8 bytes
  });

  test("plain ASCII is unchanged", () => {
    expect(byteLength("hello")).toBe(5);
    expect(byteLength("")).toBe(0);
  });

  test("accents and non-Latin scripts count correctly", () => {
    expect(byteLength("é")).toBe(2);
    expect(byteLength("日")).toBe(3);
  });

  test("a realistic payload measures larger than its string length", () => {
    const text = serialise({ tanks: [{ name: "Living Room Reef 🐠🪸", journal: [{ mood: "🐠" }] }] });
    expect(byteLength(text)).toBeGreaterThan(text.length);
  });

  test("nothing measures as zero rather than throwing", () => {
    for (const v of [null, undefined, 0, ""]) expect(byteLength(v)).toBeGreaterThanOrEqual(0);
  });

  test("humanSize reads like a file size", () => {
    expect(humanSize(0)).toBe("0 B");
    expect(humanSize(512)).toBe("512 B");
    expect(humanSize(2048)).toBe("2 KB");
    expect(humanSize(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});

describe("a payload that cannot be written returns, rather than throws", () => {
  // serialise() was called above the try block. JSON.stringify throws on a
  // payload it can't represent, and RangeError on one that exceeds the maximum
  // string length — so the function that promises {ok:false,reason} threw
  // instead, at exactly the moment a backup matters.
  test("a circular payload is reported, not raised", async () => {
    const circular = { a: 1 };
    circular.self = circular;
    let res;
    await expect((async () => { res = await writeBackupFile(circular); })()).resolves.toBeUndefined();
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("too-large");
  });

  test("a BigInt is reported too, since JSON cannot express one", async () => {
    const res = await writeBackupFile({ n: BigInt(1) });
    expect(res.ok).toBe(false);
  });

  test("every failure names a reason the caller can branch on", async () => {
    const res = await writeBackupFile({ tanks: [] });
    expect(res.ok === true || typeof res.reason === "string").toBe(true);
  });
});

describe("the filename says what it is and when", () => {
  test("it sorts by date in a file listing", () => {
    expect(backupFilename(new Date(2026, 0, 5))).toBe("pocket-reef-backup-2026-01-05.json");
  });

  test("it uses the local calendar day, not UTC", () => {
    // Every other date in this app is local; a backup named for yesterday
    // because the keeper is west of Greenwich is the same old bug.
    const d = new Date(2026, 7, 18, 23, 30);
    expect(backupFilename(d)).toContain("2026-08-18");
  });

  test("an unusable date still produces a valid filename", () => {
    expect(backupFilename(new Date("nope"))).toBe("pocket-reef-backup-backup.json");
    expect(backupFilename(null)).toMatch(/^pocket-reef-backup-.*\.json$/);
  });
});

describe("serialise", () => {
  test("is pretty-printed, because a backup is a document people open", () => {
    expect(serialise({ a: 1 })).toContain("\n");
  });

  test("round-trips", () => {
    const payload = { tanks: [{ id: "t1", name: "Reef 🐠" }], xp: 40 };
    expect(JSON.parse(serialise(payload))).toEqual(payload);
  });
});

describe("no analysis card renders outside an error boundary", () => {
  // Cards go through AdaptiveColumns, which wraps each in a CardBoundary, so a
  // throw replaces one card rather than the screen. Two rendered outside it —
  // the tank health score and the species comparison, both of which compute
  // rather than merely display — and a throw in either took the whole tab down.
  const screens = fs.readdirSync(path.join(ROOT, "screens")).filter((f) => f.endsWith(".js"));

  // Simple list items are presentational and repeat many times; a boundary each
  // would be noise. These are the ones that run an engine.
  const PRESENTATIONAL = new Set(["SpeciesCard"]);

  test("every computing card is inside AdaptiveColumns or a CardBoundary", () => {
    const offenders = [];
    for (const f of screens) {
      const src = fs.readFileSync(path.join(ROOT, "screens", f), "utf8");
      const spans = [];
      for (const m of src.matchAll(/<AdaptiveColumns\b/g)) {
        const close = src.indexOf("</AdaptiveColumns>", m.index);
        if (close !== -1) spans.push([m.index, close]);
      }
      for (const m of src.matchAll(/<CardBoundary\b/g)) {
        const close = src.indexOf("</CardBoundary>", m.index);
        if (close !== -1) spans.push([m.index, close]);
      }
      for (const m of src.matchAll(/<([A-Z][A-Za-z]*Card)\b/g)) {
        if (m[1] === "CardBoundary" || PRESENTATIONAL.has(m[1])) continue;
        if (spans.some(([a, b]) => a <= m.index && m.index <= b)) continue;
        offenders.push(`screens/${f}:${src.slice(0, m.index).split("\n").length} ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("the walker sees the cards it is meant to check", () => {
    const total = screens.reduce((n, f) =>
      n + (fs.readFileSync(path.join(ROOT, "screens", f), "utf8").match(/<[A-Z][A-Za-z]*Card\b/g) || []).length, 0);
    expect(total).toBeGreaterThan(50);
  });
});
