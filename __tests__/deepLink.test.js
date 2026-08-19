import fs from "fs";
import path from "path";
import { classifyLink, parseLink, parseParams, SCHEME } from "../lib/deepLink";

const ROOT = path.join(__dirname, "..");
const TOKENS = "access_token=AAA&refresh_token=BBB";

describe("a link is ignored unless it is genuinely ours", () => {
  // Any app, web page or QR code can open a URL with this scheme. The handler
  // used to read tokens out of whatever arrived, so a crafted link carrying an
  // attacker's session would sign the keeper into the attacker's account —
  // quietly, since nothing on screen changes. Everything logged afterwards
  // lands somewhere the keeper can't see and someone else can.
  test("a foreign scheme is refused even with a perfect payload", () => {
    expect(classifyLink(`evil://auth#${TOKENS}`)).toBe(null);
    expect(classifyLink(`https://pocketreef.app/auth#${TOKENS}`)).toBe(null);
    expect(classifyLink(`pocketreefx://auth#${TOKENS}`)).toBe(null);
  });

  test("our scheme with a path we never registered is refused", () => {
    expect(classifyLink(`${SCHEME}://anything#${TOKENS}`)).toBe(null);
    expect(classifyLink(`${SCHEME}://auth-evil#${TOKENS}`)).toBe(null);
    expect(classifyLink(`${SCHEME}://settings#${TOKENS}`)).toBe(null);
  });

  test("the registered paths are honoured", () => {
    expect(classifyLink(`${SCHEME}://auth#${TOKENS}`).session)
      .toEqual({ access_token: "AAA", refresh_token: "BBB" });
    expect(classifyLink(`${SCHEME}://reset-password#${TOKENS}`).isRecovery).toBe(true);
  });

  test("trailing and leading slashes are the same destination", () => {
    for (const u of [`${SCHEME}://auth/#${TOKENS}`, `${SCHEME}:///auth#${TOKENS}`, `${SCHEME}://AUTH#${TOKENS}`]) {
      expect(classifyLink(u)).not.toBe(null);
    }
  });

  test("a lone access_token establishes nothing", () => {
    // Half a session is not a session, and treating it as one invites a
    // half-authenticated state nobody has reasoned about.
    expect(classifyLink(`${SCHEME}://auth#access_token=AAA`)).toBe(null);
    expect(classifyLink(`${SCHEME}://auth#refresh_token=BBB`)).toBe(null);
  });
});

describe("recovery is decided by the link, not by a substring", () => {
  // `url.includes("reset-password")` matched that text anywhere in the URL,
  // query strings included.
  test("the words appearing elsewhere in the URL prove nothing", () => {
    expect(classifyLink(`${SCHEME}://auth?next=reset-password`)).toBe(null);
    expect(classifyLink(`evil://x?redirect=pocketreef://reset-password`)).toBe(null);
  });

  test("the recovery path, or a type the provider set, does", () => {
    expect(classifyLink(`${SCHEME}://reset-password`).isRecovery).toBe(true);
    expect(classifyLink(`${SCHEME}://auth#type=recovery`).isRecovery).toBe(true);
  });
});

describe("parsing holds up on what actually arrives", () => {
  test("fragment and query are both read, fragment winning", () => {
    const link = classifyLink(`${SCHEME}://auth?access_token=Q&refresh_token=Q#${TOKENS}`);
    expect(link.session.access_token).toBe("AAA");
  });

  test("values are percent-decoded", () => {
    expect(parseParams("error_description=Email%20link%20is%20invalid").error_description)
      .toBe("Email link is invalid");
  });

  test("a malformed escape doesn't throw", () => {
    expect(() => parseParams("x=%E0%A4%A")).not.toThrow();
  });

  test("an error the provider reports is carried through", () => {
    const link = classifyLink(`${SCHEME}://auth#error=access_denied&error_description=Expired`);
    expect(link.error).toBe("Expired");
  });

  test("rubbish in, null out — never a throw", () => {
    for (const v of [null, undefined, "", 42, {}, [], "not a url", "://", "pocketreef:/auth"]) {
      expect(() => classifyLink(v)).not.toThrow();
      expect(classifyLink(v)).toBe(null);
    }
  });

  test("parseLink separates the parts", () => {
    expect(parseLink("pocketreef://auth?a=1#b=2"))
      .toEqual({ scheme: "pocketreef", path: "auth", query: "a=1", fragment: "b=2" });
  });
});

describe("App routes links through the check", () => {
  const app = fs.readFileSync(path.join(ROOT, "App.js"), "utf8");

  test("the handler calls classifyLink", () => {
    expect(app).toContain("classifyLink(url)");
  });

  test("no session is set from a hand-parsed URL any more", () => {
    // The specific shape of the old bug: tokens pulled straight out of a split.
    expect(app).not.toMatch(/setSession\(\{\s*access_token: params/);
    expect(app).not.toContain('url.includes("reset-password")');
  });
});

describe("the redirects the app asks for are the ones it will accept", () => {
  // Two halves that must agree, in different files, with nothing joining them.
  // Supabase is told where to send the keeper back to; classifyLink decides
  // what to honour on the way in. Change one and the other silently stops
  // matching — the email arrives, the link opens the app, and nothing happens.
  // No error, no log, and the keeper is locked out of their own account with a
  // reset link that appears to do nothing.
  const { AUTH_REDIRECT, RESET_REDIRECT } = require("../lib/supabaseConfig");

  const withSession = (url) => `${url}#access_token=AAA&refresh_token=BBB`;

  test("the sign-in redirect is honoured when it carries a session", () => {
    // Which is the only way it ever arrives — Supabase appends the tokens.
    const link = classifyLink(withSession(AUTH_REDIRECT));
    expect(link).not.toBe(null);
    expect(link.session).toEqual({ access_token: "AAA", refresh_token: "BBB" });
  });

  test("the reset redirect is honoured, and read as a recovery", () => {
    const link = classifyLink(withSession(RESET_REDIRECT));
    expect(link).not.toBe(null);
    expect(link.isRecovery).toBe(true);
    expect(link.session).toBeTruthy();
  });

  test("the reset redirect is a recovery even before any token arrives", () => {
    expect(classifyLink(RESET_REDIRECT).isRecovery).toBe(true);
  });

  test("both use the scheme the deep-link handler allows", () => {
    for (const url of [AUTH_REDIRECT, RESET_REDIRECT]) {
      expect(url.startsWith(`${SCHEME}://`)).toBe(true);
    }
  });

  test("and the paths are the two that are actually registered", () => {
    // A redirect pointing anywhere else would be dropped by the allow-list,
    // which is doing its job — the mistake would be upstream, here.
    const { AUTH_PATH, RESET_PATH } = require("../lib/deepLink");
    expect(AUTH_REDIRECT).toBe(`${SCHEME}://${AUTH_PATH}`);
    expect(RESET_REDIRECT).toBe(`${SCHEME}://${RESET_PATH}`);
  });

  test("the auth screen sends the reset link to that exact address", () => {
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(path.join(__dirname, "..", "screens/AuthScreen.js"), "utf8");
    expect(src).toMatch(/resetPasswordForEmail\([^)]*redirectTo: RESET_REDIRECT/);
    expect(src).not.toMatch(/redirectTo: "pocketreef/);  // never a literal
  });
});
