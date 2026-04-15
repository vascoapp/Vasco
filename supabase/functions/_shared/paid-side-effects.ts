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
): Promise<void> {
  const admin = createClient(supabaseUrl, serviceKey);

  // Pull the invoice + customer email + contractor user id
  const { data: inv, error: invErr } = await admin
    .from('documents')
    .select('id, user_id, customer_id, document_number, total_amount, currency')
    .eq('id', invoiceId)
    .maybeSingle();
  if (invErr || !inv) return;

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
