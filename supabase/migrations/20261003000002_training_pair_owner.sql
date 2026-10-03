-- =============================================================================
-- 20261003000002 — the quote-win training pair and its customer weight belong
-- to the CALLER (recursive-learning Loop 5, agent batch B)
-- =============================================================================
-- Loop 5 had never turned: recordPricingOutcome looked the customer up on
-- pricing_intelligence, which has no customer column, so the weight was never
-- asked for; and the job-quality screen never sent the customer, so there was
-- nothing to weigh. Both are fixed in the app. Now that the two functions are
-- actually called, they are tightened — both are SECURITY DEFINER (RLS does
-- not apply) and trusted their arguments:
--
--   * get_customer_quality_weight averaged job_quality_signals for a customer
--     id across EVERY contractor. It now reads the caller's own rows only.
--   * write_training_pair inserted a pair for whatever p_user_id the caller
--     named. A signed-in caller may now write only their own; the service
--     role (auth.uid() is null) is unchanged.
--
-- Signatures, return types, owner and grants are unchanged (CREATE OR REPLACE
-- keeps the ACL: authenticated + service_role execute, no anon).
-- =============================================================================

create or replace function public.get_customer_quality_weight(p_customer_id text)
returns numeric
language sql
security definer
set search_path to 'public'
as $function$
  select coalesce(
    (select avg(composite_score)
       from public.job_quality_signals
      where customer_id = p_customer_id
        and user_id = auth.uid()
        and composite_score is not null
        and updated_at > now() - interval '365 days'),
    1.0
  );
$function$;

create or replace function public.write_training_pair(
  p_model_name text, p_user_id uuid, p_trade text, p_country text, p_features jsonb,
  p_target numeric, p_target_label text, p_source text, p_weight numeric default 1.0)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if auth.uid() is not null and p_user_id is distinct from auth.uid() then
    raise exception 'write_training_pair: a training pair can only be written for yourself'
      using errcode = '42501';
  end if;
  insert into public.model_training_pairs (
    model_name, user_id, trade, country, features, target, target_label, source, weight
  ) values (
    p_model_name, p_user_id, p_trade, p_country, p_features, p_target, p_target_label, p_source, p_weight
  ) returning id into v_id;
  return v_id;
end; $function$;

revoke all on function public.get_customer_quality_weight(text) from public, anon;
revoke all on function public.write_training_pair(text, uuid, text, text, jsonb, numeric, text, text, numeric) from public, anon;
grant execute on function public.get_customer_quality_weight(text) to authenticated, service_role;
grant execute on function public.write_training_pair(text, uuid, text, text, jsonb, numeric, text, text, numeric) to authenticated, service_role;
