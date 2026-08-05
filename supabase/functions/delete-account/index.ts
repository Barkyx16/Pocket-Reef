// Account deletion.
//
// Deploy: supabase functions deploy delete-account
//
// The Profile → Cloud Save card has a Delete account button that calls this.
// Deleting an auth user needs the service_role key, which must never ship in
// the app — so it lives here instead. Until this is deployed, that button
// fails and nothing is deleted.
//
// The App Store requires an in-app way to delete an account for any app that
// lets you create one, so this is a shipping blocker, not a nice-to-have.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const auth = req.headers.get("Authorization") ?? "";
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Identify the caller from their own access token — never from a body
  // parameter, or anyone could delete anyone.
  const { data: { user }, error } = await admin.auth.getUser(auth.replace("Bearer ", ""));
  if (error || !user) return new Response("Unauthorized", { status: 401 });

  // reef_profiles and premium_entitlements are both ON DELETE CASCADE from
  // auth.users, so removing the user removes their data with it.
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) return new Response(delErr.message, { status: 500 });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
