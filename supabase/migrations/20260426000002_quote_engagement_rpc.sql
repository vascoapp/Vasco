-- =============================================================================
-- Quote engagement aggregation (R242)
-- =============================================================================
-- Closes the customer-portal capture-without-loop gap. Aggregates
-- customer_portal_events per quote so the contractor's quote detail screen
-- can show "Customer opened 3 times, expanded pricing twice, hovered accept,
-- spent 14 min total" — and the weekly quote-win retrain can use those
-- signals as features.
-- =============================================================================

create or replace function public.get_quote_engagement(p_quote_id text)
returns table (
  total_events bigint,
  unique_sessions bigint,
  portal_opened_count bigint,
  quote_viewed_count bigint,
  price_expanded_count bigint,
  line_clicked_count bigint,
  photo_viewed_count bigint,
  accept_hovered_count bigint,
  decline_hovered_count bigint,
  question_started_count bigint,
  question_sent_count bigint,
  total_engagement_seconds numeric,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  decided boolean,
  decision text
)
language sql
security definer
set search_path = public
as $$
  with events as (
    select * from public.customer_portal_events
    where quote_id = p_quote_id
  )
  select
    count(*)::bigint as total_events,
    count(distinct portal_token)::bigint as unique_sessions,
    count(*) filter (where event_type = 'portal_opened')::bigint,
    count(*) filter (where event_type = 'quote_viewed')::bigint,
    count(*) filter (where event_type = 'price_expanded')::bigint,
    count(*) filter (where event_type = 'line_clicked')::bigint,
    count(*) filter (where event_type = 'photo_viewed')::bigint,
    count(*) filter (where event_type = 'accept_hovered')::bigint,
    count(*) filter (where event_type = 'decline_hovered')::bigint,
    count(*) filter (where event_type = 'question_started')::bigint,
    count(*) filter (where event_type = 'question_sent')::bigint,
    coalesce(sum(duration_ms) / 1000.0, 0)::numeric as total_engagement_seconds,
    min(created_at) as first_seen_at,
    max(created_at) as last_seen_at,
    bool_or(event_type in ('accepted','declined')) as decided,
    case
      when bool_or(event_type = 'accepted') then 'accepted'
      when bool_or(event_type = 'declined') then 'declined'
      else null
    end as decision
  from events;
$$;

grant execute on function public.get_quote_engagement(text) to authenticated, service_role;

-- Aggregate version for the training pipeline. Returns numeric features
-- ready to merge into model_training_pairs.features payload.
create or replace function public.get_quote_engagement_features(p_quote_id text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_build_object(
    'total_events', count(*),
    'unique_sessions', count(distinct portal_token),
    'opens', count(*) filter (where event_type = 'portal_opened'),
    'price_expands', count(*) filter (where event_type = 'price_expanded'),
    'accept_hovers', count(*) filter (where event_type = 'accept_hovered'),
    'decline_hovers', count(*) filter (where event_type = 'decline_hovered'),
    'questions_sent', count(*) filter (where event_type = 'question_sent'),
    'engagement_seconds', coalesce(sum(duration_ms) / 1000.0, 0)
  ), '{}'::jsonb)
  from public.customer_portal_events
  where quote_id = p_quote_id;
$$;

grant execute on function public.get_quote_engagement_features(text) to service_role;
