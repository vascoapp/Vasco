// =============================================================================
// Paid-invoice side effects — shared by mollie-webhook + stripe-webhook
// =============================================================================
// After an invoice flips to `paid`, we:
//   1. Email the customer a short receipt via send-invoice (Resend)
//   2. Fire a push notification to every device of the contractor via send-push
// Both are best-effort and must not block the webhook's 200 response.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { pushOutcome } from './pushOutcome.ts';

/** The contractor's "payment received" push, per language (was English only). */
const PAID_COPY: Record<string, { title: string; body: (who: string | null, amount: string, ref: string) => string }> = {
  en: { title: 'Payment received', body: (w, a, r) => (w ? `${w} paid ${a} — ${r}` : `Invoice ${r} paid: ${a}`) },
  nl: { title: 'Betaling ontvangen', body: (w, a, r) => (w ? `${w} heeft ${a} betaald — ${r}` : `Factuur ${r} betaald: ${a}`) },
  de: { title: 'Zahlung eingegangen', body: (w, a, r) => (w ? `${w} hat ${a} bezahlt — ${r}` : `Rechnung ${r} bezahlt: ${a}`) },
  fr: { title: 'Paiement reçu', body: (w, a, r) => (w ? `${w} a payé ${a} — ${r}` : `Facture ${r} payée : ${a}`) },
  es: { title: 'Pago recibido', body: (w, a, r) => (w ? `${w} ha pagado ${a} — ${r}` : `Factura ${r} pagada: ${a}`) },
  it: { title: 'Pagamento ricevuto', body: (w, a, r) => (w ? `${w} ha pagato ${a} — ${r}` : `Fattura ${r} pagata: ${a}`) },
};

export async function dispatchPaidSideEffects(
  supabaseUrl: string,
  serviceKey: string,
  invoiceId: string,
  paidAt?: string,
): Promise<void> {
  const admin = createClient(supabaseUrl, serviceKey);

  // Pull the invoice + customer email + contractor user id.
  // R275: also pull issue_date, due_date, sent_at to seed invoice_outcomes
  // (the DSO training table).
  const { data: inv, error: invErr } = await admin
    .from('documents')
    // No `currency`: documents has no such column, so this select failed
    // with 42703 on EVERY payment and the early return below silently skipped
    // the receipt, the push and the DSO training row (found by the live-schema
    // column scan, convergence plan P0.3, 2026-09-24).
    .select('id, user_id, customer_id, document_number, total_amount, issue_date, due_date, sent_at')
    .eq('id', invoiceId)
    .maybeSingle();
  if (invErr || !inv) {
    console.error(`paid side effects skipped for invoice ${invoiceId}: ${invErr?.message ?? 'invoice not found'}`);
    return;
  }

  // ---------------------------------------------------------------------------
  // 0. Seed invoice_outcomes for the DSO model (R275, P0-4 e2e fix)
  //
  // Without this row, predict_customer_dso has no training signal — every
  // contractor stays at the global default. Fire-and-forget; insert errors
  // are logged but don't block the receipt email / push.
  // ---------------------------------------------------------------------------
  try {
    const issuedAt = (inv as any).sent_at || (inv as any).issue_date;
    const dueAt = (inv as any).due_date;
    const total = typeof (inv as any).total_amount === 'number' ? (inv as any).total_amount : 0;
    if (issuedAt && dueAt) {
      const issued = new Date(issuedAt).getTime();
      const paid = new Date(paidAt || new Date().toISOString()).getTime();
      const daysToPayment = Math.max(0, Math.round((paid - issued) / 86400000));
      const isOverdue = paid > new Date(dueAt).getTime();
      // Fires exactly once per payment, behind the idempotency claim — so a
      // dropped row is NEVER recoverable and there is no backfill. It is the
      // training row `predict_customer_dso` learns from; without it that
      // contractor's DSO silently falls back to the global default forever.
      const { error: outcomeErr } = await admin.from('invoice_outcomes').insert({
        user_id: inv.user_id,
        invoice_id: invoiceId,
        customer_id: inv.customer_id,
        amount: total,
        issued_at: new Date(issuedAt).toISOString(),
        due_at: new Date(dueAt).toISOString(),
        paid_at: new Date(paid).toISOString(),
        days_to_payment: daysToPayment,
        is_overdue: isOverdue,
      });
      if (outcomeErr) {
        // The catch below cannot see this: supabase-js resolves with
        // `{ error }` rather than throwing (#353).
        console.error(`invoice_outcomes seed failed for invoice ${invoiceId}:`, outcomeErr.message);
      }
    }
  } catch (err) {
    console.warn('invoice_outcomes seed threw:', String(err));
  }

  let customerEmail: string | null = null;
  let customerName: string | null = null;
  if (inv.customer_id) {
    const { data: cust } = await admin
      .from('customers')
      .select('email, name')
      .eq('id', inv.customer_id)
      .maybeSingle();
    customerEmail = cust?.email ?? null;
    customerName = cust?.name ?? null;
  }

  const ref = (inv as any).document_number ?? inv.id;
  const total = typeof (inv as any).total_amount === 'number' ? (inv as any).total_amount : null;

  // The contractor's country sets the language and the currency of the push —
  // it was English with a hardcoded "€" (so "€1234.50" to a German contractor,
  // € on a UK invoice). Profile first (CLAUDE.md).
  const { data: settings } = await admin
    .from('business_settings')
    .select('country')
    .eq('user_id', inv.user_id)
    .maybeSingle();
  const country = String((settings as any)?.country ?? '').toUpperCase();
  const lang = ({ NL: 'nl', DE: 'de', FR: 'fr', ES: 'es', IT: 'it' } as Record<string, string>)[country] ?? 'en';
  const locale = ({ NL: 'nl-NL', DE: 'de-DE', FR: 'fr-FR', ES: 'es-ES', IT: 'it-IT', UK: 'en-GB', US: 'en-US' } as Record<string, string>)[country] ?? 'en-GB';
  const currency = country === 'UK' ? 'GBP' : country === 'US' ? 'USD' : 'EUR';
  const amountStr = total != null ? new Intl.NumberFormat(locale, { style: 'currency', currency }).format(total) : '';

  // 1. Customer receipt — DELIBERATELY NOT SENT (review 2026-09-24).
  // This called send-invoice with the service key: send-invoice resolves the
  // caller with auth.getUser(), which a service key cannot satisfy, so it was
  // a 401 on every payment. Do NOT "fix" that auth as a one-liner: send-invoice
  // emails "please find attached invoice" (not a receipt, always English
  // here) and then sets status='sent' on the invoice this webhook just marked
  // PAID — which reopens dunning. A receipt needs its own template and must
  // never write the invoice status. Open decision in the sweep tracker.
  void customerEmail;

  // 2. Contractor push notification
  try {
    const pushRes = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        userId: inv.user_id,
        title: PAID_COPY[lang].title,
        body: PAID_COPY[lang].body(customerName, amountStr, String(ref)),
        data: { type: 'invoice_paid', invoiceId },
      }),
    });
    const outcome = pushOutcome(await pushRes.json().catch(() => null));
    if (!pushRes.ok || !outcome.delivered) {
      console.error(`payment-received push NOT delivered for invoice ${invoiceId}: ${pushRes.status} ${outcome.error ?? ''}`);
    }
  } catch (err) {
    console.error(`payment-received push request failed for invoice ${invoiceId}:`, String(err));
  }
}
