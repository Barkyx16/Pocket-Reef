const fs = require("fs");
const path = require("path");

// Every control announces something.
//
// VoiceOver names a Pressable from its text children, so most buttons need no
// label. Two shapes defeat that and both were in the app:
//
//   1. A button whose child is swapped for a spinner while it works. The label
//      disappears at exactly the moment the user is waiting for confirmation
//      that their tap registered — it announces as an anonymous "button".
//   2. A Pressable that exists only to swallow taps on a modal backdrop. Not a
//      control at all, but announced as one and listed in the rotor.
//
// This walks the source rather than the render tree, so it covers every screen
// including ones no test mounts.

const root = path.join(__dirname, "..");
const files = ["components", "screens"].flatMap((dir) =>
  fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(".js")).map((f) => path.join(dir, f))
);

// Extracts each <Tag ...> element's source, balancing nesting.
function elements(src, tag) {
  const out = [];
  const open = new RegExp(`<${tag}\\b`, "g");
  let m;
  while ((m = open.exec(src))) {
    let i = m.index, depth = 0, j = i;
    while (j < src.length) {
      if (src.startsWith(`<${tag}`, j)) { depth++; j += tag.length + 1; continue; }
      if (src.startsWith(`</${tag}>`, j)) { depth--; j += tag.length + 3; if (!depth) break; continue; }
      if (src.startsWith("/>", j)) { depth--; j += 2; if (!depth) break; continue; }
      j++;
    }
    out.push(src.slice(i, j));
  }
  return out;
}

const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

describe("controls announce a name", () => {
  test("a button that shows a spinner keeps its label while busy", () => {
    const offenders = [];
    files.forEach((f) => {
      elements(read(f), "Pressable").forEach((el) => {
        if (!/<ActivityIndicator/.test(el)) return;
        if (/accessibilityLabel=/.test(el)) return;
        offenders.push(`${f}: ${el.split("\n")[0].trim().slice(0, 60)}`);
      });
    });
    expect(offenders).toEqual([]);
  });

  test("modal backdrop guards aren't announced as buttons", () => {
    const offenders = [];
    files.forEach((f) => {
      elements(read(f), "Pressable").forEach((el) => {
        if (!/stopPropagation\(\)/.test(el)) return;
        // Either hidden from the accessibility tree, or given a real name.
        if (/accessible=\{false\}/.test(el) || /accessibilityLabel=/.test(el)) return;
        offenders.push(`${f}: ${el.split("\n")[0].trim().slice(0, 60)}`);
      });
    });
    expect(offenders).toEqual([]);
  });

  test("a text input is named by a label or a placeholder", () => {
    const offenders = [];
    files.forEach((f) => {
      elements(read(f), "TextInput").forEach((el) => {
        if (/accessibilityLabel=/.test(el) || /placeholder=/.test(el)) return;
        offenders.push(`${f}: ${el.split("\n")[0].trim().slice(0, 60)}`);
      });
    });
    expect(offenders).toEqual([]);
  });

  test("the scan actually finds elements — otherwise it proves nothing", () => {
    const total = files.reduce((n, f) => n + elements(read(f), "Pressable").length, 0);
    expect(total).toBeGreaterThan(200);
  });
});
