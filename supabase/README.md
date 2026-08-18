# Pocket Reef — cloud save setup

Four steps to turn on accounts. Until step 3 is done the app runs local-only and
shows a "Continue on this device" button instead of the login form.

## 1. Create the project

Create a Supabase project for Pocket Reef. Keep it separate from Pocket
Planter's so the two apps don't share accounts or tables.

## 2. Create the table

SQL Editor → New query → paste [`schema.sql`](schema.sql) → Run.

That creates `public.reef_profiles` (one JSON snapshot row per user) with Row
Level Security on and every policy scoped to `auth.uid()`. The key that ships in
the app can only ever touch the signed-in user's own row.

## 3. Paste the keys

Project Settings → API. Copy the **Project URL** and the **anon / publishable**
key into `lib/supabaseConfig.js`, then restart the bundler.

Never put the `service_role` key in the app — it bypasses RLS.

## 4. Configure the auth redirects

Authentication → URL Configuration → Redirect URLs, add both:

```
pocketreef://auth
pocketreef://reset-password
```

These match `AUTH_REDIRECT` / `RESET_REDIRECT` in `lib/supabaseConfig.js` and the
`"scheme": "pocketreef"` in `app.json`. Without them, confirmation and password
reset links won't reopen the app.

## 5. Put the 6-digit code in the emails — required

The app verifies new accounts and password resets by having the user type a
6-digit code from the email (`screens/AuthScreen.js` → the `verify` mode).
Supabase already generates that code for every auth email, but the **default
templates don't print it** — they only render the link. Until you add it, the
emails will arrive with no code in them and the code screen will have nothing to
accept.

Authentication → Emails → Templates. In both **Confirm signup** and **Reset
password**, add `{{ .Token }}` to the body:

```html
<h2>Your Pocket Reef code</h2>
<p style="font-size:32px;letter-spacing:6px;font-weight:800">{{ .Token }}</p>
<p>Enter this code in the app. It expires in an hour.</p>
<p>Or just tap here: <a href="{{ .ConfirmationURL }}">open Pocket Reef</a></p>
```

Keep the `{{ .ConfirmationURL }}` link. The app still handles it as a deep link
(`App.js`), so a tapped link and a typed code both work — the link is the
shortcut, the code is the fallback that survives reading email on a desktop.

Two related settings on the same screen:

- Authentication → Sign In / Providers → Email → **Confirm email** must be on.
  With it off, `signUp` returns a live session, nothing is emailed, and the app
  skips the code screen (handled, but then nobody's address is ever verified).
- Authentication → Rate Limits controls how often a new code can be sent. The
  app's resend button waits 45 seconds, matching the default.

## Optional: account deletion

The Profile → Cloud Save card has a **Delete account** button that calls an Edge
Function named `delete-account`. Deleting an auth user requires the
`service_role` key, which must never live in the app — so it lives in the
function instead. Until you deploy it, that button reports a failure and nothing
is deleted.

```ts
// supabase/functions/delete-account/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization") ?? "";
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Identify the caller from their own access token.
  const { data: { user }, error } = await admin.auth.getUser(auth.replace("Bearer ", ""));
  if (error || !user) return new Response("Unauthorized", { status: 401 });

  // The row is ON DELETE CASCADE from auth.users, so this is enough.
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) return new Response(delErr.message, { status: 500 });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

Deploy with `supabase functions deploy delete-account`.

## What syncs

`lib/cloudSync.js` → `SYNCED_FIELDS`: tanks (with their stock, water tests,
journal, costs, maintenance, quarantine, feedings), XP, active days, care log,
wishlist, reminder prefs, profile name, member-since, recents, species notes,
challenges, banner, language, units, premium flag.

Pushes are debounced 2.5s and the whole snapshot is one upsert — last write
wins. Photos stay on the device; only their references travel.

Device-local on purpose: biometric credentials (device keychain only), collapsed
card state, splash/onboarding flags.
