// =============================================================================
// CHURN-WINBACK-EMAIL — Supabase Edge Function (R228)
// =============================================================================
// Weekly sweep: find users with 14+ days of zero business_events, pick a
// win-back variant (new_stalled vs active_quiet), and send a localized
// email via Resend. Rate-limited to max 1 win-back per user per 30 days
// via churn_winback_log.
//
// Expected cron:
//   schedule = "0 10 * * 1"   # Monday 10:00 UTC
//
// Mirrors src/services/churnWinbackPolicy.ts — kept in sync via jest.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Variant = 'new_stalled' | 'active_quiet';
type Locale = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';

const MIN_DAYS_SILENT = 14;
const MIN_DAYS_SINCE_SIGNUP = 7;
const WINBACK_COOLDOWN_DAYS = 30;

// Mirror of src/services/churnWinbackPolicy.ts#TEMPLATES. If you change one,
// change both — the jest suite on the policy file is the synchroniser.
type Template = { subject: string; body: string };
const TEMPLATES: Record<Locale, Record<Variant, Template>> = {
  en: {
    new_stalled: {
      subject: 'Still setting up Vasco?',
      body: "Hi — it's been {days} days since you signed up. Getting the first quote out is the biggest hurdle, so we built a 30-second path:\n\n• Tap 'New quote' from the Vandaag tab\n• Pick a service from the pricebook\n• Vasco tunes the price against the cohort and sends it\n\nThat's it. If something's blocking you, reply to this email — we read every one.\n",
    },
    active_quiet: {
      subject: 'Your Vasco has been quiet',
      body: "You've been away from Vasco for {days} days. Here's what probably piled up while you were heads-down:\n\n• Overdue invoices your customers might forget\n• Quotes past the cohort's typical accept-lag\n• EVE-queue drafts Vasco prepared for you\n\nOpen the app once and we'll show you exactly what to do first.\n",
    },
  },
  nl: {
    new_stalled: { subject: 'Nog aan het opstarten met Vasco?', body: "Hé — {days} dagen geleden heb je je aangemeld. De eerste offerte versturen is de grootste horde, dus we hebben een 30-seconden-pad:\n\n• Tik op 'Nieuwe offerte' vanaf Vandaag\n• Kies een dienst uit het prijsboek\n• Vasco stemt de prijs af op het cohort en stuurt\n\nDat is het. Zit je ergens op vast? Reageer op deze mail — we lezen ze allemaal.\n" },
    active_quiet: { subject: 'Je Vasco is stil', body: "Je bent {days} dagen weggeweest uit Vasco. Dit is wat er waarschijnlijk is opgestapeld:\n\n• Openstaande facturen die klanten kunnen vergeten\n• Offertes voorbij de normale acceptatietijd\n• EVE-wachtrij items die Vasco voor je klaarzet\n\nOpen de app één keer en we laten zien wat je als eerste moet doen.\n" },
  },
  de: {
    new_stalled: { subject: 'Noch am Einrichten von Vasco?', body: "Hallo — {days} Tage seit deiner Anmeldung. Das erste Angebot zu versenden ist die größte Hürde, deshalb gibt es einen 30-Sekunden-Weg:\n\n• 'Neues Angebot' vom Vandaag-Tab antippen\n• Leistung aus dem Preisbuch wählen\n• Vasco stimmt den Preis auf die Kohorte ab und versendet\n\nFertig. Hängst du irgendwo? Antworte auf diese Mail — wir lesen jede.\n" },
    active_quiet: { subject: 'Dein Vasco ist leise', body: "Du warst {days} Tage weg von Vasco. Hier, was sich wahrscheinlich angestaut hat:\n\n• Überfällige Rechnungen, die Kunden vergessen können\n• Angebote jenseits der üblichen Annahmezeit\n• EVE-Queue-Entwürfe, die Vasco für dich vorbereitet hat\n\nÖffne die App einmal und wir zeigen dir, was zuerst dran ist.\n" },
  },
  fr: {
    new_stalled: { subject: 'Toujours en configuration sur Vasco ?', body: "Bonjour — {days} jours depuis votre inscription. Envoyer le premier devis est le plus gros obstacle, donc voici un chemin de 30 secondes :\n\n• Tapez 'Nouveau devis' depuis l'onglet Vandaag\n• Choisissez une prestation dans le catalogue\n• Vasco ajuste le prix sur la cohorte et envoie\n\nC'est tout. Un blocage ? Répondez à cet e-mail — nous les lisons tous.\n" },
    active_quiet: { subject: 'Votre Vasco est silencieux', body: "Vous avez été absent de Vasco pendant {days} jours. Voici ce qui s'est probablement accumulé :\n\n• Factures impayées que vos clients peuvent oublier\n• Devis au-delà du délai habituel d'acceptation\n• Éléments EVE que Vasco a préparés pour vous\n\nOuvrez l'app une fois et nous vous montrons quoi faire en premier.\n" },
  },
  es: {
    new_stalled: { subject: '¿Aún configurando Vasco?', body: "Hola — han pasado {days} días desde que te registraste. Enviar el primer presupuesto es el mayor obstáculo, por eso hay una ruta de 30 segundos:\n\n• Toca 'Nuevo presupuesto' desde la pestaña Vandaag\n• Elige un servicio del catálogo\n• Vasco ajusta el precio con la cohorte y lo envía\n\nEso es todo. ¿Algo te bloquea? Responde a este correo — los leemos todos.\n" },
    active_quiet: { subject: 'Tu Vasco está en silencio', body: "Has estado ausente de Vasco {days} días. Esto es lo que probablemente se ha acumulado:\n\n• Facturas vencidas que los clientes pueden olvidar\n• Presupuestos pasados del tiempo de aceptación típico\n• Borradores EVE que Vasco preparó para ti\n\nAbre la app una vez y te mostramos qué hacer primero.\n" },
  },
  it: {
    new_stalled: { subject: 'Ancora in configurazione su Vasco?', body: "Ciao — sono passati {days} giorni dall'iscrizione. Mandare il primo preventivo è lo scoglio più grande, quindi c'è un percorso da 30 secondi:\n\n• Tocca 'Nuovo preventivo' dalla scheda Vandaag\n• Scegli un servizio dal listino\n• Vasco calibra il prezzo sulla coorte e invia\n\nFatto. Qualcosa ti blocca? Rispondi a questa mail — le leggiamo tutte.\n" },
    active_quiet: { subject: 'Il tuo Vasco è silenzioso', body: "Sei stato lontano da Vasco per {days} giorni. Ecco cosa probabilmente si è accumulato:\n\n• Fatture scadute che i clienti possono dimenticare\n• Preventivi oltre il tempo di accettazione tipico\n• Bozze della coda EVE che Vasco ha preparato\n\nApri l'app una volta e ti mostriamo cosa fare per primo.\n" },
  },
};

