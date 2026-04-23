// =============================================================================
// REFERRALS SCREEN (R229)
// =============================================================================
// Shows the contractor's personal referral code + share URL + summary
// stats (pending / activated / credited counts). Tap the share button to
// open the native share sheet with a pre-filled message.
// =============================================================================

import { View, Text, StyleSheet, Pressable, ScrollView, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useReferral } from '../../src/services/referralService';
import { DK } from '../../src/theme/draftkings';
import { TYPE, RADIUS, GRID, PAGE_BG } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import { DKScreenHeader } from '../../src/components/shared/DKScreenHeader';
import { DKLabel } from '../../src/components/shared/DKLabel';

export default function ReferralsScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { code, summary, shareUrl, loading, refresh } = useReferral(user?.id ?? null);

  const handleShare = async () => {
    if (!shareUrl || !code) return;
    const message = t('referrals.shareMessage', {
      defaultValue: 'I use Vasco to run my trade — pricing, invoices, and payments in one app. Sign up with my code {{code}} and we both get a month free.\n\n{{url}}',
      code,
      url: shareUrl,
    });
    try {
      await Share.share({
        message,
        url: shareUrl,   // iOS uses this separately from message
      } as any);
      await refresh();
    } catch (e) {
      Alert.alert(
        t('referrals.shareErrorTitle', 'Share failed'),
        (e as Error)?.message ?? String(e),
      );
    }
  };

  return (
    <SafeAreaView style={s.page} edges={['top']}>
      <DKScreenHeader title={t('referrals.title', 'Invite contractors')} />

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <View style={s.hero}>
          <View style={s.iconWrap}>
            <Ionicons name="people-outline" size={28} color={DK.colors.accent} />
          </View>
          <DKLabel style={s.heroTitle}>
            {t('referrals.heroTitle', 'Share Vasco, save together').toUpperCase()}
          </DKLabel>
          <Text style={s.heroSub}>
            {t('referrals.heroSub', 'Every contractor who signs up with your code gets a month free — and so do you, once they send their first invoice.')}
          </Text>
        </View>

        <View style={s.codeCard}>
          <Text style={s.codeLabel}>{t('referrals.yourCode', 'Your code')}</Text>
          <Text style={s.codeValue}>{loading ? '…' : code ?? '—'}</Text>
          <Text style={s.codeUrl} numberOfLines={1} ellipsizeMode="middle">
            {shareUrl ?? ''}
          </Text>

          <Pressable
            onPress={handleShare}
            disabled={!code}
            style={({ pressed }) => [
              s.shareBtn,
              pressed && { opacity: 0.85 },
              !code && { opacity: 0.5 },
            ]}
          >
            <Ionicons name="share-social" size={18} color={DK.colors.bg} />
            <Text style={s.shareBtnText}>{t('referrals.shareCta', 'Share my code')}</Text>
          </Pressable>
        </View>

        <View style={s.statsRow}>
          <StatPill label={t('referrals.statInvited', 'Invited')} value={summary?.totalReferrals ?? 0} />
          <StatPill label={t('referrals.statActive', 'Active')} value={summary?.activatedCount ?? 0} />
          <StatPill label={t('referrals.statCredited', 'Credited')} value={summary?.creditedCount ?? 0} />
        </View>

        <Text style={s.footnote}>
          {t('referrals.footnote', 'Credit is applied automatically when a referred contractor sends their first invoice. No expiry.')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <View style={s.pill}>
      <Text style={s.pillValue}>{value}</Text>
      <Text style={s.pillLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: PAGE_BG },
  scroll: { flex: 1 },
  scrollContent: { padding: SafeArea.side, gap: GRID.lg, paddingBottom: 120 },

  hero: {
    alignItems: 'center',
    gap: GRID.sm,
    paddingVertical: GRID.md,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: DK.colors.accent + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: TYPE.sectionSize, color: DK.colors.text, textAlign: 'center' },
  heroSub: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: DK.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: GRID.lg,
  },

  codeCard: {
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DK.colors.border,
    padding: GRID.md,
    alignItems: 'center',
    gap: GRID.sm,
  },
  codeLabel: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: DK.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  codeValue: {
    fontSize: 40,
    fontFamily: TYPE.titleFamily,
    color: DK.colors.accent,
    letterSpacing: 4,
  },
  codeUrl: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: DK.colors.textMuted,
    maxWidth: '90%',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.xs,
    backgroundColor: DK.colors.accent,
    paddingVertical: GRID.sm,
    paddingHorizontal: GRID.lg,
    borderRadius: RADIUS.md,
    marginTop: GRID.sm,
  },
  shareBtnText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: DK.colors.bg,
  },

  statsRow: {
    flexDirection: 'row',
    gap: GRID.sm,
  },
  pill: {
    flex: 1,
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DK.colors.border,
    padding: GRID.md,
    alignItems: 'center',
    gap: 4,
  },
  pillValue: {
    fontSize: 24,
    fontFamily: TYPE.titleFamily,
    color: DK.colors.text,
  },
  pillLabel: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: DK.colors.textMuted,
  },

  footnote: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: DK.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: GRID.md,
  },
});
