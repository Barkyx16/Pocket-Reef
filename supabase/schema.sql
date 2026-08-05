-- Pocket Reef cloud save schema.
-- Run this once in your Supabase project's SQL editor (SQL → New query → Run).
--
-- One row per user holding a JSON snapshot of their reef. Row Level Security is
-- on and every policy is scoped to auth.uid(), so the publishable anon key that
-- ships in the app can only ever read or write the signed-in user's own row.

create table if not exists public.reef_profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  data        jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

alter table public.reef_profiles enable row level security;

drop policy if exists "reef_profiles_select_own" on public.reef_profiles;
create policy "reef_profiles_select_own"
  on public.reef_profiles for select
  using (auth.uid() = id);

drop policy if exists "reef_profiles_insert_own" on public.reef_profiles;
create policy "reef_profiles_insert_own"
  on public.reef_profiles for insert
  with check (auth.uid() = id);

drop policy if exists "reef_profiles_update_own" on public.reef_profiles;
create policy "reef_profiles_update_own"
  on public.reef_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "reef_profiles_delete_own" on public.reef_profiles;
create policy "reef_profiles_delete_own"
  on public.reef_profiles for delete
  using (auth.uid() = id);

-- Fast lookup when syncing.
create index if not exists reef_profiles_updated_at_idx
  on public.reef_profiles (updated_at desc);
