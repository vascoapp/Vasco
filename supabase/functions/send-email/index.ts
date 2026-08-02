// =============================================================================
// send-email — Supabase Auth "Send Email Hook"
// =============================================================================
// Replaces Supabase's built-in auth mailer. Renders the branded, LOCALIZED
// template (recipient's own language, DK Sunset Slate identity) and sends it
// via Resend — the same provider the rest of the app already uses (send-invoice,
// churn-winback-email, weekly-digest). This gives auth emails BOTH:
//   • localization  — DE/FR/ES/IT/UK users no longer get Dutch-primary email
//   • deliverability — leaves Supabase's rate-limited built-in sender behind
//
// WHY A HOOK: Supabase's built-in templates are global (one language for all
// recipients). Per-recipient localization is only possible by owning the send
// path, which the Send Email Hook provides.
//
// ─── OPERATOR SETUP (all in the Supabase Dashboard / Management API) ─────────
//   1. Set the secret:   RESEND_API_KEY=re_...   (one key also fixes invoice +
//      digest email, which are currently unsent — see secrets list).
//      Optional: AUTH_EMAIL_FROM="Vasco <noreply@mail.vascobuild.com>"
//                SEND_EMAIL_HOOK_SECRET="v1,whsec_..."  (from the hook config)
//   2. Deploy:   supabase functions deploy send-email --no-verify-jwt
//      (--no-verify-jwt: the hook is authenticated by its own webhook secret,
//       NOT a Supabase JWT.)
//   3. Enable the hook: Auth → Hooks → "Send Email" → HTTPS →
//      https://<ref>.functions.supabase.co/send-email  + copy its secret into
//      SEND_EMAIL_HOOK_SECRET.
//   4. Verify your sending domain in Resend (SPF/DKIM) so mail hits the inbox.
//
// Until the hook is enabled, Supabase keeps using the static global templates in
// supabase/email-templates/ — so nothing regresses; this is purely additive.
// =============================================================================

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import {
  renderAuthEmail,
  resolveEmailLocale,
  type AuthEmailType,
} from '../_shared/authEmailTemplates.ts';

// Supabase email_action_type → our template type.
const ACTION_TO_TYPE: Record<string, AuthEmailType> = {
  signup: 'confirmation',
  confirmation: 'confirmation',
  recovery: 'recovery',
  magiclink: 'magic_link',
  invite: 'invite',
  email_change: 'email_change',
  email_change_new: 'email_change',
  email_change_current: 'email_change',
  reauthentication: 'reauthentication',
};

interface HookPayload {
  user: {
    email?: string;
    new_email?: string;
    user_metadata?: { language?: string; country?: string } | null;
  };
  email_data: {
    token?: string;
    token_hash?: string;
    token_hash_new?: string;
    redirect_to?: string;
    email_action_type?: string;
    site_url?: string;
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const payloadStr = await req.text();

  // --- Verify the Standard Webhooks signature (the hook endpoint is public) ---
  const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET');
  let payload: HookPayload;
  if (hookSecret) {
    try {
      const wh = new Webhook(hookSecret.replace('v1,whsec_', ''));
      payload = wh.verify(payloadStr, Object.fromEntries(req.headers)) as HookPayload;
    } catch (_e) {
      return json({ error: 'invalid signature' }, 401);
    }
  } else {
    // No secret configured yet — parse without verifying so the hook can be
    // smoke-tested before the secret is wired. Set SEND_EMAIL_HOOK_SECRET in
    // production so unsigned callers are rejected.
    try {
      payload = JSON.parse(payloadStr) as HookPayload;
    } catch (_e) {
      return json({ error: 'bad payload' }, 400);
    }
  }

  const { user, email_data } = payload;
  const to = user?.email;
  const action = email_data?.email_action_type ?? '';
  const type = ACTION_TO_TYPE[action];
  if (!to || !type) return json({ error: `unsupported action: ${action}` }, 200);

  // Locale from the user's own profile metadata, falling back en → nl by country.
  const locale = resolveEmailLocale(user.user_metadata?.language, user.user_metadata?.country);

  // Build the verify link (not used for the reauthentication code email).
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? email_data.site_url ?? '';
  const tokenHash = email_data.token_hash_new || email_data.token_hash || '';
  const redirect = email_data.redirect_to || 'https://admin.vascobuild.com/auth/callback';
  const actionUrl =
    `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(tokenHash)}` +
    `&type=${encodeURIComponent(action)}&redirect_to=${encodeURIComponent(redirect)}`;

  const { subject, html } = renderAuthEmail(type, locale, {
    actionUrl,
    token: email_data.token,
    email: user.email,
    newEmail: user.new_email,
  });

  // --- Send via Resend ---
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) return json({ error: 'RESEND_API_KEY not set' }, 500);
  const from = Deno.env.get('AUTH_EMAIL_FROM') ?? 'Vasco <noreply@mail.vascobuild.com>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`send-email: resend ${res.status} ${detail.slice(0, 200)}`);
    // Non-2xx tells Supabase the email didn't send so it can surface the error
    // rather than silently confirming an unsent action.
    return json({ error: `resend ${res.status}` }, 500);
  }

  // Supabase expects an empty 200 on success.
  return json({});
});
