-- =============================================================================
-- APP CONFIG TABLE — R66 round 54 (2026-05-11)
-- =============================================================================
-- Closes the TODO in versionCheckService.ts. Pre-R66r54 the remote-config
-- fetch returned null unconditionally, so every client only ever saw the
-- default minimumVersion 1.0.0 / latestVersion 1.0.0 — meaning the force-
-- update path could never fire. Once we ship the App Store / Play Store
-- listing, blocking a broken release requires this table.
--
-- Public read (anyone can fetch config without auth — same model the
-- feature_flags table uses since R13). Service-role-only write — config
-- changes happen via operator SQL, not user code.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.app_config (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_config_public_read ON public.app_config;
CREATE POLICY app_config_public_read ON public.app_config
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS app_config_service_write ON public.app_config;
CREATE POLICY app_config_service_write ON public.app_config
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- updated_at trigger (reuses the helper from earlier migrations if present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at'
  ) THEN
    CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$;
  END IF;
END $$;

DROP TRIGGER IF EXISTS app_config_set_updated_at ON public.app_config;
CREATE TRIGGER app_config_set_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed version_config with conservative defaults. Operator updates via
-- `update public.app_config set value = '{...}' where key = 'version_config';`
INSERT INTO public.app_config (key, value, description)
VALUES (
  'version_config',
  jsonb_build_object(
    'minimumVersion', '1.0.0',
    'latestVersion', '1.0.0',
    'updateUrl', 'https://apps.apple.com/app/vasco',
    'forceUpdateBelow', '0.9.0'
  ),
  'Minimum + latest app version. forceUpdateBelow blocks anything below that semver from launching.'
)
ON CONFLICT (key) DO NOTHING;
