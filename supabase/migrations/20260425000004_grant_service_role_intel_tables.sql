-- =============================================================================
-- Service-role grants on intelligence tables (R238)
-- =============================================================================
-- The intelligence migrations enable RLS and create policies, but never
-- explicitly GRANT to service_role. Edge Functions running as service_role
-- get "permission denied" on basic SELECT. Fix by granting on every table
-- the train-extra-models / weekly-retrain-models / generator-rates pipeline
-- needs to read.
-- =============================================================================

grant all on public.pricing_intelligence       to service_role;
grant all on public.job_duration_data          to service_role;
grant all on public.customer_payment_patterns  to service_role;
grant all on public.material_price_history     to service_role;
grant all on public.job_embeddings             to service_role;
grant all on public.ai_models                  to service_role;
grant all on public.ai_predictions             to service_role;
grant all on public.cohort_weekly_stats        to service_role;
grant all on public.contractor_skill_profiles  to service_role;
grant all on public.business_events            to service_role;
grant all on public.job_outcomes               to service_role;
grant all on public.invoice_outcomes           to service_role;
grant all on public.accounting_loops           to service_role;
grant all on public.calibration_entries        to service_role;
grant all on public.feedback_weights           to service_role;
grant all on public.data_events                to service_role;
grant all on public.integration_connections    to service_role;
grant all on public.learning_profiles          to service_role;
grant all on public.insight_interactions       to service_role;
grant all on public.price_observations         to service_role;
grant all on public.cohort_benchmarks          to service_role;

-- Future-proof: service_role gets ALL on every existing + future table in public.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on functions to service_role;
alter default privileges in schema public grant all on sequences to service_role;
