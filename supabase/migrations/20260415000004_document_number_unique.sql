-- =============================================================================
-- Invoice / Quote number uniqueness per user
-- =============================================================================
-- Prevent two documents from sharing the same number for a single user. The
-- client-side nextDocumentNumber now retries on 23505 (unique_violation) so
-- a brief race won't produce duplicate invoice IDs.
-- =============================================================================

create unique index if not exists documents_user_type_docnum_uq
  on public.documents (user_id, doc_type, document_number);
