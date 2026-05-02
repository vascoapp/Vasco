-- =============================================================================
-- JOB SIGNATURE COLUMNS (R301)
-- =============================================================================
-- Closes the R296 dormancy: customer-handover signatures captured via the
-- SignaturePad on app/contractor/job/[id].tsx were being dropped on BE sync
-- because `signatureSvg` and `customerSignoffAt` weren't on the jobs schema.
-- The FE used `as any` cast to push the field into updateJob, the BE
-- silently ignored unknown columns, and the signature lived in AsyncStorage
-- only — lost on app uninstall.
--
-- After this migration:
--   - signature_svg      = base64-encoded PNG of the customer's signature
--   - customer_signoff_at = timestamp of the handover signature
-- Both nullable. R301's R296 follow-up removes the `as any` cast.
-- =============================================================================

alter table public.jobs
  add column if not exists signature_svg text,
  add column if not exists customer_signoff_at timestamptz;

comment on column public.jobs.signature_svg is
  'Customer handover signature (base64 PNG). Captured by SignaturePad component.';
comment on column public.jobs.customer_signoff_at is
  'Timestamp of the customer-acknowledged work-complete signoff.';
