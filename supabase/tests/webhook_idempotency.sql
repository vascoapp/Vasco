-- =============================================================================
-- WEBHOOK IDEMPOTENCY TEST — run against staging
-- =============================================================================
-- R275 / P2-10 — proves webhook_idempotency table prevents double-consumption
-- of credits when a provider retries the same event_id.
-- =============================================================================

-- ─── 1. First call to claimWebhookEvent inserts a fresh row ──────────────────
do $$
declare
  inserted_count int;
begin
  insert into public.webhook_idempotency (provider, event_id)
  values ('mollie', 'test_event_12345')
  on conflict (provider, event_id) do nothing;

  get diagnostics inserted_count = row_count;
  if inserted_count != 1 then
    raise exception 'IDEMPOTENCY FAIL: first insert affected % rows (expected 1)', inserted_count;
  end if;
  raise notice 'IDEMPOTENCY PASS: first insert recorded';
end$$;

-- ─── 2. Second call with same (provider, event_id) is a no-op ────────────────
do $$
declare
  inserted_count int;
begin
  insert into public.webhook_idempotency (provider, event_id)
  values ('mollie', 'test_event_12345')
  on conflict (provider, event_id) do nothing;

  get diagnostics inserted_count = row_count;
  if inserted_count != 0 then
    raise exception 'IDEMPOTENCY FAIL: second insert affected % rows (expected 0 — must be no-op)', inserted_count;
  end if;
  raise notice 'IDEMPOTENCY PASS: duplicate insert was no-op';
end$$;

-- ─── 3. Different event_id under same provider works ─────────────────────────
do $$
declare
  inserted_count int;
begin
  insert into public.webhook_idempotency (provider, event_id)
  values ('mollie', 'test_event_67890')
  on conflict (provider, event_id) do nothing;

  get diagnostics inserted_count = row_count;
  if inserted_count != 1 then
    raise exception 'IDEMPOTENCY FAIL: distinct event_id should insert (got %)', inserted_count;
  end if;
  raise notice 'IDEMPOTENCY PASS: distinct event_id allowed';
end$$;

-- ─── 4. Different provider under same event_id works ─────────────────────────
do $$
declare
  inserted_count int;
begin
  insert into public.webhook_idempotency (provider, event_id)
  values ('stripe', 'test_event_12345')
  on conflict (provider, event_id) do nothing;

  get diagnostics inserted_count = row_count;
  if inserted_count != 1 then
    raise exception 'IDEMPOTENCY FAIL: distinct provider should insert (got %)', inserted_count;
  end if;
  raise notice 'IDEMPOTENCY PASS: distinct provider allowed';
end$$;

-- ─── CLEANUP ────────────────────────────────────────────────────────────────
delete from public.webhook_idempotency
  where event_id in ('test_event_12345', 'test_event_67890');

raise notice 'WEBHOOK IDEMPOTENCY TEST PASSED — (provider, event_id) PK enforces dedup';
