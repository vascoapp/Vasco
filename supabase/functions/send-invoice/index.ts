// =============================================================================
// SEND-INVOICE — Supabase Edge Function
// =============================================================================
// Sends an invoice (optionally with a payment link) to a customer's email.
// Provider: Resend (https://resend.com). Requires RESEND_API_KEY secret.
// =============================================================================
// POST /functions/v1/send-invoice
// Body: { invoiceId, to, subject?, paymentUrl?, pdfBase64?, locale? }
// Returns: { ok: true, messageId } | { ok: false, error }
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SendInvoiceRequest {
  invoiceId: string;
  to: string;
  subject?: string;
  paymentUrl?: string;
  pdfBase64?: string; // base64-encoded PDF attachment
  locale?: 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';
  /** Optional plain-text body override. Used by the dunning cadence so the
   * firm/final reminders include the EU Directive 2011/7/EU statutory
   * interest + €40 recovery disclosure. When present, replaces the stock
   * HTML template (converted to simple HTML paragraphs). */
  bodyOverride?: string;
}

const SUBJECT_BY_LOCALE: Record<string, (ref: string) => string> = {
  en: (ref) => `Invoice ${ref}`,
  nl: (ref) => `Factuur ${ref}`,
  de: (ref) => `Rechnung ${ref}`,
  fr: (ref) => `Facture ${ref}`,
  es: (ref) => `Factura ${ref}`,
  it: (ref) => `Fattura ${ref}`,
};

