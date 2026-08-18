// ─────────────────────────────────────────────────────────────────────────────
// PostHog credentials.
//
// 1. Create a PostHog project for Pocket Reef.
// 2. Project Settings → API keys → copy the **Project API key** (the one that
//    starts `phc_`). It is a publishable key and is safe to ship in the app.
//    Never paste a Personal API key here — that one can read and delete data.
// 3. Copy the host too: https://us.i.posthog.com or https://eu.i.posthog.com.
//    Choose the EU host if you have European users; that decision is not
//    changeable later without losing history.
// 4. Paste them below and restart the bundler.
//
// Until the key is filled in, nothing is sent anywhere and the app behaves
// exactly as it did before — same as the Supabase config above it.
//
// Even once configured, telemetry stays OFF until the user turns it on in
// Profile. That is a deliberate constraint carried over from lib/analytics.js,
// which states it plainly: an aquarium journal is personal, remote analytics
// must be opt-in and disclosed, and the App Store privacy label has to match
// what the app actually does.
// ─────────────────────────────────────────────────────────────────────────────

export const POSTHOG_API_KEY = "";
export const POSTHOG_HOST = "https://us.i.posthog.com";

export function isTelemetryConfigured() {
  return Boolean(POSTHOG_API_KEY && POSTHOG_HOST);
}
