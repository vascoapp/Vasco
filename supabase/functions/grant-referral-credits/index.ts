// =============================================================================
// GRANT-REFERRAL-CREDITS — Supabase Edge Function (R232)
// =============================================================================
// Thin wrapper around the `grant_referral_credits` RPC. The RPC does all
// the work atomically per attribution (insert two subscription_credits
// rows, flip status to 'credited'); this function just invokes it and
// returns a summary for cron-log visibility.
//
// Expected cron:
//   schedule = "0 4 * * *"   # 04:00 UTC daily
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) return json({ error: 'missing env' }, 500);

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc('grant_referral_credits');
  if (error) return json({ error: error.message }, 500);

  const rows = (data ?? []) as Array<{
    attribution_id: string;
    referrer_user_id: string;
    referred_user_id: string;
    credits_granted: number;
  }>;

  const totalCredits = rows.reduce((s, r) => s + (r.credits_granted ?? 0), 0);
  return json({
    attributions_processed: rows.length,
    total_credits_granted: totalCredits,
    details: rows,
  });
});
