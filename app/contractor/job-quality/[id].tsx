// =============================================================================
// JOB QUALITY FEEDBACK (R239)
// =============================================================================
// Standalone screen the contractor lands on after a job completes (or via
// a "Feedback" button on the job detail). Captures the four signals the
// job_quality_signals table composites into a 0-1 score:
//   - paid_on_time
//   - customer_review_score (1-5 stars)
//   - referral_generated
//   - rebook_within_180d
//
// One write to upsertJobQualitySignal closes the loop — the trigger
// computes composite_score, which weights training data downstream.
// =============================================================================

import { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DK } from '../../../src/theme/draftkings';
import { TYPE, GRID, RADIUS } from '../../../src/theme/tabStyles';
import { DKScreenHeader } from '../../../src/components/shared/DKScreenHeader';
import { DKLabel } from '../../../src/components/shared/DKLabel';
import { upsertJobQualitySignal } from '../../../src/services/intelligenceCaptureService';
import { hapticSuccess } from '../../../src/utils/haptics';

export default function JobQualityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [paidOnTime, setPaidOnTime] = useState<boolean | null>(null);
  const [reviewScore, setReviewScore] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [referral, setReferral] = useState(false);
  const [rebook, setRebook] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await upsertJobQualitySignal({
        jobId: id,
        paidOnTime: paidOnTime ?? undefined,
        customerReviewScore: reviewScore ?? undefined,
        customerReviewText: reviewText.trim() || undefined,
        referralGenerated: referral,
        rebookWithin180d: rebook,
      });
      hapticSuccess();
      Alert.alert('Saved', 'Job quality feedback recorded.');
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <DKScreenHeader title="JOB QUALITY" />
      <ScrollView contentContainerStyle={styles.content}>
        <DKLabel style={styles.section}>PAID ON TIME?</DKLabel>
        <View style={styles.row}>
          <Pill label="Yes" active={paidOnTime === true} onPress={() => setPaidOnTime(true)} />
          <Pill label="No" active={paidOnTime === false} onPress={() => setPaidOnTime(false)} />
        </View>

        <DKLabel style={styles.section}>CUSTOMER REVIEW</DKLabel>
        <View style={styles.row}>
          {[1, 2, 3, 4, 5].map((n) => (
            <TouchableOpacity key={n} onPress={() => setReviewScore(n)} style={styles.star}>
              <Ionicons
                name={reviewScore !== null && n <= reviewScore ? 'star' : 'star-outline'}
                size={32}
                color={DK.colors.accent}
              />
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          value={reviewText}
          onChangeText={setReviewText}
          placeholder="Optional review text"
          placeholderTextColor={DK.colors.textMuted}
          multiline
          style={styles.textarea}
        />

        <DKLabel style={styles.section}>REFERRAL GENERATED?</DKLabel>
        <View style={styles.row}>
          <Pill label="Yes" active={referral} onPress={() => setReferral(true)} />
          <Pill label="No" active={!referral} onPress={() => setReferral(false)} />
        </View>

        <DKLabel style={styles.section}>EXPECT TO REBOOK WITHIN 6 MONTHS?</DKLabel>
        <View style={styles.row}>
          <Pill label="Yes" active={rebook} onPress={() => setRebook(true)} />
          <Pill label="No" active={!rebook} onPress={() => setRebook(false)} />
        </View>

        <TouchableOpacity
          style={[styles.submit, submitting && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitText}>{submitting ? 'SAVING…' : 'SAVE FEEDBACK'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DK.colors.bg },
  content: { padding: GRID.lg, gap: GRID.md },
  section: {
    color: DK.colors.textMuted,
    marginTop: GRID.md,
    marginBottom: GRID.xs,
  },
  row: { flexDirection: 'row', gap: GRID.sm },
  pill: {
    paddingHorizontal: GRID.lg,
    paddingVertical: GRID.sm,
    borderRadius: RADIUS.full,
    backgroundColor: DK.colors.panel,
    borderWidth: 1,
    borderColor: DK.colors.border,
  },
  pillActive: {
    backgroundColor: DK.colors.accent,
    borderColor: DK.colors.accent,
  },
  pillText: { color: DK.colors.text, fontFamily: TYPE.bodyFamily, fontSize: 14 },
  pillTextActive: { color: '#000' },
  star: { padding: GRID.xs },
  textarea: {
    backgroundColor: DK.colors.panel,
    borderRadius: RADIUS.md,
    borderColor: DK.colors.border,
    borderWidth: 1,
    color: DK.colors.text,
    padding: GRID.md,
    minHeight: 80,
    fontFamily: TYPE.bodyFamily,
  },
  submit: {
    marginTop: GRID.lg,
    backgroundColor: DK.colors.accent,
    paddingVertical: GRID.md,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    shadowColor: DK.colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: {
    color: '#000',
    fontFamily: TYPE.titleFamily,
    fontSize: 14,
    letterSpacing: 1.4,
  },
});
