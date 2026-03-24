// =============================================================================
// DAILY SITE REPORT — Structured daily log entry
// =============================================================================
// Site leads fill this out end-of-day or during shifts.
// Captures: weather, workforce, progress, issues, safety, photos, notes
// =============================================================================

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { hapticSuccess } from '../../src/utils/haptics';
import { showPhotoPicker, type PhotoResult } from '../../src/utils/photoPicker';
import { useTranslation } from 'react-i18next';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { GradientButton } from '../../src/components/shared/GradientButton';
import { Toast } from '../../src/components/shared/Toast';
import { useDailyReports } from '../../src/services/siteLeadDataService';
import { useDaySchedule } from '../../src/services/smartSchedulerService';
import { InlineInsight } from '../../src/components/shared/VascoInsightCard';
import { useInlineInsight } from '../../src/services/vascoGuidanceService';

type IconName = keyof typeof Ionicons.glyphMap;
type Weather = 'sunny' | 'cloudy' | 'rainy' | 'storm' | 'cold';

const WEATHER_OPTIONS: { key: Weather; icon: IconName; labelKey: string }[] = [
  { key: 'sunny', icon: 'sunny', labelKey: 'dailyReport.sunny' },
  { key: 'cloudy', icon: 'cloudy', labelKey: 'dailyReport.cloudy' },
  { key: 'rainy', icon: 'rainy', labelKey: 'dailyReport.rainy' },
  { key: 'storm', icon: 'thunderstorm', labelKey: 'dailyReport.storm' },
  { key: 'cold', icon: 'snow', labelKey: 'dailyReport.cold' },
];

interface ProgressEntry {
  zone: string;
  task: string;
  percent: number;
  notes: string;
}

const INITIAL_PROGRESS: ProgressEntry[] = [
  { zone: 'Blok A - BG', task: 'Kozijnen plaatsen', percent: 88, notes: '' },
  { zone: 'Blok A - Verd. 2', task: 'Bekabeling', percent: 72, notes: '' },
  { zone: 'Blok B - Verd. 1', task: 'Sanitair installatie', percent: 45, notes: '' },
  { zone: 'Blok B - Buiten', task: 'Gevelstenen', percent: 100, notes: '' },
];

