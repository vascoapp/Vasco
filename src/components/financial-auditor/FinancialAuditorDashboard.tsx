/**
 * Financial Auditor Dashboard
 *
 * Volledig audit-overzicht voor de CFO:
 * - Audit health score & risico-samenvatting
 * - Recente bevindingen met ernst-badges (critical/high/medium/low)
 * - Compliance-status indicatoren
 * - Tappable bevindingen (Alert met details)
 * - Actieknoppen: Markeer als Beoordeeld, Escaleer, etc.
 *
 * Gebruikt SemanticColors tokens + Spacing + Ionicons.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';

// Financial auditor service hooks
import {
  useFinancialAuditStats,
  useFinancialAuditFindings,
  useUnnecessarySpendAnalysis,
  useOverpaymentAnalysis,
  useBudgetReconciliation,
  financialAuditor,
} from '../../services/financialAuditorService';

// General auditor service hooks
import {
  useAuditFindings,
  useAuditStats,
  auditorService,
} from '../../services/auditorService';

type IconName = keyof typeof Ionicons.glyphMap;

// CFO role color (matches SemanticColors.roleCFO)
const CFO_COLOR = '#2563EB';

// =============================================================================
// TYPES
// =============================================================================

type AuditorTab = 'overzicht' | 'bevindingen' | 'compliance' | 'besparingen';

interface Props {
  projectId?: string;
  /** Compact mode: show only summary card (for embedding in CFO dashboard overview) */
  compact?: boolean;
  onExpandPress?: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatBedrag(amount: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `\u20AC${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `\u20AC${(value / 1_000).toFixed(0)}K`;
  return `\u20AC${value.toFixed(0)}`;
}

type Severity = 'critical' | 'high' | 'medium' | 'low';

function getSeverityColor(severity: Severity): string {
  switch (severity) {
    case 'critical': return SemanticColors.feedbackError;
    case 'high': return SemanticColors.feedbackWarning;
    case 'medium': return CFO_COLOR;
    case 'low': return SemanticColors.textTertiary;
  }
}

function getSeverityBg(severity: Severity): string {
  switch (severity) {
    case 'critical': return SemanticColors.feedbackErrorBg;
    case 'high': return SemanticColors.feedbackWarningBg;
    case 'medium': return SemanticColors.feedbackInfoBg;
    case 'low': return SemanticColors.surfaceSecondary;
  }
}

function getSeverityLabel(severity: Severity): string {
  switch (severity) {
    case 'critical': return 'Kritiek';
    case 'high': return 'Hoog';
    case 'medium': return 'Gemiddeld';
    case 'low': return 'Laag';
  }
}

function getSeverityIcon(severity: Severity): IconName {
  switch (severity) {
    case 'critical': return 'alert-circle';
    case 'high': return 'warning';
    case 'medium': return 'information-circle';
    case 'low': return 'checkmark-circle';
  }
}

function getComplianceStatusColor(status: string): string {
  switch (status) {
    case 'compliant': return SemanticColors.feedbackSuccess;
    case 'at-risk': return SemanticColors.feedbackWarning;
    case 'non-compliant': return SemanticColors.feedbackError;
    default: return SemanticColors.textTertiary;
  }
}

// =============================================================================
// MOCK COMPLIANCE DATA
// =============================================================================

interface ComplianceItem {
  id: string;
  label: string;
  status: 'compliant' | 'at-risk' | 'non-compliant';
  detail: string;
  icon: IconName;
  lastChecked: string;
}

const MOCK_COMPLIANCE: ComplianceItem[] = [
  {
    id: 'c1',
    label: 'Factuurgoedkeuring',
    status: 'at-risk',
    detail: '3 facturen wachten langer dan 14 dagen op goedkeuring',
    icon: 'document-text',
    lastChecked: 'Today',
  },
  {
    id: 'c2',
    label: 'Budgetcontrole',
    status: 'compliant',
    detail: 'Alle projecten binnen budgetmarges',
    icon: 'calculator',
    lastChecked: 'Today',
  },
  {
    id: 'c3',
    label: 'Contractnaleving',
    status: 'non-compliant',
    detail: '2 leveranciers factureren boven contracttarief',
    icon: 'shield-checkmark',
    lastChecked: 'Yesterday',
  },
  {
    id: 'c4',
    label: 'BTW-controle',
    status: 'compliant',
    detail: 'BTW-boekingen correct afgestemd',
    icon: 'receipt',
    lastChecked: 'Today',
  },
  {
    id: 'c5',
    label: 'Dubbele betalingen',
    status: 'compliant',
    detail: 'No duplicate invoices detected',
    icon: 'copy',
    lastChecked: 'Today',
  },
];

// =============================================================================
// SUBCOMPONENTS
// =============================================================================

function AuditHealthScore({ score, label }: { score: number; label: string }) {
  const color = score >= 80
    ? SemanticColors.feedbackSuccess
    : score >= 60
      ? SemanticColors.feedbackWarning
      : SemanticColors.feedbackError;

  return (
    <View style={[localStyles.healthScoreContainer, { borderColor: color }]}>
      <Text style={[localStyles.healthScoreValue, { color }]}>{score}</Text>
      <Text style={localStyles.healthScoreLabel}>{label}</Text>
    </View>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <View style={[localStyles.severityBadge, { backgroundColor: getSeverityBg(severity) }]}>
      <Ionicons name={getSeverityIcon(severity)} size={12} color={getSeverityColor(severity)} />
      <Text style={[localStyles.severityBadgeText, { color: getSeverityColor(severity) }]}>
        {getSeverityLabel(severity)}
      </Text>
    </View>
  );
}

function SeverityCountPill({ severity, count }: { severity: Severity; count: number }) {
  if (count === 0) return null;
  return (
    <View style={[localStyles.severityCountPill, { backgroundColor: getSeverityBg(severity) }]}>
      <View style={[localStyles.severityCountDot, { backgroundColor: getSeverityColor(severity) }]} />
      <Text style={[localStyles.severityCountValue, { color: getSeverityColor(severity) }]}>
        {count}
      </Text>
      <Text style={[localStyles.severityCountLabel, { color: getSeverityColor(severity) }]}>
        {getSeverityLabel(severity)}
      </Text>
    </View>
  );
}

function TabButton({
  label,
  icon,
  isActive,
  onPress,
}: {
  label: string;
  icon: IconName;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[localStyles.tabBtn, isActive && localStyles.tabBtnActive]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={16}
        color={isActive ? '#fff' : SemanticColors.textSecondary}
      />
      <Text style={[localStyles.tabBtnText, isActive && localStyles.tabBtnTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function FinancialAuditorDashboard({
  projectId = 'project-001',
  compact = false,
  onExpandPress,
}: Props) {
  const [activeTab, setActiveTab] = useState<AuditorTab>('overzicht');
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

  // Financial auditor hooks
  const financialStats = useFinancialAuditStats();
  const { findings: financialFindings, loading: financialLoading } = useFinancialAuditFindings();
  const { analysis: savingsAnalysis, totalSavings, loading: savingsLoading } = useUnnecessarySpendAnalysis(projectId);
  const { analysis: overpaymentAnalysis, totalOverpaid, loading: overpaymentLoading } = useOverpaymentAnalysis(projectId);
  const { report: budgetReport, loading: budgetLoading } = useBudgetReconciliation(projectId);

  // General auditor hooks (for CFO-specific findings)
  const { findings: auditFindings, loading: auditLoading, refresh: refreshAudit } = useAuditFindings('cfo');
  const auditStats = useAuditStats('cfo');

  // Combined findings (both general + financial audit)
  const allFindings = useMemo(() => {
    const combined = [
      ...auditFindings.map(f => ({
        id: f.id,
        severity: f.severity as Severity,
        title: f.title,
        description: f.description,
        category: f.category?.name || f.categoryId,
        impact: f.impact?.financial || 0,
        action: f.suggestedAction?.description || '',
        actionType: f.suggestedAction?.type || '',
        urgency: f.suggestedAction?.urgency || '',
        status: f.status,
        detectedAt: f.detectedAt,
        source: 'auditor' as const,
      })),
      ...financialFindings.map(f => ({
        id: f.id,
        severity: f.severity as Severity,
        title: f.title,
        description: f.description,
        category: f.auditType?.replace(/-/g, ' ') || 'financieel',
        impact: Math.abs(f.financialDetails?.variance || 0),
        action: f.suggestedAction?.description || '',
        actionType: f.suggestedAction?.type || '',
        urgency: '',
        status: f.status,
        detectedAt: f.createdAt,
        source: 'financial' as const,
      })),
    ];

    // Sort: critical first, then by impact
    const severityOrder: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return combined.sort((a, b) => {
      const sd = severityOrder[a.severity] - severityOrder[b.severity];
      if (sd !== 0) return sd;
      return b.impact - a.impact;
    });
  }, [auditFindings, financialFindings]);

  // Health score calculation
  const healthScore = useMemo(() => {
    let score = 100;
    const criticals = allFindings.filter(f => f.severity === 'critical').length;
    const highs = allFindings.filter(f => f.severity === 'high').length;
    const mediums = allFindings.filter(f => f.severity === 'medium').length;

    score -= criticals * 15;
    score -= highs * 8;
    score -= mediums * 3;

    // Deduct for compliance issues
    const nonCompliant = MOCK_COMPLIANCE.filter(c => c.status === 'non-compliant').length;
    const atRisk = MOCK_COMPLIANCE.filter(c => c.status === 'at-risk').length;
    score -= nonCompliant * 10;
    score -= atRisk * 5;

    return Math.max(0, Math.min(100, score));
  }, [allFindings]);

  // Severity counts
  const severityCounts = useMemo(() => ({
    critical: allFindings.filter(f => f.severity === 'critical').length,
    high: allFindings.filter(f => f.severity === 'high').length,
    medium: allFindings.filter(f => f.severity === 'medium').length,
    low: allFindings.filter(f => f.severity === 'low').length,
  }), [allFindings]);

  const totalImpact = useMemo(
    () => allFindings.reduce((sum, f) => sum + f.impact, 0),
    [allFindings],
  );

  // Handlers
  const handleFindingPress = useCallback((finding: typeof allFindings[0]) => {
    const impactStr = finding.impact > 0 ? `\n\nFinanciele impact: ${formatBedrag(finding.impact)}` : '';
    const actionStr = finding.action ? `\n\nAanbevolen actie:\n${finding.action}` : '';

    Alert.alert(
      `${getSeverityLabel(finding.severity).toUpperCase()} - ${finding.title}`,
      `${finding.description}${impactStr}${actionStr}\n\nCategorie: ${finding.category}\nStatus: ${finding.status}`,
      [
        { text: 'Sluiten', style: 'cancel' },
        {
          text: 'Markeer beoordeeld',
          onPress: () => handleMarkReviewed(finding.id, finding.source),
        },
        {
          text: 'Escaleer',
          style: 'destructive',
          onPress: () => handleEscalate(finding),
        },
      ],
    );
  }, []);

  const handleMarkReviewed = useCallback((id: string, source: 'auditor' | 'financial') => {
    setReviewedIds(prev => new Set(prev).add(id));
    if (source === 'auditor') {
      auditorService.acknowledgeFinding(id, 'cfo-user');
    } else {
      financialAuditor.acknowledgeFinding(id, 'cfo-user');
    }
    Alert.alert('Beoordeeld', 'Bevinding is gemarkeerd als beoordeeld.');
  }, []);

  const handleEscalate = useCallback((finding: typeof allFindings[0]) => {
    Alert.alert(
      'Escalatie bevestigen',
      `Wil je "${finding.title}" escaleren naar het directieteam?\n\nImpact: ${formatBedrag(finding.impact)}`,
      [
        { text: 'Annuleer', style: 'cancel' },
        {
          text: 'Escaleer nu',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Geescaleerd', 'Bevinding is geescaleerd naar het directieteam.');
          },
        },
      ],
    );
  }, []);

  const handleCompliancePress = useCallback((item: ComplianceItem) => {
    const statusLabel =
      item.status === 'compliant' ? 'Conform'
      : item.status === 'at-risk' ? 'Risico'
      : 'Niet-conform';

    Alert.alert(
      `${item.label} - ${statusLabel}`,
      `${item.detail}\n\nLaatste controle: ${item.lastChecked}`,
      [{ text: 'OK' }],
    );
  }, []);

  const handleRefresh = useCallback(async () => {
    await refreshAudit();
  }, [refreshAudit]);

  // =========================================================================
  // COMPACT MODE: embeddable summary card for CFO Overview tab
  // =========================================================================
  if (compact) {
    return (
      <Pressable style={localStyles.compactCard} onPress={onExpandPress}>
        <View style={localStyles.compactHeader}>
          <View style={[localStyles.compactHeaderIcon, { backgroundColor: SemanticColors.feedbackWarningBg }]}>
            <Ionicons name="shield-checkmark" size={18} color={SemanticColors.feedbackWarning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={localStyles.compactTitle}>Financiele Auditor</Text>
            <Text style={localStyles.compactSubtitle}>AI-gestuurde financiele controle</Text>
          </View>
          <AuditHealthScore score={healthScore} label="Score" />
        </View>

        {/* Severity pills row */}
        <View style={localStyles.severityPillRow}>
          <SeverityCountPill severity="critical" count={severityCounts.critical} />
          <SeverityCountPill severity="high" count={severityCounts.high} />
          <SeverityCountPill severity="medium" count={severityCounts.medium} />
          <SeverityCountPill severity="low" count={severityCounts.low} />
        </View>

        {/* Key metrics */}
        <View style={localStyles.compactMetricsRow}>
          <View style={localStyles.compactMetric}>
            <Text style={[localStyles.compactMetricValue, { color: SemanticColors.feedbackError }]}>
              {formatCompact(totalImpact)}
            </Text>
            <Text style={localStyles.compactMetricLabel}>Totale impact</Text>
          </View>
          <View style={localStyles.compactMetricDivider} />
          <View style={localStyles.compactMetric}>
            <Text style={[localStyles.compactMetricValue, { color: SemanticColors.feedbackSuccess }]}>
              {formatCompact(totalSavings + totalOverpaid)}
            </Text>
            <Text style={localStyles.compactMetricLabel}>Besparingskans</Text>
          </View>
          <View style={localStyles.compactMetricDivider} />
          <View style={localStyles.compactMetric}>
            <Text style={[localStyles.compactMetricValue, { color: CFO_COLOR }]}>
              {allFindings.length}
            </Text>
            <Text style={localStyles.compactMetricLabel}>Bevindingen</Text>
          </View>
        </View>

        {/* Top 2 findings preview */}
        {allFindings.slice(0, 2).map(finding => (
          <View key={finding.id} style={localStyles.compactFinding}>
            <View style={[localStyles.compactFindingDot, { backgroundColor: getSeverityColor(finding.severity) }]} />
            <Text style={localStyles.compactFindingText} numberOfLines={1}>
              {finding.title}
            </Text>
            <SeverityBadge severity={finding.severity} />
          </View>
        ))}

        {/* Expand prompt */}
        <View style={localStyles.compactExpandRow}>
          <Ionicons name="expand" size={14} color={CFO_COLOR} />
          <Text style={localStyles.compactExpandText}>Toon volledig audit-overzicht</Text>
          <Ionicons name="chevron-forward" size={14} color={CFO_COLOR} />
        </View>
      </Pressable>
    );
  }

  // =========================================================================
  // FULL DASHBOARD MODE
  // =========================================================================

  const isLoading = auditLoading || financialLoading;

  return (
    <View style={localStyles.container}>
      {/* Tab Bar */}
      <View style={localStyles.tabBar}>
        <TabButton
          label="Overzicht"
          icon="grid"
          isActive={activeTab === 'overzicht'}
          onPress={() => setActiveTab('overzicht')}
        />
        <TabButton
          label="Bevindingen"
          icon="alert-circle"
          isActive={activeTab === 'bevindingen'}
          onPress={() => setActiveTab('bevindingen')}
        />
        <TabButton
          label="Compliance"
          icon="shield-checkmark"
          isActive={activeTab === 'compliance'}
          onPress={() => setActiveTab('compliance')}
        />
        <TabButton
          label="Besparingen"
          icon="trending-down"
          isActive={activeTab === 'besparingen'}
          onPress={() => setActiveTab('besparingen')}
        />
      </View>

      <ScrollView
        style={localStyles.scrollView}
        contentContainerStyle={localStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ================= OVERZICHT TAB ================= */}
        {activeTab === 'overzicht' && (
          <>
            {/* Health Score + Risk Summary */}
            <View style={localStyles.healthRow}>
              <AuditHealthScore score={healthScore} label="Audit Score" />
              <View style={localStyles.riskSummary}>
                <Text style={localStyles.riskSummaryTitle}>Risico-overzicht</Text>
                <View style={localStyles.riskGrid}>
                  <SeverityCountPill severity="critical" count={severityCounts.critical} />
                  <SeverityCountPill severity="high" count={severityCounts.high} />
                  <SeverityCountPill severity="medium" count={severityCounts.medium} />
                  <SeverityCountPill severity="low" count={severityCounts.low} />
                </View>
                <View style={localStyles.riskTotalRow}>
                  <Ionicons name="cash" size={14} color={SemanticColors.feedbackError} />
                  <Text style={localStyles.riskTotalText}>
                    Totale financiele impact: {formatBedrag(totalImpact)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Key Metrics Cards */}
            <View style={localStyles.metricsGrid}>
              <Pressable
                style={[localStyles.metricCard, { borderColor: SemanticColors.feedbackWarningBorder }]}
                onPress={() => setActiveTab('bevindingen')}
              >
                <View style={[localStyles.metricIcon, { backgroundColor: SemanticColors.feedbackWarningBg }]}>
                  <Ionicons name="document-text" size={20} color={SemanticColors.feedbackWarning} />
                </View>
                <Text style={localStyles.metricValue}>{financialStats?.invoicesWithDiscrepancies || 0}</Text>
                <Text style={localStyles.metricLabel}>Factuur-{'\n'}afwijkingen</Text>
              </Pressable>

              <Pressable
                style={[localStyles.metricCard, { borderColor: SemanticColors.feedbackSuccessBorder }]}
                onPress={() => setActiveTab('besparingen')}
              >
                <View style={[localStyles.metricIcon, { backgroundColor: SemanticColors.feedbackSuccessBg }]}>
                  <Ionicons name="trending-down" size={20} color={SemanticColors.feedbackSuccess} />
                </View>
                <Text style={localStyles.metricValue}>{formatCompact(totalSavings)}</Text>
                <Text style={localStyles.metricLabel}>Mogelijke{'\n'}besparingen</Text>
              </Pressable>

              <Pressable
                style={[localStyles.metricCard, { borderColor: SemanticColors.feedbackErrorBorder }]}
                onPress={() => setActiveTab('bevindingen')}
              >
                <View style={[localStyles.metricIcon, { backgroundColor: SemanticColors.feedbackErrorBg }]}>
                  <Ionicons name="alert-circle" size={20} color={SemanticColors.feedbackError} />
                </View>
                <Text style={localStyles.metricValue}>{formatCompact(totalOverpaid)}</Text>
                <Text style={localStyles.metricLabel}>Te veel{'\n'}betaald</Text>
              </Pressable>
            </View>

            {/* Compliance Quick Status */}
            <View style={localStyles.card}>
              <View style={localStyles.cardHeader}>
                <Ionicons name="shield-checkmark" size={18} color={CFO_COLOR} />
                <Text style={localStyles.cardTitle}>Compliance Status</Text>
                <Pressable onPress={() => setActiveTab('compliance')}>
                  <Text style={localStyles.cardLink}>Toon alles</Text>
                </Pressable>
              </View>
              {MOCK_COMPLIANCE.slice(0, 3).map(item => (
                <Pressable
                  key={item.id}
                  style={localStyles.complianceQuickItem}
                  onPress={() => handleCompliancePress(item)}
                >
                  <View style={[
                    localStyles.complianceStatusDot,
                    { backgroundColor: getComplianceStatusColor(item.status) },
                  ]} />
                  <Text style={localStyles.complianceQuickLabel}>{item.label}</Text>
                  <Ionicons
                    name={
                      item.status === 'compliant' ? 'checkmark-circle' :
                      item.status === 'at-risk' ? 'warning' : 'close-circle'
                    }
                    size={16}
                    color={getComplianceStatusColor(item.status)}
                  />
                </Pressable>
              ))}
            </View>

            {/* Recent Findings Preview */}
            <View style={localStyles.card}>
              <View style={localStyles.cardHeader}>
                <Ionicons name="list" size={18} color={CFO_COLOR} />
                <Text style={localStyles.cardTitle}>Recente bevindingen</Text>
                <Pressable onPress={() => setActiveTab('bevindingen')}>
                  <Text style={localStyles.cardLink}>Toon alles</Text>
                </Pressable>
              </View>

              {isLoading ? (
                <ActivityIndicator size="small" color={CFO_COLOR} style={{ marginVertical: Spacing.md }} />
              ) : (
                allFindings.slice(0, 3).map(finding => (
                  <Pressable
                    key={finding.id}
                    style={[
                      localStyles.findingRow,
                      reviewedIds.has(finding.id) && localStyles.findingRowReviewed,
                    ]}
                    onPress={() => handleFindingPress(finding)}
                  >
                    <View style={[localStyles.findingSeverityBar, { backgroundColor: getSeverityColor(finding.severity) }]} />
                    <View style={localStyles.findingContent}>
                      <View style={localStyles.findingTopRow}>
                        <Text style={localStyles.findingTitle} numberOfLines={1}>{finding.title}</Text>
                        <SeverityBadge severity={finding.severity} />
                      </View>
                      <Text style={localStyles.findingDesc} numberOfLines={2}>{finding.description}</Text>
                      {finding.impact > 0 && (
                        <View style={localStyles.findingImpactRow}>
                          <Ionicons name="cash" size={12} color={getSeverityColor(finding.severity)} />
                          <Text style={[localStyles.findingImpactText, { color: getSeverityColor(finding.severity) }]}>
                            Impact: {formatBedrag(finding.impact)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
                  </Pressable>
                ))
              )}
            </View>

            {/* Refresh button */}
            <Pressable style={localStyles.refreshButton} onPress={handleRefresh}>
              <Ionicons name="refresh" size={16} color={CFO_COLOR} />
              <Text style={localStyles.refreshButtonText}>Audit opnieuw uitvoeren</Text>
            </Pressable>
          </>
        )}

        {/* ================= BEVINDINGEN TAB ================= */}
        {activeTab === 'bevindingen' && (
          <>
            {/* Filter summary */}
            <View style={localStyles.filterBar}>
              <Text style={localStyles.filterTitle}>
                {allFindings.length} bevindingen gevonden
              </Text>
              <View style={localStyles.filterPills}>
                <SeverityCountPill severity="critical" count={severityCounts.critical} />
                <SeverityCountPill severity="high" count={severityCounts.high} />
                <SeverityCountPill severity="medium" count={severityCounts.medium} />
              </View>
            </View>

            {isLoading ? (
              <ActivityIndicator size="large" color={CFO_COLOR} style={{ marginVertical: Spacing.xl }} />
            ) : (
              allFindings.map(finding => (
                <Pressable
                  key={finding.id}
                  style={[
                    localStyles.findingCard,
                    { borderLeftColor: getSeverityColor(finding.severity) },
                    reviewedIds.has(finding.id) && localStyles.findingCardReviewed,
                  ]}
                  onPress={() => handleFindingPress(finding)}
                >
                  {/* Header */}
                  <View style={localStyles.findingCardHeader}>
                    <SeverityBadge severity={finding.severity} />
                    <Text style={localStyles.findingCardCategory}>{finding.category}</Text>
                  </View>

                  {/* Title & description */}
                  <Text style={localStyles.findingCardTitle}>{finding.title}</Text>
                  <Text style={localStyles.findingCardDesc}>{finding.description}</Text>

                  {/* Impact */}
                  {finding.impact > 0 && (
                    <View style={localStyles.findingCardImpact}>
                      <Ionicons name="cash" size={14} color={getSeverityColor(finding.severity)} />
                      <Text style={[localStyles.findingCardImpactText, { color: getSeverityColor(finding.severity) }]}>
                        Financiele impact: {formatBedrag(finding.impact)}
                      </Text>
                    </View>
                  )}

                  {/* Recommended action */}
                  {finding.action ? (
                    <View style={localStyles.findingCardAction}>
                      <Ionicons name="bulb" size={14} color={Palette.hermesOrange} />
                      <Text style={localStyles.findingCardActionText} numberOfLines={2}>
                        {finding.action}
                      </Text>
                    </View>
                  ) : null}

                  {/* Action buttons */}
                  <View style={localStyles.findingCardButtons}>
                    <Pressable
                      style={[localStyles.findingBtn, localStyles.findingBtnReview]}
                      onPress={() => handleMarkReviewed(finding.id, finding.source)}
                    >
                      <Ionicons name="checkmark" size={14} color={SemanticColors.feedbackSuccess} />
                      <Text style={[localStyles.findingBtnText, { color: SemanticColors.feedbackSuccess }]}>
                        Beoordeeld
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[localStyles.findingBtn, localStyles.findingBtnEscalate]}
                      onPress={() => handleEscalate(finding)}
                    >
                      <Ionicons name="arrow-up" size={14} color={SemanticColors.feedbackError} />
                      <Text style={[localStyles.findingBtnText, { color: SemanticColors.feedbackError }]}>
                        Escaleer
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[localStyles.findingBtn, localStyles.findingBtnDetails]}
                      onPress={() => handleFindingPress(finding)}
                    >
                      <Ionicons name="eye" size={14} color={CFO_COLOR} />
                      <Text style={[localStyles.findingBtnText, { color: CFO_COLOR }]}>
                        Details
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              ))
            )}

            {!isLoading && allFindings.length === 0 && (
              <View style={localStyles.emptyState}>
                <Ionicons name="checkmark-done-circle" size={48} color={SemanticColors.feedbackSuccess} />
                <Text style={localStyles.emptyStateTitle}>Geen bevindingen</Text>
                <Text style={localStyles.emptyStateText}>
                  De financiele auditor heeft geen problemen gedetecteerd.
                </Text>
              </View>
            )}
          </>
        )}

        {/* ================= COMPLIANCE TAB ================= */}
        {activeTab === 'compliance' && (
          <>
            {/* Compliance summary */}
            <View style={localStyles.complianceSummary}>
              <View style={localStyles.complianceSummaryItem}>
                <Ionicons name="checkmark-circle" size={24} color={SemanticColors.feedbackSuccess} />
                <Text style={localStyles.complianceSummaryValue}>
                  {MOCK_COMPLIANCE.filter(c => c.status === 'compliant').length}
                </Text>
                <Text style={localStyles.complianceSummaryLabel}>Conform</Text>
              </View>
              <View style={localStyles.complianceSummaryItem}>
                <Ionicons name="warning" size={24} color={SemanticColors.feedbackWarning} />
                <Text style={localStyles.complianceSummaryValue}>
                  {MOCK_COMPLIANCE.filter(c => c.status === 'at-risk').length}
                </Text>
                <Text style={localStyles.complianceSummaryLabel}>Risico</Text>
              </View>
              <View style={localStyles.complianceSummaryItem}>
                <Ionicons name="close-circle" size={24} color={SemanticColors.feedbackError} />
                <Text style={localStyles.complianceSummaryValue}>
                  {MOCK_COMPLIANCE.filter(c => c.status === 'non-compliant').length}
                </Text>
                <Text style={localStyles.complianceSummaryLabel}>Niet-conform</Text>
              </View>
            </View>

            {/* Compliance items */}
            {MOCK_COMPLIANCE.map(item => (
              <Pressable
                key={item.id}
                style={[
                  localStyles.complianceCard,
                  { borderLeftColor: getComplianceStatusColor(item.status) },
                ]}
                onPress={() => handleCompliancePress(item)}
              >
                <View style={localStyles.complianceCardHeader}>
                  <View style={[localStyles.complianceIcon, { backgroundColor: getComplianceStatusColor(item.status) + '20' }]}>
                    <Ionicons name={item.icon} size={20} color={getComplianceStatusColor(item.status)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={localStyles.complianceLabel}>{item.label}</Text>
                    <Text style={localStyles.complianceLastCheck}>Laatste controle: {item.lastChecked}</Text>
                  </View>
                  <View style={[
                    localStyles.complianceStatusBadge,
                    { backgroundColor: getComplianceStatusColor(item.status) + '20' },
                  ]}>
                    <Text style={[
                      localStyles.complianceStatusText,
                      { color: getComplianceStatusColor(item.status) },
                    ]}>
                      {item.status === 'compliant' ? 'Conform' : item.status === 'at-risk' ? 'Risico' : 'Niet-conform'}
                    </Text>
                  </View>
                </View>
                <Text style={localStyles.complianceDetail}>{item.detail}</Text>
              </Pressable>
            ))}
          </>
        )}

        {/* ================= BESPARINGEN TAB ================= */}
        {activeTab === 'besparingen' && (
          <>
            {/* Savings hero */}
            <View style={localStyles.savingsHero}>
              <Text style={localStyles.savingsHeroLabel}>Totale besparingskans</Text>
              <Text style={localStyles.savingsHeroValue}>{formatBedrag(totalSavings + totalOverpaid)}</Text>
              <View style={localStyles.savingsHeroBreakdown}>
                <View style={localStyles.savingsHeroItem}>
                  <Ionicons name="trending-down" size={14} color={SemanticColors.feedbackSuccess} />
                  <Text style={localStyles.savingsHeroItemText}>
                    Onnodige uitgaven: {formatBedrag(totalSavings)}
                  </Text>
                </View>
                <View style={localStyles.savingsHeroItem}>
                  <Ionicons name="alert-circle" size={14} color={SemanticColors.feedbackWarning} />
                  <Text style={localStyles.savingsHeroItemText}>
                    Overbetalingen: {formatBedrag(totalOverpaid)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Savings actions */}
            {savingsAnalysis?.prioritizedActions.map((action, index) => (
              <Pressable
                key={action.id}
                style={localStyles.savingsActionCard}
                onPress={() => {
                  Alert.alert(
                    action.title,
                    `${action.description}\n\nMogelijke besparing: ${formatBedrag(action.savingsAmount)}\nInspanning: ${action.effort === 'high' ? 'Hoog' : action.effort === 'medium' ? 'Gemiddeld' : 'Laag'}`,
                    [
                      { text: 'Sluiten' },
                      { text: 'Start actie', onPress: () => Alert.alert('Actie gestart', 'Besparingsactie is in gang gezet.') },
                    ],
                  );
                }}
              >
                <View style={localStyles.savingsActionRank}>
                  <Text style={localStyles.savingsActionRankText}>{index + 1}</Text>
                </View>
                <View style={localStyles.savingsActionContent}>
                  <Text style={localStyles.savingsActionTitle}>{action.title}</Text>
                  <Text style={localStyles.savingsActionDesc} numberOfLines={2}>{action.description}</Text>
                </View>
                <View style={localStyles.savingsActionAmount}>
                  <Text style={localStyles.savingsActionAmountText}>{formatBedrag(action.savingsAmount)}</Text>
                  <View style={localStyles.savingsActionBtn}>
                    <Text style={localStyles.savingsActionBtnText}>Actie</Text>
                  </View>
                </View>
              </Pressable>
            ))}

            {/* Overpayment findings */}
            {overpaymentAnalysis?.findings.map(finding => (
              <Pressable
                key={finding.id}
                style={localStyles.overpaymentCard}
                onPress={() => {
                  Alert.alert(
                    `Overbetaling: ${finding.itemOrService}`,
                    `${finding.description}\n\nLeverancier: ${finding.vendor}\nBetaald tarief: ${formatBedrag(finding.paidRate)}\nMarkt-/contracttarief: ${formatBedrag(finding.benchmarkRate)}\nTe veel betaald: ${formatBedrag(finding.overpaymentAmount)}${finding.isRecoverable ? '\n\nDit bedrag is mogelijk terugvorderbaar.' : ''}`,
                    [
                      { text: 'Sluiten' },
                      finding.isRecoverable
                        ? { text: 'Start terugvordering', onPress: () => Alert.alert('Terugvordering', 'Terugvordering is gestart.') }
                        : { text: 'Heronderhandel', onPress: () => Alert.alert('Heronderhandeling', 'Heronderhandeling is gestart.') },
                    ],
                  );
                }}
              >
                <View style={localStyles.overpaymentHeader}>
                  <View>
                    <Text style={localStyles.overpaymentVendor}>{finding.vendor}</Text>
                    <Text style={localStyles.overpaymentItem}>{finding.itemOrService}</Text>
                  </View>
                  <View style={localStyles.overpaymentAmountBox}>
                    <Text style={localStyles.overpaymentAmountPercent}>
                      +{finding.overpaymentPercent.toFixed(0)}%
                    </Text>
                    <Text style={localStyles.overpaymentAmountValue}>
                      {formatBedrag(finding.overpaymentAmount)}
                    </Text>
                  </View>
                </View>
                <View style={localStyles.overpaymentRateRow}>
                  <View style={localStyles.overpaymentRateBox}>
                    <Text style={localStyles.overpaymentRateLabel}>Betaald</Text>
                    <Text style={[localStyles.overpaymentRateValue, { color: SemanticColors.feedbackError }]}>
                      {formatBedrag(finding.paidRate)}
                    </Text>
                  </View>
                  <Ionicons name="arrow-forward" size={14} color={SemanticColors.textTertiary} />
                  <View style={localStyles.overpaymentRateBox}>
                    <Text style={localStyles.overpaymentRateLabel}>Benchmark</Text>
                    <Text style={localStyles.overpaymentRateValue}>
                      {formatBedrag(finding.benchmarkRate)}
                    </Text>
                  </View>
                </View>
                {finding.isRecoverable && (
                  <View style={localStyles.recoverableBadge}>
                    <Ionicons name="refresh" size={12} color={SemanticColors.feedbackSuccess} />
                    <Text style={localStyles.recoverableBadgeText}>Terugvorderbaar</Text>
                  </View>
                )}
              </Pressable>
            ))}

            {savingsLoading && overpaymentLoading && (
              <ActivityIndicator size="large" color={CFO_COLOR} style={{ marginVertical: Spacing.xl }} />
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    paddingHorizontal: Spacing.xs,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 4,
    borderRadius: RADIUS.sm,
    marginVertical: 4,
    marginHorizontal: 2,
  },
  tabBtnActive: {
    backgroundColor: CFO_COLOR,
  },
  tabBtnText: {
    fontSize: TYPE.labelSize,
    fontWeight: '500',
    color: SemanticColors.textSecondary,
  },
  tabBtnTextActive: {
    color: Palette.white,
    fontWeight: '600',
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.sm,
  },

  // Health score
  healthScoreContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
  },
  healthScoreValue: {
    fontSize: TYPE.displaySize,
    fontWeight: '800',
  },
  healthScoreLabel: {
    fontSize: TYPE.tinySize - 2,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Health row
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  riskSummary: {
    flex: 1,
  },
  riskSummaryTitle: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: Spacing.xs,
  },
  riskGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  riskTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.xs,
  },
  riskTotalText: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.feedbackError,
    fontWeight: '600',
  },

  // Severity badges
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  severityBadgeText: {
    fontSize: TYPE.tinySize - 1,
    fontWeight: '600',
  },

  // Severity count pills
  severityCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  severityCountDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  severityCountValue: {
    fontSize: TYPE.captionSize,
    fontWeight: '700',
  },
  severityCountLabel: {
    fontSize: TYPE.tinySize,
    fontWeight: '500',
  },
  severityPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },

  // Metrics grid
  metricsGrid: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  metricCard: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  metricValue: {
    fontSize: TYPE.sectionSize,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  metricLabel: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },

  // Card
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  cardTitle: {
    flex: 1,
    fontSize: TYPE.bodySize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  cardLink: {
    fontSize: TYPE.captionSize,
    color: CFO_COLOR,
    fontWeight: '500',
  },

  // Compliance quick items (in overview)
  complianceQuickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  complianceStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  complianceQuickLabel: {
    flex: 1,
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
  },

  // Finding rows (overview preview)
  findingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  findingRowReviewed: {
    opacity: 0.5,
  },
  findingSeverityBar: {
    width: 3,
    height: '100%',
    minHeight: 40,
    borderRadius: 2,
  },
  findingContent: {
    flex: 1,
  },
  findingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  findingTitle: {
    flex: 1,
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  findingDesc: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    lineHeight: 16,
  },
  findingImpactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  findingImpactText: {
    fontSize: TYPE.labelSize,
    fontWeight: '600',
  },

  // Finding cards (full tab)
  findingCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    borderLeftWidth: 4,
  },
  findingCardReviewed: {
    opacity: 0.5,
  },
  findingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 6,
  },
  findingCardCategory: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  findingCardTitle: {
    fontSize: TYPE.bodySize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 4,
  },
  findingCardDesc: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  findingCardImpact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  findingCardImpactText: {
    fontSize: TYPE.captionSize,
    fontWeight: '600',
  },
  findingCardAction: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: SemanticColors.surfaceSecondary,
    padding: 10,
    borderRadius: RADIUS.sm,
    marginBottom: 10,
  },
  findingCardActionText: {
    flex: 1,
    fontSize: TYPE.labelSize,
    color: Palette.hermesOrange,
    lineHeight: 16,
  },
  findingCardButtons: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  findingBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  findingBtnReview: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  findingBtnEscalate: {
    backgroundColor: SemanticColors.feedbackErrorBg,
  },
  findingBtnDetails: {
    backgroundColor: SemanticColors.feedbackInfoBg,
  },
  findingBtnText: {
    fontSize: TYPE.labelSize,
    fontWeight: '600',
  },

  // Filter bar
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  filterTitle: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  filterPills: {
    flexDirection: 'row',
    gap: 4,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyStateTitle: {
    fontSize: TYPE.sectionSize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginTop: Spacing.sm,
  },
  emptyStateText: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },

  // Compliance tab
  complianceSummary: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  complianceSummaryItem: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  complianceSummaryValue: {
    fontSize: TYPE.displaySize - 4,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginTop: 4,
  },
  complianceSummaryLabel: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  complianceCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    borderLeftWidth: 4,
  },
  complianceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 6,
  },
  complianceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  complianceLabel: {
    fontSize: TYPE.bodySize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  complianceLastCheck: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
  },
  complianceStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  complianceStatusText: {
    fontSize: TYPE.tinySize,
    fontWeight: '600',
  },
  complianceDetail: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },

  // Savings tab
  savingsHero: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackSuccessBorder,
  },
  savingsHeroLabel: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
  },
  savingsHeroValue: {
    fontSize: TYPE.displaySize + 4,
    fontWeight: '800',
    color: SemanticColors.feedbackSuccess,
    marginVertical: 6,
  },
  savingsHeroBreakdown: {
    gap: 4,
    width: '100%',
    marginTop: 4,
  },
  savingsHeroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savingsHeroItemText: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
  },
  savingsActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  savingsActionRank: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.md,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  savingsActionRankText: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  savingsActionContent: {
    flex: 1,
  },
  savingsActionTitle: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  savingsActionDesc: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  savingsActionAmount: {
    alignItems: 'flex-end',
  },
  savingsActionAmountText: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  savingsActionBtn: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm - 2,
    marginTop: 4,
  },
  savingsActionBtnText: {
    fontSize: TYPE.tinySize,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
  },

  // Overpayment cards
  overpaymentCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackErrorBorder,
    borderLeftWidth: 4,
    borderLeftColor: SemanticColors.feedbackError,
  },
  overpaymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  overpaymentVendor: {
    fontSize: TYPE.bodySize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  overpaymentItem: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  overpaymentAmountBox: {
    alignItems: 'flex-end',
  },
  overpaymentAmountPercent: {
    fontSize: TYPE.titleSize,
    fontWeight: '700',
    color: SemanticColors.feedbackError,
  },
  overpaymentAmountValue: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.feedbackError,
    fontWeight: '600',
  },
  overpaymentRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  overpaymentRateBox: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
  },
  overpaymentRateLabel: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
  },
  overpaymentRateValue: {
    fontSize: TYPE.bodySize - 1,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },
  recoverableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
  },
  recoverableBadgeText: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.feedbackSuccess,
    fontWeight: '600',
  },

  // Refresh button
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: Spacing.xs,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: CFO_COLOR,
  },
  refreshButtonText: {
    fontSize: TYPE.bodySize - 1,
    color: CFO_COLOR,
    fontWeight: '600',
  },

  // =========================================================================
  // COMPACT MODE STYLES
  // =========================================================================
  compactCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  compactHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTitle: {
    fontSize: TYPE.bodySize,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  compactSubtitle: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
  },
  compactMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
    padding: 10,
    marginBottom: Spacing.xs,
  },
  compactMetric: {
    flex: 1,
    alignItems: 'center',
  },
  compactMetricDivider: {
    width: 1,
    height: 28,
    backgroundColor: SemanticColors.borderDefault,
  },
  compactMetricValue: {
    fontSize: TYPE.titleSize,
    fontWeight: '700',
  },
  compactMetricLabel: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  compactFinding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  compactFindingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  compactFindingText: {
    flex: 1,
    fontSize: TYPE.captionSize,
    color: SemanticColors.textPrimary,
  },
  compactExpandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: Spacing.xs,
    marginTop: 4,
  },
  compactExpandText: {
    fontSize: TYPE.captionSize,
    color: CFO_COLOR,
    fontWeight: '500',
  },
});

export default FinancialAuditorDashboard;
