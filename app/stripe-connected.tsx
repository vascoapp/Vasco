// =============================================================================
// vasco://stripe-connected — where Stripe Connect's callback returns (2a)
// =============================================================================
// On iOS the in-app browser (openAuthSessionAsync) catches this link itself and
// this screen never mounts. On Android the link can ALSO arrive as a deep link,
// and Expo Router would show "not found" over the Stripe screen after a
// successful connect (review 2026-10-09). This route only steps back: the
// Stripe screen asks the SERVER whether the connection landed.
// =============================================================================

import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { goBack } from '../src/utils/goBack';
import { PAGE_BG } from '../src/theme/tabStyles';

export default function StripeConnectedReturn() {
  const router = useRouter();
  useEffect(() => { goBack(router); }, [router]);
  return <View style={{ flex: 1, backgroundColor: PAGE_BG }} />;
}
