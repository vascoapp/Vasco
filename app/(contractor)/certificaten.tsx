// =============================================================================
// CERTIFICATEN - AI-Powered Certificates & Compliance Management
// =============================================================================
// Smart compliance tracking with alerts, verification, and renewal workflows
// Integrates: complianceService, auditorService, AI-powered insights
// =============================================================================

import { useState, useMemo } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Modal,
  Linking,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { PAGE_BG, TYPE, GRID, RADIUS } from '../../src/theme/tabStyles';
import { MS_PER_DAY } from '../../src/utils/timeConstants';
import { useAuth } from '../../src/context/AuthContext';
import { formatCurrency0, formatDateShortAuto, formatDayMonthAuto, type Country } from '../../src/i18n/formatting';

// Services
import {
  useLicenses,
  useCertifications,
  useInsurancePolicies,
  useComplianceAlerts,
  useComplianceStats,
  useExpiryCalendar,
  License,
  Certification,
  InsurancePolicy,
} from '../../src/services/complianceService';
import { useAuditFindings } from '../../src/services/auditorService';
import { useKvKRegistration, useBtwRegistration } from '../../src/services/dutchComplianceService';
import { governmentPortalsFor } from '../../src/config/governmentPortals';
import { useTranslation } from 'react-i18next';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// TYPES
// ============================================

type TabId = 'overview' | 'certificates' | 'insurance' | 'licenses';
type ItemStatus = 'valid' | 'active' | 'expiring_soon' | 'expired' | 'pending_renewal' | 'suspended' | 'cancelled';

