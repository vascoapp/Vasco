// =============================================================================
// CERTIFICATEN - AI-Powered Certificates & Compliance Management
// =============================================================================
// Smart compliance tracking with alerts, verification, and renewal workflows
// Integrates: complianceService, auditorService, AI-powered insights
// =============================================================================

import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Modal,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';

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

function getStatusConfig(status: ItemStatus) {
  switch (status) {
    case 'valid':
    case 'active':
      return {
        label: status === 'active' ? 'Actief' : 'Geldig',
        color: SemanticColors.feedbackSuccess,
        bg: SemanticColors.feedbackSuccessBg,
        icon: 'checkmark-circle' as IconName,
      };
    case 'expiring_soon':
      return {
        label: 'Verloopt binnenkort',
        color: SemanticColors.feedbackWarning,
        bg: SemanticColors.feedbackWarningBg,
        icon: 'alert-circle' as IconName,
      };
    case 'expired':
      return {
        label: 'Verlopen',
        color: SemanticColors.feedbackError,
        bg: SemanticColors.feedbackErrorBg,
        icon: 'close-circle' as IconName,
      };
    case 'pending_renewal':
      return {
        label: 'In aanvraag',
        color: SemanticColors.feedbackInfo,
        bg: SemanticColors.feedbackInfoBg,
        icon: 'time' as IconName,
      };
    case 'suspended':
    case 'cancelled':
      return {
        label: status === 'cancelled' ? 'Geannuleerd' : 'Opgeschort',
        color: SemanticColors.feedbackError,
        bg: SemanticColors.feedbackErrorBg,
        icon: 'ban' as IconName,
      };
    default:
      return {
        label: 'Onbekend',
        color: SemanticColors.textTertiary,
        bg: SemanticColors.surfaceSecondary,
        icon: 'help-circle' as IconName,
      };
  }
}

