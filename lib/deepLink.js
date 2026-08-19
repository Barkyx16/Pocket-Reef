// ─────────────────────────────────────────────────────────────────────────────
// Deciding whether an incoming link is really ours.
//
// The app handles two auth redirects — pocketreef://auth for a verified
// sign-in and pocketreef://reset-password for a recovery — and Supabase returns
// the session in the URL fragment. The handler took whatever arrived, pulled
// access_token and refresh_token out of it, and called setSession.
//
// Whatever arrived. Any app, any web page, any QR code can open a URL with
// this app's scheme, and nothing checked where the link came from or where it
// claimed to point. A crafted link carrying an attacker's tokens signs the
// keeper into the attacker's account — quietly, since the app looks the same
// afterwards. Everything they log from that point lands somewhere they can't
// see and someone else can.
//
// The reset check had the same shape a level down: `url.includes(
// "reset-password")` matched that text anywhere in the URL, query strings
// included, so it was a substring away from being triggered by a link that had
// nothing to do with recovery.
//
// So the rule here is allow-list, not sniff: the scheme must be ours, the path
// must be one of the two we actually registered, and only then is anything in
// the fragment worth reading.
// ─────────────────────────────────────────────────────────────────────────────

export const SCHEME = "pocketreef";

// The only two destinations the app registered. A link claiming anything else
// is not one of ours however convincing the rest of it looks.
export const AUTH_PATH = "auth";
export const RESET_PATH = "reset-password";
const ALLOWED = new Set([AUTH_PATH, RESET_PATH]);

// Splits "scheme://host/path?query#fragment" without depending on a URL
// implementation — React Native's differs between platforms for custom schemes,
// and the host/path split for "pocketreef://auth" is exactly where they differ.
export function parseLink(url) {
  if (typeof url !== "string" || !url) return null;
  const schemeEnd = url.indexOf("://");
  if (schemeEnd === -1) return null;
  const scheme = url.slice(0, schemeEnd).toLowerCase();
  let rest = url.slice(schemeEnd + 3);

  let fragment = "";
  const hash = rest.indexOf("#");
  if (hash !== -1) { fragment = rest.slice(hash + 1); rest = rest.slice(0, hash); }

  let query = "";
  const q = rest.indexOf("?");
  if (q !== -1) { query = rest.slice(q + 1); rest = rest.slice(0, q); }

  // "auth", "auth/", "//auth" all mean the same destination.
  const path = rest.replace(/^\/+|\/+$/g, "").toLowerCase();
  return { scheme, path, query, fragment };
}

// Key/value pairs from a fragment or query string.
export function parseParams(text) {
  const out = {};
  if (!text) return out;
  for (const pair of String(text).split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const k = eq === -1 ? pair : pair.slice(0, eq);
    const v = eq === -1 ? "" : pair.slice(eq + 1);
    if (!k) continue;
    try { out[k] = decodeURIComponent(v); } catch { out[k] = v; }
  }
  return out;
}

// What, if anything, the app should do about this link. Returns null for
// anything that isn't a link we registered — which is the default, not the
// exception.
export function classifyLink(url) {
  const parsed = parseLink(url);
  if (!parsed) return null;
  if (parsed.scheme !== SCHEME) return null;
  if (!ALLOWED.has(parsed.path)) return null;

  // Supabase returns the session in the fragment; some flows use the query.
  const params = { ...parseParams(parsed.query), ...parseParams(parsed.fragment) };

  // A recovery link is one that arrived at the recovery path, or that says so
  // in its own parameters — not one whose URL happens to contain the words.
  const isRecovery = parsed.path === RESET_PATH || params.type === "recovery";

  // Both halves or neither: a lone access_token can't establish a session and
  // shouldn't be treated as if it might.
  const session = params.access_token && params.refresh_token
    ? { access_token: params.access_token, refresh_token: params.refresh_token }
    : null;

  const error = params.error_description || params.error || null;

  // An expired or already-used email link arrives here carrying an error and
  // nothing else. Returning null for it produced silence: the keeper tapped
  // the link in their inbox, the app opened, and nothing happened at all.
  if (!session && !isRecovery && !error) return null;
  return { path: parsed.path, session, isRecovery, error };
}
