// =============================================================================
// WARRANTY MANAGER COMPONENT
// =============================================================================
// Warranty tracking, claims management, and expiration alerts
// =============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { formatCurrency, formatMoney, formatDateShortAuto } from '../../i18n/formatting';
import {
  useWarranties,
  useWarrantyClaims,
  useWarrantyStats,
  Warranty,
  WarrantyClaim,
} from '../../services/warrantyManagerService';

// =============================================================================
// TYPES
// =============================================================================

type TabType = 'active' | 'expiring' | 'claims';

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useTranslation();
  const getConfig = () => {
    switch (status) {
      case 'active':
        return { label: t('warranty.badgeActive', 'Active'), color: Palette.green500, bg: 'rgba(34, 197, 94, 0.15)' };
      case 'expiring_soon':
        return { label: t('warranty.badgeExpiring', 'Expiring'), color: Palette.orange500, bg: Palette.orange100 };
      case 'expired':
        return { label: t('warranty.badgeExpired', 'Expired'), color: Palette.red500, bg: 'rgba(239, 68, 68, 0.15)' };
      case 'draft':
      case 'submitted':
      case 'under_review':
        return { label: t('warranty.statusPending', 'In review'), color: Palette.yellow600, bg: 'rgba(234, 179, 8, 0.15)' };
      case 'approved':
        return { label: t('warranty.statusApproved', 'Approved'), color: Palette.green500, bg: 'rgba(34, 197, 94, 0.15)' };
      case 'denied':
        return { label: t('warranty.statusRejected', 'Denied'), color: Palette.red500, bg: 'rgba(239, 68, 68, 0.15)' };
      case 'completed':
        return { label: t('warranty.statusCompleted', 'Completed'), color: Palette.blue500, bg: 'rgba(59, 130, 246, 0.15)' };
      default:
        return { label: status, color: Palette.gray500, bg: Palette.gray100 };
    }
  };

  const config = getConfig();
  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

