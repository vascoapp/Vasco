-- =============================================================================
-- Widen two status CHECKs to match the FE enums (prevent latent 23514s)
-- =============================================================================
-- Both are masked today (the offending values are computed-only / the table
-- isn't persisted yet), but the FE type already allows them, so any future
-- write path would fail with Postgres 23514 and silently drop the row. Widen
-- now per MEMORY rule #8 (drop + recreate the CHECK).
-- =============================================================================

-- documents.status: FE InvoiceStatus includes 'overdue' (src/domain/documents.ts).
-- Currently derived in-memory from dueInDays<0 and never persisted; widen so a
-- future "mark overdue" write is safe.
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_status_check
  CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'paid', 'overdue'));

-- purchase_orders.status: FE POStatus adds 'shipped' + 'invoiced'
-- (src/services/purchaseOrderService.ts). purchaseOrderService is in-memory today
-- (nothing persists to the table), but widen so updateStatus(id,'shipped'|
-- 'invoiced') is safe once PO persistence lands.
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_status_check
  CHECK (status IN ('draft', 'submitted', 'confirmed', 'shipped', 'delivered', 'invoiced', 'cancelled'));
