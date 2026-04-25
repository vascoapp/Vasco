-- =============================================================================
-- Push Tokens — Expo push notification registry
-- =============================================================================
-- One row per (user_id, device_id). Upserted on each login; deleted on logout.
-- Consumed by Supabase Edge Functions that fan out notifications via Expo.
-- =============================================================================

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  app_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id)
);

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);
create index if not exists push_tokens_token_idx on public.push_tokens (token);

alter table public.push_tokens enable row level security;

create policy "users manage their own push tokens"
  on public.push_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_push_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists push_tokens_set_updated_at on public.push_tokens;
create trigger push_tokens_set_updated_at
  before update on public.push_tokens
  for each row execute function public.set_push_tokens_updated_at();
