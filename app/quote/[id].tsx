// =============================================================================
// PUBLIC QUOTE LINK — deep link target for email CTAs
// =============================================================================
// vasco://quote/:id and https://vascobuild.com/quote/:id route here. Forwards to
// the existing contractor customer-view which handles unauthenticated quote
// access via the `quoteId` param.
//
// 🔴 The `t` token MUST be forwarded. `sign-quote-token` mints
// `.../quote/<id>?t=<hmac>`, and customer-view bails at
// `if (!quoteId || !tokenParam) return;` — it needs the token to fetch the
// quote through the public verify-quote-token function. This screen used to
// forward `quoteId` alone, so a customer arriving on a signed link got an
// empty screen. The break was invisible while QUOTE_LINK_SECRET was unset,
// because no signed link had ever been issued to test it with.
//
// Web fallback for readers without the app: admin/src/app/quote/[id]/page.tsx.
// =============================================================================

import { Redirect, useLocalSearchParams } from 'expo-router';

export default function QuoteDeepLink() {
  const { id, t } = useLocalSearchParams<{ id: string; t?: string }>();

  // A repeated query param arrives as string[]; take the first so the token is
  // always a plain string by the time customer-view verifies it.
  const token = Array.isArray(t) ? t[0] : t;

  return (
    <Redirect
      href={{
        pathname: '/contractor/customer-view',
        params: {
          quoteId: id ?? '',
          // Only pass `t` when it is actually present: customer-view treats a
          // missing token as "signed-in contractor previewing" and a present
          // one as "verify this". An empty string is not the same as absent.
          ...(token ? { t: token } : {}),
        },
      }}
    />
  );
}
