// =============================================================================
// Paid-invoice side effects — shared by mollie-webhook + stripe-webhook
// =============================================================================
// After an invoice flips to `paid`, we:
//   1. Email the customer a short receipt via send-invoice (Resend)
//   2. Fire a push notification to every device of the contractor via send-push
// Both are best-effort and must not block the webhook's 200 response.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    .select('id, user_id, customer_id, document_number, total_amount, currency, issue_date, due_date, sent_at')
    .eq('id', invoiceId)
    .maybeSingle();
  if (invErr || !inv) return;

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
      await admin.from('invoice_outcomes').insert({
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
    }
  } catch (err) {
    console.warn('invoice_outcomes seed failed:', String(err));
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
  const amountStr = total != null ? `€${total.toFixed(2)}` : '';

  // 1. Customer receipt email
  if (customerEmail) {
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          invoiceId,
          to: customerEmail,
          subject: `Receipt ${ref}`,
          locale: 'en',
        }),
      });
    } catch {}
  }

  // 2. Contractor push notification
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        userId: inv.user_id,
        title: 'Payment received',
        body: customerName ? `${customerName} paid ${amountStr} — ${ref}` : `Invoice ${ref} paid ${amountStr}`,
        data: { type: 'invoice_paid', invoiceId },
      }),
    });
  } catch {}
}
