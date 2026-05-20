// =============================================================================
// SMS SERVICE — Twilio-backed transactional SMS (R79 US Phase 2)
// =============================================================================
// Wraps the Supabase `send-sms` edge function which proxies to Twilio.
// Surfaces three templated send paths for the US "On my way" + payment
// reminder flows; raw `sendSms` is available for ad-hoc messages.
//
// Operator setup (deferred to launch):
//   supabase secrets set TWILIO_ACCOUNT_SID=ACxxx \
//                       TWILIO_AUTH_TOKEN=xxx \
//                       TWILIO_FROM=+1XXXXXXXXXX
//   supabase functions deploy send-sms
//
// Until those secrets land, every send returns
// `{ ok: false, reason: 'sms_disabled' }` so dev flows don't break and
// the contractor sees a clear "configure Twilio in Settings" hint.
// =============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logWarn } from '../utils/errorHandler';
import { isFeatureEnabled } from './featureFlagService';

export type SmsSendResult =
  | { ok: true; sid: string }
  | { ok: false; reason: 'sms_disabled' | 'invalid_phone' | 'twilio_error' | 'network' | 'rate_limited' };

// Twilio E.164 format: + followed by country code and number, no spaces.
// US numbers: +1 followed by 10 digits. Reject anything malformed up-front
// so we don't waste a Twilio API call (~$0.0075 minimum each).
const E164 = /^\+\d{10,15}$/;

export function isValidPhone(phone: string): boolean {
  return E164.test(phone.replace(/[\s\-()]/g, ''));
}

/**
 * Send a raw SMS via Twilio. Use the templated helpers below for the
 * common contractor flows ("on my way", "payment reminder").
 *
 * Returns `{ ok: false, reason: 'sms_disabled' }` when the feature flag
 * is off or Twilio creds are unset — never throws. Caller is the
 * customerCommunicationService dispatcher; it falls through to email/
 * WhatsApp when SMS is unavailable.
 */
export async function sendSms(to: string, body: string): Promise<SmsSendResult> {
  if (!isFeatureEnabled('sms_us')) return { ok: false, reason: 'sms_disabled' };

  const cleaned = to.replace(/[\s\-()]/g, '');
  if (!isValidPhone(cleaned)) return { ok: false, reason: 'invalid_phone' };

  if (!isSupabaseConfigured) {
    // Dev / demo mode — no real Twilio call. Log and return success-shape
    // so UI dialogs render the "sent" state without hitting the network.
    logWarn('sendSms', `supabase not configured, no-op (to=${cleaned}, len=${body.length})`);
    return { ok: true, sid: `dev-${Date.now()}` };
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-sms', {
      body: { to: cleaned, body },
    });
    if (error) {
      logWarn('sendSms', `edge fn error: ${error.message}`);
      return { ok: false, reason: 'twilio_error' };
    }
    if (data?.sid) return { ok: true, sid: data.sid };
    return { ok: false, reason: 'twilio_error' };
  } catch (e) {
    logWarn('sendSms', `threw: ${(e as Error).message}`);
    return { ok: false, reason: 'network' };
  }
}

// ─── Templated US flows ─────────────────────────────────────────────────

export interface OnMyWayParams {
  customerPhone: string;
  contractorName: string;
  etaMinutes: number;
  trackingUrl?: string;
}

/**
 * "On My Way" text — fires from the contractor app when a tech taps
 * "Heading there" on a scheduled job. US contractors expect this; per
 * the research report, Housecall Pro / Jobber both ship it as default.
 */
export async function sendOnMyWaySms(p: OnMyWayParams): Promise<SmsSendResult> {
  const tracking = p.trackingUrl ? ` Track: ${p.trackingUrl}` : '';
  const body = `Hi! ${p.contractorName} is on the way — ETA ${p.etaMinutes} min.${tracking} Reply STOP to opt out.`;
  return sendSms(p.customerPhone, body);
}

export interface PaymentReminderParams {
  customerPhone: string;
  contractorName: string;
  invoiceNumber: string;
  amount: string; // pre-formatted "$1,234.50"
  paymentUrl: string;
  daysOverdue?: number;
}

/**
 * Payment reminder text — fires from the auto-collection cadence at
 * 7-day and 14-day buckets. Brief and direct so the unsubscribe link
 * doesn't push the payment CTA below the SMS preview.
 */
export async function sendPaymentReminderSms(p: PaymentReminderParams): Promise<SmsSendResult> {
  const overdue = p.daysOverdue && p.daysOverdue > 0
    ? ` (${p.daysOverdue} days overdue)`
    : '';
  const body = `Reminder from ${p.contractorName}: Invoice ${p.invoiceNumber} for ${p.amount} is due${overdue}. Pay: ${p.paymentUrl} — Reply STOP to opt out.`;
  return sendSms(p.customerPhone, body);
}

export interface AppointmentConfirmationParams {
  customerPhone: string;
  contractorName: string;
  date: string;     // pre-formatted "Tue, May 21"
  timeWindow: string; // pre-formatted "9–11 AM"
}

/**
 * Booking confirmation text — fires when an estimate is accepted and the
 * job is auto-scheduled. Closes the "wait, is this still on?" loop that
 * US customers complain about for trades.
 */
export async function sendAppointmentConfirmationSms(p: AppointmentConfirmationParams): Promise<SmsSendResult> {
  const body = `Confirmed: ${p.contractorName} will arrive ${p.date}, ${p.timeWindow}. Reply CANCEL to reschedule.`;
  return sendSms(p.customerPhone, body);
}
