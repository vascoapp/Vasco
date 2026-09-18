-- =============================================================================
-- 20260918000001 — one chosen upgrade, one invoice
-- =============================================================================
-- Billing a customer's chosen upgrades stamps the decision tracker so the same
-- choice cannot be billed twice. The tracker is AsyncStorage — device-local, by
-- an explicit earlier decision (its FE ids are `tracker_${Date.now()}` and the
-- database wants UUIDs) — so the stamp does not travel: on a second device, or
-- after a reinstall, the same upgrades bill again and the customer receives two
-- invoices for one decision (#339 D14).
--
-- The de-dup key belongs on the INVOICE because invoices are the side that is
-- backend-backed and therefore shared between devices. `decision_item_ids`
-- records which decision items an invoice already charged for; the billing path
-- refuses when any of them appears on an existing invoice.
--
-- Additive and nullable: every existing invoice has NULL, meaning "not raised
-- from decision upgrades", which is exactly what they are.
alter table public.documents
  add column if not exists decision_item_ids text[];

comment on column public.documents.decision_item_ids is
  'Decision-tracker item ids this invoice charged for. The cross-device guard against billing one chosen upgrade twice; NULL for every invoice not raised from decisions.';

-- Finding "has any invoice already billed this item?" is the hot path of that
-- guard, and it runs per contractor.
create index if not exists documents_decision_item_ids_idx
  on public.documents using gin (decision_item_ids);