const BODY_BY_LOCALE: Record<string, (args: { ref: string; businessName: string; paymentUrl?: string }) => string> = {
  en: ({ ref, businessName, paymentUrl }) => `
    <p>Hi,</p>
    <p>Please find attached invoice <strong>${ref}</strong> from <strong>${businessName}</strong>.</p>
    ${paymentUrl ? `<p><a href="${paymentUrl}" style="display:inline-block;padding:12px 20px;background:#F97316;color:#fff;border-radius:8px;text-decoration:none">Pay now</a></p>` : ''}
    <p>Thanks,<br/>${businessName}</p>
  `,
  nl: ({ ref, businessName, paymentUrl }) => `
    <p>Hallo,</p>
    <p>Hierbij de factuur <strong>${ref}</strong> van <strong>${businessName}</strong>.</p>
    ${paymentUrl ? `<p><a href="${paymentUrl}" style="display:inline-block;padding:12px 20px;background:#F97316;color:#fff;border-radius:8px;text-decoration:none">Nu betalen</a></p>` : ''}
    <p>Met vriendelijke groet,<br/>${businessName}</p>
  `,
  de: ({ ref, businessName, paymentUrl }) => `
    <p>Guten Tag,</p>
    <p>anbei die Rechnung <strong>${ref}</strong> von <strong>${businessName}</strong>.</p>
    ${paymentUrl ? `<p><a href="${paymentUrl}" style="display:inline-block;padding:12px 20px;background:#F97316;color:#fff;border-radius:8px;text-decoration:none">Jetzt bezahlen</a></p>` : ''}
    <p>Mit freundlichen Grüßen,<br/>${businessName}</p>
  `,
  fr: ({ ref, businessName, paymentUrl }) => `
    <p>Bonjour,</p>
    <p>Veuillez trouver ci-joint la facture <strong>${ref}</strong> de <strong>${businessName}</strong>.</p>
    ${paymentUrl ? `<p><a href="${paymentUrl}" style="display:inline-block;padding:12px 20px;background:#F97316;color:#fff;border-radius:8px;text-decoration:none">Payer maintenant</a></p>` : ''}
    <p>Cordialement,<br/>${businessName}</p>
  `,
  es: ({ ref, businessName, paymentUrl }) => `
    <p>Hola,</p>
    <p>Adjuntamos la factura <strong>${ref}</strong> de <strong>${businessName}</strong>.</p>
    ${paymentUrl ? `<p><a href="${paymentUrl}" style="display:inline-block;padding:12px 20px;background:#F97316;color:#fff;border-radius:8px;text-decoration:none">Pagar ahora</a></p>` : ''}
    <p>Un saludo,<br/>${businessName}</p>
  `,
  it: ({ ref, businessName, paymentUrl }) => `
    <p>Salve,</p>
    <p>In allegato la fattura <strong>${ref}</strong> da <strong>${businessName}</strong>.</p>
    ${paymentUrl ? `<p><a href="${paymentUrl}" style="display:inline-block;padding:12px 20px;background:#F97316;color:#fff;border-radius:8px;text-decoration:none">Paga ora</a></p>` : ''}
    <p>Cordiali saluti,<br/>${businessName}</p>
  `,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    // Auth: require a valid Supabase JWT (contractor sending their own invoice)
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromAddress = Deno.env.get('INVOICE_FROM_EMAIL') ?? 'invoices@vascobuild.com';

    if (!supabaseUrl || !supabaseAnon || !serviceKey || !resendKey) {
      return new Response(JSON.stringify({ ok: false, error: 'Server misconfigured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller via JWT
    const authClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await authClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: SendInvoiceRequest = await req.json();
    const { invoiceId, to, paymentUrl, pdfBase64, locale = 'nl' } = body;
    if (!invoiceId || !to) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing invoiceId or to' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch invoice + issuer business profile via service role (user_id scoped)
    const admin = createClient(supabaseUrl, serviceKey);
    // Canonical store is `documents` (doc_type='invoice') — there is no
    // `invoices` table, so this fn previously 404'd on every send. Only
    // id/user_id/document_number are actually used below.
    const { data: invoice, error: invErr } = await admin
      .from('documents')
      .select('id, document_number, user_id')
      .eq('id', invoiceId)
      .eq('doc_type', 'invoice')
      .single();
    if (invErr || !invoice) {
      return new Response(JSON.stringify({ ok: false, error: 'Invoice not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (invoice.user_id !== user.id) {
      return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await admin
      .from('business_settings')
      .select('business_name')
      .eq('user_id', user.id)
      .maybeSingle();
    const businessName = (profile as any)?.business_name ?? 'Vasco';

    const ref = (invoice as any).document_number ?? invoice.id;
    const subject = body.subject ?? (SUBJECT_BY_LOCALE[locale] ?? SUBJECT_BY_LOCALE.en)(ref);
    // bodyOverride (plain text with \n) → simple HTML paragraphs so the Resend
    // email renders the cadence copy + disclosure properly.
    // R66 round 4: localize the dunning-cadence "Pay now" button to match
    // the customer's locale. Was hardcoded English even when the rest of
    // the override body (cadence copy + EU 2011/7 disclosure) is localized
    // by the FE caller.
    const PAY_NOW_BY_LOCALE: Record<string, string> = {
      en: 'Pay now',
      nl: 'Nu betalen',
      de: 'Jetzt bezahlen',
      fr: 'Payer maintenant',
      es: 'Pagar ahora',
      it: 'Paga ora',
    };
    const payNowLabel = PAY_NOW_BY_LOCALE[locale] ?? PAY_NOW_BY_LOCALE.en;
    const html = body.bodyOverride
      ? body.bodyOverride
          .split(/\n{2,}/)
          .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
          .join('\n') +
        (paymentUrl
          ? `<p><a href="${paymentUrl}" style="display:inline-block;padding:12px 20px;background:#F97316;color:#fff;border-radius:8px;text-decoration:none">${payNowLabel}</a></p>`
          : '')
      : (BODY_BY_LOCALE[locale] ?? BODY_BY_LOCALE.en)({ ref, businessName, paymentUrl });

    const emailPayload: Record<string, unknown> = {
      from: `${businessName} <${fromAddress}>`,
      to: [to],
      subject,
      html,
    };
    if (pdfBase64) {
      emailPayload.attachments = [
        { filename: `${ref}.pdf`, content: pdfBase64 },
      ];
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    const resendJson = await resendRes.json().catch(() => ({}));
    if (!resendRes.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: resendJson?.message ?? 'Email send failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Mark invoice as sent
    await admin
      .from('documents')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', invoiceId)
      .eq('doc_type', 'invoice');

    return new Response(JSON.stringify({ ok: true, messageId: resendJson?.id ?? null }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
