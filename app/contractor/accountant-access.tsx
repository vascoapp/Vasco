// =============================================================================
// ACCOUNTANT ACCESS — who can see your books, and what they saw
// =============================================================================
// The contractor side of the seat. Sending a handover through the share sheet
// is a one-off; a seat is standing access to financial records, and the thing
// that makes standing access safe is being able to see it and take it away.
//
// So this screen is organised around those two questions rather than around
// publishing: every live seat, when the adviser last opened it, and one tap to
// withdraw. Publishing is a single button because it is the easy part.
//
// "Last opened" is deliberately prominent. It answers "did my accountant
// actually look at this?" — which is the question behind most of the chasing
// that happens in a filing week — and it is the only thing the adviser's visit
// writes back.
// =============================================================================

import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert, Share, TextInput, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import { DKScreenHeader } from '../../src/components/shared/DKScreenHeader';
import { hapticSuccess } from '../../src/utils/haptics';
import { logWarn } from '../../src/utils/errorHandler';
import { useAppState } from '../../src/state/AppState';
import {
  listSeats, publishSeat, revokeSeat, type AccountantSeat,
} from '../../src/services/accountantSeatService';

export default function AccountantAccessScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { invoices, businessProfile } = useAppState();
  // Period comes from vat-prep so the seat covers the same quarter the
  // contractor was just looking at — an adviser receiving a filing summary for
  // a different period from the numbers beside it is worse than no summary.
  const { periodStart, periodEnd } = useLocalSearchParams<{ periodStart?: string; periodEnd?: string }>();

  const [seats, setSeats] = useState<AccountantSeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [publishing, setPublishing] = useState(false);

  const country = (businessProfile as any)?.country ?? 'NL';
  const businessName = (businessProfile as any)?.businessName ?? 'Vasco';

  const refresh = useCallback(() => {
    setLoading(true);
    listSeats()
      .then(setSeats)
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const bounds = useCallback(() => {
    if (periodStart && periodEnd) return { start: periodStart, end: periodEnd };
    // Fall back to the current calendar quarter rather than inventing a range.
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), q * 3, 1);
    const end = new Date(now.getFullYear(), q * 3 + 3, 0);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }, [periodStart, periodEnd]);

  const publish = async () => {
    const name = label.trim();
    if (!name) {
      Alert.alert(
        t('accountantAccess.nameRequired', 'Who is this for?'),
        t('accountantAccess.nameRequiredBody', 'Give the seat your accountant’s name so you can tell your seats apart later.'),
      );
      return;
    }
    setPublishing(true);
    try {
      const [{ buildAccountantHandover }, { loadSubmissions }] = await Promise.all([
        import('../../src/services/accountantHandoverService'),
        import('../../src/services/submissionStore'),
      ]);
      const { start, end } = bounds();
      const handover = buildAccountantHandover({
        businessName,
        country,
        periodStart: start,
        periodEnd: end,
        invoices: invoices as never,
        submissions: await loadSubmissions(),
      });
      const seat = await publishSeat({
        label: name,
        businessName,
        country,
        periodStart: start,
        periodEnd: end,
        handover,
      });
      hapticSuccess();
      setLabel('');
      setSeats((prev) => [seat, ...prev.filter((s) => s.id !== seat.id)]);
      await Share.share({
        message: t('accountantAccess.shareMessage', '{{business}} — filing position {{start}} to {{end}}: {{url}}', {
          business: businessName, start, end, url: seat.url,
        }),
      });
    } catch (err) {
      // Every branch here must produce a SENTENCE. The first version translated
      // only 'offline' and passed everything else through, so walking this
      // screen showed a contractor an alert reading exactly "not_signed_in" —
      // an internal code, in English, in a Dutch app. Same family as the raw
      // entity ids the queue generator is tested against: an identifier that
      // reaches the user is a defect even when the logic behind it is right.
      const code = String((err as Error)?.message ?? err);
      const message =
        code === 'offline'
          ? t('accountantAccess.needsOnline', 'You need to be online to publish a seat — otherwise you would be sending a link that does not work yet.')
          : code === 'not_signed_in'
            ? t('accountantAccess.needsSignIn', 'Sign in to your Vasco account to publish a seat. If you are already signed in, sign out and back in, then try again.')
            : code === 'label_required'
              ? t('accountantAccess.nameRequiredBody', 'Give the seat your accountant’s name so you can tell your seats apart later.')
              // Anything unrecognised gets a sentence too. The code still goes
              // to the log, where it belongs, and not to the contractor.
              : t('accountantAccess.publishFailed', 'The seat could not be published. Check your connection and try again.');
      if (code !== 'offline' && code !== 'not_signed_in' && code !== 'label_required') {
        logWarn('AccountantSeat', `publish failed: ${code}`);
      }
      Alert.alert(t('common.error', 'Error'), message);
    } finally {
      setPublishing(false);
    }
  };

  const confirmRevoke = (seat: AccountantSeat) => {
    Alert.alert(
      t('accountantAccess.revokeTitle', 'Withdraw access?'),
      t('accountantAccess.revokeBody', '{{name}} will no longer be able to open the link. You can publish a new seat for them at any time.', { name: seat.label }),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('accountantAccess.revoke', 'Withdraw'),
          style: 'destructive',
          onPress: async () => {
            const ok = await revokeSeat(seat.id);
            if (ok) {
              hapticSuccess();
              setSeats((prev) => prev.filter((s) => s.id !== seat.id));
            } else {
              Alert.alert(t('common.error', 'Error'), t('accountantAccess.revokeFailed', 'Could not withdraw access. Check your connection and try again.'));
            }
          },
        },
      ],
    );
  };

  const viewedLabel = (seat: AccountantSeat) => {
    if (!seat.lastViewedAt) return t('accountantAccess.neverOpened', 'Not opened yet');
    const when = new Date(seat.lastViewedAt).toLocaleDateString();
    return t('accountantAccess.lastOpened', 'Last opened {{when}} · {{count}}×', { when, count: seat.viewCount });
  };

  return (
    <View style={styles.container}>
      <DKScreenHeader title={t('accountantAccess.title', 'Accountant access')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          {t(
            'accountantAccess.intro',
            'A seat gives your accountant a read-only web page showing which invoices were actually accepted by the tax authority — the one thing their accounting package cannot tell them. They cannot change anything.',
          )}
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('accountantAccess.newSeat', 'Give an accountant a seat')}</Text>
          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder={t('accountantAccess.namePlaceholder', 'Accountant or practice name')}
            placeholderTextColor={SemanticColors.textTertiary}
            autoCapitalize="words"
            editable={!publishing}
          />
          <Pressable
            style={[styles.primaryBtn, publishing && styles.disabled]}
            onPress={publish}
            disabled={publishing}
            accessibilityRole="button"
          >
            {publishing
              ? <ActivityIndicator size="small" color={Palette.white} />
              : <Ionicons name="share-outline" size={16} color={Palette.white} />}
            <Text style={styles.primaryBtnText}>
              {t('accountantAccess.publish', 'Publish and send link')}
            </Text>
          </Pressable>
          <Text style={styles.hint}>
            {t('accountantAccess.hint', 'Publishing again for the same name refreshes the page they already have, rather than sending a second link.')}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>{t('accountantAccess.active', 'Active seats')}</Text>

        {loading && <ActivityIndicator style={{ marginTop: GRID.lg }} color={Palette.hermesOrange} />}

        {!loading && seats.length === 0 && (
          <Text style={styles.empty}>
            {t('accountantAccess.empty', 'No one has access. Publish a seat above to give your accountant one.')}
          </Text>
        )}

        {seats.map((seat) => (
          <View key={seat.id} style={styles.seatCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.seatName}>{seat.label}</Text>
              <Text style={styles.seatMeta}>{seat.periodStart} → {seat.periodEnd}</Text>
              <Text style={[styles.seatMeta, !seat.lastViewedAt && styles.seatMetaQuiet]}>
                {viewedLabel(seat)}
              </Text>
              <Text style={styles.seatMeta}>
                {t('accountantAccess.expires', 'Expires {{when}}', {
                  when: new Date(seat.expiresAt).toLocaleDateString(),
                })}
              </Text>
            </View>
            <View style={styles.seatActions}>
              <Pressable
                onPress={() => { void Share.share({ message: seat.url }); }}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel={t('accountantAccess.resend', 'Send link again')}
              >
                <Ionicons name="share-outline" size={18} color={SemanticColors.textSecondary} />
              </Pressable>
              <Pressable
                onPress={() => confirmRevoke(seat)}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel={t('accountantAccess.revoke', 'Withdraw')}
              >
                <Ionicons name="close-circle-outline" size={18} color={SemanticColors.feedbackError} />
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  content: { padding: GRID.md, paddingBottom: SafeArea.bottom + 40 },
  intro: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
    lineHeight: 19,
    marginBottom: GRID.md,
  },
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    marginBottom: GRID.lg,
  },
  cardTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    marginBottom: GRID.sm,
  },
  input: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize,
    backgroundColor: PAGE_BG,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    paddingHorizontal: GRID.sm,
    paddingVertical: GRID.sm,
    marginBottom: GRID.sm,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.xs,
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.full,
    paddingVertical: GRID.sm + 2,
  },
  primaryBtnText: {
    color: Palette.white,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
  },
  disabled: { opacity: 0.6 },
  hint: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.captionSize,
    marginTop: GRID.sm,
    lineHeight: 18,
  },
  sectionTitle: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: GRID.sm,
  },
  empty: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.captionSize,
    marginTop: GRID.sm,
    lineHeight: 19,
  },
  seatCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    marginBottom: GRID.sm,
  },
  seatName: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    marginBottom: 2,
  },
  seatMeta: { color: SemanticColors.textSecondary, fontSize: TYPE.captionSize, marginTop: 2 },
  seatMetaQuiet: { color: SemanticColors.textTertiary },
  seatActions: { flexDirection: 'row', gap: GRID.xs },
  iconBtn: { padding: GRID.xs },
});