interface ComplianceItem {
  id: string;
  name: string;
  issuer: string;
  expiryDate: Date;
  status: ItemStatus;
  type: 'certification' | 'insurance' | 'license';
  category?: string;
  documentUrl?: string;
  renewalCost?: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getStatusConfig(status: ItemStatus, t?: (key: string, fallback: string) => string) {
  const tr = t || ((k: string, f: string) => f);
  switch (status) {
    case 'valid':
    case 'active':
      return {
        label: status === 'active' ? tr('compliance.statusActive', 'Actief') : tr('compliance.statusValid', 'Geldig'),
        color: SemanticColors.feedbackSuccess,
        bg: SemanticColors.feedbackSuccessBg,
        icon: 'checkmark-circle' as IconName,
      };
    case 'expiring_soon':
      return {
        label: tr('compliance.statusExpiringSoon', 'Verloopt binnenkort'),
        color: SemanticColors.feedbackWarning,
        bg: SemanticColors.feedbackWarningBg,
        icon: 'alert-circle' as IconName,
      };
    case 'expired':
      return {
        label: tr('compliance.statusExpired', 'Verlopen'),
        color: SemanticColors.feedbackError,
        bg: SemanticColors.feedbackErrorBg,
        icon: 'close-circle' as IconName,
      };
    case 'pending_renewal':
      return {
        label: tr('compliance.statusPendingRenewal', 'In aanvraag'),
        color: SemanticColors.feedbackInfo,
        bg: SemanticColors.feedbackInfoBg,
        icon: 'time' as IconName,
      };
    case 'suspended':
    case 'cancelled':
      return {
        label: status === 'cancelled' ? tr('compliance.statusCancelled', 'Geannuleerd') : tr('compliance.statusSuspended', 'Opgeschort'),
        color: SemanticColors.feedbackError,
        bg: SemanticColors.feedbackErrorBg,
        icon: 'ban' as IconName,
      };
    default:
      return {
        label: tr('compliance.statusUnknown', 'Onbekend'),
        color: SemanticColors.textTertiary,
        bg: SemanticColors.surfaceSecondary,
        icon: 'help-circle' as IconName,
      };
  }
}

function getDaysUntilExpiry(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// Shared formatter, not toLocaleDateString(undefined) — the latter follows
// the DEVICE, so a Dutch contractor on an English phone read "Verloopt Mar 4".
// `*Auto` resolves the country from the current user; this helper is called
// from leaf subcomponents that are not passed one.
function formatDate(date: Date): string {
  return formatDateShortAuto(date);
}

// ============================================
// COMPONENTS
// ============================================

function ComplianceScoreRing({ score, size = 100 }: { score: number | null; size?: number }) {
  const { t } = useTranslation();
  const getScoreColor = () => {
    if (score === null) return SemanticColors.textTertiary;
    if (score >= 90) return SemanticColors.feedbackSuccess;
    if (score >= 70) return SemanticColors.feedbackWarning;
    return SemanticColors.feedbackError;
  };

  const getScoreLabel = () => {
    if (score === null) return t('compliance.scoreUnknown', 'Nog niets bijgehouden');
    if (score >= 90) return t('compliance.scoreExcellent', 'Uitstekend');
    if (score >= 70) return t('compliance.scoreActionNeeded', 'Actie nodig');
    return t('compliance.scoreCritical', 'Kritiek');
  };

  return (
    <View style={[styles.scoreRing, { width: size, height: size }]}>
      <View style={[styles.scoreRingInner, { borderColor: getScoreColor() }]}>
        <Text style={[styles.scoreValue, { color: getScoreColor() }]}>{score === null ? '—' : score}</Text>
        <Text style={styles.scoreLabel} numberOfLines={2}>{getScoreLabel()}</Text>
      </View>
    </View>
  );
}

function AlertCard({ alert, onPress }: { alert: any; onPress?: () => void }) {
  const { t } = useTranslation();
  const severityConfig = {
    critical: { bg: SemanticColors.feedbackErrorBg, color: SemanticColors.feedbackError, icon: 'warning' as IconName },
    high: { bg: SemanticColors.feedbackWarningBg, color: SemanticColors.feedbackWarning, icon: 'alert-circle' as IconName },
    medium: { bg: SemanticColors.feedbackInfoBg, color: SemanticColors.feedbackInfo, icon: 'information-circle' as IconName },
    low: { bg: SemanticColors.feedbackInfoBg, color: SemanticColors.feedbackInfo, icon: 'information-circle' as IconName },
  };

  const config = severityConfig[alert.severity as keyof typeof severityConfig] || severityConfig.low;

  return (
    <Pressable style={[styles.alertCard, { backgroundColor: config.bg }]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${alert.severity} alert: ${alert.title}`}>
      <Ionicons name={config.icon} size={20} color={config.color} />
      <View style={styles.alertContent}>
        <Text style={[styles.alertTitle, { color: config.color }]} numberOfLines={1}>{alert.title}</Text>
        {alert.dueDate && (
          <Text style={[styles.alertDays, { color: config.color }]}>
            {(() => {
              const days = Math.ceil((new Date(alert.dueDate).getTime() - Date.now()) / MS_PER_DAY);
              return days < 0 ? `${Math.abs(days)} ${t('compliance.daysAgo', 'dagen geleden')}` : `${t('compliance.daysRemaining', 'Nog')} ${days} ${t('compliance.days', 'dagen')}`;
            })()}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={config.color} />
    </Pressable>
  );
}

function StatCard({ icon, value, label, color, onPress }: {
  icon: IconName;
  value: number;
  label: string;
  color: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.statCard} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

function TabButton({ id, label, icon, isActive, onPress }: {
  id: TabId;
  label: string;
  icon: IconName;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.tabButton, isActive && styles.tabButtonActive]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isActive }}
    >
      <Ionicons
        name={icon}
        size={18}
        color={isActive ? '#fff' : SemanticColors.textSecondary}
      />
      <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ItemCard({ item, onPress }: { item: ComplianceItem; onPress?: () => void }) {
  const { t } = useTranslation();
  const status = getStatusConfig(item.status, t);
  const daysUntil = getDaysUntilExpiry(item.expiryDate);

  const getTypeIcon = (): IconName => {
    switch (item.type) {
      case 'certification': return 'school';
      case 'insurance': return 'shield-checkmark';
      case 'license': return 'ribbon';
    }
  };

  return (
    <Pressable style={styles.itemCard} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${item.name}, ${status.label}, ${item.issuer}`}>
      <View style={styles.itemHeader}>
        <View style={[styles.itemIcon, { backgroundColor: Palette.hermesOrange + '15' }]}>
          <Ionicons name={getTypeIcon()} size={22} color={Palette.hermesOrange} />
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.itemIssuer} numberOfLines={1}>{item.issuer}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Ionicons name={status.icon} size={14} color={status.color} />
        </View>
      </View>

      <View style={styles.itemFooter}>
        <View style={styles.itemExpiry}>
          <Ionicons name="calendar-outline" size={14} color={SemanticColors.textTertiary} />
          <Text style={[
            styles.itemExpiryText,
            (item.status === 'expired' || item.status === 'cancelled') && { color: SemanticColors.feedbackError },
            item.status === 'expiring_soon' && { color: SemanticColors.feedbackWarning },
          ]}>
            {item.status === 'expired' || item.status === 'cancelled'
              ? `${item.status === 'cancelled' ? t('compliance.statusCancelled', 'Geannuleerd') : t('compliance.statusExpired', 'Verlopen')} ${formatDate(item.expiryDate)}`
              : `${t('compliance.expires', 'Verloopt')} ${formatDate(item.expiryDate)}`}
            {item.status === 'expiring_soon' && ` (${daysUntil}d)`}
          </Text>
        </View>

        {(item.status === 'expired' || item.status === 'expiring_soon' || item.status === 'cancelled') && (
          <Pressable style={styles.renewButton} onPress={() => Alert.alert(t('compliance.renew', 'Renew'), t('common.comingSoon', 'Coming soon'))} accessibilityRole="button" accessibilityLabel={`${t('compliance.renew', 'Renew')} ${item.name}`}>
            <Ionicons name="refresh" size={14} color={Palette.hermesOrange} />
            <Text style={styles.renewButtonText}>{t('compliance.renew', 'Vernieuw')}</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

function ExpiryTimeline({ items }: { items: { name: string; date: Date; type: string }[] }) {
  const { t } = useTranslation();
  if (items.length === 0) return null;

  return (
    <View style={styles.timeline}>
      <Text style={styles.timelineTitle}>{t('compliance.upcomingExpiries', 'Komende vervaldatums')}</Text>
      {items.slice(0, 4).map((item, index) => {
        const days = getDaysUntilExpiry(item.date);
        const isUrgent = days <= 30;

        return (
          <View key={index} style={styles.timelineItem}>
            <View style={[styles.timelineDot, isUrgent && { backgroundColor: SemanticColors.feedbackWarning }]} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineItemName} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.timelineItemDate, isUrgent && { color: SemanticColors.feedbackWarning }]}>
                {formatDate(item.date)} ({days}d)
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function BlockedWorkBanner({ blockedCount }: { blockedCount: number }) {
  const { t } = useTranslation();
  if (blockedCount === 0) return null;

  return (
    <View style={styles.blockedBanner}>
      <View style={styles.blockedIcon}>
        <Ionicons name="lock-closed" size={18} color="#fff" />
      </View>
      <View style={styles.blockedContent}>
        <Text style={styles.blockedTitle} numberOfLines={1}>{t('compliance.workBlocked', { count: blockedCount, defaultValue: '{{count}} types of work blocked' })}</Text>
        <Text style={styles.blockedSubtitle} numberOfLines={1}>{t('compliance.missingCertificates', 'Door ontbrekende certificaten')}</Text>
      </View>
      <Pressable style={styles.blockedAction} accessibilityRole="button" accessibilityLabel={t('compliance.view', 'View blocked work')}>
        <Text style={styles.blockedActionText} numberOfLines={1}>{t('compliance.view', 'Bekijk')}</Text>
      </Pressable>
    </View>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

export default function CertificatenScreen() {
  const { user } = useAuth();
  const country = (user?.country ?? 'NL') as Country;
  const portals = governmentPortalsFor(country);
  const { t } = useTranslation();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ComplianceItem | null>(null);

  // Data from services
  const { licenses, loading: licensesLoading } = useLicenses();
  const { certifications, loading: certsLoading } = useCertifications();
  const { policies, loading: insuranceLoading } = useInsurancePolicies();
  const { alerts } = useComplianceAlerts();
  const stats = useComplianceStats();
  const calendar = useExpiryCalendar(6);
  const { findings: auditFindings } = useAuditFindings('contractor');
  const { kvk, verify: verifyKvK } = useKvKRegistration();
  const { btw } = useBtwRegistration();
  const [kvkVerifying, setKvkVerifying] = useState(false);

  // Combine items for unified view
  const allItems = useMemo((): ComplianceItem[] => {
    const items: ComplianceItem[] = [];

    licenses.forEach(l => items.push({
      id: l.id,
      name: l.name,
      issuer: l.issuingAuthority,
      expiryDate: l.expiryDate,
      status: l.status,
      type: 'license',
      category: l.type,
      documentUrl: l.documentUrl,
      renewalCost: l.renewalCost,
    }));

    certifications.forEach(c => items.push({
      id: c.id,
      name: c.name,
      issuer: c.issuingBody,
      expiryDate: c.expiryDate,
      status: c.status,
      type: 'certification',
      category: c.category,
      documentUrl: c.documentUrl,
    }));

    policies.forEach(p => items.push({
      id: p.id,
      name: p.name,
      issuer: p.provider,
      expiryDate: p.endDate,
      status: p.status,
      type: 'insurance',
      documentUrl: p.documentUrl,
    }));

    return items;
  }, [licenses, certifications, policies]);

  // Filter items by tab
  const filteredItems = useMemo(() => {
    if (activeTab === 'overview') return allItems;
    if (activeTab === 'certificates') return allItems.filter(i => i.type === 'certification');
    if (activeTab === 'insurance') return allItems.filter(i => i.type === 'insurance');
    if (activeTab === 'licenses') return allItems.filter(i => i.type === 'license');
    return allItems;
  }, [allItems, activeTab]);

  // Stats calculations
  const validCount = allItems.filter(i => i.status === 'valid' || i.status === 'active').length;
  const expiringCount = allItems.filter(i => i.status === 'expiring_soon').length;
  const expiredCount = allItems.filter(i => i.status === 'expired' || i.status === 'cancelled').length;
  const totalCount = allItems.length;

  // Compliance score (0-100), or null when there is nothing to score.
  //
  // This used to return 100 for an empty record, so a contractor tracking no
  // certificates at all was told "100 / Uitstekend" on the COMPLIANCE screen —
  // the one surface where a false reassurance costs the most. Nothing tracked
  // is not the same fact as everything valid. Same UNKNOWN-vs-zero treatment
  // as the savings trend fabrication.
  const complianceScore = useMemo<number | null>(() => {
    if (totalCount === 0) return null;
    const score = Math.round(((validCount + (expiringCount * 0.5)) / totalCount) * 100);
    return Math.max(0, Math.min(100, score));
  }, [validCount, expiringCount, totalCount]);

  // Blocked work count from audit findings
  const blockedWorkCount = auditFindings.filter(
    f => f.categoryId === 'compliance-expiring' && f.status === 'new'
  ).length;

  // Upcoming expiries for timeline — calendar entries have { date, items[] }
  const upcomingExpiries = useMemo(() => {
    if (!calendar || !Array.isArray(calendar)) return [];
    const now = new Date();
    const entries: { name: string; date: Date; type: string }[] = [];
    calendar.forEach(entry => {
      if (entry.date > now) {
        entry.items.forEach(item => {
          entries.push({ name: item.name, date: entry.date, type: item.type });
        });
      }
    });
    return entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [calendar]);

  // Critical alerts (expiring/expired)
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' || a.severity === 'high');

  // Refresh handler — services re-fetch via subscribe, so just trigger a re-render
  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  const isLoading = licensesLoading || certsLoading || insuranceLoading;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('compliance.title', 'Certificaten & Compliance'),
          headerStyle: { backgroundColor: SemanticColors.surfacePrimary },
          headerTintColor: SemanticColors.textPrimary,
          headerShadowVisible: false,
        }}
      />

      {/* Tabs */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          <TabButton
            id="overview"
            label={t('compliance.tabOverview', 'Overzicht')}
            icon="grid"
            isActive={activeTab === 'overview'}
            onPress={() => setActiveTab('overview')}
          />
          <TabButton
            id="certificates"
            label={t('compliance.tabCertificates', 'Certificaten')}
            icon="school"
            isActive={activeTab === 'certificates'}
            onPress={() => setActiveTab('certificates')}
          />
          <TabButton
            id="insurance"
            label={t('compliance.tabInsurance', 'Verzekeringen')}
            icon="shield-checkmark"
            isActive={activeTab === 'insurance'}
            onPress={() => setActiveTab('insurance')}
          />
          <TabButton
            id="licenses"
            label={t('compliance.tabLicenses', 'Vergunningen')}
            icon="ribbon"
            isActive={activeTab === 'licenses'}
            onPress={() => setActiveTab('licenses')}
          />
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'overview' && (
          <>
            {/* Compliance Score Card */}
            <View style={styles.scoreCard}>
              <View style={styles.scoreCardLeft}>
                <Text style={styles.scoreCardTitle}>{t('compliance.complianceStatus', 'Compliance Status')}</Text>
                <View style={styles.statsRow}>
                  <StatCard
                    icon="checkmark-circle"
                    value={validCount}
                    label={t('compliance.statusValid', 'Geldig')}
                    color={SemanticColors.feedbackSuccess}
                    onPress={() => setActiveTab('certificates')}
                  />
                  <StatCard
                    icon="alert-circle"
                    value={expiringCount}
                    label={t('compliance.expiring', 'Verloopt')}
                    color={SemanticColors.feedbackWarning}
                  />
                  <StatCard
                    icon="close-circle"
                    value={expiredCount}
                    label={t('compliance.expired', 'Verlopen')}
                    color={SemanticColors.feedbackError}
                  />
                </View>
              </View>
              <ComplianceScoreRing score={complianceScore} size={90} />
            </View>

            {/* Blocked Work Banner */}
            <BlockedWorkBanner blockedCount={blockedWorkCount} />

            {/* Critical Alerts */}
            {criticalAlerts.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('compliance.actionsRequired', 'Acties vereist')}</Text>
                {criticalAlerts.slice(0, 3).map(alert => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </View>
            )}

            {/* Upcoming Expiries Timeline */}
            <ExpiryTimeline items={upcomingExpiries} />

            {/* KvK & BTW Verification — NL ONLY.
                Ungated, this asked a German contractor for a KvK number (the
                DUTCH chamber of commerce) under a heading reading
                "Registraties", and showed a Dutch BTW status. Germany has a
                Handelsregisternummer and USt-IdNr — DE_BUSINESS_PROFILE
                already carries both — but there is no verification lookup for
                them, and unlike the portals there is no ready sibling to point
                at. Gated rather than faked: a verification badge that verifies
                nothing is worse than no badge. */}
            {country === 'NL' && (
            <View style={styles.verificationSection}>
              <Text style={styles.sectionTitle}>{t('compliance.registrations', 'Registraties')}</Text>
              {/* KvK Row */}
              <View style={styles.verificationRow}>
                <View style={[styles.verificationIcon, { backgroundColor: kvk.verificationStatus === 'verified' ? SemanticColors.feedbackSuccessBg : SemanticColors.feedbackWarningBg }]}>
                  <Ionicons name="business" size={18} color={kvk.verificationStatus === 'verified' ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.verificationLabel}>KvK</Text>
                  <Text style={styles.verificationValue}>{kvk.kvkNumber} — {kvk.businessName}</Text>
                  <Text style={styles.verificationMeta}>
                    {kvk.verificationStatus === 'verified'
                      ? t('compliance.verified', 'Geverifieerd')
                      : t('compliance.unverified', 'Niet geverifieerd')}
                    {kvk.lastVerified ? ` · ${formatDayMonthAuto(new Date(kvk.lastVerified))}` : ''}
                  </Text>
                </View>
                <Pressable
                  style={[styles.verifyButton, kvkVerifying && { opacity: 0.5 }]}
                  disabled={kvkVerifying}
                  onPress={async () => {
                    setKvkVerifying(true);
                    try { await verifyKvK(); } finally { setKvkVerifying(false); }
                  }}
                >
                  <Ionicons name="shield-checkmark" size={14} color={Palette.hermesOrange} />
                  <Text style={styles.verifyButtonText}>{kvkVerifying ? t('compliance.checking', 'Bezig...') : t('compliance.checkKvK', 'Controleer')}</Text>
                </Pressable>
              </View>
              {/* BTW Row */}
              <View style={styles.verificationRow}>
                <View style={[styles.verificationIcon, { backgroundColor: btw.isActive ? SemanticColors.feedbackSuccessBg : SemanticColors.feedbackErrorBg }]}>
                  <Ionicons name="receipt" size={18} color={btw.isActive ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.verificationLabel}>BTW</Text>
                  <Text style={styles.verificationValue}>{btw.btwNumber}</Text>
                  <Text style={styles.verificationMeta}>
                    {btw.isActive ? t('compliance.active', 'Actief') : t('compliance.inactive', 'Inactief')}
                    {btw.viesVerified ? ` · VIES ${t('compliance.verified', 'Geverifieerd')}` : ''}
                    {btw.nextFilingDeadline ? ` · ${t('compliance.nextFiling', 'Aangifte')}: ${formatDayMonthAuto(new Date(btw.nextFilingDeadline))}` : ''}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: btw.isActive ? SemanticColors.feedbackSuccessBg : SemanticColors.feedbackErrorBg }]}>
                  <Ionicons name={btw.isActive ? 'checkmark' : 'close'} size={16} color={btw.isActive ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError} />
                </View>
              </View>
            </View>
            )}

            {/* Quick Add Button */}
            <Pressable style={styles.addButton} onPress={() => Alert.alert(t('compliance.addCertificate', 'Add certificate'), t('common.comingSoon', 'Coming soon'))}>
              <Ionicons name="add-circle" size={22} color={Palette.hermesOrange} />
              <Text style={styles.addButtonText} numberOfLines={1}>{t('compliance.addCertificate', 'Certificaat toevoegen')}</Text>
            </Pressable>
          </>
        )}

        {activeTab !== 'overview' && (
          <>
            {/* Section Header with count */}
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>
                {activeTab === 'certificates' && t('compliance.tabCertificates', 'Certificaten')}
                {activeTab === 'insurance' && t('compliance.tabInsurance', 'Verzekeringen')}
                {activeTab === 'licenses' && t('compliance.tabLicenses', 'Vergunningen')}
              </Text>
              <Text style={styles.listCount}>{filteredItems.length} {t('compliance.items', 'items')}</Text>
            </View>

            {/* Entry point to the full insurance screen (claims, photos,
                report-to-insurer). This compliance tab only lists policies
                read-only — before this the dedicated /contractor/insurance
                screen had NO contractor entry point at all (only the site
                lead's compliance hub linked to it), so the whole claim flow
                was dead code for solo contractors. */}
            {activeTab === 'insurance' && (
              <Pressable
                style={styles.manageInsuranceButton}
                onPress={() => router.push('/contractor/insurance' as any)}
                accessibilityRole="button"
                accessibilityLabel={t('compliance.manageInsurance', 'Beheer verzekeringen & claims')}
              >
                <Ionicons name="shield-half" size={18} color="#fff" />
                <Text style={styles.manageInsuranceText} numberOfLines={1}>{t('compliance.manageInsurance', 'Beheer verzekeringen & claims')}</Text>
                <Ionicons name="chevron-forward" size={16} color="#fff" />
              </Pressable>
            )}

            {/* Items sorted by urgency */}
            {filteredItems
              .sort((a, b) => {
                // Expired first, then expiring, then valid
                const priority: Record<string, number> = { expired: 0, cancelled: 0, expiring_soon: 1, pending_renewal: 2, suspended: 3, valid: 4, active: 4 };
                return (priority[a.status] ?? 4) - (priority[b.status] ?? 4);
              })
              .map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onPress={() => setSelectedItem(item)}
                />
              ))
            }

            {filteredItems.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="document-outline" size={48} color={SemanticColors.textTertiary} />
                <Text style={styles.emptyStateText}>{t('compliance.noItemsFound', 'Geen items gevonden')}</Text>
                <Pressable style={styles.emptyStateButton} onPress={() => Alert.alert(t('compliance.add', 'Add'), t('common.comingSoon', 'Coming soon'))}>
                  <Text style={styles.emptyStateButtonText} numberOfLines={1}>{t('compliance.add', 'Voeg toe')}</Text>
                </Pressable>
              </View>
            )}

            {/* Add Button */}
            <Pressable style={styles.addButton} onPress={() => Alert.alert(
              activeTab === 'certificates' ? t('compliance.addCertificate', 'Add certificate')
                : activeTab === 'insurance' ? t('compliance.addInsurance', 'Add insurance')
                : t('compliance.addLicense', 'Add license'),
              t('common.comingSoon', 'Coming soon'),
            )}>
              <Ionicons name="add-circle" size={22} color={Palette.hermesOrange} />
              <Text style={styles.addButtonText} numberOfLines={1}>
                {activeTab === 'certificates' && t('compliance.addCertificate', 'Certificaat toevoegen')}
                {activeTab === 'insurance' && t('compliance.addInsurance', 'Verzekering toevoegen')}
                {activeTab === 'licenses' && t('compliance.addLicense', 'Vergunning toevoegen')}
              </Text>
            </Pressable>
          </>
        )}

        {/* Government Portals — per country.
            DUTCH_GOVERNMENT_PORTALS rendered ungated, so a German contractor
            was linked to KVK and the Belastingdienst with Dutch descriptions,
            as were FR/ES/IT/UK/US. I first gated this to NL, reasoning that
            foreign registry links were claims I should not invent — but all
            six sets already existed in src/types/*-compliance.ts. Nothing
            needed inventing, it needed looking for. */}
        {portals.length > 0 && (
        <View style={styles.portalsSection}>
          <Text style={styles.portalsSectionTitle}>{t('compliance.governmentPortals', 'Overheidsloketten')}</Text>
          <View style={styles.portalsCard}>
            {portals.map((portal, index) => (
              <Pressable
                key={portal.name}
                style={[styles.portalRow, index < portals.length - 1 && styles.portalRowBorder]}
                onPress={() => Linking.openURL(portal.url)}
              >
                <View style={styles.portalIcon}>
                  <Ionicons name="globe-outline" size={16} color={Palette.hermesOrange} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.portalName}>{portal.name}</Text>
                  <Text style={styles.portalDesc}>{portal.description}</Text>
                </View>
                <Ionicons name="open-outline" size={14} color={SemanticColors.textTertiary} />
              </Pressable>
            ))}
          </View>
        </View>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Item Detail Modal */}
      <Modal
        visible={selectedItem !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedItem(null)}
      >
        {selectedItem && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedItem.name}</Text>
              <Pressable onPress={() => setSelectedItem(null)}>
                <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>{t('compliance.issuer', 'Uitgever')}</Text>
                <Text style={styles.modalValue}>{selectedItem.issuer}</Text>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>{t('compliance.status', 'Status')}</Text>
                <View style={[styles.statusBadgeLarge, { backgroundColor: getStatusConfig(selectedItem.status, t).bg }]}>
                  <Ionicons
                    name={getStatusConfig(selectedItem.status, t).icon}
                    size={18}
                    color={getStatusConfig(selectedItem.status, t).color}
                  />
                  <Text style={[styles.statusTextLarge, { color: getStatusConfig(selectedItem.status, t).color }]}>
                    {getStatusConfig(selectedItem.status, t).label}
                  </Text>
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>{t('compliance.expiryDate', 'Vervaldatum')}</Text>
                <Text style={styles.modalValue}>{formatDate(selectedItem.expiryDate)}</Text>
                <Text style={styles.modalSubvalue}>
                  {getDaysUntilExpiry(selectedItem.expiryDate) > 0
                    ? `${t('compliance.daysRemaining', 'Nog')} ${getDaysUntilExpiry(selectedItem.expiryDate)} ${t('compliance.days', 'dagen')}`
                    : `${Math.abs(getDaysUntilExpiry(selectedItem.expiryDate))} ${t('compliance.daysExpiredAgo', 'dagen geleden verlopen')}`}
                </Text>
              </View>

              {selectedItem.renewalCost && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>{t('compliance.renewalCost', 'Vernieuwingskosten')}</Text>
                  <Text style={styles.modalValue}>{formatCurrency0(selectedItem.renewalCost, country)}</Text>
                </View>
              )}

              <View style={styles.modalActions}>
                {selectedItem.type === 'insurance' && (
                  <Pressable
                    style={styles.modalButton}
                    onPress={() => { setSelectedItem(null); router.push('/contractor/insurance' as any); }}
                  >
                    <Ionicons name="shield-half" size={20} color={Palette.hermesOrange} />
                    <Text style={styles.modalButtonText}>{t('compliance.fileClaim', 'Claim indienen')}</Text>
                  </Pressable>
                )}
                {selectedItem.documentUrl && (
                  <Pressable style={styles.modalButton} onPress={() => { if (selectedItem.documentUrl) Linking.openURL(selectedItem.documentUrl); }}>
                    <Ionicons name="document-text" size={20} color={Palette.hermesOrange} />
                    <Text style={styles.modalButtonText}>{t('compliance.viewDocument', 'Document bekijken')}</Text>
                  </Pressable>
                )}
                <Pressable style={styles.modalButton} onPress={() => Alert.alert(t('compliance.share', 'Share'), t('common.comingSoon', 'Coming soon'))}>
                  <Ionicons name="share-outline" size={20} color={Palette.hermesOrange} />
                  <Text style={styles.modalButtonText}>{t('compliance.share', 'Delen')}</Text>
                </Pressable>
                {(selectedItem.status === 'expired' || selectedItem.status === 'expiring_soon' || selectedItem.status === 'cancelled') && (
                  <Pressable style={[styles.modalButton, styles.modalButtonPrimary]} onPress={() => Alert.alert(t('compliance.renewAction', 'Renew'), t('common.comingSoon', 'Coming soon'))}>
                    <Ionicons name="refresh" size={20} color="#fff" />
                    <Text style={[styles.modalButtonText, { color: '#fff' }]}>{t('compliance.renewAction', 'Vernieuwen')}</Text>
                  </Pressable>
                )}
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  tabBar: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  tabScroll: {
    paddingHorizontal: GRID.md,
    paddingVertical: GRID.sm,
    gap: GRID.sm,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADIUS.full,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  tabButtonActive: {
    backgroundColor: Palette.hermesOrange,
  },
  tabButtonText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textSecondary,
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SafeArea.content,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },

  // Score Card
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  scoreCardLeft: {
    flex: 1,
  },
  scoreCardTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontFamily: TYPE.sectionFamily,
  },
  statLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  scoreRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRingInner: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontSize: TYPE.displaySize,
    fontFamily: TYPE.displayFamily,
  },
  scoreLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    // The label sits at the widest point of a CIRCLE, so it has less room than
    // the card it is in. Unconstrained, German "Noch nichts erfasst" ran past
    // the ring and was clipped by the border mid-word ("Noch nichts / rfasst").
    // Cap it inside the chord and let it take a second line.
    maxWidth: '78%',
    textAlign: 'center',
  },

  // Blocked Banner
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.feedbackErrorBg,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  blockedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SemanticColors.feedbackError,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedContent: {
    flex: 1,
  },
  blockedTitle: {
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.feedbackError,
  },
  blockedSubtitle: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.feedbackError,
    opacity: 0.8,
  },
  blockedAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: SemanticColors.feedbackError,
  },
  blockedActionText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    color: '#fff',
  },

  // Section
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    marginBottom: Spacing.xs,
  },

  // Alert Card
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: RADIUS.md,
    gap: Spacing.sm,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
  },
  alertDays: {
    fontSize: TYPE.tinySize,
    marginTop: 2,
  },

  // Timeline
  timeline: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
  },
  timelineTitle: {
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    marginBottom: Spacing.md,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SemanticColors.textTertiary,
  },
  timelineContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineItemName: {
    flex: 1,
    fontSize: TYPE.captionSize,
    color: SemanticColors.textPrimary,
  },
  timelineItemDate: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },

  // List Header
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  listTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  listCount: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textTertiary,
  },

  // Item Card
  itemCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textPrimary,
  },
  itemIssuer: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderMuted,
  },
  itemExpiry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemExpiryText: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  renewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: Palette.hermesOrange + '15',
  },
  renewButtonText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    color: Palette.hermesOrange,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyStateText: {
    fontSize: TYPE.captionSize + 1,
    color: SemanticColors.textTertiary,
  },
  emptyStateButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADIUS.sm,
    backgroundColor: Palette.hermesOrange,
    marginTop: Spacing.sm,
  },
  emptyStateButtonText: {
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.labelFamily,
    color: '#fff',
  },

  // Verification Section
  verificationSection: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  verificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verificationLabel: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
    letterSpacing: 0.5,
  },
  verificationValue: {
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textPrimary,
    marginTop: 1,
  },
  verificationMeta: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: Palette.hermesOrange + '15',
  },
  verifyButtonText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    color: Palette.hermesOrange,
  },

  // Add Button
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.labelFamily,
    color: Palette.hermesOrange,
  },

  // Manage insurance & claims (routes to the full /contractor/insurance screen)
  manageInsuranceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.hermesOrange,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
  },
  manageInsuranceText: {
    flex: 1,
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.labelFamily,
    color: '#fff',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  modalTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    flex: 1,
    marginRight: Spacing.md,
  },
  modalContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  modalSection: {
    marginBottom: Spacing.lg,
  },
  modalLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  modalValue: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textPrimary,
  },
  modalSubvalue: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  statusBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
  },
  statusTextLarge: {
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.labelFamily,
  },
  modalActions: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    borderRadius: RADIUS.md,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  modalButtonPrimary: {
    backgroundColor: Palette.hermesOrange,
  },
  modalButtonText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.labelFamily,
    color: Palette.hermesOrange,
  },
  portalsSection: {
    marginTop: Spacing.lg,
    gap: 8,
  },
  portalsSectionTitle: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    letterSpacing: -0.2,
    paddingHorizontal: 4,
  },
  portalsCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    overflow: 'hidden',
  },
  portalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  portalRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SemanticColors.borderDefault,
  },
  portalIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.lg,
    backgroundColor: Palette.hermesOrange + '0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portalName: {
    fontSize: TYPE.captionSize + 1,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textPrimary,
  },
  portalDesc: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textSecondary,
    marginTop: 1,
  },
});
