import { getJSON, safeSetJSON } from "./storage";
import { capture } from "./telemetry";

// ─────────────────────────────────────────────────────────────────────────────
// Conversion funnel, measured locally.
//
// You now have a paywall, contextual triggers, a teaser card, and a value-first
// onboarding step — and no way to know which of them does anything. This
// records the handful of events that answer that, so the next change is
// informed rather than guessed.
//
// Privacy stance, deliberately strict:
//   * Events are counts and coarse timings. No tank names, species, journal
//     text, emails, or free-text of any kind ever enters an event.
//   * Nothing leaves the device unless the user asks it to. This is a local
//     ring buffer the Profile screen can summarize. Remote analytics (PostHog,
//     see lib/telemetry.js) is wired downstream of the filtering below and is
//     OFF until switched on in Profile — an aquarium journal is personal, and
//     App Store privacy labels have to match what the app actually does.
//   * Capped at MAX_EVENTS so it can never grow into a storage problem.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = "pr_funnel";
const MAX_EVENTS = 500;

// The events worth having. A closed list, so a stray call can't start recording
// something unreviewed.
export const EVENTS = {
  ONBOARD_START: "onboard_start",
  ONBOARD_RESULT_SEEN: "onboard_result_seen", // saw real recommendations
  ONBOARD_DONE: "onboard_done",
  PAYWALL_VIEW: "paywall_view",               // + reason
  PAYWALL_CTA: "paywall_cta",                 // tapped buy
  PURCHASE_SUCCESS: "purchase_success",
  PURCHASE_CANCELLED: "purchase_cancelled",
  PURCHASE_FAILED: "purchase_failed",
  RESTORE_SUCCESS: "restore_success",
  GATE_HIT: "gate_hit",                       // + reason: blocked by the wall
  TEASER_TAP: "teaser_tap",
  STOCK_CAP_HIT: "stock_cap_hit",
};

const ALLOWED = new Set(Object.values(EVENTS));

// Reasons are already a closed vocabulary in the paywall, so they're safe to
// record. Anything unrecognized is dropped rather than stored verbatim — that's
// what stops free text leaking in through a future caller.
const ALLOWED_REASONS = new Set([
  "stockCap", "species", "disease", "tankIdea", "secondTank",
  "tank", "log", "health", "journal", "games", "profile",
]);

let buffer = null;      // in-memory mirror, so a track() never blocks on disk
let loaded = false;
let flushTimer = null;

async function load() {
  if (loaded) return buffer;
  buffer = (await getJSON(KEY, null)) || [];
  if (!Array.isArray(buffer)) buffer = [];
  loaded = true;
  return buffer;
}

// Writes are batched — funnel data is not worth a disk write per tap.
function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    try { await safeSetJSON(KEY, buffer.slice(-MAX_EVENTS)); } catch (e) {}
  }, 4000);
}

// Records one event. Never throws, never blocks the UI.
export async function track(event, reason) {
  try {
    if (!ALLOWED.has(event)) return;
    // Both the allowlist and the reason vocabulary are applied here, once, so
    // the remote sink below can never receive a value the local log wouldn't.
    const safeReason = reason && ALLOWED_REASONS.has(reason) ? reason : undefined;
    await load();
    buffer.push({ e: event, r: safeReason, t: Date.now() });
    if (buffer.length > MAX_EVENTS) buffer = buffer.slice(-MAX_EVENTS);
    scheduleFlush();

    // Mirrored to PostHog only when the user has opted in and a key is
    // configured; capture() is a no-op otherwise. Routing it through here
    // rather than from each call site means there is exactly one place where
    // an event can leave the device, and it is downstream of the filtering.
    capture(event, safeReason);
  } catch (e) {}
}

// Rolls the raw events up into the numbers actually worth looking at.
export async function getFunnel() {
  const events = await load();
  const count = (e) => events.filter((x) => x.e === e).length;

  const views = count(EVENTS.PAYWALL_VIEW);
  const ctas = count(EVENTS.PAYWALL_CTA);
  const purchases = count(EVENTS.PURCHASE_SUCCESS);

  // Which trigger actually sends people to the paywall.
  const byReason = {};
  events
    .filter((x) => x.e === EVENTS.GATE_HIT && x.r)
    .forEach((x) => { byReason[x.r] = (byReason[x.r] || 0) + 1; });

  const topReasons = Object.entries(byReason)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, n]) => ({ reason, count: n }));

  return {
    events: events.length,
    paywallViews: views,
    ctaTaps: ctas,
    purchases,
    cancellations: count(EVENTS.PURCHASE_CANCELLED),
    failures: count(EVENTS.PURCHASE_FAILED),
    restores: count(EVENTS.RESTORE_SUCCESS),
    stockCapHits: count(EVENTS.STOCK_CAP_HIT),
    teaserTaps: count(EVENTS.TEASER_TAP),
    onboardCompleted: count(EVENTS.ONBOARD_DONE),
    onboardSawResults: count(EVENTS.ONBOARD_RESULT_SEEN),
    // Percentages, guarded against divide-by-zero.
    viewToCta: views ? Math.round((ctas / views) * 100) : null,
    ctaToPurchase: ctas ? Math.round((purchases / ctas) * 100) : null,
    viewToPurchase: views ? Math.round((purchases / views) * 100) : null,
    topReasons,
  };
}

// Wipes the local log — exposed so a user can clear it, which is the least a
// privacy-respecting app can offer for data it keeps about them.
export async function clearFunnel() {
  buffer = [];
  loaded = true;
  try { await safeSetJSON(KEY, []); return true; } catch (e) { return false; }
}
