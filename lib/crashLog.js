// ─────────────────────────────────────────────────────────────────────────────
// Keeping the crash.
//
// ErrorBoundary catches a render error, shows an apology and offers a retry —
// all correct, and the error itself then vanishes. Nobody can act on it. The
// user can only say "it crashed", the developer can only ask "doing what?",
// and neither has anything else to go on. For an app holding years of
// irreplaceable records, "it crashed sometimes and we never found out why" is
// not an acceptable place to leave it.
//
// So the last few crashes are kept on the device and can be shared as plain
// text. Local only, and never transmitted anywhere on its own — telemetry is a
// separate, opt-in thing, and a stack trace can carry a tank name.
// ─────────────────────────────────────────────────────────────────────────────

import { getJSON, safeSetJSON } from "./storage";
import { records } from "./records";

const KEY = "pr_crashLog";
// Enough to spot a pattern, few enough that the log can't grow unbounded.
export const MAX_CRASHES = 5;
// Stack traces are long and the tail is framework noise.
const MAX_STACK = 1200;

const clean = (s, max) => String(s == null ? "" : s).slice(0, max);

export function newCrashRecord(error, info = {}, extra = {}) {
  return {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    message: clean((error && error.message) || error || "Unknown error", 300),
    stack: clean(error && error.stack, MAX_STACK),
    // Which screen was on when it went — the single most useful field, and the
    // one a user can never reliably recall.
    screen: clean(extra.screen || "", 40),
    componentStack: clean(info && info.componentStack, MAX_STACK),
    version: clean(extra.version || "", 20),
  };
}

export async function recordCrash(error, info, extra) {
  try {
    const record = newCrashRecord(error, info, extra);
    const existing = await getJSON(KEY, []);
    const list = [record, ...(Array.isArray(existing) ? existing : [])].slice(0, MAX_CRASHES);
    await safeSetJSON(KEY, list);
    return record;
  } catch (e) {
    // A failure to record a crash must never itself crash. This runs from
    // componentDidCatch, where throwing takes the boundary down too.
    return null;
  }
}

export async function listCrashes() {
  const list = await getJSON(KEY, []);
  return Array.isArray(list) ? list : [];
}

export async function clearCrashes() {
  await safeSetJSON(KEY, []);
  return [];
}

// Plain text, because it has to survive being pasted into an email or a
// support form. The newest first — that's the one being asked about.
export function formatCrashes(list = [], { app = "Pocket Reef" } = {}) {
  list = records(list);

  if (!list.length) return `${app}: no crashes recorded.`;
  return list
    .map((c, i) => {
      const lines = [
        `── Crash ${i + 1} of ${list.length} ──`,
        `When:    ${c.at}`,
        c.screen ? `Screen:  ${c.screen}` : null,
        c.version ? `Version: ${c.version}` : null,
        `Error:   ${c.message}`,
      ].filter(Boolean);
      if (c.stack) lines.push("", "Stack:", c.stack);
      if (c.componentStack) lines.push("", "Components:", c.componentStack.trim());
      return lines.join("\n");
    })
    .join("\n\n");
}
