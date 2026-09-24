-- =============================================================================
-- Indexes for the erasure worker's owner deletes (review 2026-09-24).
-- =============================================================================
-- drain-account-deletions now deletes these tables by owner explicitly (their
-- FK to auth.users is ON DELETE SET NULL, so the cascade would keep the rows).
-- Without an owner index each delete — and each SET NULL cascade — scans the
-- whole table. Tiny today; analytics_events grows with every app open.
-- =============================================================================
create index if not exists analytics_events_user_id_idx on public.analytics_events (user_id);
create index if not exists job_embeddings_user_id_idx on public.job_embeddings (user_id);
create index if not exists model_training_pairs_user_id_idx on public.model_training_pairs (user_id);
create index if not exists material_price_history_observed_by_idx on public.material_price_history (observed_by);
