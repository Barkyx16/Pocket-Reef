// RevenueCat → Supabase entitlement webhook.
//
// Deploy:  supabase functions deploy revenuecat-webhook --no-verify-jwt
// Secrets: supabase secrets set REVENUECAT_WEBHOOK_SECRET=<a long random string>
//
// Then in RevenueCat: Project Settings → Integrations → Webhooks
//   URL:            https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
//   Authorization:  the same value as REVENUECAT_WEBHOOK_SECRET
//
// --no-verify-jwt is required because RevenueCat is not a signed-in Supabase
// user. The shared secret below is what authenticates the caller instead, so it
// must be set — the function refuses to run without it rather than accepting
// anonymous writes to entitlement state.
//
// The app must be calling Purchases.logIn(<supabase user id>) so RevenueCat's
// app_user_id matches auth.users.id. Without that, events arrive with an
// anonymous id and can't be attributed to an account.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Events that mean "this person currently has access".
const GRANTING = new Set([
  "INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION",
  "NON_RENEWING_PURCHASE", "SUBSCRIPTION_EXTENDED", "TRANSFER",
]);
// Events that revoke immediately. Note CANCELLATION is deliberately NOT here —
// a cancelled subscription keeps working until it expires.
const REVOKING = new Set(["EXPIRATION", "REFUND", "SUBSCRIPTION_PAUSED"]);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const expected = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  if (!expected) {
    // Fail closed. An unset secret must never mean "let anyone in".
    return new Response("Webhook secret not configured", { status: 500 });
  }
  if ((req.headers.get("Authorization") ?? "") !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const event = payload?.event;
  if (!event) return new Response("No event", { status: 400 });

  const type = String(event.type ?? "");
  // app_user_id is the Supabase user id, assuming Purchases.logIn was called.
  const userId = String(event.app_user_id ?? "");
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    // Anonymous RevenueCat id — nothing to attribute. Ack so RevenueCat stops
    // retrying; this is not a server fault.
    return new Response(JSON.stringify({ ok: true, skipped: "no supabase user id" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let isActive: boolean;
  if (GRANTING.has(type)) isActive = true;
  else if (REVOKING.has(type)) isActive = false;
  else {
    // Unknown or informational event (CANCELLATION, BILLING_ISSUE, TEST…).
    // Fall back to the expiry timestamp rather than guessing.
    const ms = Number(event.expiration_at_ms ?? 0);
    isActive = ms > Date.now();
  }

  const expiresAt = event.expiration_at_ms
    ? new Date(Number(event.expiration_at_ms)).toISOString()
    : null;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { error } = await admin.from("premium_entitlements").upsert(
    {
      user_id: userId,
      rc_app_user_id: String(event.original_app_user_id ?? event.app_user_id ?? ""),
      is_active: isActive,
      product_id: event.product_id ?? null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  // A 500 makes RevenueCat retry, which is what we want on a transient failure.
  if (error) return new Response(error.message, { status: 500 });

  return new Response(JSON.stringify({ ok: true, type, isActive }), {
    headers: { "Content-Type": "application/json" },
  });
});
