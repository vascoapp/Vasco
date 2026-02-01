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
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
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

const StatusBadge: React.FC<{ status: Warranty['status'] | WarrantyClaim['status'] }> = ({ status }) => {
  const getConfig = () => {
    switch (status) {
      case 'active':
        return { label: 'Actief', color: Palette.green500, bg: 'rgba(34, 197, 94, 0.15)' };
      case 'expiring_soon':
        return { label: 'Verloopt', color: Palette.orange500, bg: Palette.orange100 };
      case 'expired':
        return { label: 'Verlopen', color: Palette.red500, bg: 'rgba(239, 68, 68, 0.15)' };
      case 'pending':
        return { label: 'In behandeling', color: Palette.yellow600, bg: 'rgba(234, 179, 8, 0.15)' };
      case 'approved':
        return { label: 'Goedgekeurd', color: Palette.green500, bg: 'rgba(34, 197, 94, 0.15)' };
      case 'rejected':
        return { label: 'Afgewezen', color: Palette.red500, bg: 'rgba(239, 68, 68, 0.15)' };
      case 'completed':
        return { label: 'Afgehandeld', color: Palette.blue500, bg: 'rgba(59, 130, 246, 0.15)' };
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
  const [expanded, setExpanded] = useState(false);

  const daysUntilExpiry = Math.ceil(
    (warranty.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const getExpiryColor = () => {
    if (daysUntilExpiry < 0) return Palette.red500;
    if (daysUntilExpiry < 30) return Palette.orange500;
    if (daysUntilExpiry < 90) return Palette.yellow600;
    return Palette.green500;
  };

  return (
    <TouchableOpacity
      style={styles.warrantyCard}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.warrantyHeader}>
        <View style={styles.warrantyInfo}>
          <Text style={styles.warrantyProduct}>{warranty.productName}</Text>
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
              ? `Verloopt over ${daysUntilExpiry} dagen`
              : `${Math.abs(daysUntilExpiry)} dagen verlopen`}
          </Text>
        </View>
      </View>

      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.warrantyDates}>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>Installatie</Text>
              <Text style={styles.dateValue}>
                {warranty.installationDate.toLocaleDateString('nl-NL')}
              </Text>
            </View>
            <View style={styles.dateDivider} />
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>Start garantie</Text>
              <Text style={styles.dateValue}>
                {warranty.startDate.toLocaleDateString('nl-NL')}
              </Text>
            </View>
            <View style={styles.dateDivider} />
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>Einde garantie</Text>
              <Text style={styles.dateValue}>
                {warranty.endDate.toLocaleDateString('nl-NL')}
              </Text>
            </View>
          </View>

          {warranty.serialNumber && (
            <View style={styles.serialSection}>
              <Text style={styles.serialLabel}>Serienummer</Text>
              <Text style={styles.serialValue}>{warranty.serialNumber}</Text>
            </View>
          )}

          {warranty.coverage.length > 0 && (
            <View style={styles.coverageSection}>
              <Text style={styles.coverageTitle}>Dekking</Text>
              {warranty.coverage.map((item, index) => (
                <View key={index} style={styles.coverageItem}>
                  <Ionicons name="checkmark-circle" size={16} color={Palette.green500} />
                  <Text style={styles.coverageText}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.warrantyActions}>
            <TouchableOpacity style={styles.actionButton} onPress={onViewDetails}>
              <Ionicons name="document-text-outline" size={18} color={SemanticColors.primary} />
              <Text style={styles.actionButtonText}>Details</Text>
            </TouchableOpacity>
            {warranty.status !== 'expired' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={onFileClaim}
              >
                <Ionicons name="shield-outline" size={18} color={Palette.white} />
                <Text style={[styles.actionButtonText, styles.primaryButtonText]}>
                  Claim Indienen
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

const ClaimCard: React.FC<{
  claim: WarrantyClaim;
  onViewDetails: () => void;
}> = ({ claim, onViewDetails }) => {
  const daysSinceFiled = Math.floor(
    (Date.now() - claim.filedDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <TouchableOpacity style={styles.claimCard} onPress={onViewDetails} activeOpacity={0.7}>
      <View style={styles.claimHeader}>
        <View style={styles.claimInfo}>
          <Text style={styles.claimNumber}>{claim.claimNumber}</Text>
          <Text style={styles.claimProduct}>{claim.productName}</Text>
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
          <Text style={styles.claimDetailText}>{daysSinceFiled} dagen geleden ingediend</Text>
        </View>
      </View>

      {claim.estimatedValue && (
        <View style={styles.claimValue}>
          <Text style={styles.claimValueLabel}>Geschatte waarde</Text>
          <Text style={styles.claimValueAmount}>€{claim.estimatedValue}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const StatCard: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  color?: string;
}> = ({ icon, label, value, color = SemanticColors.primary }) => (
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
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const { warranties, loading } = useWarranties();
  const { claims } = useWarrantyClaims();
  const stats = useWarrantyStats();

  const activeWarranties = warranties.filter(w => w.status === 'active');
  const expiringWarranties = warranties.filter(w => w.status === 'expiring_soon');

  const handleViewDetails = (warranty: Warranty) => {
    console.log('View warranty details:', warranty.id);
  };

  const handleFileClaim = (warranty: Warranty) => {
    console.log('File claim for:', warranty.id);
  };

  const handleViewClaimDetails = (claim: WarrantyClaim) => {
    console.log('View claim details:', claim.id);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'active':
        return (
          <View style={styles.tabContent}>
            <View style={styles.statsRow}>
              <StatCard
                icon="shield-checkmark-outline"
                label="Actief"
                value={stats.activeWarranties}
                color={Palette.green500}
              />
              <StatCard
                icon="warning-outline"
                label="Verloopt Binnenkort"
                value={stats.expiringSoon}
                color={Palette.orange500}
              />
              <StatCard
                icon="document-text-outline"
                label="Claims"
                value={stats.pendingClaims}
                color={Palette.blue500}
              />
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Laden...</Text>
              </View>
            ) : activeWarranties.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="shield-outline" size={48} color={SemanticColors.textSecondary} />
                <Text style={styles.emptyText}>Geen actieve garanties</Text>
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
                <Text style={styles.alertTitle}>Garanties Verlopen Binnenkort</Text>
                <Text style={styles.alertText}>
                  {expiringWarranties.length} garantie(s) verlopen binnen 90 dagen
                </Text>
              </View>
            </View>

            {expiringWarranties.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle-outline" size={48} color={Palette.green500} />
                <Text style={styles.emptyText}>Geen garanties verlopen binnenkort</Text>
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
              <Text style={styles.claimsTitle}>Garantieclaims</Text>
              <TouchableOpacity style={styles.newClaimButton}>
                <Ionicons name="add" size={18} color={Palette.white} />
                <Text style={styles.newClaimButtonText}>Nieuwe Claim</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.claimsStats}>
              <View style={styles.claimStatItem}>
                <Text style={styles.claimStatValue}>{stats.pendingClaims}</Text>
                <Text style={styles.claimStatLabel}>In behandeling</Text>
              </View>
              <View style={styles.claimStatDivider} />
              <View style={styles.claimStatItem}>
                <Text style={styles.claimStatValue}>{stats.claimsThisMonth}</Text>
                <Text style={styles.claimStatLabel}>Deze maand</Text>
              </View>
              <View style={styles.claimStatDivider} />
              <View style={styles.claimStatItem}>
                <Text style={styles.claimStatValue}>{stats.successRate}%</Text>
                <Text style={styles.claimStatLabel}>Succesrate</Text>
              </View>
            </View>

            {claims.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-outline" size={48} color={SemanticColors.textSecondary} />
                <Text style={styles.emptyText}>Geen claims gevonden</Text>
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
        <Text style={styles.title}>Garantiebeheer</Text>
        <TouchableOpacity style={styles.searchButton}>
          <Ionicons name="search-outline" size={24} color={SemanticColors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {[
          { key: 'active', label: 'Actief', icon: 'shield-checkmark-outline' },
          { key: 'expiring', label: 'Verlopend', icon: 'warning-outline' },
          { key: 'claims', label: 'Claims', icon: 'document-text-outline' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key as TabType)}
          >
            <Ionicons
              name={tab.icon as keyof typeof Ionicons.glyphMap}
              size={18}
              color={activeTab === tab.key ? SemanticColors.primary : SemanticColors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
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
    backgroundColor: SemanticColors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: SemanticColors.card,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.text,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SemanticColors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.card,
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
    borderRadius: 8,
    backgroundColor: SemanticColors.background,
    gap: 6,
  },
  tabActive: {
    backgroundColor: SemanticColors.primary + '15',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: SemanticColors.textSecondary,
  },
  tabTextActive: {
    color: SemanticColors.primary,
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
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.text,
  },
  statLabel: {
    fontSize: 11,
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
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: SemanticColors.textSecondary,
  },
  warrantyCard: {
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.border,
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
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  warrantyBrand: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
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
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.border,
  },
  warrantyDates: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  dateItem: {
    flex: 1,
    alignItems: 'center',
  },
  dateDivider: {
    width: 1,
    backgroundColor: SemanticColors.border,
    marginHorizontal: 8,
  },
  dateLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  serialSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: SemanticColors.background,
    borderRadius: 8,
    marginBottom: 12,
  },
  serialLabel: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  serialValue: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.text,
    fontFamily: 'monospace',
  },
  coverageSection: {
    marginBottom: 12,
  },
  coverageTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.text,
    marginBottom: 8,
  },
  coverageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  coverageText: {
    fontSize: 14,
    color: SemanticColors.text,
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
    backgroundColor: SemanticColors.primary + '15',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    color: SemanticColors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: SemanticColors.primary,
  },
  primaryButtonText: {
    color: Palette.white,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.orange50,
    borderRadius: 12,
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
    fontSize: 16,
    fontWeight: '600',
    color: Palette.orange700,
  },
  alertText: {
    fontSize: 14,
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
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  newClaimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  newClaimButtonText: {
    color: Palette.white,
    fontWeight: '600',
    fontSize: 14,
  },
  claimsStats: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  claimStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  claimStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.text,
  },
  claimStatLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  claimStatDivider: {
    width: 1,
    backgroundColor: SemanticColors.border,
    marginHorizontal: 16,
  },
  claimCard: {
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.border,
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
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.primary,
    fontFamily: 'monospace',
  },
  claimProduct: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.text,
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
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  claimValue: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.border,
  },
  claimValueLabel: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  claimValueAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.text,
  },
});

export default WarrantyManager;
