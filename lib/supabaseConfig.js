// ─────────────────────────────────────────────────────────────────────────────
// Pocket Reef cloud credentials.
//
// 1. Create a Supabase project for Pocket Reef (keep it separate from Pocket
//    Planter's so the two apps don't share accounts or tables).
// 2. Project Settings → API → copy the Project URL and the publishable/anon key.
// 3. Paste them below and restart the bundler.
// 4. Run supabase/schema.sql in the SQL editor to create the profiles table.
//
// The anon key is a *publishable* key — it's designed to ship inside the app and
// is safe here as long as Row Level Security is on (schema.sql turns it on).
// Never paste the service_role key into this file.
//
// Until both values are filled in, the app runs in local-only mode: everything
// still works, it just saves to this device instead of an account.
// ─────────────────────────────────────────────────────────────────────────────

export const SUPABASE_URL = "https://hvsbbfguvvolwlppupxz.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_OwN7zmzXO00H6ypqJMwA6Q_sx7fec-x";

// Deep links the auth emails come back to (app.json → "scheme": "pocketreef").
export const AUTH_REDIRECT = "pocketreef://auth";
export const RESET_REDIRECT = "pocketreef://reset-password";

// True once real credentials are in place — every cloud path checks this first.
export function isCloudConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
