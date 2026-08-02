// =============================================================================
// CONTRACTOR ROUTE GROUP — error boundary (R257)
// =============================================================================
// Expo Router auto-renders this when any screen inside (contractor)/* throws
// during render. Keeps a crash on Vandaag from taking down Werk/Geld/etc.
// =============================================================================

import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { DK } from '../../src/theme/draftkings';
import { TYPE, GRID, RADIUS } from '../../src/theme/tabStyles';
import { DKLabel } from '../../src/components/shared/DKLabel';
import { captureException } from '../../src/lib/errorReporting';

interface Props {
  error: Error;
  retry: () => void;
}

export default function ContractorErrorScreen({ error, retry }: Props) {
  const { t } = useTranslation();

  useEffect(() => {
    captureException(error, { route: 'contractor' });
  }, [error]);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="alert-circle" size={40} color={DK.colors.accent} />
        </View>
        <DKLabel style={styles.title}>{t('error.somethingWrong', 'SOMETHING WENT WRONG')}</DKLabel>
        <Text style={styles.body}>
          {t('error.bodyContractor', 'A screen failed to render. Your data is safe — try again or pick another tab.')}
        </Text>

        <Pressable
          style={styles.retryBtn}
          onPress={retry}
          accessibilityRole="button"
          accessibilityLabel={t('error.retry', 'Try again')}
        >
          <Text style={styles.retryBtnText}>{t('error.retry', 'TRY AGAIN').toUpperCase()}</Text>
        </Pressable>

        {__DEV__ && error?.message ? (
          <View style={styles.devBox}>
            <Text style={styles.devLabel}>DEV details</Text>
            <Text style={styles.devText} numberOfLines={20}>{String(error.message)}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DK.colors.bg },
  content: { padding: GRID.lg, gap: GRID.md, alignItems: 'center', paddingTop: GRID.xl },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: DK.colors.accent + '22',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: GRID.md,
  },
  title: { color: DK.colors.text, fontSize: 16 },
  body: {
    color: DK.colors.textMuted,
    fontFamily: TYPE.bodyFamily, fontSize: 14,
    textAlign: 'center', maxWidth: 320,
  },
  retryBtn: {
    marginTop: GRID.lg,
    backgroundColor: DK.colors.accent,
    paddingHorizontal: GRID.xl, paddingVertical: GRID.md,
    borderRadius: RADIUS.full,
    shadowColor: DK.colors.accent, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  retryBtnText: { color: '#000', fontFamily: TYPE.titleFamily, fontSize: 14, letterSpacing: 1.4 },
  devBox: {
    marginTop: GRID.xl,
    padding: GRID.md,
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.md,
    width: '100%',
  },
  devLabel: { fontSize: 11, fontFamily: TYPE.captionFamily, color: DK.colors.textMuted, letterSpacing: 1 },
  devText: { fontSize: 12, fontFamily: TYPE.bodyFamily, color: DK.colors.danger ?? '#EF4444', marginTop: 8 },
});
