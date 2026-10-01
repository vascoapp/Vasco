-- =============================================================================
-- One line per position per document.
-- =============================================================================
-- `healOrphanLineItems` re-sends the lines of a document created offline. It
-- runs from a React state updater (which React may run twice) and two
-- refreshes can overlap; rows carry no id, so a second run inserted a SECOND
-- set of lines. The client is now idempotent (in-flight set + existing-lines
-- check), but a read-then-insert still races an edit saved at the same moment
-- (review, 2026-10-01). Every writer numbers its lines 0..n-1, so a document
-- can never legitimately hold two lines at one position: the database says so,
-- and the heal inserts with ON CONFLICT DO NOTHING.
-- Prod had 0 duplicate (document_id, position) groups when this was written.
-- =============================================================================

create unique index if not exists line_items_document_position_uq
  on public.line_items (document_id, position);
