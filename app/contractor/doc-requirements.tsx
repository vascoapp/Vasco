// =============================================================================
// DOCUMENT REQUIREMENTS — Documentvereisten per klus
// =============================================================================
import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import { useDocumentRequirements, CATEGORY_CONFIG, type DocCategory } from '../../src/services/documentRequirementService';

type IconName = keyof typeof Ionicons.glyphMap;

export default function DocRequirementsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { jobs } = useAppState();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const activeJobs = jobs.filter(j => !['cancelled', 'paid'].includes(j.status));
  const selectedJob = selectedJobId ? jobs.find(j => j.id === selectedJobId) : activeJobs[0];

  const { requirements, required, optional } = useDocumentRequirements(
    selectedJob?.trade,
    selectedJob?.title?.toLowerCase(),
  );

  // Mock which docs are "uploaded" (simulate some being done)
  const [uploadedIds, setUploadedIds] = useState<Set<string>>(new Set(['dr-1', 'dr-10', 'dr-12', 'dr-16']));

  const completeness = useMemo(() => {
    const completed = required.filter(r => uploadedIds.has(r.id)).length;
    return {
      total: required.length,
      completed,
      missing: required.length - completed,
      percentage: required.length > 0 ? Math.round((completed / required.length) * 100) : 100,
    };
  }, [required, uploadedIds]);

  const toggleDoc = (id: string) => {
    setUploadedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<DocCategory, typeof requirements>();
    requirements.forEach(r => {
      const list = map.get(r.category) ?? [];
      list.push(r);
      map.set(r.category, list);
    });
    return Array.from(map.entries());
  }, [requirements]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('compliance.docRequirements', 'Documentvereisten')}</Text>
          <Text style={styles.headerSubtitle}>
            {completeness.completed}/{completeness.total} {t('compliance.required', 'verplicht')} · {completeness.percentage}% {t('compliance.complete', 'compleet')}
          </Text>
        </View>
      </View>

      {/* Job selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.jobBar} contentContainerStyle={styles.jobBarContent}>
        {activeJobs.map(job => (
          <Pressable
            key={job.id}
            style={[styles.jobChip, (selectedJob?.id === job.id) && styles.jobChipActive]}
            onPress={() => setSelectedJobId(job.id)}
          >
            <Text style={[styles.jobChipText, (selectedJob?.id === job.id) && styles.jobChipTextActive]} numberOfLines={1}>
              {job.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Completeness bar */}
      <View style={styles.completenessCard}>
        <View style={styles.completenessRow}>
          <View style={styles.completenessInfo}>
            <Text style={styles.completenessTitle}>{t('compliance.documentProgress', 'Documentatie voortgang')}</Text>
            <Text style={styles.completenessDetail}>
              {completeness.missing > 0
                ? `${completeness.missing} ${t('compliance.requiredDocsMissing', 'verplicht document(en) ontbreekt')}`
                : t('compliance.allDocsPresent', 'Alle verplichte documenten aanwezig')}
            </Text>
          </View>
          <View style={[styles.percentCircle, completeness.percentage === 100 && { backgroundColor: SemanticColors.feedbackSuccess + '20' }]}>
            <Text style={[styles.percentText, completeness.percentage === 100 && { color: SemanticColors.feedbackSuccess }]}>
              {completeness.percentage}%
            </Text>
          </View>
        </View>
        <View style={styles.progressBar}>
          <View style={[
            styles.progressFill,
            { width: `${completeness.percentage}%` },
            completeness.percentage === 100 && { backgroundColor: SemanticColors.feedbackSuccess },
          ]} />
        </View>
      </View>

      {/* Requirements by category */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {grouped.map(([category, items]) => {
          const catConf = CATEGORY_CONFIG[category];
          return (
            <View key={category} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Ionicons name={catConf.icon as IconName} size={16} color={catConf.color} />
                <Text style={[styles.categoryTitle, { color: catConf.color }]}>{catConf.label}</Text>
                <Text style={styles.categoryCount}>{items.length}</Text>
              </View>
              {items.map(req => {
                const isUploaded = uploadedIds.has(req.id);
                return (
                  <Pressable
                    key={req.id}
                    style={[styles.reqCard, isUploaded && styles.reqCardDone]}
                    onPress={() => toggleDoc(req.id)}
                  >
                    <Ionicons
                      name={isUploaded ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={isUploaded ? SemanticColors.feedbackSuccess : SemanticColors.textTertiary}
                    />
                    <View style={styles.reqInfo}>
                      <View style={styles.reqTitleRow}>
                        <Text style={[styles.reqName, isUploaded && styles.reqNameDone]}>{req.name}</Text>
                        {req.required && !isUploaded && (
                          <View style={styles.requiredBadge}>
                            <Text style={styles.requiredText}>{t('compliance.requiredLabel', 'Verplicht')}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.reqDesc} numberOfLines={2}>{req.description}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: SafeArea.side, paddingTop: SafeArea.top, paddingBottom: Spacing.sm },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 24, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  headerSubtitle: { fontSize: 14, color: SemanticColors.textSecondary, marginTop: 2 },
  jobBar: { maxHeight: 40, marginBottom: Spacing.sm },
  jobBarContent: { paddingHorizontal: SafeArea.side, gap: 6 },
  jobChip: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, maxWidth: 200 },
  jobChipActive: { backgroundColor: Palette.hermesOrange },
  jobChipText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: SemanticColors.textSecondary },
  jobChipTextActive: { color: '#fff' },
  completenessCard: { marginHorizontal: SafeArea.side, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 16, padding: Spacing.md, marginBottom: Spacing.md },
  completenessRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  completenessInfo: { flex: 1 },
  completenessTitle: { fontSize: 15, fontFamily: 'Manrope_600SemiBold', color: SemanticColors.textPrimary },
  completenessDetail: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 2 },
  percentCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.hermesOrange + '15', alignItems: 'center', justifyContent: 'center' },
  percentText: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: Palette.hermesOrange },
  progressBar: { height: 6, backgroundColor: SemanticColors.borderDefault, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Palette.hermesOrange, borderRadius: 3 },
  scrollView: { flex: 1, paddingHorizontal: SafeArea.side },
  categorySection: { marginBottom: Spacing.md },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.xs },
  categoryTitle: { flex: 1, fontSize: 13, fontFamily: 'Manrope_700Bold', letterSpacing: 0.5 },
  categoryCount: { fontSize: 12, color: SemanticColors.textTertiary },
  reqCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, padding: Spacing.sm, marginBottom: 4 },
  reqCardDone: { opacity: 0.7 },
  reqInfo: { flex: 1 },
  reqTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reqName: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: SemanticColors.textPrimary },
  reqNameDone: { textDecorationLine: 'line-through', color: SemanticColors.textSecondary },
  reqDesc: { fontSize: 12, color: SemanticColors.textTertiary, marginTop: 2 },
  requiredBadge: { backgroundColor: SemanticColors.feedbackWarning + '20', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  requiredText: { fontSize: 9, fontFamily: 'Manrope_700Bold', color: SemanticColors.feedbackWarning },
});
