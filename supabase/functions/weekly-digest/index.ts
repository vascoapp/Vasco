// =============================================================================
// WEEKLY-DIGEST — Supabase Edge Function
// =============================================================================
// Designed to be invoked by Supabase Cron every Monday 08:00 local. For each
// active user we compute last week's numbers (new jobs, paid invoices, quotes
// won/lost) and send a single digest email via Resend.
//
// Expected cron (in supabase/config.toml or dashboard):
//   schedule = "0 8 * * 1"   # Mon 08:00
//   command  = "select net.http_post(url := '{supabase_url}/functions/v1/weekly-digest', headers := jsonb_build_object('Authorization','Bearer {service_role_key}'));"
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserDigest {
  userId: string;
  email: string;
  businessName: string;
  language: string;
  newJobs: number;
  paidInvoices: number;
  paidAmount: number;
  openInvoices: number;
  openAmount: number;
  quotesSent: number;
  quotesAccepted: number;
}

const SUBJECT: Record<string, string> = {
  en: 'Your Vasco week',
  nl: 'Jouw Vasco-week',
  de: 'Deine Vasco-Woche',
  fr: 'Votre semaine Vasco',
  es: 'Tu semana Vasco',
  it: 'La tua settimana Vasco',
};

function body(d: UserDigest, locale: string): string {
  const paid = `€${d.paidAmount.toFixed(0)}`;
  const open = `€${d.openAmount.toFixed(0)}`;
  const heading = locale === 'nl' ? `Week van ${d.businessName}`
    : locale === 'de' ? `Woche von ${d.businessName}`
    : locale === 'fr' ? `Semaine de ${d.businessName}`
    : locale === 'es' ? `Semana de ${d.businessName}`
    : locale === 'it' ? `Settimana di ${d.businessName}`
    : `This week for ${d.businessName}`;
  return `
    <h2 style="font-family:sans-serif;color:#0D1B2A">${heading}</h2>
    <table style="font-family:sans-serif;border-collapse:collapse" cellpadding="8">
      <tr><td>🛠️</td><td>${d.newJobs} new jobs</td></tr>
      <tr><td>💶</td><td>${d.paidInvoices} invoices paid — <strong>${paid}</strong></td></tr>
      <tr><td>⏳</td><td>${d.openInvoices} invoices still open — ${open}</td></tr>
      <tr><td>📝</td><td>${d.quotesSent} quotes sent · ${d.quotesAccepted} accepted</td></tr>
    </table>
    <p style="color:#9CA3AF;font-size:12px;font-family:sans-serif">Vasco — digest sent every Monday. Open the app to see the details.</p>
  `;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const fromAddress = Deno.env.get('DIGEST_FROM_EMAIL') ?? 'digest@vasco.app';
  if (!serviceKey || !supabaseUrl || !resendKey) {
    return new Response(JSON.stringify({ ok: false, error: 'Server misconfigured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Only accept the cron caller (service role) — no public unauthenticated digest trigger
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Pull every business profile with an email — each row = one digest candidate
  const { data: profiles } = await admin
    .from('business_settings')
    .select('user_id, business_name, email, country')
    .not('email', 'is', null);

  if (!profiles || profiles.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let sent = 0;
  let skipped = 0;

  for (const p of profiles as any[]) {
    try {
      const userId = p.user_id;

      const [newJobsQ, paidInvQ, openInvQ, quotesSentQ, quotesAcceptedQ] = await Promise.all([
        admin.from('jobs').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since),
        admin.from('documents').select('total_amount', { count: 'exact' }).eq('user_id', userId).eq('doc_type', 'invoice').eq('status', 'paid').gte('paid_at', since),
        admin.from('documents').select('total_amount', { count: 'exact' }).eq('user_id', userId).eq('doc_type', 'invoice').in('status', ['sent', 'overdue']),
        admin.from('documents').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('doc_type', 'quote').eq('status', 'sent').gte('updated_at', since),
        admin.from('documents').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('doc_type', 'quote').eq('status', 'accepted').gte('updated_at', since),
      ]);

      const paidAmount = (paidInvQ.data as any[] | null)?.reduce((s, r) => s + (r.total_amount ?? 0), 0) ?? 0;
      const openAmount = (openInvQ.data as any[] | null)?.reduce((s, r) => s + (r.total_amount ?? 0), 0) ?? 0;

      const digest: UserDigest = {
        userId,
        email: p.email,
        businessName: p.business_name ?? 'Vasco',
        language: (p.country === 'DE' ? 'de' : p.country === 'FR' ? 'fr' : p.country === 'ES' ? 'es' : p.country === 'IT' ? 'it' : p.country === 'UK' ? 'en' : 'nl'),
        newJobs: newJobsQ.count ?? 0,
        paidInvoices: paidInvQ.count ?? 0,
        paidAmount,
        openInvoices: openInvQ.count ?? 0,
        openAmount,
        quotesSent: quotesSentQ.count ?? 0,
        quotesAccepted: quotesAcceptedQ.count ?? 0,
      };

      // Skip dead-air weeks — no point emailing an empty digest
      if (digest.newJobs === 0 && digest.paidInvoices === 0 && digest.quotesSent === 0 && digest.openInvoices === 0) {
        skipped += 1;
        continue;
      }

      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `Vasco <${fromAddress}>`,
          to: [digest.email],
          subject: SUBJECT[digest.language] ?? SUBJECT.en,
          html: body(digest, digest.language),
        }),
      });
      if (resp.ok) sent += 1;
    } catch {}
  }

  return new Response(JSON.stringify({ ok: true, sent, skipped, considered: profiles.length }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