export default function DailyReportScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  // Auto-populate from schedule
  const todayStr = new Date().toISOString().split('T')[0];
  const schedule = useDaySchedule(todayStr);

  const scheduleProgress: ProgressEntry[] = schedule.jobs.length > 0
    ? schedule.jobs.map(job => ({
        zone: job.address || '',
        task: job.projectName || '',
        percent: job.status === 'completed' ? 100 : job.status === 'in_progress' ? 50 : 0,
        notes: '',
      }))
    : [];

  // Form state
  const inlineTip = useInlineInsight('sitelead', 'daily-report', 'overview');

  const [weather, setWeather] = useState<Weather>('sunny');
  const [temperature, setTemperature] = useState('12');
  const [workersOnSite, setWorkersOnSite] = useState(() =>
    schedule.jobs.length > 0 ? String(schedule.jobs.length) : '14'
  );
  const [workersPlanned, setWorkersPlanned] = useState('16');
  const [progressEntries, setProgressEntries] = useState(
    scheduleProgress.length > 0 ? scheduleProgress : INITIAL_PROGRESS
  );
  const [safetyIncidents, setSafetyIncidents] = useState('0');
  const [nearMisses, setNearMisses] = useState('0');
  const [safetyNotes, setSafetyNotes] = useState('');
  const [deliveries, setDeliveries] = useState('');
  const [issues, setIssues] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [photos, setPhotos] = useState<PhotoResult[]>([]);
  const [showToast, setShowToast] = useState(false);
  const { addReport } = useDailyReports();

  const today = new Date();
  const dateStr = today.toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const updateProgress = (index: number, field: keyof ProgressEntry, value: string | number) => {
    setProgressEntries(prev => {
      const copy = [...prev];
      (copy[index] as any)[field] = value;
      return copy;
    });
  };

  const handleAddPhoto = () => {
    showPhotoPicker((photo) => {
      setPhotos(prev => [...prev, photo]);
    });
  };

  const handleSubmit = () => {
    addReport({
      date: today.toISOString().split('T')[0],
      weather,
      temperature,
      workersPresent: Number(workersOnSite),
      workersPlanned: Number(workersPlanned),
      progressEntries,
      safetyIncidents: Number(safetyIncidents),
      nearMisses: Number(nearMisses),
      safetyNotes,
      deliveries,
      issues,
      generalNotes,
      photoCount: photos.length,
    });
    hapticSuccess();
    setShowToast(true);
  };

  const completeness = (() => {
    let filled = 0;
    let total = 6;
    if (weather) filled++;
    if (workersOnSite) filled++;
    if (progressEntries.some(e => e.notes)) filled++;
    if (safetyIncidents || safetyNotes) filled++;
    if (issues || generalNotes) filled++;
    if (photos.length > 0) filled++;
    return Math.round((filled / total) * 100);
  })();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>{t('dailyReport.title')}</Text>
          <Text style={styles.headerDate}>{dateStr}</Text>
        </View>
        <View style={styles.completeBadge}>
          <Text style={styles.completeText}>{completeness}%</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {inlineTip && <InlineInsight icon={inlineTip.icon as any} message={inlineTip.message} />}

        <FadeIn delay={0} duration={400}>
        {/* Weather */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dailyReport.weather')}</Text>
          <View style={styles.weatherRow}>
            {WEATHER_OPTIONS.map(w => (
              <Pressable
                key={w.key}
                style={[styles.weatherChip, weather === w.key && styles.weatherChipActive]}
                onPress={() => setWeather(w.key)}
              >
                <Ionicons name={w.icon} size={20} color={weather === w.key ? Palette.white : SemanticColors.textSecondary} />
                <Text style={[styles.weatherLabel, weather === w.key && styles.weatherLabelActive]}>{t(w.labelKey)}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.inlineRow}>
            <Text style={styles.inlineLabel}>{t('dailyReport.temperature')}</Text>
            <TextInput
              style={styles.inlineInput}
              value={temperature}
              onChangeText={setTemperature}
              keyboardType="number-pad"
              placeholder="°C"
              placeholderTextColor={SemanticColors.textTertiary}
            />
            <Text style={styles.inlineUnit}>°C</Text>
          </View>
        </View>

        {/* Workforce */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dailyReport.workforce')}</Text>
          <View style={styles.workforceRow}>
            <View style={styles.workforceItem}>
              <Text style={styles.workforceLabel}>{t('dailyReport.present')}</Text>
              <TextInput
                style={styles.workforceInput}
                value={workersOnSite}
                onChangeText={setWorkersOnSite}
                keyboardType="number-pad"
              />
            </View>
            <Text style={styles.workforceDivider}>/</Text>
            <View style={styles.workforceItem}>
              <Text style={styles.workforceLabel}>{t('dailyReport.planned')}</Text>
              <TextInput
                style={styles.workforceInput}
                value={workersPlanned}
                onChangeText={setWorkersPlanned}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.workforceItem}>
              <Text style={styles.workforceLabel}>{t('dailyReport.occupancy')}</Text>
              <Text style={[styles.workforcePercent, {
                color: Number(workersOnSite) / Number(workersPlanned || 1) >= 0.9
                  ? SemanticColors.feedbackSuccess
                  : SemanticColors.feedbackWarning,
              }]}>
                {Math.round((Number(workersOnSite) / Number(workersPlanned || 1)) * 100)}%
              </Text>
            </View>
          </View>
        </View>

        {/* Progress per zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dailyReport.progressPerZone')}</Text>
          {progressEntries.map((entry, i) => (
            <View key={entry.zone} style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.progressZone}>{entry.zone}</Text>
                  <Text style={styles.progressTask}>{entry.task}</Text>
                </View>
                <Text style={[styles.progressPercent, {
                  color: entry.percent >= 80 ? SemanticColors.feedbackSuccess
                    : entry.percent >= 50 ? SemanticColors.feedbackWarning
                    : SemanticColors.feedbackError,
                }]}>
                  {entry.percent}%
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, {
                  width: `${entry.percent}%`,
                  backgroundColor: entry.percent >= 80 ? SemanticColors.feedbackSuccess
                    : entry.percent >= 50 ? SemanticColors.feedbackWarning
                    : SemanticColors.feedbackError,
                }]} />
              </View>
              <TextInput
                style={styles.progressNotes}
                value={entry.notes}
                onChangeText={(v) => updateProgress(i, 'notes', v)}
                placeholder={t('dailyReport.progressNotes')}
                placeholderTextColor={SemanticColors.textTertiary}
                multiline
              />
            </View>
          ))}
        </View>

        {/* Safety */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dailyReport.safetySection')}</Text>
          <View style={styles.safetyRow}>
            <View style={styles.safetyItem}>
              <Text style={styles.safetyLabel}>{t('dailyReport.incidentsCount')}</Text>
              <TextInput
                style={[styles.safetyInput, Number(safetyIncidents) > 0 && { borderColor: SemanticColors.feedbackError }]}
                value={safetyIncidents}
                onChangeText={setSafetyIncidents}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.safetyItem}>
              <Text style={styles.safetyLabel}>{t('dailyReport.nearMissesCount')}</Text>
              <TextInput
                style={[styles.safetyInput, Number(nearMisses) > 0 && { borderColor: SemanticColors.feedbackWarning }]}
                value={nearMisses}
                onChangeText={setNearMisses}
                keyboardType="number-pad"
              />
            </View>
          </View>
          <TextInput
            style={styles.textArea}
            value={safetyNotes}
            onChangeText={setSafetyNotes}
            placeholder={t('dailyReport.safetyNotes')}
            placeholderTextColor={SemanticColors.textTertiary}
            multiline
          />
        </View>

        {/* Deliveries & Issues */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dailyReport.deliveriesIssues')}</Text>
          <TextInput
            style={styles.textArea}
            value={deliveries}
            onChangeText={setDeliveries}
            placeholder={t('dailyReport.deliveriesPlaceholder')}
            placeholderTextColor={SemanticColors.textTertiary}
            multiline
          />
          <TextInput
            style={styles.textArea}
            value={issues}
            onChangeText={setIssues}
            placeholder={t('dailyReport.issuesPlaceholder')}
            placeholderTextColor={SemanticColors.textTertiary}
            multiline
          />
        </View>

        {/* Photos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dailyReport.photos')} ({photos.length})</Text>
          <View style={styles.photoRow}>
            {photos.map((p, i) => (
              <View key={i} style={styles.photoThumb}>
                {p.uri ? (
                  <Image source={{ uri: p.uri }} style={{ width: 64, height: 64, borderRadius: 8 }} />
                ) : (
                  <Ionicons name="image" size={24} color={SemanticColors.textTertiary} />
                )}
                <Pressable
                  style={styles.photoRemove}
                  onPress={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                >
                  <Ionicons name="close-circle" size={18} color={SemanticColors.feedbackError} />
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.photoAdd} onPress={handleAddPhoto}>
              <Ionicons name="camera-outline" size={24} color={Palette.hermesOrange} />
              <Text style={styles.photoAddText}>{t('dailyReport.addPhoto')}</Text>
            </Pressable>
          </View>
        </View>

        {/* General notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dailyReport.generalNotes')}</Text>
          <TextInput
            style={styles.textArea}
            value={generalNotes}
            onChangeText={setGeneralNotes}
            placeholder={t('dailyReport.generalNotesPlaceholder')}
            placeholderTextColor={SemanticColors.textTertiary}
            multiline
          />
        </View>

        {/* Submit */}
        <GradientButton
          label={t('dailyReport.submit')}
          onPress={handleSubmit}
          icon="send"
        />

        <View style={{ height: Spacing.xxl }} />
        </FadeIn>
      </ScrollView>
      <Toast
        message={t('dailyReport.submitted')}
        visible={showToast}
        onHide={() => { setShowToast(false); router.back(); }}
        type="success"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: SafeArea.top, paddingHorizontal: SafeArea.side, paddingBottom: 12,
  },
  headerTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  headerDate: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },
  completeBadge: {
    backgroundColor: Palette.hermesOrange + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.sm,
  },
  completeText: { fontSize: TYPE.captionSize, fontFamily: 'Inter_600SemiBold', color: Palette.hermesOrange },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, gap: Spacing.md },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: TYPE.bodySize, fontFamily: TYPE.sectionFamily, color: Palette.hermesOrange,
    letterSpacing: 0.6,
  },
  weatherRow: { flexDirection: 'row', gap: 6 },
  weatherChip: {
    flex: 1, alignItems: 'center', gap: 4,
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md, padding: 10,
    borderWidth: 1.5, borderColor: SemanticColors.borderDefault,
  },
  weatherChipActive: { backgroundColor: Palette.hermesOrange, borderColor: Palette.hermesOrange },
  weatherLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', color: SemanticColors.textSecondary },
  weatherLabelActive: { color: Palette.white },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  inlineLabel: { fontSize: TYPE.bodySize, fontFamily: 'Inter_500Medium', color: SemanticColors.textPrimary },
  inlineInput: {
    width: 60, backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
    paddingHorizontal: 10, paddingVertical: 6, fontSize: TYPE.bodySize, fontFamily: 'Inter_500Medium',
    color: SemanticColors.textPrimary, textAlign: 'center',
  },
  inlineUnit: { fontSize: TYPE.bodySize, color: SemanticColors.textSecondary },
  workforceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  workforceItem: { alignItems: 'center', gap: 4 },
  workforceLabel: { fontSize: TYPE.labelSize, fontFamily: TYPE.labelFamily, color: SemanticColors.textSecondary },
  workforceInput: {
    width: 60, backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 20, fontFamily: 'Inter_700Bold',
    color: SemanticColors.textPrimary, textAlign: 'center',
  },
  workforceDivider: { fontSize: 24, color: SemanticColors.textTertiary, marginTop: 16 },
  workforcePercent: { fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 4 },
  progressCard: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md, padding: 14, gap: 8,
  },
  progressHeader: { flexDirection: 'row', alignItems: 'center' },
  progressZone: { fontSize: TYPE.bodySize, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textPrimary },
  progressTask: { fontSize: TYPE.labelSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },
  progressPercent: { fontSize: TYPE.sectionSize, fontFamily: 'Inter_700Bold' },
  progressBar: {
    height: 6, backgroundColor: SemanticColors.surfaceSecondary, borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 3 },
  progressNotes: {
    backgroundColor: SemanticColors.surfaceBackground, borderRadius: RADIUS.sm,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily,
    color: SemanticColors.textPrimary, minHeight: 36,
  },
  safetyRow: { flexDirection: 'row', gap: 12 },
  safetyItem: { flex: 1, gap: 4 },
  safetyLabel: { fontSize: TYPE.captionSize, fontFamily: TYPE.labelFamily, color: SemanticColors.textSecondary },
  safetyInput: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: SemanticColors.borderDefault,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: TYPE.sectionSize, fontFamily: 'Inter_700Bold',
    color: SemanticColors.textPrimary, textAlign: 'center',
  },
  textArea: {
    backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: SemanticColors.borderDefault,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: TYPE.bodySize, fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary, minHeight: 60, textAlignVertical: 'top',
  },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumb: {
    width: 72, height: 72, borderRadius: RADIUS.md,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  photoRemove: { position: 'absolute', top: -4, right: -4 },
  photoAdd: {
    width: 72, height: 72, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: Palette.hermesOrange, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  photoAddText: { fontSize: 9, fontFamily: 'Inter_500Medium', color: Palette.hermesOrange },
  submitButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Palette.hermesOrange, borderRadius: RADIUS.lg, paddingVertical: 16, marginTop: 8,
  },
  submitText: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: Palette.white },
});
