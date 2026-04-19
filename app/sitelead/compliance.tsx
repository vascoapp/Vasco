// =============================================================================
// SITE LEAD COMPLIANCE — focused on worker certs, site permits, insurance
// =============================================================================

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { hapticSuccess } from '../../src/utils/haptics';
import { InlineInsight } from '../../src/components/shared/VascoInsightCard';
import { useInlineInsight } from '../../src/services/vascoGuidanceService';

type IconName = keyof typeof Ionicons.glyphMap;

// Mock compliance data for site leads
const SITE_COMPLIANCE = {
  workerCerts: { total: 24, valid: 18, expiring: 4, expired: 2 },
  sitePermits: { total: 6, active: 5, expiring: 1 },
  insurance: { total: 3, valid: 2, expiring: 1 },
};

interface ComplianceItem {
  icon: IconName;
  label: string;
  desc: string;
  route: string;
  total: number;
  issues: number;
  issueColor: string;
}

export default function ComplianceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); hapticSuccess(); }, 600);
  }, []);

  const items: ComplianceItem[] = [
    {
      icon: 'card-outline',
      label: t('sitelead.workerCerts', 'Werknemercertificaten'),
      desc: `${SITE_COMPLIANCE.workerCerts.valid} geldig, ${SITE_COMPLIANCE.workerCerts.expiring} verlopend, ${SITE_COMPLIANCE.workerCerts.expired} verlopen`,
      route: '/sitelead/worker-certs',
      total: SITE_COMPLIANCE.workerCerts.total,
      issues: SITE_COMPLIANCE.workerCerts.expiring + SITE_COMPLIANCE.workerCerts.expired,
      issueColor: SITE_COMPLIANCE.workerCerts.expired > 0 ? SemanticColors.feedbackError : SemanticColors.feedbackWarning,
    },
    {
      icon: 'shield-checkmark-outline',
      label: t('sitelead.sitePermits', 'Bouwvergunningen'),
      desc: `${SITE_COMPLIANCE.sitePermits.active} actief, ${SITE_COMPLIANCE.sitePermits.expiring} verlopend`,
      route: '/contractor/permits',
      total: SITE_COMPLIANCE.sitePermits.total,
      issues: SITE_COMPLIANCE.sitePermits.expiring,
      issueColor: SemanticColors.feedbackWarning,
    },
    {
      icon: 'shield-half-outline',
      label: t('sitelead.insurance', 'Verzekeringen'),
      desc: `${SITE_COMPLIANCE.insurance.valid} geldig, ${SITE_COMPLIANCE.insurance.expiring} verlopend`,
      route: '/contractor/insurance',
      total: SITE_COMPLIANCE.insurance.total,
      issues: SITE_COMPLIANCE.insurance.expiring,
      issueColor: SemanticColors.feedbackWarning,
    },
    {
      icon: 'document-text-outline',
      label: 'RAMS Documenten',
      desc: 'Risico-inventarisatie & methode',
      route: '/sitelead/safety-docs',
      total: 5,
      issues: 0,
      issueColor: SemanticColors.feedbackSuccess,
    },
  ];

  const inlineTip = useInlineInsight('sitelead', 'compliance', 'overview');
  const totalIssues = items.reduce((sum, i) => sum + i.issues, 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('sitelead.compliance', 'Compliance')}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}
      >
        {inlineTip && <InlineInsight icon={inlineTip.icon as any} message={inlineTip.message} />}

        {/* Summary banner */}
        <View style={[styles.summaryBanner, {
          backgroundColor: totalIssues > 0 ? SemanticColors.feedbackWarning + '12' : SemanticColors.feedbackSuccess + '12',
          borderColor: totalIssues > 0 ? SemanticColors.feedbackWarning + '30' : SemanticColors.feedbackSuccess + '30',
        }]}>
          <Ionicons
            name={totalIssues > 0 ? 'alert-circle' : 'checkmark-circle'}
            size={22}
            color={totalIssues > 0 ? SemanticColors.feedbackWarning : SemanticColors.feedbackSuccess}
          />
          <Text style={styles.summaryText}>
            {totalIssues > 0
              ? `${totalIssues} aandachtspunt${totalIssues !== 1 ? 'en' : ''} vereisen actie`
              : 'Alle compliance items zijn in orde'}
          </Text>
        </View>

        {/* Compliance items */}
        <View style={styles.cards}>
          {items.map((item) => (
            <Pressable
              key={item.route}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(item.route as any)}
            >
              <View style={styles.cardIcon}>
                <Ionicons name={item.icon} size={22} color={Palette.hermesOrange} />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardLabel}>{item.label}</Text>
                <Text style={styles.cardDesc}>{item.desc}</Text>
              </View>
              {item.issues > 0 && (
                <View style={[styles.issueBadge, { backgroundColor: item.issueColor }]}>
                  <Text style={styles.issueBadgeText}>{item.issues}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
            </Pressable>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SafeArea.side,
    paddingTop: SafeArea.top,
    paddingBottom: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  backButton: { marginRight: Spacing.md },
  headerTitle: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SafeArea.side, paddingTop: Spacing.md, gap: Spacing.md },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: RADIUS.md,
    padding: 14,
    borderWidth: 1,
  },
  summaryText: { flex: 1, fontSize: TYPE.bodySize, fontFamily: 'Inter_500Medium', color: SemanticColors.textPrimary },
  cards: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SemanticColors.borderDefault,
  },
  cardIcon: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    backgroundColor: Palette.hermesOrange + '12',
    alignItems: 'center', justifyContent: 'center',
  },
  cardInfo: { flex: 1, gap: 2 },
  cardLabel: { fontSize: TYPE.bodySize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  cardDesc: { fontSize: TYPE.labelSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary },
  issueBadge: {
    minWidth: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  issueBadgeText: { fontSize: TYPE.tinySize, fontFamily: 'Inter_700Bold', color: Palette.white },
});
