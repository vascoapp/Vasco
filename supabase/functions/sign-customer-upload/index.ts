// =============================================================================
// SIGN-CUSTOMER-UPLOAD — Supabase Edge Function
// =============================================================================
// The customer decision portal (anonymous, no JWT) uploads photos into the
// private `customer-uploads` bucket and needs a long-lived signed URL to store
// in the decision row. Previously the portal called storage.createSignedUrl
// client-side, which required a broad anon SELECT on storage.objects — that
// policy let any anon-key holder enumerate/read every customer's photos (the
// bucket path prefix is the portal access_code). See migration
// 20260711000003_portal_anon_read_hardening.sql, which drops that anon SELECT.
//
// This function replaces the client-side signing: it runs as the service role
// and will only sign paths that live UNDER the caller's own access_code prefix
// (`<accessToken>/...`), so knowing an access_code never lets you sign or read
// another customer's objects, and there is no enumeration surface.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BUCKET = 'customer-uploads';
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;
const MAX_PATHS = 10;
const ACCESS_TOKEN_RE = /^[A-Za-z0-9_-]{4,64}$/;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method Not Allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: 'Server misconfigured' }, 500);

    const { accessToken, paths } = (await req.json()) as { accessToken?: string; paths?: unknown };

    if (!accessToken || !ACCESS_TOKEN_RE.test(accessToken)) {
      return json({ ok: false, error: 'Invalid accessToken' }, 400);
    }
    if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_PATHS) {
      return json({ ok: false, error: 'Invalid paths' }, 400);
    }

    const prefix = `${accessToken}/`;
    const cleanPaths: string[] = [];
    for (const p of paths) {
      if (typeof p !== 'string') return json({ ok: false, error: 'Invalid path entry' }, 400);
      // Must live under the caller's OWN access_code prefix; reject traversal.
      if (!p.startsWith(prefix) || p.includes('..')) {
        return json({ ok: false, error: 'Path outside your prefix' }, 403);
      }
      cleanPaths.push(p);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const urls: string[] = [];
    for (const path of cleanPaths) {
      const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, THIRTY_DAYS_SECONDS);
      if (error || !data?.signedUrl) {
        return json({ ok: false, error: `Could not sign ${path}` }, 500);
      }
      urls.push(data.signedUrl);
    }

    return json({ ok: true, urls });
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
});