const WarrantyCard: React.FC<{
  warranty: Warranty;
  onViewDetails: () => void;
  onFileClaim: () => void;
}> = ({ warranty, onViewDetails, onFileClaim }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const daysUntilExpiry = Math.ceil(
    ((warranty.warrantyEnd ?? new Date()).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const getExpiryColor = () => {
    if (daysUntilExpiry < 0) return Palette.red500;
    if (daysUntilExpiry < 30) return Palette.orange500;
    if (daysUntilExpiry < 90) return Palette.yellow600;
    return Palette.green500;
  };

  return (
    <Pressable
      style={styles.warrantyCard}
      onPress={() => setExpanded(!expanded)}
    >
      <View style={styles.warrantyHeader}>
        <View style={styles.warrantyInfo}>
          <Text style={styles.warrantyProduct}>{warranty.equipmentName}</Text>
          <Text style={styles.warrantyBrand}>{warranty.brand} {warranty.model}</Text>
        </View>
        <StatusBadge status={warranty.status} />
      </View>

      <View style={styles.warrantyDetails}>
        <View style={styles.warrantyDetailRow}>
          <Ionicons name="person-outline" size={16} color={SemanticColors.textSecondary} />
          <Text style={styles.warrantyDetailText}>{warranty.customerName}</Text>
        </View>
        <View style={styles.warrantyDetailRow}>
          <Ionicons name="calendar-outline" size={16} color={getExpiryColor()} />
          <Text style={[styles.warrantyDetailText, { color: getExpiryColor() }]}>
            {daysUntilExpiry > 0
              ? t('warranty.expiresInDays', 'Expires in {{days}} days', { days: daysUntilExpiry })
              : t('warranty.expiredDaysAgo', '{{days}} days expired', { days: Math.abs(daysUntilExpiry) })}
          </Text>
        </View>
      </View>

      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.warrantyDates}>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>{t('warranty.installation', 'Installation')}</Text>
              <Text style={styles.dateValue}>
                {formatDateShortAuto(warranty.installDate)}
              </Text>
            </View>
            <View style={styles.dateDivider} />
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>{t('warranty.warrantyStartLabel', 'Warranty start')}</Text>
              <Text style={styles.dateValue}>
                {formatDateShortAuto(warranty.warrantyStart)}
              </Text>
            </View>
            <View style={styles.dateDivider} />
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>{t('warranty.warrantyEndLabel', 'Warranty end')}</Text>
              <Text style={styles.dateValue}>
                {formatDateShortAuto(warranty.warrantyEnd)}
              </Text>
            </View>
          </View>

          {warranty.serialNumber && (
            <View style={styles.serialSection}>
              <Text style={styles.serialLabel}>{t('warranty.serialNumber', 'Serial number')}</Text>
              <Text style={styles.serialValue}>{warranty.serialNumber}</Text>
            </View>
          )}

          {warranty.coverage.length > 0 && (
            <View style={styles.coverageSection}>
              <Text style={styles.coverageTitle}>{t('warranty.coverage', 'Coverage')}</Text>
              {warranty.coverage.map((item, index) => (
                <View key={index} style={styles.coverageItem}>
                  <Ionicons name="checkmark-circle" size={16} color={Palette.green500} />
                  <Text style={styles.coverageText}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.warrantyActions}>
            <Pressable style={styles.actionButton} onPress={onViewDetails}>
              <Ionicons name="document-text-outline" size={18} color={SemanticColors.actionPrimary} />
              <Text style={styles.actionButtonText}>{t('warranty.detailsBtn', 'Details')}</Text>
            </Pressable>
            {warranty.status !== 'expired' && (
              <Pressable
                style={[styles.actionButton, styles.primaryButton]}
                onPress={onFileClaim}
              >
                <Ionicons name="shield-outline" size={18} color={Palette.white} />
                <Text style={[styles.actionButtonText, styles.primaryButtonText]}>
                  {t('warranty.fileClaim', 'File claim')}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </Pressable>
  );
};

const ClaimCard: React.FC<{
  claim: WarrantyClaim;
  onViewDetails: () => void;
}> = ({ claim, onViewDetails }) => {
  const { t } = useTranslation();
  const daysSinceFiled = Math.floor(
    (Date.now() - claim.claimDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Pressable style={styles.claimCard} onPress={onViewDetails}>
      <View style={styles.claimHeader}>
        <View style={styles.claimInfo}>
          <Text style={styles.claimNumber}>{claim.claimNumber}</Text>
          <Text style={styles.claimProduct}>{claim.equipmentName}</Text>
        </View>
        <StatusBadge status={claim.status} />
      </View>

      <View style={styles.claimDetails}>
        <View style={styles.claimDetailRow}>
          <Ionicons name="alert-circle-outline" size={16} color={SemanticColors.textSecondary} />
          <Text style={styles.claimDetailText} numberOfLines={1}>
            {claim.issueDescription}
          </Text>
        </View>
        <View style={styles.claimDetailRow}>
          <Ionicons name="time-outline" size={16} color={SemanticColors.textSecondary} />
          <Text style={styles.claimDetailText}>{t('warranty.daysAgoFiled', 'Filed {{count}} days ago', { count: daysSinceFiled })}</Text>
        </View>
      </View>

      {claim.estimatedCost > 0 && (
        <View style={styles.claimValue}>
          <Text style={styles.claimValueLabel}>{t('warranty.estimatedValue', 'Estimated value')}</Text>
          <Text style={styles.claimValueAmount}>{formatCurrency(claim.estimatedCost)}</Text>
        </View>
      )}
    </Pressable>
  );
};

const StatCard: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  color?: string;
}> = ({ icon, label, value, color = SemanticColors.actionPrimary }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const WarrantyManager: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const { warranties, loading } = useWarranties();
  const { claims } = useWarrantyClaims();
  const stats = useWarrantyStats();

  const activeWarranties = warranties.filter(w => w.status === 'active');
  // The "Verlopend" tab surfaces warranties needing attention — both expiring
  // soon and already expired (there is no separate expired tab, so otherwise an
  // expired warranty would vanish from the UI entirely).
  const expiringWarranties = warranties.filter(w => w.status === 'expiring_soon' || w.status === 'expired');

  const handleViewDetails = (warranty: Warranty) => {
    const daysLeft = Math.ceil(
      ((warranty.warrantyEnd ?? new Date()).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const expiryInfo = daysLeft > 0
      ? t('warranty.expiresInDays', 'Expires in {{days}} days', { days: daysLeft })
      : t('warranty.expiredDaysAgo', '{{days}} days expired', { days: Math.abs(daysLeft) });

    Alert.alert(
      warranty.equipmentName,
      [
        `${t('warranty.customer', 'Customer')}: ${warranty.customerName}`,
        `${t('warranty.brandModel', 'Brand/Model')}: ${warranty.brand} ${warranty.model}`,
        warranty.serialNumber ? `${t('warranty.serialNumber', 'Serial number')}: ${warranty.serialNumber}` : null,
        `${t('warranty.installation', 'Installation')}: ${formatDateShortAuto(warranty.installDate)}`,
        `${t('warranty.warranty', 'Warranty')}: ${formatDateShortAuto(warranty.warrantyStart)} - ${formatDateShortAuto(warranty.warrantyEnd)}`,
        expiryInfo,
        warranty.coverage.length > 0 ? `\n${t('warranty.coverage', 'Coverage')}: ${warranty.coverage.join(', ')}` : null,
      ].filter(Boolean).join('\n'),
      [{ text: t('common.close', 'Close'), style: 'cancel' }],
    );
  };

  const handleFileClaim = (warranty: Warranty) => {
    Alert.alert(
      t('warranty.fileClaim', 'File Claim'),
      t('warranty.fileClaimPrompt', 'Do you want to file a warranty claim for {{equipment}} ({{brand}} {{model}}) of customer {{customer}}?', { equipment: warranty.equipmentName, brand: warranty.brand, model: warranty.model, customer: warranty.customerName }),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('warranty.fileClaim', 'File Claim'),
          onPress: () => {
            Alert.alert(t('warranty.claimCreated', 'Claim Created'), t('warranty.claimCreatedMessage', 'A warranty claim has been created for {{equipment}}.', { equipment: warranty.equipmentName }));
          },
        },
      ],
    );
  };

  const handleViewClaimDetails = (claim: WarrantyClaim) => {
    const statusLabels: Record<string, string> = {
      pending: t('warranty.statusPending', 'Pending'),
      approved: t('warranty.statusApproved', 'Approved'),
      rejected: t('warranty.statusRejected', 'Rejected'),
      completed: t('warranty.statusCompleted', 'Completed'),
    };
    const daysSinceFiled = Math.floor(
      (Date.now() - claim.claimDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    Alert.alert(
      claim.claimNumber || `Claim ${claim.id}`,
      [
        `${t('warranty.product', 'Product')}: ${claim.equipmentName}`,
        `${t('auditor.status', 'Status')}: ${statusLabels[claim.status] || claim.status}`,
        `${t('warranty.issue', 'Issue')}: ${claim.issueDescription}`,
        `${t('warranty.filed', 'Filed')}: ${formatDateShortAuto(claim.claimDate)} (${t('warranty.daysAgo', '{{days}} days ago', { days: daysSinceFiled })})`,
        claim.estimatedCost ? `${t('warranty.estimatedValue', 'Estimated value')}: ${formatMoney(claim.estimatedCost)}` : null,
      ].filter(Boolean).join('\n'),
      [{ text: t('common.close', 'Close'), style: 'cancel' }],
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'active':
        return (
          <View style={styles.tabContent}>
            <View style={styles.statsRow}>
              <StatCard
                icon="shield-checkmark-outline"
                label={t('warranty.statActive', 'Active')}
                value={stats.activeWarranties}
                color={Palette.green500}
              />
              <StatCard
                icon="warning-outline"
                label={t('warranty.statExpiringSoon', 'Expiring soon')}
                value={stats.expiringThisMonth}
                color={Palette.orange500}
              />
              <StatCard
                icon="document-text-outline"
                label={t('warranty.statClaims', 'Claims')}
                value={stats.openClaims}
                color={Palette.blue500}
              />
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>{t('common.loading', 'Loading...')}</Text>
              </View>
            ) : activeWarranties.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="shield-outline" size={48} color={SemanticColors.textSecondary} />
                <Text style={styles.emptyText}>{t('warranty.noActive', 'No active warranties')}</Text>
              </View>
            ) : (
              activeWarranties.map(warranty => (
                <WarrantyCard
                  key={warranty.id}
                  warranty={warranty}
                  onViewDetails={() => handleViewDetails(warranty)}
                  onFileClaim={() => handleFileClaim(warranty)}
                />
              ))
            )}
          </View>
        );

      case 'expiring':
        return (
          <View style={styles.tabContent}>
            <View style={styles.alertBanner}>
              <Ionicons name="alert-circle" size={24} color={Palette.orange500} />
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>{t('warranty.expiringTitle', 'Warranties Expiring Soon')}</Text>
                <Text style={styles.alertText}>
                  {t('warranty.expiringCount', '{{count}} warranty(ies) expiring within 90 days', { count: expiringWarranties.length })}
                </Text>
              </View>
            </View>

            {expiringWarranties.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle-outline" size={48} color={Palette.green500} />
                <Text style={styles.emptyText}>{t('warranty.noExpiring', 'No warranties expiring soon')}</Text>
              </View>
            ) : (
              expiringWarranties.map(warranty => (
                <WarrantyCard
                  key={warranty.id}
                  warranty={warranty}
                  onViewDetails={() => handleViewDetails(warranty)}
                  onFileClaim={() => handleFileClaim(warranty)}
                />
              ))
            )}
          </View>
        );

      case 'claims':
        return (
          <View style={styles.tabContent}>
            <View style={styles.claimsHeader}>
              <Text style={styles.claimsTitle}>{t('warranty.claimsTitle', 'Warranty claims')}</Text>
              <Pressable style={styles.newClaimButton}>
                <Ionicons name="add" size={18} color={Palette.white} />
                <Text style={styles.newClaimButtonText}>{t('warranty.newClaim', 'New claim')}</Text>
              </Pressable>
            </View>

            <View style={styles.claimsStats}>
              <View style={styles.claimStatItem}>
                <Text style={styles.claimStatValue}>{stats.openClaims}</Text>
                <Text style={styles.claimStatLabel}>{t('warranty.statInReview', 'In review')}</Text>
              </View>
              <View style={styles.claimStatDivider} />
              <View style={styles.claimStatItem}>
                <Text style={styles.claimStatValue}>{stats.claimsThisYear}</Text>
                <Text style={styles.claimStatLabel}>{t('warranty.statThisMonth', 'This month')}</Text>
              </View>
              <View style={styles.claimStatDivider} />
              <View style={styles.claimStatItem}>
                <Text style={styles.claimStatValue}>{stats.approvalRate}%</Text>
                <Text style={styles.claimStatLabel}>{t('warranty.statSuccessRate', 'Success rate')}</Text>
              </View>
            </View>

            {claims.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-outline" size={48} color={SemanticColors.textSecondary} />
                <Text style={styles.emptyText}>{t('warranty.noClaims', 'No claims found')}</Text>
              </View>
            ) : (
              claims.map(claim => (
                <ClaimCard
                  key={claim.id}
                  claim={claim}
                  onViewDetails={() => handleViewClaimDetails(claim)}
                />
              ))
            )}
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('warranty.title', 'Warranty management')}</Text>
        <Pressable style={styles.searchButton}>
          <Ionicons name="search-outline" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {[
          { key: 'active', label: t('warranty.statActive', 'Active'), icon: 'shield-checkmark-outline' },
          { key: 'expiring', label: t('warranty.tabExpiring', 'Expiring'), icon: 'warning-outline' },
          { key: 'claims', label: t('warranty.statClaims', 'Claims'), icon: 'document-text-outline' },
        ].map(tab => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key as TabType)}
          >
            <Ionicons
              name={tab.icon as keyof typeof Ionicons.glyphMap}
              size={18}
              color={activeTab === tab.key ? SemanticColors.actionPrimary : SemanticColors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderContent()}
      </ScrollView>
    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  title: {
    fontSize: TYPE.displaySize - 4,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.xl,
    backgroundColor: SemanticColors.surfaceBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.surfaceBackground,
    gap: 6,
  },
  tabActive: {
    backgroundColor: SemanticColors.actionPrimary + '15',
  },
  tabText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textSecondary,
  },
  tabTextActive: {
    color: SemanticColors.actionPrimary,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  statLabel: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.titleSize,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: TYPE.titleSize,
    color: SemanticColors.textSecondary,
  },
  warrantyCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  warrantyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  warrantyInfo: {
    flex: 1,
  },
  warrantyProduct: {
    fontSize: TYPE.titleSize + 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  warrantyBrand: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
  },
  statusText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
  },
  warrantyDetails: {
    gap: 6,
  },
  warrantyDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warrantyDetailText: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  warrantyDates: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: RADIUS.sm,
    padding: 12,
    marginBottom: 12,
  },
  dateItem: {
    flex: 1,
    alignItems: 'center',
  },
  dateDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginHorizontal: 8,
  },
  dateLabel: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
    marginBottom: 4,
  },
  dateValue: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  serialSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: RADIUS.sm,
    marginBottom: 12,
  },
  serialLabel: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
  },
  serialValue: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
    fontFamily: 'monospace',
  },
  coverageSection: {
    marginBottom: 12,
  },
  coverageTitle: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginBottom: 8,
  },
  coverageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  coverageText: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
  },
  warrantyActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.actionPrimary + '15',
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    gap: 6,
  },
  actionButtonText: {
    color: SemanticColors.actionPrimary,
    fontFamily: TYPE.titleFamily,
    fontSize: TYPE.bodySize - 1,
  },
  primaryButton: {
    backgroundColor: SemanticColors.actionPrimary,
  },
  primaryButtonText: {
    color: Palette.white,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.orange50,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Palette.orange200,
  },
  alertContent: {
    marginLeft: 12,
    flex: 1,
  },
  alertTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.orange700,
  },
  alertText: {
    fontSize: TYPE.bodySize - 1,
    color: Palette.orange600,
    marginTop: 2,
  },
  claimsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  claimsTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  newClaimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.actionPrimary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  newClaimButtonText: {
    color: Palette.white,
    fontFamily: TYPE.titleFamily,
    fontSize: TYPE.bodySize - 1,
  },
  claimsStats: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  claimStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  claimStatValue: {
    fontSize: TYPE.displaySize - 4,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  claimStatLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  claimStatDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginHorizontal: 16,
  },
  claimCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  claimHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  claimInfo: {
    flex: 1,
  },
  claimNumber: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.actionPrimary,
    fontFamily: 'monospace',
  },
  claimProduct: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginTop: 4,
  },
  claimDetails: {
    gap: 6,
  },
  claimDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  claimDetailText: {
    flex: 1,
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
  },
  claimValue: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  claimValueLabel: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
  },
  claimValueAmount: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
});

export default WarrantyManager;
