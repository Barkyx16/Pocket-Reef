-- Pocket Reef — server-authoritative Premium entitlement.
--
-- Run once in the SQL editor, after schema.sql.
--
-- Why this exists: the app reads entitlement from the RevenueCat SDK, which is
-- correct and offline-capable, but it lives inside a JS bundle a determined user
-- can patch. This table is the copy the client CANNOT write. RevenueCat posts
-- here over a webhook using the service_role key; the app may only read its own
-- row. Anything that actually matters server-side should trust this, not the
-- client's claim.

create table if not exists public.premium_entitlements (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  -- RevenueCat's own identifier for the subscriber, for reconciliation.
  rc_app_user_id text,
  is_active    boolean     not null default false,
  product_id   text,
  -- Null means "no expiry known" (lifetime, or a grace period we weren't told
  -- about). The client treats null as "not expired" rather than "expired", so a
  -- missing value can't lock out a paying subscriber.
  expires_at   timestamptz,
  updated_at   timestamptz not null default now()
);

alter table public.premium_entitlements enable row level security;

-- Read your own row. That is the ONLY policy — no insert, update, or delete.
-- With RLS on and no write policy, the publishable key that ships in the app
-- physically cannot grant anyone Premium.
drop policy if exists "premium_entitlements_select_own" on public.premium_entitlements;
create policy "premium_entitlements_select_own"
  on public.premium_entitlements for select
  using (auth.uid() = user_id);

create index if not exists premium_entitlements_active_idx
  on public.premium_entitlements (is_active, expires_at desc);

-- The webhook (service_role) bypasses RLS, so it needs no policy of its own.
