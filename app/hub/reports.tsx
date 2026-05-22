// Hub: Reports - Report generation and recent report overview
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { InlineInsight } from '../../src/components/shared/VascoInsightCard';

type IconName = keyof typeof Ionicons.glyphMap;

interface ReportCategory {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  color: string;
}

interface RecentReport {
  id: string;
  name: string;
  date: string;
  type: string;
}

const REPORT_CATEGORIES: ReportCategory[] = [
  {
    id: 'financial-summary',
    title: 'Financial Summary',
    description: 'Maandelijkse financiële samenvatting',
    icon: 'briefcase',
    color: Palette.blue500,
  },
  {
    id: 'project-progress',
    title: 'Project Progress',
    description: 'Voortgang alle projecten',
    icon: 'bar-chart',
    color: Palette.green500,
  },
  {
    id: 'risk-assessment',
    title: 'Risk Assessment',
    description: 'Risico-overzicht portfolio',
    icon: 'warning',
    color: Palette.yellow500,
  },
  {
    id: 'cost-analysis',
    title: 'Cost Analysis',
    description: 'Kostenanalyse per project',
    icon: 'calculator',
    color: Palette.hermesOrange,
  },
  {
    id: 'schedule-performance',
    title: 'Schedule Performance',
    description: 'Planning prestatie (SPI/CPI)',
    icon: 'time',
    color: Palette.hermesOrange,
  },
  {
    id: 'compliance-report',
    title: 'Compliance Report',
    description: 'Compliance en certificaten status',
    icon: 'shield-checkmark',
    color: '#7C3AED',
  },
];

const RECENT_REPORTS: RecentReport[] = [
  {
    id: 'rec-1',
    name: 'Financieel Overzicht - Januari 2026',
    date: '31 jan 2026',
    type: 'Financial Summary',
  },
  {
    id: 'rec-2',
    name: 'Voortgangsrapport Q4 2025',
    date: '15 jan 2026',
    type: 'Project Progress',
  },
  {
    id: 'rec-3',
    name: 'Risicobeoordeling Portfolio',
    date: '10 jan 2026',
    type: 'Risk Assessment',
  },
];

export default function ReportsScreen() {
  const handleGenerateReport = (category: ReportCategory) => {
    Alert.alert(
      'Rapport genereren...',
      `${category.title} wordt voorbereid op basis van de laatste projectdata.`,
    );
  };

  const handleDownload = (report: RecentReport) => {
    Alert.alert(
      'Rapport downloaden',
      `${report.name} wordt gedownload.`,
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* AI Insight */}
      <InlineInsight
        icon="sparkles"
        message="Rapporten worden automatisch gegenereerd op basis van actuele projectdata."
      />

      {/* Report Categories */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Rapport categorieën</Text>
      </View>

      <View style={styles.grid}>
        {REPORT_CATEGORIES.map((category) => (
          <Pressable
            key={category.id}
            style={styles.categoryCard}
            onPress={() => handleGenerateReport(category)}
          >
            <View style={[styles.iconContainer, { backgroundColor: category.color + '20' }]}>
              <Ionicons name={category.icon} size={22} color={category.color} />
            </View>
            <Text style={styles.categoryTitle}>{category.title}</Text>
            <Text style={styles.categoryDescription}>{category.description}</Text>
          </Pressable>
        ))}
      </View>

      {/* Recent Reports */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recente rapporten</Text>
        <Text style={styles.sectionCount}>{RECENT_REPORTS.length} rapporten</Text>
      </View>

      {RECENT_REPORTS.map((report) => (
        <View key={report.id} style={styles.recentCard}>
          <View style={styles.recentInfo}>
            <Text style={styles.recentName}>{report.name}</Text>
            <View style={styles.recentMeta}>
              <Ionicons name="calendar-outline" size={12} color={SemanticColors.textTertiary} />
              <Text style={styles.recentDate}>{report.date}</Text>
              <Text style={styles.recentSeparator}>·</Text>
              <Text style={styles.recentType}>{report.type}</Text>
            </View>
          </View>
          <Pressable style={styles.downloadButton} onPress={() => handleDownload(report)}>
            <Ionicons name="download-outline" size={18} color={Palette.hermesOrange} />
          </Pressable>
        </View>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.md,
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  sectionCount: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },

  // Category grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryCard: {
    width: '48%',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  categoryDescription: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    lineHeight: 16,
  },

  // Recent reports
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  recentInfo: {
    flex: 1,
    gap: 4,
  },
  recentName: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  recentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentDate: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },
  recentSeparator: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },
  recentType: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  downloadButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Palette.hermesOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
