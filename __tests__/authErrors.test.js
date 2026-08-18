import fs from "fs";
import path from "path";
import { friendlyAuthError, isUnconfirmedError } from "../lib/authErrors";

const ROOT = path.join(__dirname, "..");

describe("Supabase diagnostics become instructions", () => {
  // These are the actual strings the API returns. They are written for whoever
  // is reading the server logs, not for someone trying to sign in.
  const cases = [
    ["Invalid login credentials", /don't match|typos/i],
    ["Email not confirmed", /verif/i],
    ["Token has expired or is invalid", /expired|code/i],
    ["User already registered", /already an account/i],
    ["For security purposes, you can only request this after 47 seconds", /too many|wait/i],
    ["Password should be at least 6 characters", /stronger password/i],
    ["Network request failed", /connection/i],
  ];

  for (const [raw, want] of cases) {
    test(`"${raw.slice(0, 40)}" is rewritten`, () => {
      const out = friendlyAuthError(raw);
      expect(out).toMatch(want);
      expect(out).not.toBe(raw);
    });
  }

  test("an unrecognised error passes through rather than being swallowed", () => {
    // A generic apology hides a real error the keeper could have acted on.
    expect(friendlyAuthError("Tenant not found")).toBe("Tenant not found");
  });

  test("no message at all still says something", () => {
    for (const v of ["", null, undefined]) {
      expect(friendlyAuthError(v)).toMatch(/went wrong/i);
    }
  });

  test("matching is case-insensitive, since casing varies by endpoint", () => {
    expect(friendlyAuthError("INVALID LOGIN CREDENTIALS")).toMatch(/don't match/i);
  });

  test("every rewrite is a sentence, not a fragment", () => {
    for (const [raw] of cases) {
      const out = friendlyAuthError(raw);
      expect(out[0]).toBe(out[0].toUpperCase());
      expect(out).toMatch(/[.!]$/);
    }
  });

  test("isUnconfirmedError catches the phrasings the endpoints differ on", () => {
    expect(isUnconfirmedError("Email not confirmed")).toBe(true);
    expect(isUnconfirmedError("User not confirmed")).toBe(true);
    expect(isUnconfirmedError("Invalid login credentials")).toBe(false);
    expect(isUnconfirmedError(undefined)).toBe(false);
  });
});

describe("no screen shows a raw API string", () => {
  // The rewrite lived inside AuthScreen, so only AuthScreen benefited:
  // change-email, change-password and the reset modal each surfaced the raw
  // Supabase text. One rule used in one of the four places it applies is the
  // same defect as no rule.
  const files = ["components", "screens"].flatMap((dir) =>
    fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".js")).map((f) => path.join(dir, f)));

  test("every displayed error.message goes through friendlyAuthError", () => {
    const offenders = [];
    for (const f of files) {
      // The boundaries deliberately show the raw crash — that is their job.
      if (f.includes("ErrorBoundary") || f.includes("CardBoundary")) continue;
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      for (const m of src.matchAll(/(?:Alert\.alert\([^;]{0,160}?|setError\(|setNotice\()((?:\w+)\.message)/g)) {
        const before = src.slice(Math.max(0, m.index - 30), m.index + m[0].length);
        if (!before.includes("friendlyAuthError")) {
          offenders.push(`${f}:${src.slice(0, m.index).split("\n").length} ${m[1]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test("the files that talk to Supabase import the rewrite", () => {
    for (const f of ["screens/AuthScreen.js", "components/AccountCloudCard.js", "components/ResetPasswordModal.js"]) {
      expect(fs.readFileSync(path.join(ROOT, f), "utf8")).toContain("authErrors");
    }
  });
});

describe("controls are big enough to hit", () => {
  // Apple's minimum is 44pt. Icon-only controls here are drawn at 34–40,
  // which looks right and misses a lot; hitSlop grows the tappable area
  // without changing the visual size.
  const files = ["components", "screens"].flatMap((dir) =>
    fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".js")).map((f) => path.join(dir, f)));

  function pressableTags(src) {
    const out = [];
    for (const m of src.matchAll(/<Pressable\b/g)) {
      let i = m.index + m[0].length, depth = 0;
      while (i < src.length) {
        const c = src[i];
        if (c === "{") depth++;
        else if (c === "}") depth--;
        else if (c === ">" && depth === 0) break;
        i++;
      }
      out.push({ tag: src.slice(m.index, i), line: src.slice(0, m.index).split("\n").length });
    }
    return out;
  }

  test("no Pressable sized under 44pt lacks hitSlop", () => {
    const offenders = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      for (const { tag, line } of pressableTags(src)) {
        const w = /width: (\d+)/.exec(tag);
        const h = /height: (\d+)/.exec(tag);
        if (!w || !h) continue;
        const min = Math.min(+w[1], +h[1]);
        // 0 comes from shadowOffset, not a size.
        if (min > 0 && min < 44 && !tag.includes("hitSlop")) offenders.push(`${f}:${line} ${w[1]}x${h[1]}pt`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
