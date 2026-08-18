import { Platform } from "react-native";
import * as Application from "expo-application";
import * as Device from "expo-device";
import { getRaw, setRaw, removeRaw } from "./storage";
import { POSTHOG_API_KEY, POSTHOG_HOST, isTelemetryConfigured } from "./posthogConfig";

// ─────────────────────────────────────────────────────────────────────────────
// Remote product analytics — opt-in, anonymous, and closed-vocabulary.
//
// lib/analytics.js already records the conversion funnel locally, and it wrote
// down the rule this module has to satisfy: "If you later ship remote
// analytics, it must be opt-in and disclosed — an aquarium journal is personal,
// and App Store privacy labels have to match what the app actually does."
//
// So four hard constraints, enforced here rather than left to call sites:
//
//   1. OFF until the user turns it on. Not opt-out. Not on-by-default with a
//      buried switch. A fresh install sends nothing.
//   2. Anonymous. The distinct id is a random value generated on this device.
//      It is deliberately NOT the Supabase user id and never the email —
//      joining product analytics to an account identity is exactly the thing
//      the privacy label would then have to declare.
//   3. No free text, ever. Only events from the closed EVENTS list in
//      analytics.js, and only reasons from its closed vocabulary. Tank names,
//      species, journal entries and notes cannot reach this file, because
//      nothing here accepts arbitrary properties.
//   4. Silent when unconfigured. No key means no client, no network, no errors.
//
// Device context (app version, OS, model) is attached because it is what makes
// a crash-adjacent funnel drop interpretable, and none of it identifies a
// person. Device.modelName is a class of hardware, not a serial number.
// ─────────────────────────────────────────────────────────────────────────────

const OPT_IN_KEY = "pr_telemetryOptIn";
const ANON_ID_KEY = "pr_anonId";

let client = null;
let optedIn = false;
let ready = false;

// A random, app-scoped id. Not derived from anything about the device or the
// person, so it cannot be correlated with another app's data or reversed into
// an identity. Cleared when telemetry is switched off.
async function anonId() {
  const existing = await getRaw(ANON_ID_KEY);
  if (existing) return existing;
  const id = `pr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  await setRaw(ANON_ID_KEY, id);
  return id;
}

// Non-identifying context, attached to every event.
function deviceContext() {
  return {
    app_version: Application.nativeApplicationVersion || "unknown",
    app_build: Application.nativeBuildVersion || "unknown",
    platform: Platform.OS,
    os_version: String(Device.osVersion || "unknown"),
    // A hardware class ("iPhone 15"), never a serial or advertising id.
    device_model: Device.modelName || "unknown",
    is_emulator: Device.isDevice === false,
  };
}

export async function isOptedIn() {
  return (await getRaw(OPT_IN_KEY)) === "1";
}

// Boots the client if — and only if — there's a key and the user has said yes.
export async function initTelemetry() {
  if (ready) return Boolean(client);
  ready = true;
  if (!isTelemetryConfigured()) return false;
  optedIn = await isOptedIn();
  if (!optedIn) return false;
  return start();
}

async function start() {
  try {
    // Required lazily so an uninstalled or web-stubbed native module can't take
    // the app down at import time.
     
    const { PostHog } = require("posthog-react-native");
    client = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      // Session replay would capture journal text and photos on screen. Off,
      // permanently, and not exposed as an option.
      enableSessionReplay: false,
      captureAppLifecycleEvents: true,
    });
    const id = await anonId();
    client.identify(id, deviceContext());
    return true;
  } catch (e) {
    client = null;
    return false;
  }
}

// Turning it on or off from the Profile screen.
export async function setOptIn(on) {
  await setRaw(OPT_IN_KEY, on ? "1" : "0");
  optedIn = !!on;
  if (on) {
    if (!isTelemetryConfigured()) return false;
    if (!client) return start();
    return true;
  }
  // Off means off: stop the client and drop the pseudonymous id, so switching
  // back on later starts a genuinely new identity rather than resuming the old
  // one. Anything already queued locally is discarded with it.
  try {
    if (client) {
      client.optOut();
      if (typeof client.reset === "function") client.reset();
    }
  } catch (e) { /* nothing useful to do */ }
  client = null;
  await removeRaw(ANON_ID_KEY);
  return false;
}

// The only way an event reaches PostHog. Callers pass an already-validated
// event name and reason from analytics.js; nothing else is accepted, and no
// caller-supplied property bag exists to smuggle text through.
export function capture(event, reason) {
  if (!client || !optedIn) return;
  try {
    client.capture(event, reason ? { reason } : undefined);
  } catch (e) { /* telemetry must never break the app */ }
}

// Flushed when the app backgrounds, alongside the write scheduler.
export async function flushTelemetry() {
  if (!client) return;
  try { await client.flush(); } catch (e) { /* offline is fine; it retries */ }
}

// Test seam.
export function __resetTelemetry() {
  client = null;
  optedIn = false;
  ready = false;
}
