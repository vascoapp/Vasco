// =============================================================================
// NOT FOUND — the route that catches everything else
// =============================================================================
// Without this file Expo Router renders its own built-in screen: white-on-black
// "Unmatched Route / Page could not be found." with blue "Go back · Sitemap"
// links. Hardcoded English in every locale, none of the DK type or colour, and
// a "Sitemap" link that drops the contractor into the developer route index.
//
// It is reachable in normal use — a stale deep link, a push notification
// pointing at a renamed route, or any `router.push` to a path that has moved —
// and it is the one screen a user sees at the exact moment something is already
// going wrong. Landing there in a foreign language, off-brand, with a dead-end
// developer link, reads as a broken app rather than a missing page.
//
// Deliberately does NOT try to explain what went wrong: the user cannot act on
// a route name. It offers the two things they can do — go back, or go home.
// =============================================================================

import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { DK } from '../src/theme/draftkings';
import { TYPE, GRID, RADIUS } from '../src/theme/tabStyles';
import { DKLabel } from '../src/components/shared/DKLabel';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.root}>
        <View style={styles.body}>
          <View style={styles.iconWrap}>
            <Ionicons name="compass-outline" size={34} color={DK.colors.accent} />
          </View>

          <Text style={styles.title}>
            {t('notFound.title', 'This page has moved')}
          </Text>
          <Text style={styles.text}>
            {t('notFound.body', 'The link you followed no longer points anywhere. Nothing is lost — go back, or start again from Today.')}
          </Text>

          <Pressable
            style={styles.cta}
            onPress={() => router.replace('/(contractor)' as never)}
            accessibilityRole="button"
          >
            <LinearGradient
              colors={[DK.colors.primaryDark, DK.colors.primary, DK.colors.accent]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <DKLabel style={styles.ctaText}>{t('notFound.home', 'Go to Today')}</DKLabel>
          </Pressable>

          {/* Only offered when there is somewhere to go back TO — a dead
              "Back" on a cold start from a deep link is another dead end. */}
          {router.canGoBack() && (
            <Pressable
              style={styles.secondary}
              onPress={() => router.back()}
              accessibilityRole="button"
            >
              <Ionicons name="chevron-back" size={16} color={DK.colors.textMuted} />
              <Text style={styles.secondaryText}>{t('common.back', 'Back')}</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DK.colors.bg },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: GRID.xl,
    gap: GRID.sm,
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: DK.colors.accent + '22',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: GRID.sm,
  },
  title: {
    fontFamily: DK.type.display900,
    fontSize: 20,
    color: DK.colors.text,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  text: {
    fontFamily: TYPE.bodyFamily,
    fontSize: 14,
    color: DK.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  cta: {
    marginTop: GRID.lg,
    overflow: 'hidden',
    borderRadius: RADIUS.full,
    paddingHorizontal: GRID.xl,
    paddingVertical: GRID.md,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: DK.colors.accent, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  ctaText: { color: '#FFFFFF', fontFamily: TYPE.titleFamily, fontSize: 13, letterSpacing: 1.4 },
  secondary: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: GRID.md, paddingHorizontal: GRID.md,
  },
  secondaryText: { fontFamily: TYPE.bodyFamily, fontSize: 14, color: DK.colors.textMuted },
});
