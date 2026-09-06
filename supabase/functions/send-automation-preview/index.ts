// =============================================================================
// SEND-AUTOMATION-PREVIEW — Supabase Edge Function (R66r49 #5)
// =============================================================================
// Renders any of the 10 workflow-pack templates with realistic mock data and
// emails it to a target inbox so contractors (or product folks) can preview
// what each automation actually sends. Bypasses the AI Action Queue + the
// per-tenant matchTrigger evaluator — purely a render+send harness.
//
// POST /functions/v1/send-automation-preview
// Body: { to: string, packId?: string, stepIndex?: number, locale?: 'nl'|'en'|'de'|'fr'|'es'|'it', sendAll?: boolean }
// Returns: { ok: true, sent: [{ packId, stepIndex, subject, messageId }] }
// =============================================================================

// R66r49 #13 audit: this function bills Resend per email. Without auth a
// bot with the URL could spam emails to arbitrary recipients. Require a
// valid user JWT (any authenticated Vasco user — the preview is a dev
// tool, not a customer feature, so per-user gating is enough).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

async function requireAuth(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized — missing token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) {
    return new Response(JSON.stringify({ ok: false, error: 'server config missing' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const client = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized — invalid token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return { userId: user.id };
}

interface PackStep {
  trigger: string;
  delayDays: number;
  action: string;
  channel: 'email' | 'sms' | 'push' | 'in_app';
  template: string;
  i18nKey?: string;
}

interface Pack {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: PackStep[];
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Inlined snapshot of DEFAULT_PACKS templates per locale. Mirrors the
// production NL templates; non-NL renders fall back to NL when the locale
// key isn't yet translated. Update if `src/services/workflowPackService.ts`
// changes step copy.
const PACKS: Pack[] = [
  {
    id: 'incasso_auto',
    name: 'Incasso Automatisch',
    description: 'Automated payment reminders at -3, +3, +7, +14, +30 days',
    category: 'billing',
    steps: [
      { trigger: 'invoice_sent', delayDays: -3, action: 'send_pre_reminder', channel: 'email', i18nKey: 'workflowPacks.incasso.preReminder', template: 'Hi {{customer}}, factuur {{invoice}} ({{currency}}{{amount}}) vervalt over 3 dagen. Alvast bedankt!' },
      { trigger: 'invoice_overdue', delayDays: 3, action: 'send_friendly_reminder', channel: 'email', i18nKey: 'workflowPacks.incasso.friendlyReminder', template: 'Hi {{customer}}, een vriendelijke herinnering: factuur {{invoice}} ({{currency}}{{amount}}) is 3 dagen over de vervaldatum. Vragen? Laat het weten.' },
      { trigger: 'invoice_overdue', delayDays: 7, action: 'send_reminder', channel: 'email', i18nKey: 'workflowPacks.incasso.reminder', template: 'Hi {{customer}}, factuur {{invoice}} ({{currency}}{{amount}}) staat al 7 dagen open. Mag ik je vragen deze deze week te voldoen?' },
      { trigger: 'invoice_overdue', delayDays: 14, action: 'send_urgent_reminder', channel: 'sms', i18nKey: 'workflowPacks.incasso.urgentReminder', template: 'Herinnering: factuur {{invoice}} ({{currency}}{{amount}}) is 14 dagen achterstallig. Conform EU Richtlijn 2011/7/EU brengen wij vanaf nu wettelijke rente + €40 incassokosten in rekening. Gelieve direct te betalen.' },
      { trigger: 'invoice_overdue', delayDays: 30, action: 'send_final_notice', channel: 'email', i18nKey: 'workflowPacks.incasso.finalNotice', template: 'Laatste herinnering: factuur {{invoice}} ({{currency}}{{amount}}) is 30 dagen achterstallig. Conform EU Richtlijn 2011/7/EU rekenen wij wettelijke rente + €40 incassokosten. Zonder betaling binnen 7 dagen geven wij de vordering uit handen aan een incassobureau, met bijkomende kosten voor uw rekening.' },
    ],
  },
  {
    id: 'offerte_opvolging',
    name: 'Offerte Opvolging',
    description: 'Quote follow-up at 3 + 7 days',
    category: 'quotes',
    steps: [
      { trigger: 'quote_sent', delayDays: 3, action: 'send_quote_followup', channel: 'email', i18nKey: 'workflowPacks.quoteFollowup.day3', template: 'Hi {{customer}}, lukt het om naar de offerte voor {{job}} ({{currency}}{{amount}}) te kijken? Hoor graag van je.' },
      { trigger: 'quote_sent', delayDays: 7, action: 'send_quote_reminder', channel: 'email', i18nKey: 'workflowPacks.quoteFollowup.day7', template: 'Hi {{customer}}, korte reminder: de offerte voor {{job}} is nog 7 dagen geldig. Vragen? Bel of app me.' },
    ],
  },
  {
    id: 'onderhoud_herinnering',
    name: 'Onderhoud Herinnering',
    description: 'Annual maintenance follow-up',
    category: 'maintenance',
    steps: [
      { trigger: 'job_completed', delayDays: 335, action: 'send_maintenance_reminder', channel: 'email', i18nKey: 'workflowPacks.maintenance.reminder', template: 'Beste {{customer}}, het is bijna een jaar geleden dat we {{job}} voor u hebben uitgevoerd. Tijd voor onderhoud?' },
      { trigger: 'job_completed', delayDays: 365, action: 'send_maintenance_followup', channel: 'sms', i18nKey: 'workflowPacks.maintenance.followup', template: 'Herinnering: tijd voor jaarlijks onderhoud. Bel ons op {{phone}} voor een afspraak.' },
    ],
  },
  {
    id: 'einde_dag',
    name: 'Einde Dag Routine',
    description: '17:00 daily auto-log + flag + prep',
    category: 'admin',
    steps: [
      { trigger: 'daily_17:00', delayDays: 0, action: 'auto_log_hours', channel: 'in_app', i18nKey: 'workflowPacks.endOfDay.logHours', template: 'Uren vandaag: {{hours}}u gewerkt op {{jobCount}} klussen.' },
      { trigger: 'daily_17:00', delayDays: 0, action: 'flag_incomplete_jobs', channel: 'push', i18nKey: 'workflowPacks.endOfDay.incompleteJobs', template: '{{count}} klussen nog niet afgerond vandaag.' },
      { trigger: 'daily_17:00', delayDays: 0, action: 'prep_tomorrow', channel: 'in_app', i18nKey: 'workflowPacks.endOfDay.prepTomorrow', template: 'Morgen: {{tomorrowJobs}} klussen gepland.' },
    ],
  },
  {
    id: 'nieuw_klant_welkom',
    name: 'Nieuw Klant Welkom',
    description: 'Welcome + start notifications',
    category: 'customer',
    steps: [
      { trigger: 'quote_accepted', delayDays: 0, action: 'send_welcome', channel: 'email', i18nKey: 'workflowPacks.newCustomer.welcome', template: 'Welkom {{customer}}! Bedankt voor uw vertrouwen. Uw project {{job}} staat ingepland. U kunt de voortgang volgen via uw klantportaal.' },
      { trigger: 'job_started', delayDays: 0, action: 'send_start_notification', channel: 'sms', i18nKey: 'workflowPacks.newCustomer.start', template: 'Goed nieuws: we zijn begonnen met {{job}}! Verwachte oplevering: {{endDate}}.' },
    ],
  },
  {
    id: 'klant_keuze_herinnering',
    name: 'Klant Keuze Herinnering',
    description: 'Decision-pending nudges at 3 + 7 days',
    category: 'customer',
    steps: [
      { trigger: 'decision_pending', delayDays: 3, action: 'send_decision_reminder', channel: 'email', i18nKey: 'workflowPacks.decisions.reminder', template: 'Beste {{customer}}, u heeft nog openstaande keuzes voor {{project}}. Laat het ons weten zodat we verder kunnen.' },
      { trigger: 'decision_pending', delayDays: 7, action: 'send_decision_urgent', channel: 'sms', i18nKey: 'workflowPacks.decisions.urgent', template: '{{customer}}, uw keuzes voor {{project}} zijn nodig om vertraging te voorkomen. Reageer alstublieft vandaag.' },
    ],
  },
  {
    id: 'inkoop_automatisch',
    name: 'Inkoop Automatisch',
    description: 'Stock-low + price-drop + bulk alerts',
    category: 'admin',
    steps: [
      { trigger: 'stock_low', delayDays: 0, action: 'send_reorder_alert', channel: 'push', i18nKey: 'workflowPacks.purchasing.stockLow', template: '{{material}} bijna op ({{stock}} over). Bestel bij {{supplier}} voor €{{price}}/stuk.' },
      { trigger: 'price_drop', delayDays: 0, action: 'send_price_alert', channel: 'in_app', i18nKey: 'workflowPacks.purchasing.priceDrop', template: '{{material}} is {{pct}}% goedkoper bij {{supplier}}. Bespaar €{{savings}} per bestelling.' },
      { trigger: 'bulk_opportunity', delayDays: 0, action: 'send_bulk_alert', channel: 'push', i18nKey: 'workflowPacks.purchasing.bulk', template: 'Combineer bestellingen voor {{material}} over {{jobCount}} klussen — bespaar €{{savings}} met bulkkorting.' },
    ],
  },
  {
    id: 'dagelijkse_update',
    name: 'Dagelijkse Klant Update',
    description: 'Per-clockout customer progress SMS',
    category: 'customer',
    steps: [
      { trigger: 'job_clockout', delayDays: 0, action: 'send_progress_note', channel: 'sms', i18nKey: 'workflowPacks.dailyUpdate.progress', template: 'Hi {{customer}}, update: {{hours}}u gewerkt aan {{job}} vandaag. Alles op schema. Vragen? Laat het weten!' },
    ],
  },
  {
    id: 'oplevering_pakket',
    name: 'Oplevering Pakket',
    description: 'Handover-ready + 7-day satisfaction survey',
    category: 'admin',
    steps: [
      { trigger: 'job_completed', delayDays: 0, action: 'prepare_handover', channel: 'in_app', i18nKey: 'workflowPacks.handover.ready', template: "Opleveringspakket klaar: {{photoCount}} foto's, {{hours}}u gewerkt. Verstuur naar {{customer}}." },
      { trigger: 'job_completed', delayDays: 7, action: 'send_satisfaction_survey', channel: 'sms', i18nKey: 'workflowPacks.handover.survey', template: 'Hi {{customer}}, hoe was je ervaring met {{job}}? Je feedback helpt ons verbeteren!' },
    ],
  },
  {
    id: 'vergunning_check',
    name: 'Vergunning & Permit Check',
    description: 'Required-permit auto-check on job creation',
    category: 'admin',
    steps: [
      { trigger: 'job_created', delayDays: 0, action: 'check_permits', channel: 'in_app', i18nKey: 'workflowPacks.permits.check', template: 'Vergunningscheck voor {{job}}: {{permitCount}} vereisten gevonden voor {{country}}.' },
    ],
  },
];

const MOCK_DATA: Record<string, string> = {
  customer: 'Familie de Vries',
  invoice: 'F2026-0042',
  amount: '2.450,00',
  currency: '€',
  job: 'Badkamerrenovatie 1e verdieping',
  hours: '7,5',
  jobCount: '3',
  count: '2',
  tomorrowJobs: '4',
  phone: '+31 6 12 34 56 78',
  endDate: '15 mei 2026',
  project: 'Badkamerrenovatie',
  material: 'Sanitair tegels 30x60',
  stock: '8',
  supplier: 'Pontmeyer Amsterdam',
  price: '24,50',
  pct: '12',
  savings: '147,00',
  photoCount: '24',
  permitCount: '2',
  country: 'Nederland',
};

function resolveTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`);
}

function buildEmailHtml(opts: {
  pack: Pack;
  step: PackStep;
  resolved: string;
  recipient: string;
}): string {
  const { pack, step, resolved } = opts;
  const channelBadge = step.channel.toUpperCase();
  const triggerLabel = step.trigger.replace(/_/g, ' ');
  const offsetLabel = step.delayDays === 0
    ? 'fires immediately'
    : step.delayDays > 0
      ? `fires +${step.delayDays}d after ${triggerLabel}`
      : `fires ${step.delayDays}d before ${triggerLabel}`;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${pack.name} preview</title></head>
<body style="margin:0;padding:0;background:#0B0E11;font-family:-apple-system,Segoe UI,sans-serif;color:#FFFFFF">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="font-size:11px;letter-spacing:1.4px;color:#F97316;text-transform:uppercase;font-weight:800">VASCO AUTOMATION PREVIEW</div>
    <h1 style="font-size:22px;font-weight:900;margin:8px 0 4px;letter-spacing:1.2px;text-transform:uppercase">${pack.name}</h1>
    <div style="font-size:13px;color:#9CA3AF;margin-bottom:24px">${pack.description}</div>

    <div style="background:#14181F;border:1px solid #2A3038;border-radius:14px;padding:20px;margin-bottom:16px">
      <div style="font-size:11px;letter-spacing:1px;color:#F97316;text-transform:uppercase;font-weight:700;margin-bottom:8px">Step ${pack.steps.indexOf(step) + 1} · ${channelBadge}</div>
      <div style="font-size:13px;color:#9CA3AF;margin-bottom:12px">${offsetLabel}</div>
      <div style="font-size:15px;line-height:1.5;color:#FFFFFF;white-space:pre-wrap">${resolved.replace(/</g, '&lt;')}</div>
    </div>

    <div style="background:#1C2128;border-radius:10px;padding:16px;font-size:12px;color:#9CA3AF;line-height:1.6">
      <strong style="color:#FFFFFF">Mock context:</strong><br/>
      • Pack ID: <code style="color:#F59E0B">${pack.id}</code><br/>
      • Trigger: <code style="color:#F59E0B">${step.trigger}</code><br/>
      • Action: <code style="color:#F59E0B">${step.action}</code><br/>
      • Channel: <code style="color:#F59E0B">${step.channel}</code><br/>
      • i18nKey: <code style="color:#F59E0B">${step.i18nKey ?? '(none)'}</code>
    </div>

    <div style="margin-top:24px;font-size:11px;color:#6B7280;text-align:center">
      This is a preview render. The real automation queues into the AI Action<br/>
      Queue for one-tap contractor approval before sending.
    </div>
  </div>
</body></html>`;
}

interface RequestBody {
  to?: string;
  packId?: string;
  stepIndex?: number;
  locale?: string;
  sendAll?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'POST only' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // R66r49 #13: require authenticated caller.
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const body = (await req.json()) as RequestBody;
    const to = body.to;
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid `to`' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      return new Response(JSON.stringify({ ok: false, error: 'RESEND_API_KEY not set' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fromAddress = Deno.env.get('AUTOMATION_PREVIEW_FROM') ?? Deno.env.get('SEND_INVOICE_FROM') ?? 'Vasco <noreply@mail.vascobuild.com>';
    const targetSteps: { pack: Pack; step: PackStep; idx: number }[] = [];

    if (body.sendAll) {
      for (const pack of PACKS) {
        pack.steps.forEach((step, idx) => targetSteps.push({ pack, step, idx }));
      }
    } else {
      const pack = PACKS.find((p) => p.id === (body.packId ?? 'incasso_auto'));
      if (!pack) {
        return new Response(JSON.stringify({ ok: false, error: `unknown packId: ${body.packId}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const idx = body.stepIndex ?? 1; // default: friendly reminder (+3 days overdue)
      const step = pack.steps[idx];
      if (!step) {
        return new Response(JSON.stringify({ ok: false, error: `pack ${pack.id} has no step ${idx}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      targetSteps.push({ pack, step, idx });
    }

    const sent: Array<{ packId: string; stepIndex: number; subject: string; messageId: string | null; ok: boolean; error?: string }> = [];

    for (const { pack, step, idx } of targetSteps) {
      const resolved = resolveTemplate(step.template, MOCK_DATA);
      const subject = `[Vasco preview] ${pack.name} — step ${idx + 1} (${step.channel})`;
      const html = buildEmailHtml({ pack, step, resolved, recipient: to });

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [to],
          subject,
          html,
        }),
      });

      const resendJson = await resendRes.json().catch(() => ({}));
      sent.push({
        packId: pack.id,
        stepIndex: idx,
        subject,
        messageId: resendJson?.id ?? null,
        ok: resendRes.ok,
        error: resendRes.ok ? undefined : (resendJson?.message ?? `HTTP ${resendRes.status}`),
      });
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
