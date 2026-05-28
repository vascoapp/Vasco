import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { DK } from '../src/theme/draftkings';

/**
 * QA-only deep link target. Visit `vasco://reset-onboarding` (or
 * `exp://…/--/reset-onboarding`) to: log out the current user → wipe
 * `@vasco_*` keys → log in as `new@vasco.dev` (a fresh-state demo account
 * with onboardingComplete=false) → push `/onboarding`. Lets a tester see
 * the full 14-step flow without uninstalling Expo Go or signing up again.
 */
export default function ResetOnboardingScreen() {
  const { login, logout, updateUser } = useAuth();
  // `?dest=home` skips the onboarding step list and force-flips the user to
  // onboardingComplete=true so we can verify the post-onboarding Vandaag
  // (first-login simplified screen) without 14 manual taps. No param =
  // existing behavior (drop into onboarding).
  const params = useLocalSearchParams<{ dest?: string; account?: string }>();
  const destHome = params.dest === 'home';
  // `?account=aannemer` logs in as Pieter (renovation GC) instead of the
  // fresh-state new@vasco.dev. Lets us verify aannemer-specific surfaces
  // without manually walking through onboarding picking 2+ trades.
  const accountEmail =
    params.account === 'aannemer' ? 'aannemer@vasco.dev' : 'new@vasco.dev';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await logout();
      } catch {}
      try {
        const keys = await AsyncStorage.getAllKeys();
        const vascoKeys = keys.filter((k) => k.startsWith('@vasco_'));
        if (vascoKeys.length > 0) await AsyncStorage.multiRemove(vascoKeys);
      } catch {}
      if (cancelled) return;
      const result = await login(accountEmail, 'demo');
      if (cancelled) return;
      if (!result.ok) {
        router.replace('/login');
        return;
      }
      if (destHome) {
        updateUser({ onboardingComplete: true });
        // Mark first-login only for the fresh-state new@vasco.dev path.
        // Existing demo accounts (like aannemer@vasco.dev) should land on
        // the normal Vandaag with their seed data + role-specific copy.
        if (accountEmail === 'new@vasco.dev') {
          await AsyncStorage.setItem('@vasco_first_login_pending', 'true').catch(() => {});
        }
        router.replace('/(contractor)' as any);
      } else {
        router.replace('/onboarding' as any);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [login, logout, updateUser, destHome, accountEmail]);

  return (
    <View style={{ flex: 1, backgroundColor: DK.colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={DK.colors.accent} />
      <Text style={{ marginTop: 16, color: DK.colors.textMuted, fontFamily: 'Inter_500Medium' }}>
        Resetting onboarding…
      </Text>
    </View>
  );
}
