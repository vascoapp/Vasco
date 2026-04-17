// =============================================================================
// PHOTO SUBMISSIONS PANEL
// =============================================================================
// Shows customer-submitted photos that came in through the decisions portal
// and lets the contractor kick off a "Draft quote from these photos" flow.
// =============================================================================

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../theme/colors';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import type { DecisionSubmission } from '../../services/decisionSyncService';
import { useAuth } from '../../context/AuthContext';
import { analyzePhotoUrls, stashHandoff } from '../../services/photoQuoteHandoffService';
import { hapticSuccess } from '../../utils/haptics';

interface Props {
  submissions: DecisionSubmission[];
  trackerId?: string;
  customerName?: string;
}

export function PhotoSubmissionsPanel({ submissions, trackerId, customerName }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Only customer-submitted rows with at least one photo are interesting here.
  const photoSubmissions = submissions
    .filter((s) => s.submittedBy === 'customer' && Array.isArray(s.photos) && s.photos.length > 0)
    .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));

  if (photoSubmissions.length === 0) return null;

  const handleDraftQuote = async (submission: DecisionSubmission) => {
    if (!submission.photos || submission.photos.length === 0) return;
    const id = submission.id ?? `${submission.trackerId}:${submission.itemId}`;
    setBusyId(id);
    try {
      const result = await analyzePhotoUrls(submission.photos, {
        trade: (user as any)?.trade ?? 'general',
        country: user?.country ?? 'NL',
      });
      await stashHandoff({
        trackerId,
        submissionId: submission.id,
        customerName,
        photoUrls: submission.photos,
        result,
      });
      hapticSuccess();
      router.push('/contractor/tiered-quote' as any);
    } catch {
      Alert.alert(
        t('photoSubmissions.failTitle', 'Analysis failed'),
        t('photoSubmissions.failDesc', 'Could not generate a draft. Try again in a moment.'),
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Ionicons name="images" size={16} color={Palette.hermesOrange} />
        <Text style={styles.title}>{t('photoSubmissions.title', 'Customer photos')}</Text>
      </View>

      {photoSubmissions.slice(0, 3).map((s) => {
        const id = s.id ?? `${s.trackerId}:${s.itemId}`;
        const photos = s.photos ?? [];
        const isBusy = busyId === id;
        return (
          <View key={id} style={styles.row}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: GRID.xs, paddingRight: GRID.sm }}>
              {photos.slice(0, 5).map((uri, i) => (
                <Image key={uri + i} source={{ uri }} style={styles.thumb} />
              ))}
            </ScrollView>
            <View style={styles.meta}>
              <Text style={styles.metaText} numberOfLines={1}>
                {t('photoSubmissions.count', { count: photos.length, defaultValue: '{{count}} photos' })}
                {s.notes ? ` · ${s.notes}` : ''}
              </Text>
              <Pressable
                onPress={() => handleDraftQuote(s)}
                disabled={isBusy}
                style={[styles.draftBtn, isBusy && { opacity: 0.5 }]}
                accessibilityRole="button"
                accessibilityLabel={t('photoSubmissions.draftQuote', 'Draft quote from these photos')}
              >
                {isBusy ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="sparkles" size={14} color="#fff" />
                )}
                <Text style={styles.draftBtnText}>
                  {isBusy
                    ? t('photoSubmissions.analyzing', 'Analyzing…')
                    : t('photoSubmissions.draftQuote', 'Draft quote')}
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: GRID.md,
    gap: GRID.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderMuted,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: GRID.xs },
  title: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  row: {
    flexDirection: 'column',
    gap: GRID.sm,
    paddingTop: GRID.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderMuted,
  },
  thumb: { width: 72, height: 72, borderRadius: RADIUS.md, backgroundColor: SemanticColors.surfaceSecondary },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: GRID.sm },
  metaText: { flex: 1, fontSize: TYPE.captionSize, fontFamily: TYPE.bodyFamily, color: SemanticColors.textSecondary },
  draftBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: GRID.md, paddingVertical: GRID.sm,
    borderRadius: RADIUS.sm, backgroundColor: Palette.hermesOrange,
  },
  draftBtnText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: '#fff' },
});
