// =============================================================================
// REFERRAL DEEP-LINK HANDLER (R231)
// =============================================================================
// Catches https://admin.vascobuild.com/ref/CODE universal links on iOS,
// https://admin.vascobuild.com/ref/CODE app links on Android, and the
// vasco://ref/CODE custom scheme fallback.
//
// The route has no UI — it stashes the code via AsyncStorage and
// immediately redirects:
//   - Not signed in → /signup?ref=CODE  (the signup screen reads the
//     param and renders the "Referred · code X" chip from R230)
//   - Signed in     → /(contractor)     (the code is stashed; an admin
//     can use it for retroactive attribution via the referrals screen,
//     but we don't spam an existing user mid-session)
// =============================================================================

import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { stashPendingReferral } from '../../src/services/referralAttributionService';
import { DK } from '../../src/theme/draftkings';
import { PAGE_BG } from '../../src/theme/tabStyles';

export default function ReferralDeepLink() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  const { user } = useAuth();

  useEffect(() => {
    const raw = Array.isArray(code) ? code[0] : code;
    (async () => {
      const clean = raw ? await stashPendingReferral(raw) : null;
      if (user) {
        // Already signed in — keep them in the app; the next sign-out → sign-up
        // cycle (or an invited friend's next open) will pick up the code.
        router.replace('/(contractor)' as any);
      } else {
        // Not signed in — deliver the user straight to signup with the code
        // echoed so the signup screen's useLocalSearchParams fires.
        const target = clean ? `/signup?ref=${encodeURIComponent(clean)}` : '/signup';
        router.replace(target as any);
      }
    })();
  }, [code, user]);

  // Brief splash while the effect runs — users barely see this.
  return (
    <View style={s.wrap}>
      <ActivityIndicator size="large" color={DK.colors.accent} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: PAGE_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
