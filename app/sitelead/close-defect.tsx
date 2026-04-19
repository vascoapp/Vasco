import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { hapticSuccess } from '../../src/utils/haptics';
import { useDefects } from '../../src/services/siteLeadDataService';
import { useTranslation } from 'react-i18next';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { InlineInsight } from '../../src/components/shared/VascoInsightCard';
import { useInlineInsight } from '../../src/services/vascoGuidanceService';

type Severity = 'alle' | 'hoog' | 'middel' | 'laag';

export default function CloseDefectScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const inlineTip = useInlineInsight('sitelead', 'close-defect', 'overview');
  const [filter, setFilter] = useState<Severity>('alle');
  const { defects: allDefects, closeDefect } = useDefects('open');

  const getSeverityColor = (severity: 'hoog' | 'middel' | 'laag') => {
    switch (severity) {
      case 'hoog':
        return SemanticColors.feedbackError;
      case 'middel':
        return SemanticColors.feedbackWarning;
      case 'laag':
        return SemanticColors.feedbackSuccess;
    }
  };

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); hapticSuccess(); }, 600);
  }, []);

  const handleResolve = (defectId: string) => {
    hapticSuccess();
    closeDefect(defectId);
  };

  const filteredDefects = useMemo(
    () => filter === 'alle' ? allDefects : allDefects.filter((d) => d.severity === filter),
    [filter, allDefects],
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('sitelead.closeDefectTitle', 'Sluit Gebrek')}</Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}
      >
        {inlineTip && <InlineInsight icon={inlineTip.icon as any} message={inlineTip.message} />}

        <FadeIn delay={0} duration={400}>
        {/* Filter Chips */}
        <View style={styles.filterRow}>
          {(['alle', 'hoog', 'middel', 'laag'] as Severity[]).map((f) => {
            const filterLabels: Record<Severity, string> = {
              'alle': t('sitelead.closeDefectFilterAll', 'Alle'),
              'hoog': t('sitelead.closeDefectFilterHigh', 'Hoog'),
              'middel': t('sitelead.closeDefectFilterMedium', 'Middel'),
              'laag': t('sitelead.closeDefectFilterLow', 'Laag'),
            };
            return (
            <Pressable
              key={f}
              style={[
                styles.filterChip,
                filter === f && styles.filterChipActive,
              ]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filter === f && styles.filterChipTextActive,
                ]}
              >
                {filterLabels[f]}
              </Text>
            </Pressable>
            );
          })}
        </View>

        {/* Defects List */}
        <View style={styles.defectsList}>
          {filteredDefects.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={48} color={SemanticColors.textSecondary} />
              <Text style={styles.emptyStateText}>{t('sitelead.closeDefectEmpty', 'Geen openstaande gebreken')}</Text>
            </View>
          ) : (
            filteredDefects.map((defect) => (
              <View key={defect.id} style={styles.defectCard}>
                <View style={styles.defectHeader}>
                  <View style={styles.defectTitleRow}>
                    <View
                      style={[
                        styles.severityDot,
                        { backgroundColor: getSeverityColor(defect.severity) },
                      ]}
                    />
                    <Text style={styles.defectTitle}>{defect.title}</Text>
                  </View>
                  <Text style={styles.defectDate}>{defect.date}</Text>
                </View>

                <Text style={styles.defectLocation}>
                  <Ionicons name="location-outline" size={14} color={SemanticColors.textSecondary} />{' '}
                  {defect.location}
                </Text>

                <Text style={styles.defectDesc}>{defect.description}</Text>

                {defect.photos && defect.photos.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.photoRow}
                    contentContainerStyle={styles.photoRowContent}
                  >
                    {defect.photos.map((uri, idx) => (
                      <Image
                        key={`${defect.id}-photo-${idx}`}
                        source={{ uri }}
                        style={styles.photoThumb}
                      />
                    ))}
                  </ScrollView>
                )}

                <View style={styles.defectFooter}>
                  <View style={styles.tradeTag}>
                    <Ionicons name="construct-outline" size={14} color="#D2691E" />
                    <Text style={styles.tradeText}>{defect.trade}</Text>
                  </View>

                  <Pressable
                    style={styles.resolveButton}
                    onPress={() => handleResolve(defect.id)}
                  >
                    <Text style={styles.resolveButtonText}>
                      {t('sitelead.closeDefectResolve', 'Markeer als opgelost')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: Spacing.xl }} />
        </FadeIn>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SafeArea.side,
    paddingTop: SafeArea.top,
    paddingBottom: Spacing.sm,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  backButton: {
    marginRight: Spacing.md,
  },
  headerTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: RADIUS.xl,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  filterChipActive: {
    backgroundColor: Palette.hermesOrange,
  },
  filterChipText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textSecondary,
  },
  filterChipTextActive: {
    color: Palette.white,
  },
  defectsList: {
    gap: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyStateText: {
    fontSize: TYPE.titleSize,
    color: SemanticColors.textSecondary,
    marginTop: Spacing.md,
  },
  defectCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.lg,
  },
  defectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  defectTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  severityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.sm,
  },
  defectTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    flex: 1,
  },
  defectDate: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
  },
  defectLocation: {
    fontSize: TYPE.bodySize,
    color: SemanticColors.textSecondary,
    marginBottom: Spacing.sm,
  },
  defectDesc: {
    fontSize: TYPE.bodySize,
    color: SemanticColors.textPrimary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  photoRow: {
    marginBottom: Spacing.md,
  },
  photoRowContent: {
    gap: 8,
  },
  photoThumb: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  defectFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  tradeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  tradeText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
    color: Palette.hermesOrange,
  },
  resolveButton: {
    backgroundColor: Palette.hermesOrange,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: RADIUS.sm,
  },
  resolveButtonText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.white,
  },
});