function getDaysUntilExpiry(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ============================================
// COMPONENTS
// ============================================

function ComplianceScoreRing({ score, size = 100 }: { score: number; size?: number }) {
  const getScoreColor = () => {
    if (score >= 90) return SemanticColors.feedbackSuccess;
    if (score >= 70) return SemanticColors.feedbackWarning;
    return SemanticColors.feedbackError;
  };

  const getScoreLabel = () => {
    if (score >= 90) return 'Uitstekend';
    if (score >= 70) return 'Actie nodig';
    return 'Kritiek';
  };

  return (
    <View style={[styles.scoreRing, { width: size, height: size }]}>
      <View style={[styles.scoreRingInner, { borderColor: getScoreColor() }]}>
        <Text style={[styles.scoreValue, { color: getScoreColor() }]}>{score}</Text>
        <Text style={styles.scoreLabel}>{getScoreLabel()}</Text>
      </View>
    </View>
  );
}

function AlertCard({ alert, onPress }: { alert: any; onPress?: () => void }) {
  const severityConfig = {
    critical: { bg: SemanticColors.feedbackErrorBg, color: SemanticColors.feedbackError, icon: 'warning' as IconName },
    warning: { bg: SemanticColors.feedbackWarningBg, color: SemanticColors.feedbackWarning, icon: 'alert-circle' as IconName },
    info: { bg: SemanticColors.feedbackInfoBg, color: SemanticColors.feedbackInfo, icon: 'information-circle' as IconName },
  };

  const config = severityConfig[alert.severity as keyof typeof severityConfig] || severityConfig.info;

  return (
    <Pressable style={[styles.alertCard, { backgroundColor: config.bg }]} onPress={onPress}>
      <Ionicons name={config.icon} size={20} color={config.color} />
      <View style={styles.alertContent}>
        <Text style={[styles.alertTitle, { color: config.color }]}>{alert.title}</Text>
        {alert.daysUntil !== undefined && (
          <Text style={[styles.alertDays, { color: config.color }]}>
            {alert.daysUntil < 0 ? `${Math.abs(alert.daysUntil)} dagen geleden` : `Nog ${alert.daysUntil} dagen`}
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
    <Pressable style={styles.statCard} onPress={onPress}>
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
  const status = getStatusConfig(item.status);
  const daysUntil = getDaysUntilExpiry(item.expiryDate);

  const getTypeIcon = (): IconName => {
    switch (item.type) {
      case 'certification': return 'school';
      case 'insurance': return 'shield-checkmark';
      case 'license': return 'ribbon';
    }
  };

  return (
    <Pressable style={styles.itemCard} onPress={onPress}>
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
              ? `${item.status === 'cancelled' ? 'Geannuleerd' : 'Verlopen'} ${formatDate(item.expiryDate)}`
              : `Verloopt ${formatDate(item.expiryDate)}`}
            {item.status === 'expiring_soon' && ` (${daysUntil}d)`}
          </Text>
        </View>

        {(item.status === 'expired' || item.status === 'expiring_soon' || item.status === 'cancelled') && (
          <Pressable style={styles.renewButton}>
            <Ionicons name="refresh" size={14} color={Palette.hermesOrange} />
            <Text style={styles.renewButtonText}>Vernieuw</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

function ExpiryTimeline({ items }: { items: { name: string; date: Date; type: string }[] }) {
  if (items.length === 0) return null;

  return (
    <View style={styles.timeline}>
      <Text style={styles.timelineTitle}>Komende vervaldatums</Text>
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
  if (blockedCount === 0) return null;

  return (
    <View style={styles.blockedBanner}>
      <View style={styles.blockedIcon}>
        <Ionicons name="lock-closed" size={18} color="#fff" />
      </View>
      <View style={styles.blockedContent}>
        <Text style={styles.blockedTitle}>{blockedCount} type{blockedCount > 1 ? 's' : ''} werk geblokkeerd</Text>
        <Text style={styles.blockedSubtitle}>Door ontbrekende certificaten</Text>
      </View>
      <Pressable style={styles.blockedAction}>
        <Text style={styles.blockedActionText}>Bekijk</Text>
      </Pressable>
    </View>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

export default function CertificatenScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ComplianceItem | null>(null);

  // Data from services
  const { licenses, loading: licensesLoading, refresh: refreshLicenses } = useLicenses();
  const { certifications, loading: certsLoading, refresh: refreshCerts } = useCertifications();
  const { policies, loading: insuranceLoading, refresh: refreshInsurance } = useInsurancePolicies();
  const { alerts } = useComplianceAlerts();
  const stats = useComplianceStats();
  const calendar = useExpiryCalendar(6);
  const { findings: auditFindings } = useAuditFindings('contractor');

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

  // Compliance score (0-100)
  const complianceScore = useMemo(() => {
    if (totalCount === 0) return 100;
    const score = Math.round(((validCount + (expiringCount * 0.5)) / totalCount) * 100);
    return Math.max(0, Math.min(100, score));
  }, [validCount, expiringCount, totalCount]);

  // Blocked work count from audit findings
  const blockedWorkCount = auditFindings.filter(
    f => f.categoryId === 'compliance-expiring' && f.status === 'new'
  ).length;

  // Upcoming expiries for timeline
  const upcomingExpiries = useMemo(() => {
    if (!calendar || !Array.isArray(calendar)) return [];
    return calendar
      .filter(item => new Date(item.expiryDate) > new Date())
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())
      .map(item => ({
        name: item.name,
        date: new Date(item.expiryDate),
        type: item.type,
      }));
  }, [calendar]);

  // Critical alerts (expiring/expired)
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' || a.severity === 'warning');

  // Refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshLicenses(), refreshCerts(), refreshInsurance()]);
    setRefreshing(false);
  };

  const isLoading = licensesLoading || certsLoading || insuranceLoading;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Certificaten & Compliance',
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
            label="Overzicht"
            icon="grid"
            isActive={activeTab === 'overview'}
            onPress={() => setActiveTab('overview')}
          />
          <TabButton
            id="certificates"
            label="Certificaten"
            icon="school"
            isActive={activeTab === 'certificates'}
            onPress={() => setActiveTab('certificates')}
          />
          <TabButton
            id="insurance"
            label="Verzekeringen"
            icon="shield-checkmark"
            isActive={activeTab === 'insurance'}
            onPress={() => setActiveTab('insurance')}
          />
          <TabButton
            id="licenses"
            label="Vergunningen"
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
                <Text style={styles.scoreCardTitle}>Compliance Status</Text>
                <View style={styles.statsRow}>
                  <StatCard
                    icon="checkmark-circle"
                    value={validCount}
                    label="Geldig"
                    color={SemanticColors.feedbackSuccess}
                    onPress={() => setActiveTab('certificates')}
                  />
                  <StatCard
                    icon="alert-circle"
                    value={expiringCount}
                    label="Verloopt"
                    color={SemanticColors.feedbackWarning}
                  />
                  <StatCard
                    icon="close-circle"
                    value={expiredCount}
                    label="Verlopen"
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
                <Text style={styles.sectionTitle}>Acties vereist</Text>
                {criticalAlerts.slice(0, 3).map(alert => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </View>
            )}

            {/* Upcoming Expiries Timeline */}
            <ExpiryTimeline items={upcomingExpiries} />

            {/* Quick Add Button */}
            <Pressable style={styles.addButton}>
              <Ionicons name="add-circle" size={22} color={Palette.hermesOrange} />
              <Text style={styles.addButtonText}>Certificaat toevoegen</Text>
            </Pressable>
          </>
        )}

        {activeTab !== 'overview' && (
          <>
            {/* Section Header with count */}
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>
                {activeTab === 'certificates' && 'Certificaten'}
                {activeTab === 'insurance' && 'Verzekeringen'}
                {activeTab === 'licenses' && 'Vergunningen'}
              </Text>
              <Text style={styles.listCount}>{filteredItems.length} items</Text>
            </View>

            {/* Items sorted by urgency */}
            {filteredItems
              .sort((a, b) => {
                // Expired first, then expiring, then valid
                const priority = { expired: 0, expiring_soon: 1, pending_renewal: 2, suspended: 3, valid: 4 };
                return priority[a.status] - priority[b.status];
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
                <Text style={styles.emptyStateText}>Geen items gevonden</Text>
                <Pressable style={styles.emptyStateButton}>
                  <Text style={styles.emptyStateButtonText}>Voeg toe</Text>
                </Pressable>
              </View>
            )}

            {/* Add Button */}
            <Pressable style={styles.addButton}>
              <Ionicons name="add-circle" size={22} color={Palette.hermesOrange} />
              <Text style={styles.addButtonText}>
                {activeTab === 'certificates' && 'Certificaat toevoegen'}
                {activeTab === 'insurance' && 'Verzekering toevoegen'}
                {activeTab === 'licenses' && 'Vergunning toevoegen'}
              </Text>
            </Pressable>
          </>
        )}

        <View style={{ height: 100 }} />
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
                <Text style={styles.modalLabel}>Uitgever</Text>
                <Text style={styles.modalValue}>{selectedItem.issuer}</Text>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Status</Text>
                <View style={[styles.statusBadgeLarge, { backgroundColor: getStatusConfig(selectedItem.status).bg }]}>
                  <Ionicons
                    name={getStatusConfig(selectedItem.status).icon}
                    size={18}
                    color={getStatusConfig(selectedItem.status).color}
                  />
                  <Text style={[styles.statusTextLarge, { color: getStatusConfig(selectedItem.status).color }]}>
                    {getStatusConfig(selectedItem.status).label}
                  </Text>
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Vervaldatum</Text>
                <Text style={styles.modalValue}>{formatDate(selectedItem.expiryDate)}</Text>
                <Text style={styles.modalSubvalue}>
                  {getDaysUntilExpiry(selectedItem.expiryDate) > 0
                    ? `Nog ${getDaysUntilExpiry(selectedItem.expiryDate)} dagen`
                    : `${Math.abs(getDaysUntilExpiry(selectedItem.expiryDate))} dagen geleden verlopen`}
                </Text>
              </View>

              {selectedItem.renewalCost && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Vernieuwingskosten</Text>
                  <Text style={styles.modalValue}>€{selectedItem.renewalCost.toLocaleString('nl-NL')}</Text>
                </View>
              )}

              <View style={styles.modalActions}>
                {selectedItem.documentUrl && (
                  <Pressable style={styles.modalButton}>
                    <Ionicons name="document-text" size={20} color={Palette.hermesOrange} />
                    <Text style={styles.modalButtonText}>Document bekijken</Text>
                  </Pressable>
                )}
                <Pressable style={styles.modalButton}>
                  <Ionicons name="share-outline" size={20} color={Palette.hermesOrange} />
                  <Text style={styles.modalButtonText}>Delen</Text>
                </Pressable>
                {(selectedItem.status === 'expired' || selectedItem.status === 'expiring_soon' || selectedItem.status === 'cancelled') && (
                  <Pressable style={[styles.modalButton, styles.modalButtonPrimary]}>
                    <Ionicons name="refresh" size={20} color="#fff" />
                    <Text style={[styles.modalButtonText, { color: '#fff' }]}>Vernieuwen</Text>
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
    backgroundColor: SemanticColors.surfaceBackground,
  },
  tabBar: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  tabScroll: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  tabButtonActive: {
    backgroundColor: Palette.hermesOrange,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },

  // Score Card
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  scoreCardLeft: {
    flex: 1,
  },
  scoreCardTitle: {
    fontSize: 16,
    fontWeight: '700',
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
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
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
    fontSize: 28,
    fontWeight: '800',
  },
  scoreLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },

  // Blocked Banner
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.feedbackErrorBg,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackErrorBorder,
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
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.feedbackError,
  },
  blockedSubtitle: {
    fontSize: 12,
    color: SemanticColors.feedbackError,
    opacity: 0.8,
  },
  blockedAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: SemanticColors.feedbackError,
  },
  blockedActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },

  // Section
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginBottom: Spacing.xs,
  },

  // Alert Card
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
    gap: Spacing.sm,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  alertDays: {
    fontSize: 11,
    marginTop: 2,
  },

  // Timeline
  timeline: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '700',
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
    fontSize: 13,
    color: SemanticColors.textPrimary,
  },
  timelineItemDate: {
    fontSize: 12,
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
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  listCount: {
    fontSize: 13,
    color: SemanticColors.textTertiary,
  },

  // Item Card
  itemCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
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
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  itemIssuer: {
    fontSize: 12,
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
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  renewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: Palette.hermesOrange + '15',
  },
  renewButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyStateText: {
    fontSize: 14,
    color: SemanticColors.textTertiary,
  },
  emptyStateButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Palette.hermesOrange,
    marginTop: Spacing.sm,
  },
  emptyStateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  // Add Button
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.hermesOrange + '40',
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
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
    fontSize: 18,
    fontWeight: '700',
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
    fontSize: 12,
    color: SemanticColors.textTertiary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  modalSubvalue: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  statusBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusTextLarge: {
    fontSize: 14,
    fontWeight: '600',
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
    borderRadius: 12,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  modalButtonPrimary: {
    backgroundColor: Palette.hermesOrange,
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },
});
