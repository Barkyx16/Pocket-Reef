import fs from "fs";
import path from "path";
import { MAX_FONT_SCALE, MAX_FONT_SCALE_COMPACT } from "../lib/a11y";

const ROOT = path.join(__dirname, "..");
const files = ["App.js", ...["components", "screens"].flatMap((dir) =>
  fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".js")).map((f) => path.join(dir, f)))];

describe("text inside a fixed box cannot outgrow the box", () => {
  // iOS accessibility text sizes reach roughly 310%. Text in a flexible
  // container just reflows and is fine. Text inside something drawn at a fixed
  // size — a health-score ring, a count badge, an emoji tile — has nowhere to
  // go, so it clips: the score in the ring becomes unreadable for exactly the
  // person who turned the setting on.
  //
  // The cap is 1.3, not 1.0. These still grow by a third; they just stop
  // before they leave the circle.
  test("the compact cap is a cap, not a freeze", () => {
    expect(MAX_FONT_SCALE_COMPACT).toBeGreaterThan(1);
    expect(MAX_FONT_SCALE_COMPACT).toBeLessThan(MAX_FONT_SCALE);
  });

  function uncappedInFixedBox(src) {
    const out = [];
    for (const m of src.matchAll(/height: (\d+)[,\s}]/g)) {
      const h = Number(m[1]);
      if (h < 18 || h > 80) continue;
      const window = src.slice(m.index + m[0].length, m.index + m[0].length + 420);
      const tm = /<Text([^>]*)>/.exec(window);
      if (!tm) continue;
      if (tm[1].includes("maxFontSizeMultiplier")) continue;
      const after = window.slice(tm.index + tm[0].length, tm.index + tm[0].length + 60);
      if (/^\s*\{?\s*</.test(after)) continue; // a nested element, not text
      out.push(src.slice(0, m.index).split("\n").length);
    }
    return out;
  }

  test("no fixed-size container holds uncapped text", () => {
    const offenders = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      for (const line of uncappedInFixedBox(src)) offenders.push(`${f}:${line}`);
    }
    expect(offenders).toEqual([]);
  });

  test("the walker can actually see fixed-size containers", () => {
    // A detector that silently matches nothing passes forever.
    const capped = files.reduce((n, f) =>
      n + (fs.readFileSync(path.join(ROOT, f), "utf8").match(/maxFontSizeMultiplier/g) || []).length, 0);
    expect(capped).toBeGreaterThan(40);
  });

  test("body text is left alone to grow", () => {
    // Capping everything would be the same mistake in the other direction:
    // the setting exists so people can read prose.
    const total = files.reduce((n, f) =>
      n + (fs.readFileSync(path.join(ROOT, f), "utf8").match(/<Text\b/g) || []).length, 0);
    const capped = files.reduce((n, f) =>
      n + (fs.readFileSync(path.join(ROOT, f), "utf8").match(/maxFontSizeMultiplier/g) || []).length, 0);
    expect(capped / total).toBeLessThan(0.15);
  });
});

describe("photo storage keys are built from safe parts", () => {
  const src = fs.readFileSync(path.join(ROOT, "lib/photoSync.js"), "utf8");

  test("the id is sanitised before it becomes a path segment", () => {
    // Entry ids are generated here, but they also arrive from imported backups
    // and synced profiles, where nothing has ever checked them.
    expect(src).toContain("safeSegment(userId)");
    expect(src).toContain("safeSegment(entryId)");
    expect(src).not.toMatch(/`\$\{userId\}\/\$\{entryId/);
  });

  test("the extension is chosen from a fixed list, not taken from the URI", () => {
    expect(src).toMatch(/jpe\?g\|png\|webp\|heic/);
  });
});

describe("the photo bucket is private however it was created", () => {
  const sql = fs.readFileSync(path.join(ROOT, "supabase/storage.sql"), "utf8");

  test("running the script on an existing bucket enforces the settings", () => {
    // "on conflict do nothing" left a bucket created by hand exactly as it was
    // — and the dashboard default is public. The comment promised private;
    // only this makes it so.
    expect(sql).not.toContain("on conflict (id) do nothing");
    expect(sql).toMatch(/on conflict \(id\) do update set/);
    expect(sql).toMatch(/public\s*=\s*false/);
  });

  test("every policy is still scoped to the caller's own folder", () => {
    const policies = sql.match(/create policy[\s\S]*?;/g) || [];
    expect(policies.length).toBe(4);
    for (const p of policies) {
      expect(p).toContain("(storage.foldername(name))[1] = auth.uid()::text");
    }
  });
});