function localeForCountry(country: string | null | undefined): Locale {
  switch ((country ?? '').toUpperCase()) {
    case 'NL': return 'nl';
    case 'DE': return 'de';
    case 'FR': return 'fr';
    case 'ES': return 'es';
    case 'IT': return 'it';
    case 'UK':
    default:   return 'en';
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Every sender must sit on the ONE domain verified in Resend
// (mail.vascobuild.com). Resend rejects a From on an unverified domain with a
// 403, so a stray root-domain address here would silently kill the whole run.
const WINBACK_FROM = Deno.env.get('WINBACK_FROM_EMAIL') ?? 'Vasco <hello@mail.vascobuild.com>';

async function sendResend(apiKey: string, to: string, subject: string, textBody: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: WINBACK_FROM,
        to,
        subject,
        text: textBody,
      }),
    });
    if (!res.ok) return { ok: false, error: `resend ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!supabaseUrl || !serviceRole || !resendKey) return json({ error: 'missing env' }, 500);

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = Date.now();
  const silentCutoff = new Date(now - MIN_DAYS_SILENT * 24 * 60 * 60 * 1000).toISOString();
  const cooldownCutoff = new Date(now - WINBACK_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const signupCutoff = new Date(now - MIN_DAYS_SINCE_SIGNUP * 24 * 60 * 60 * 1000).toISOString();

  // 1. All users with a signup_completed event older than MIN_DAYS_SINCE_SIGNUP.
  const { data: signups, error: signupErr } = await admin
    .from('business_events')
    .select('user_id, created_at')
    .eq('event_type', 'signup_completed')
    .lt('created_at', signupCutoff);
  if (signupErr) return json({ error: signupErr.message }, 500);

  const signupByUser = new Map<string, string>();
  for (const row of (signups ?? []) as Array<{ user_id: string; created_at: string }>) {
    if (!signupByUser.has(row.user_id)) signupByUser.set(row.user_id, row.created_at);
  }

  const results: Array<{ userId: string; variant: string | 'none'; delivery: string }> = [];
  let sentCount = 0;

  for (const [userId, signupIso] of signupByUser) {
    // 2. Cooldown check: any winback sent in last 30 days → skip.
    const { count: recentWinbacks } = await admin
      .from('churn_winback_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('sent_at', cooldownCutoff);
    if ((recentWinbacks ?? 0) > 0) {
      results.push({ userId, variant: 'none', delivery: 'cooldown' });
      continue;
    }

    // 3. Latest business_event. If more recent than silentCutoff, they're
    // not silent → skip.
    const { data: lastEvent } = await admin
      .from('business_events')
      .select('created_at, event_type')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    const latestIso = (lastEvent && lastEvent[0]?.created_at) || signupIso;
    if (latestIso > silentCutoff) {
      results.push({ userId, variant: 'none', delivery: 'active' });
      continue;
    }

    // 4. Has this user ever done a monetary action?
    const { count: monetaryCount } = await admin
      .from('business_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('event_type', ['quote_sent', 'quote_accepted', 'invoice_sent', 'payment_received']);
    const hasMonetary = (monetaryCount ?? 0) > 0;
    const variant: Variant = hasMonetary ? 'active_quiet' : 'new_stalled';

    // 5. Email address + locale via business_settings join.
    const { data: settings } = await admin
      .from('business_settings')
      .select('country, email')
      .eq('user_id', userId)
      .maybeSingle();
    const email: string | null =
      ((settings as any)?.email)
      || (await admin.auth.admin.getUserById(userId)).data.user?.email
      || null;
    if (!email) {
      results.push({ userId, variant: 'none', delivery: 'no_email' });
      continue;
    }
    const locale = localeForCountry((settings as any)?.country);
    const tpl = TEMPLATES[locale][variant];

    const daysSince = Math.floor((now - new Date(latestIso).getTime()) / (24 * 60 * 60 * 1000));
    const body = tpl.body.replace('{days}', String(daysSince));

    const { ok, error } = await sendResend(resendKey, email, tpl.subject, body);
    await admin.from('churn_winback_log').insert({
      user_id: userId,
      variant,
      locale,
      days_since_activity: daysSince,
      success: ok,
      error: error ?? null,
    });
    if (ok) sentCount += 1;
    results.push({ userId, variant, delivery: ok ? 'sent' : `failed:${error}` });
  }

  return json({
    processed: signupByUser.size,
    sent: sentCount,
    details: results,
  });
});
