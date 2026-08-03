// =============================================================================
// JOB FORM — fill in a per-trade checklist on site
// =============================================================================
// The counterpart to job-forms.tsx. That screen is set up once on a Sunday
// evening; this one is used standing in someone's kitchen, so it favours large
// tap targets and saves on every change rather than behind a button someone
// might not reach before the phone locks.
// =============================================================================

import { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../../src/theme/tabStyles';
import { SafeArea } from '../../../src/theme/spacing';
import { hapticSuccess } from '../../../src/utils/haptics';
import { useAppState } from '../../../src/state/AppState';
import {
  loadTemplates,
  responsesForJob,
  saveResponse,
  blankAnswers,
  validateResponse,
  completionPercent,
  templatesForJob,
  type JobFormTemplate,
  type JobFormAnswer,
  type JobFormResponse,
} from '../../../src/services/jobFormService';

export default function JobFormScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { jobs } = useAppState();

  const job = useMemo(() => jobs.find((j: any) => j.id === jobId), [jobs, jobId]);

  const [templates, setTemplates] = useState<JobFormTemplate[]>([]);
  const [response, setResponse] = useState<JobFormResponse | null>(null);
  const [loading, setLoading] = useState(true);
  // Raw text per numeric field, so an in-progress "1." survives the keystroke.
  const [numberText, setNumberText] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const [tpls, existing] = await Promise.all([loadTemplates(), responsesForJob(String(jobId))]);
      setTemplates(tpls);
      // Resume rather than restart: a crew member who backed out to check
      // something should not lose what they already recorded.
      if (existing.length > 0) setResponse(existing[0]);
      setLoading(false);
    })();
  }, [jobId]);

  const available = useMemo(
    () => templatesForJob(templates, (job as any)?.trade),
    [templates, job],
  );

  const activeTemplate = useMemo(
    () => templates.find((t2) => t2.id === response?.templateId) ?? null,
    [templates, response],
  );

  const start = (tpl: JobFormTemplate) => {
    setResponse({
      id: `jr-${Date.now()}`,
      jobId: String(jobId),
      templateId: tpl.id,
      templateName: tpl.name,
      answers: blankAnswers(tpl),
      updatedAt: new Date().toISOString(),
    });
  };

  const patch = useCallback(
    (fieldId: string, next: Partial<JobFormAnswer>) => {
      // Compute first, then persist OUTSIDE the updater. A state updater must
      // be pure: React can invoke it twice (StrictMode, concurrent re-render),
      // which would fire two writes for one keystroke.
      setResponse((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          answers: prev.answers.map((a) => (a.fieldId === fieldId ? { ...a, ...next } : a)),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [],
  );

  // Persist whenever the answers settle. Debounced so a typed sentence is one
  // write rather than one per character, and still saves without a Save button
  // — on site the phone locks and people get called away mid-form.
  useEffect(() => {
    if (!response) return;
    const id = setTimeout(() => { saveResponse(response).catch(() => {}); }, 400);
    return () => clearTimeout(id);
  }, [response]);

  const errors = useMemo(
    () => (activeTemplate && response ? validateResponse(activeTemplate, response.answers) : []),
    [activeTemplate, response],
  );
  const percent = useMemo(
    () => (activeTemplate && response ? completionPercent(activeTemplate, response.answers) : 0),
    [activeTemplate, response],
  );

  const complete = async () => {
    if (!response) return;
    if (errors.length > 0) {
      Alert.alert(t('jobForms.incomplete', 'Not complete yet'), errors[0].message);
      return;
    }
    const done = { ...response, completedAt: new Date().toISOString() };
    await saveResponse(done);
    setResponse(done);
    hapticSuccess();
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {response?.templateName || t('jobForms.fillIn', 'Fill in form')}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {loading ? null : !response ? (
          available.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t('jobForms.noFormsForTrade', 'No form for this trade')}</Text>
              <Text style={styles.emptyHint}>{t('jobForms.emptyHint', '')}</Text>
              <Pressable style={styles.emptyBtn} onPress={() => router.push('/contractor/job-forms' as any)}>
                <Text style={styles.emptyBtnText}>{t('jobForms.newForm', 'New form')}</Text>
              </Pressable>
            </View>
          ) : (
            // More than one form can apply (trade-specific plus any
            // trade-agnostic ones), so pick rather than assume.
            available.map((tpl) => (
              <Pressable key={tpl.id} style={styles.pickRow} onPress={() => start(tpl)}>
                <Ionicons name="clipboard-outline" size={18} color={Palette.hermesOrange} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{tpl.name}</Text>
                  <Text style={styles.rowMeta}>{t('jobForms.fieldCount', { count: tpl.fields.length })}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={SemanticColors.textSecondary} />
              </Pressable>
            ))
          )
        ) : (
          <>
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${percent}%` }]} />
              </View>
              <Text style={styles.progressText}>{t('jobForms.percentDone', { percent })}</Text>
            </View>

            {response.answers.map((a) => {
              const field = activeTemplate?.fields.find((f) => f.id === a.fieldId);
              return (
                <View key={a.fieldId} style={styles.fieldCard}>
                  <View style={styles.fieldHeader}>
                    <Text style={styles.fieldLabel}>
                      {a.label}
                      {field?.required ? ' *' : ''}
                    </Text>
                    {a.unit ? <Text style={styles.fieldUnit}>{a.unit}</Text> : null}
                  </View>
                  {field?.hint ? <Text style={styles.fieldHint}>{field.hint}</Text> : null}

                  {a.type === 'check' ? (
                    // Yes AND no, not a single toggle: "did you bleed the
                    // radiators? no" is a real answer worth recording, and a
                    // lone checkbox cannot tell it apart from "not asked yet".
                    <View style={styles.checkRow}>
                      <Pressable
                        style={[styles.checkBtn, a.checked === true && styles.checkBtnYes]}
                        onPress={() => patch(a.fieldId, { checked: true })}
                      >
                        <Ionicons
                          name="checkmark"
                          size={18}
                          color={a.checked === true ? Palette.white : SemanticColors.textSecondary}
                        />
                      </Pressable>
                      <Pressable
                        style={[styles.checkBtn, a.checked === false && styles.checkBtnNo]}
                        onPress={() => patch(a.fieldId, { checked: false })}
                      >
                        <Ionicons
                          name="close"
                          size={18}
                          color={a.checked === false ? Palette.white : SemanticColors.textSecondary}
                        />
                      </Pressable>
                    </View>
                  ) : a.type === 'number' ? (
                    <TextInput
                      style={styles.input}
                      keyboardType="decimal-pad"
                      // Bound to the RAW text, not to String(number). Reformatting
                      // on every keystroke ate the decimal point: at "1." the
                      // value became Number("1.") === 1 and the field rewrote
                      // itself to "1", so "1.8" could never be typed.
                      value={numberText[a.fieldId] ?? (a.number !== undefined ? String(a.number) : '')}
                      onChangeText={(v) => {
                        setNumberText((prev) => ({ ...prev, [a.fieldId]: v }));
                        const n = Number(v.replace(',', '.'));
                        patch(a.fieldId, {
                          number: v.trim() === '' || !Number.isFinite(n) ? undefined : n,
                        });
                      }}
                      placeholderTextColor={SemanticColors.textTertiary}
                    />
                  ) : (
                    <TextInput
                      style={[styles.input, styles.multiline]}
                      multiline
                      value={a.text ?? ''}
                      onChangeText={(v) => patch(a.fieldId, { text: v })}
                      placeholderTextColor={SemanticColors.textTertiary}
                    />
                  )}
                </View>
              );
            })}

            <Pressable
              style={[styles.completeBtn, errors.length > 0 && styles.completeBtnBlocked]}
              onPress={complete}
            >
              <Text style={styles.completeBtnText}>
                {response.completedAt
                  ? t('jobForms.percentDone', { percent: 100 })
                  : t('jobForms.markComplete', 'Complete')}
              </Text>
            </Pressable>
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: SafeArea.top, paddingHorizontal: GRID.md, paddingBottom: GRID.sm,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: TYPE.titleSize, fontFamily: 'Archivo_700Bold', color: SemanticColors.textPrimary },
  content: { paddingHorizontal: GRID.md },

  pickRow: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.sm,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md,
    padding: GRID.md, marginBottom: GRID.sm,
  },
  rowTitle: { fontSize: TYPE.bodySize, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  rowMeta: { fontSize: TYPE.captionSize, color: SemanticColors.textSecondary, marginTop: 2 },

  emptyCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, padding: GRID.lg, alignItems: 'center', gap: GRID.xs },
  emptyTitle: { fontSize: TYPE.bodySize, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  emptyHint: { fontSize: TYPE.captionSize, color: SemanticColors.textSecondary, textAlign: 'center' },
  emptyBtn: { marginTop: GRID.sm, paddingHorizontal: GRID.md, paddingVertical: GRID.sm, borderRadius: RADIUS.md, backgroundColor: Palette.hermesOrange },
  emptyBtnText: { fontSize: TYPE.captionSize, fontFamily: 'Inter_700Bold', color: Palette.white },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm, marginBottom: GRID.md },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: SemanticColors.borderDefault, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: Palette.hermesOrange },
  progressText: { fontSize: TYPE.captionSize, color: SemanticColors.textSecondary, flexShrink: 0 },

  fieldCard: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md, padding: GRID.md, marginBottom: GRID.sm },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', gap: GRID.xs },
  fieldLabel: { flex: 1, fontSize: TYPE.bodySize, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  fieldUnit: { fontSize: TYPE.captionSize, color: SemanticColors.textSecondary, flexShrink: 0 },
  fieldHint: { fontSize: TYPE.captionSize, color: SemanticColors.textSecondary, marginTop: 2 },

  checkRow: { flexDirection: 'row', gap: GRID.sm, marginTop: GRID.sm },
  checkBtn: {
    width: 56, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: PAGE_BG,
  },
  checkBtnYes: { backgroundColor: SemanticColors.feedbackSuccess },
  checkBtnNo: { backgroundColor: SemanticColors.feedbackError },

  input: {
    backgroundColor: PAGE_BG, borderRadius: RADIUS.md, padding: GRID.sm,
    fontSize: TYPE.bodySize, color: SemanticColors.textPrimary, marginTop: GRID.sm,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },

  completeBtn: {
    backgroundColor: Palette.hermesOrange, borderRadius: RADIUS.md,
    paddingVertical: GRID.md, alignItems: 'center', marginTop: GRID.sm,
  },
  completeBtnBlocked: { opacity: 0.5 },
  completeBtnText: { fontSize: TYPE.bodySize, fontFamily: 'Inter_700Bold', color: Palette.white },
});
