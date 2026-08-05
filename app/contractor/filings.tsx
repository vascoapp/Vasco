// =============================================================================
// FILINGS — what has actually been filed, and what only looks filed
// =============================================================================
// From 2027–2028 a German or French tradesperson must issue structured
// e-invoices; in Italy and Spain that is already true. The expensive failure in
// all four is not forgetting to send — it is believing you sent.
//
// A rejected FatturaPA is a legal non-event: the invoice was never issued. So
// this screen is organised by that distinction and nothing else. Filings that
// need a human come first, then ones handed over but unconfirmed, then the ones
// genuinely accepted.
//
// Nothing here decides an outcome on the app's behalf. There is no transport
// adapter, so only the contractor sees the SDI receipt or the FACe refusal, and
// only the contractor can record it. An app that quietly marked filings
// accepted to look tidy would be telling them they are compliant when they may
// not be.
// =============================================================================

import { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { SafeArea } from '../../src/theme/spacing';
import { DKScreenHeader } from '../../src/components/shared/DKScreenHeader';
import { hapticSuccess } from '../../src/utils/haptics';
import { useAppState } from '../../src/state/AppState';
import { useSubmissions, recordAuthorityOutcome } from '../../src/services/submissionStore';
import { describeState, type Submission } from '../../src/services/submissionLifecycle';

const CHANNEL_LABEL: Record<string, string> = {
  sdi: 'SDI', face: 'FACe', pdp: 'PDP', peppol: 'Peppol',
  hmrc_cis: 'HMRC CIS', hmrc_mtd: 'HMRC MTD',
};

export default function FilingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { invoices } = useAppState();
  const { submissions, attention, awaiting, refresh } = useSubmissions();

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const accepted = submissions.filter((s) => s.state === 'accepted');

  /** The invoice this filing is about, by reference rather than row id. */
  const subjectLabel = (s: Submission) => {
    const inv = invoices.find((i) => i.id === s.subjectId);
    return inv?.reference || inv?.customer || s.subjectId;
  };

  const confirmOutcome = (s: Submission, outcome: 'accepted' | 'rejected') => {
    Alert.alert(
      outcome === 'accepted'
        ? t('filings.confirmAcceptedTitle', 'Mark as accepted?')
        : t('filings.confirmRejectedTitle', 'Mark as rejected?'),
      outcome === 'accepted'
        ? t('filings.confirmAcceptedBody', 'Only do this once the authority has confirmed it. This is the record that says you filed.')
        : t('filings.confirmRejectedBody', 'A rejected filing was never issued. You will need to correct the invoice and send it again.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.confirm', 'Confirm'),
          style: outcome === 'rejected' ? 'destructive' : 'default',
          onPress: async () => {
            const res = await recordAuthorityOutcome(s.id, outcome);
            if (!res.ok) {
              // The state machine refused it — surface why rather than
              // silently doing nothing.
              Alert.alert(t('filings.cannotChange', 'Cannot change this filing'), res.error ?? '');
              return;
            }
            hapticSuccess();
            refresh();
          },
        },
      ],
    );
  };

  const renderRow = (s: Submission, actionable: boolean) => {
    const last = s.attempts[s.attempts.length - 1];
    return (
      <View key={s.id} style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.subject} numberOfLines={1}>{subjectLabel(s)}</Text>
            <Text style={styles.meta}>
              {CHANNEL_LABEL[s.channel] ?? s.channel} · {new Date(s.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <View style={[
            styles.badge,
            s.state === 'accepted' && styles.badgeOk,
            (s.state === 'rejected' || s.state === 'failed') && styles.badgeBad,
          ]}>
            <Text style={[
              styles.badgeText,
              s.state === 'accepted' && styles.badgeTextOk,
              (s.state === 'rejected' || s.state === 'failed') && styles.badgeTextBad,
            ]}>
              {describeState(s.state)}
            </Text>
          </View>
        </View>

        {/* The authority's own wording, kept verbatim — it is what a correction
            has to answer and what support tickets quote. */}
        {!!last?.authorityCode && (
          <Text style={styles.authorityCode}>
            {t('filings.code', 'Code')} {last.authorityCode}{last.detail ? ` · ${last.detail}` : ''}
          </Text>
        )}

        {s.supersedes && (
          <Text style={styles.supersedes}>
            {t('filings.replaces', 'Replaces an earlier rejected filing')}
          </Text>
        )}

        {actionable && (
          <View style={styles.actions}>
            <Pressable style={styles.rejectBtn} onPress={() => confirmOutcome(s, 'rejected')}>
              <Text style={styles.rejectBtnText}>{t('filings.markRejected', 'Rejected')}</Text>
            </Pressable>
            <Pressable style={styles.acceptBtn} onPress={() => confirmOutcome(s, 'accepted')}>
              <Text style={styles.acceptBtnText}>{t('filings.markAccepted', 'Accepted')}</Text>
            </Pressable>
          </View>
        )}

        {s.state === 'rejected' && (
          <Pressable
            style={styles.fixBtn}
            onPress={() => router.push(`/invoices/${s.subjectId}` as any)}
          >
            <Ionicons name="build-outline" size={15} color={Palette.hermesOrange} />
            <Text style={styles.fixBtnText}>{t('filings.correctInvoice', 'Correct and resend')}</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <DKScreenHeader title={t('filings.title', 'Filings')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          {t('filings.intro', 'Structured invoices you have handed over. Sent is not the same as accepted — only the authority decides that, and only you see their answer.')}
        </Text>

        {attention.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: SemanticColors.feedbackError }]}>
              {t('filings.needsAttention', 'Not filed')}
            </Text>
            {attention.map((s) => renderRow(s, false))}
          </>
        )}

        {awaiting.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>{t('filings.awaiting', 'Awaiting confirmation')}</Text>
            {awaiting.map((s) => renderRow(s, true))}
          </>
        )}

        {accepted.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>{t('filings.accepted', 'Filed')}</Text>
            {accepted.map((s) => renderRow(s, false))}
          </>
        )}

        {submissions.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="document-lock-outline" size={44} color={SemanticColors.textTertiary} />
            <Text style={styles.emptyTitle}>{t('filings.emptyTitle', 'No filings yet')}</Text>
            <Text style={styles.emptyHint}>
              {t('filings.emptyHint', 'Exporting a structured e-invoice from an invoice records it here, so you can track what the authority accepted.')}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  content: { padding: GRID.md, paddingBottom: SafeArea.bottom + 40, gap: GRID.sm },
  intro: { color: SemanticColors.textSecondary, fontSize: TYPE.captionSize, lineHeight: 19 },
  sectionLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: GRID.md,
  },
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    padding: 14,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: GRID.sm },
  subject: { color: SemanticColors.textPrimary, fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily },
  meta: { color: SemanticColors.textSecondary, fontSize: TYPE.captionSize },
  badge: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full,
    backgroundColor: SemanticColors.surfaceSecondary, flexShrink: 0,
  },
  badgeOk: { backgroundColor: SemanticColors.feedbackSuccess + '20' },
  badgeBad: { backgroundColor: SemanticColors.feedbackError + '20' },
  badgeText: { color: SemanticColors.textSecondary, fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily },
  badgeTextOk: { color: SemanticColors.feedbackSuccess },
  badgeTextBad: { color: SemanticColors.feedbackError },
  authorityCode: { color: SemanticColors.feedbackError, fontSize: TYPE.captionSize },
  supersedes: { color: SemanticColors.textTertiary, fontSize: TYPE.captionSize },
  actions: { flexDirection: 'row', gap: GRID.sm, marginTop: 4 },
  rejectBtn: {
    flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: SemanticColors.feedbackError + '60',
  },
  rejectBtnText: { color: SemanticColors.feedbackError, fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily },
  acceptBtn: {
    flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.full,
    backgroundColor: SemanticColors.actionPrimary,
  },
  acceptBtnText: { color: Palette.white, fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily },
  fixBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, marginTop: 4, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: Palette.hermesOrange + '60',
  },
  fixBtnText: { color: Palette.hermesOrange, fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily },
  empty: { alignItems: 'center', padding: GRID.xl, gap: GRID.sm },
  emptyTitle: { color: SemanticColors.textSecondary, fontSize: TYPE.bodySize },
  emptyHint: { color: SemanticColors.textTertiary, fontSize: TYPE.captionSize, textAlign: 'center', lineHeight: 19 },
});
