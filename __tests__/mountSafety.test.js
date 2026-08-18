const fs = require("fs");
const path = require("path");

// State written after a component has gone.
//
// Four components read from storage on mount and set state when the promise
// resolves. Switch tab or close the sheet before that lands and the write goes
// to an unmounted component: React logs it, the value is discarded, and the
// next thing to read that state gets a stale one. It's a warning today and a
// real bug the moment anything downstream depends on it.
//
// Source-level, because reproducing the race reliably in a test is harder than
// checking that the guard is present on every effect that needs one.

const root = path.join(__dirname, "..");
const files = ["components", "screens"].flatMap((dir) =>
  fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(".js")).map((f) => path.join(dir, f))
);
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

// The body of each useEffect in a file.
function effects(src) {
  const out = [];
  const open = /useEffect\(\(\)\s*=>\s*\{/g;
  let m;
  while ((m = open.exec(src))) {
    let i = m.index + m[0].length, depth = 1, j = i;
    while (j < src.length && depth) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") depth--;
      j++;
    }
    out.push(src.slice(i, j));
  }
  return out;
}

describe("async effects don't write to a gone component", () => {
  test("every effect that awaits and then sets state is guarded", () => {
    const offenders = [];
    files.forEach((f) => {
      effects(read(f)).forEach((body) => {
        const isAsync = body.includes(".then(") || body.includes("await ");
        const sets = /\bset[A-Z]\w*\(/.test(body);
        if (!isAsync || !sets) return;
        const guarded = /\balive\b|\bcancelled\b|\bmounted\b/.test(body);
        if (!guarded) offenders.push(f);
      });
    });
    expect([...new Set(offenders)]).toEqual([]);
  });

  test("every guard is actually cleared on unmount", () => {
    // A flag nobody resets is decoration.
    const offenders = [];
    files.forEach((f) => {
      effects(read(f)).forEach((body) => {
        if (!/let alive = true/.test(body)) return;
        if (!/alive = false/.test(body)) offenders.push(f);
      });
    });
    expect([...new Set(offenders)]).toEqual([]);
  });

  test("and every guard is read before the state write", () => {
    const offenders = [];
    files.forEach((f) => {
      effects(read(f)).forEach((body) => {
        if (!/let alive = true/.test(body)) return;
        // Somewhere after the flag there must be a check, not just the reset.
        const checks = (body.match(/if\s*\(\s*!?alive\b|alive\s*&&/g) || []).length;
        if (checks < 1) offenders.push(f);
      });
    });
    expect([...new Set(offenders)]).toEqual([]);
  });

  test("the scan finds effects — otherwise it proves nothing", () => {
    const total = files.reduce((n, f) => n + effects(read(f)).length, 0);
    expect(total).toBeGreaterThan(20);
  });
});
