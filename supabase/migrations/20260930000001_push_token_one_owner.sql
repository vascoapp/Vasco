-- =============================================================================
-- A push token belongs to ONE account at a time.
-- =============================================================================
-- `push_tokens` is unique per (user_id, device_id). When a second contractor
-- signs in on the same phone WITHOUT the first logging out — an email-confirm /
-- recovery link for another account opened while signed in (auth/callback sets
-- its session), or a demo switch — the new account registers its own row and
-- the previous account's row stays. `device_id` survives logout on purpose, so
-- both rows point at the same phone, and every push for the previous
-- contractor (customer names, amounts) kept arriving there (review 2026-09-30,
-- learnings #378).
--
-- The app cannot fix it: RLS lets the new user touch only their own rows. An
-- Expo push token identifies one app install, so the rule is the server's to
-- keep: registering a token or device for one account removes it from every
-- other account.
--
-- SECURITY DEFINER because the rows it removes belong to someone else. It only
-- ever deletes rows sharing the NEW row's token or device_id — never anything
-- the caller could not have registered themselves.
-- Live check: `npm run check:push-owner` (throwaway users, cleaned up).
-- =============================================================================

create or replace function public.push_tokens_one_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.push_tokens
   where user_id <> new.user_id
     and (token = new.token or device_id = new.device_id);
  return new;
end;
$$;

revoke all on function public.push_tokens_one_owner() from public, anon, authenticated;

drop trigger if exists push_tokens_one_owner on public.push_tokens;
create trigger push_tokens_one_owner
  after insert or update of token, device_id on public.push_tokens
  for each row execute function public.push_tokens_one_owner();
