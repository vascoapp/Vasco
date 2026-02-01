// =============================================================================
// CUSTOMER INSIGHTS COMPONENT
// =============================================================================
// Customer analytics, segmentation, and churn prediction
// =============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import {
  useCustomerProfiles,
  useCustomerSegments,
  useChurnPredictions,
  useCustomerInsightsStats,
  CustomerProfile,
  CustomerSegment,
  ChurnPrediction,
} from '../../services/customerInsightsService';

// =============================================================================
// TYPES
// =============================================================================

type TabType = 'customers' | 'segments' | 'churn';

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const ChurnRiskBadge: React.FC<{ risk: CustomerProfile['churnRisk'] }> = ({ risk }) => {
  const getConfig = () => {
    switch (risk) {
      case 'low':
        return { label: 'Laag', color: Palette.green500, bg: "rgba(34, 197, 94, 0.15)" };
      case 'medium':
        return { label: 'Gemiddeld', color: Palette.orange500, bg: Palette.orange100 };
      case 'high':
        return { label: 'Hoog', color: Palette.red500, bg: "rgba(239, 68, 68, 0.15)" };
      default:
        return { label: risk, color: Palette.gray500, bg: Palette.gray100 };
    }
  };

  const config = getConfig();
  return (
    <View style={[styles.riskBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.riskText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

const PaymentBadge: React.FC<{ behavior: CustomerProfile['paymentBehavior'] }> = ({ behavior }) => {
  const getConfig = () => {
    switch (behavior) {
      case 'excellent':
        return { icon: 'star', color: Palette.green500 };
      case 'good':
        return { icon: 'checkmark-circle', color: Palette.blue500 };
      case 'average':
        return { icon: 'remove-circle', color: Palette.orange500 };
      case 'poor':
        return { icon: 'alert-circle', color: Palette.red500 };
      default:
        return { icon: 'ellipse', color: Palette.gray500 };
    }
  };

  const config = getConfig();
  return (
    <Ionicons name={config.icon as keyof typeof Ionicons.glyphMap} size={18} color={config.color} />
  );
};

const SatisfactionStars: React.FC<{ rating: number }> = ({ rating }) => {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;

  return (
    <View style={styles.starsContainer}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= fullStars ? 'star' : i === fullStars + 1 && hasHalf ? 'star-half' : 'star-outline'}
          size={14}
          color={Palette.yellow500}
        />
      ))}
      <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
    </View>
  );
};

const CustomerCard: React.FC<{
  customer: CustomerProfile;
  onView: () => void;
}> = ({ customer, onView }) => {
  const [expanded, setExpanded] = useState(false);

  const daysSinceContact = Math.floor(
    (Date.now() - customer.lastContact.getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <TouchableOpacity
      style={styles.customerCard}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.customerHeader}>
        <View style={styles.customerInfo}>
          <View style={styles.customerTitleRow}>
            <Text style={styles.customerName}>{customer.name}</Text>
            <View style={styles.customerTypeBadge}>
              <Text style={styles.customerTypeText}>
                {customer.type === 'commercial' ? 'Zakelijk' : 'Particulier'}
              </Text>
            </View>
          </View>
          <View style={styles.customerMeta}>
            <SatisfactionStars rating={customer.satisfaction} />
            <PaymentBadge behavior={customer.paymentBehavior} />
          </View>
        </View>
        <ChurnRiskBadge risk={customer.churnRisk} />
      </View>

      <View style={styles.customerStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>€{customer.lifetimeValue.toLocaleString()}</Text>
          <Text style={styles.statLabel}>LTV</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{customer.totalJobs}</Text>
          <Text style={styles.statLabel}>Klussen</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{daysSinceContact}d</Text>
          <Text style={styles.statLabel}>Laatste contact</Text>
        </View>
      </View>

      {customer.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {customer.tags.map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.contactInfo}>
            {customer.email && (
              <View style={styles.contactRow}>
                <Ionicons name="mail-outline" size={16} color={SemanticColors.textSecondary} />
                <Text style={styles.contactText}>{customer.email}</Text>
              </View>
            )}
            <View style={styles.contactRow}>
              <Ionicons name="call-outline" size={16} color={SemanticColors.textSecondary} />
              <Text style={styles.contactText}>{customer.phone}</Text>
            </View>
            <View style={styles.contactRow}>
              <Ionicons name="location-outline" size={16} color={SemanticColors.textSecondary} />
              <Text style={styles.contactText}>{customer.address}, {customer.city}</Text>
            </View>
          </View>

          {customer.equipment.length > 0 && (
            <View style={styles.equipmentSection}>
              <Text style={styles.sectionLabel}>Apparatuur</Text>
              {customer.equipment.map((eq, index) => (
                <View key={index} style={styles.equipmentItem}>
                  <Ionicons name="hardware-chip-outline" size={16} color={SemanticColors.primary} />
                  <Text style={styles.equipmentText}>
                    {eq.type} - {eq.brand} {eq.model}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.customerActions}>
            <TouchableOpacity style={styles.actionButton} onPress={onView}>
              <Ionicons name="person-outline" size={18} color={SemanticColors.primary} />
              <Text style={styles.actionButtonText}>Profiel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.primaryButton]}>
              <Ionicons name="call" size={18} color={Palette.white} />
              <Text style={[styles.actionButtonText, styles.primaryButtonText]}>Bellen</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

const SegmentCard: React.FC<{ segment: CustomerSegment }> = ({ segment }) => (
  <View style={styles.segmentCard}>
    <View style={styles.segmentHeader}>
      <Text style={styles.segmentName}>{segment.name}</Text>
      <View style={styles.segmentCount}>
        <Text style={styles.segmentCountText}>{segment.customerCount}</Text>
      </View>
    </View>
    <Text style={styles.segmentDescription}>{segment.description}</Text>

    <View style={styles.segmentStats}>
      <View style={styles.segmentStatItem}>
        <Text style={styles.segmentStatValue}>€{segment.avgLifetimeValue.toLocaleString()}</Text>
        <Text style={styles.segmentStatLabel}>Gem. LTV</Text>
      </View>
      <View style={styles.segmentStatItem}>
        <Text style={[styles.segmentStatValue, { color: segment.churnRate > 15 ? Palette.red500 : Palette.green500 }]}>
          {segment.churnRate}%
        </Text>
        <Text style={styles.segmentStatLabel}>Churn</Text>
      </View>
    </View>

    <View style={styles.criteriaSection}>
      <Text style={styles.criteriaLabel}>Criteria:</Text>
      <View style={styles.criteriaList}>
        {segment.criteria.map((criterion, index) => (
          <View key={index} style={styles.criteriaItem}>
            <Ionicons name="checkmark" size={12} color={SemanticColors.primary} />
            <Text style={styles.criteriaText}>{criterion}</Text>
          </View>
        ))}
      </View>
    </View>

    {segment.recommendations.length > 0 && (
      <View style={styles.recommendationsSection}>
        <Text style={styles.recommendationsLabel}>Aanbevelingen:</Text>
        {segment.recommendations.map((rec, index) => (
          <View key={index} style={styles.recommendationItem}>
            <Ionicons name="bulb-outline" size={14} color={Palette.yellow600} />
            <Text style={styles.recommendationText}>{rec}</Text>
          </View>
        ))}
      </View>
    )}
  </View>
);

const ChurnCard: React.FC<{
  prediction: ChurnPrediction;
  onTakeAction: () => void;
}> = ({ prediction, onTakeAction }) => {
  const getRiskColor = () => {
    switch (prediction.riskLevel) {
      case 'high':
        return Palette.red500;
      case 'medium':
        return Palette.orange500;
      case 'low':
        return Palette.green500;
      default:
        return Palette.gray500;
    }
  };

  const daysSinceContact = Math.floor(
    (Date.now() - prediction.lastContact.getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <View style={styles.churnCard}>
      <View style={styles.churnHeader}>
        <View style={styles.churnInfo}>
          <Text style={styles.churnCustomerName}>{prediction.customerName}</Text>
          <Text style={styles.churnLastContact}>{daysSinceContact} dagen geen contact</Text>
        </View>
        <View style={styles.churnRiskSection}>
          <View style={[styles.riskMeter, { borderColor: getRiskColor() }]}>
            <Text style={[styles.riskPercentage, { color: getRiskColor() }]}>
              {prediction.probability}%
            </Text>
          </View>
          <Text style={[styles.riskLabel, { color: getRiskColor() }]}>
            {prediction.riskLevel === 'high' ? 'Hoog' : prediction.riskLevel === 'medium' ? 'Gemiddeld' : 'Laag'}
          </Text>
        </View>
      </View>

      <View style={styles.churnValue}>
        <Ionicons name="cash-outline" size={16} color={SemanticColors.textSecondary} />
        <Text style={styles.churnValueText}>
          €{prediction.lifetimeValue.toLocaleString()} lifetime value
        </Text>
      </View>

      <View style={styles.factorsSection}>
        <Text style={styles.factorsLabel}>Risicofactoren:</Text>
        {prediction.factors.map((factor, index) => (
          <View key={index} style={styles.factorItem}>
            <Ionicons name="alert-circle" size={14} color={Palette.orange500} />
            <Text style={styles.factorText}>{factor}</Text>
          </View>
        ))}
      </View>

      <View style={styles.suggestedActionsSection}>
        <Text style={styles.suggestedActionsLabel}>Aanbevolen acties:</Text>
        {prediction.suggestedActions.map((action, index) => (
          <View key={index} style={styles.actionItem}>
            <Ionicons name="arrow-forward-circle" size={14} color={Palette.green500} />
            <Text style={styles.actionItemText}>{action}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.takeActionButton} onPress={onTakeAction}>
        <Ionicons name="call" size={18} color={Palette.white} />
        <Text style={styles.takeActionButtonText}>Neem Contact Op</Text>
      </TouchableOpacity>
    </View>
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
    <Text style={styles.statCardValue}>{value}</Text>
    <Text style={styles.statCardLabel}>{label}</Text>
  </View>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const CustomerInsights: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('customers');
  const [searchQuery, setSearchQuery] = useState('');
  const { customers, loading } = useCustomerProfiles();
  const segments = useCustomerSegments();
  const churnPredictions = useChurnPredictions();
  const stats = useCustomerInsightsStats();

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleViewCustomer = (customer: CustomerProfile) => {
    console.log('View customer:', customer.id);
  };

  const handleTakeAction = (prediction: ChurnPrediction) => {
    console.log('Take action for:', prediction.customerId);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'customers':
        return (
          <View style={styles.tabContent}>
            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={20} color={SemanticColors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Zoek klanten..."
                placeholderTextColor={SemanticColors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <View style={styles.statsRow}>
              <StatCard
                icon="people-outline"
                label="Totaal"
                value={stats.totalCustomers}
              />
              <StatCard
                icon="person-outline"
                label="Actief"
                value={stats.activeCustomers}
                color={Palette.green500}
              />
              <StatCard
                icon="star-outline"
                label="Gem. Score"
                value={stats.avgSatisfaction}
                color={Palette.yellow500}
              />
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Laden...</Text>
              </View>
            ) : filteredCustomers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color={SemanticColors.textSecondary} />
                <Text style={styles.emptyText}>Geen klanten gevonden</Text>
              </View>
            ) : (
              filteredCustomers.map(customer => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  onView={() => handleViewCustomer(customer)}
                />
              ))
            )}
          </View>
        );

      case 'segments':
        return (
          <View style={styles.tabContent}>
            <View style={styles.segmentsHeader}>
              <Text style={styles.segmentsTitle}>Klantsegmenten</Text>
              <Text style={styles.segmentsSubtitle}>
                {segments.length} segmenten • {stats.totalCustomers} klanten
              </Text>
            </View>

            {segments.map(segment => (
              <SegmentCard key={segment.id} segment={segment} />
            ))}
          </View>
        );

      case 'churn':
        return (
          <View style={styles.tabContent}>
            <View style={styles.churnHeader}>
              <Ionicons name="warning" size={24} color={Palette.orange500} />
              <View style={styles.churnHeaderInfo}>
                <Text style={styles.churnHeaderTitle}>Churn Voorspelling</Text>
                <Text style={styles.churnHeaderSubtitle}>
                  {stats.churnRiskHigh} klanten met hoog risico
                </Text>
              </View>
            </View>

            {churnPredictions.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle-outline" size={48} color={Palette.green500} />
                <Text style={styles.emptyText}>Geen hoog risico klanten</Text>
                <Text style={styles.emptySubtext}>Alle klanten zijn tevreden</Text>
              </View>
            ) : (
              churnPredictions.map(prediction => (
                <ChurnCard
                  key={prediction.customerId}
                  prediction={prediction}
                  onTakeAction={() => handleTakeAction(prediction)}
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
        <Text style={styles.title}>Klant Inzichten</Text>
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="filter-outline" size={24} color={SemanticColors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {[
          { key: 'customers', label: 'Klanten', icon: 'people-outline' },
          { key: 'segments', label: 'Segmenten', icon: 'pie-chart-outline' },
          { key: 'churn', label: 'Churn Risico', icon: 'warning-outline' },
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
  filterButton: {
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 16,
    color: SemanticColors.text,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.text,
  },
  statCardLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 2,
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
    color: SemanticColors.text,
    fontWeight: '500',
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  customerCard: {
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  customerInfo: {
    flex: 1,
  },
  customerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerName: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  customerTypeBadge: {
    backgroundColor: SemanticColors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  customerTypeText: {
    fontSize: 11,
    color: SemanticColors.primary,
    fontWeight: '500',
  },
  customerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginLeft: 4,
  },
  riskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  riskText: {
    fontSize: 12,
    fontWeight: '600',
  },
  customerStats: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.text,
  },
  statLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: SemanticColors.border,
    marginHorizontal: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: SemanticColors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    color: SemanticColors.primary,
    fontWeight: '500',
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.border,
  },
  contactInfo: {
    gap: 8,
    marginBottom: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactText: {
    fontSize: 14,
    color: SemanticColors.text,
  },
  equipmentSection: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.text,
    marginBottom: 8,
  },
  equipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  equipmentText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  customerActions: {
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
  segmentsHeader: {
    marginBottom: 16,
  },
  segmentsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.text,
  },
  segmentsSubtitle: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  segmentCard: {
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  segmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  segmentName: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  segmentCount: {
    backgroundColor: SemanticColors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  segmentCountText: {
    color: Palette.white,
    fontSize: 13,
    fontWeight: '600',
  },
  segmentDescription: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginBottom: 12,
  },
  segmentStats: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 12,
  },
  segmentStatItem: {
    alignItems: 'center',
  },
  segmentStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.text,
  },
  segmentStatLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  criteriaSection: {
    marginBottom: 12,
  },
  criteriaLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.text,
    marginBottom: 6,
  },
  criteriaList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  criteriaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  criteriaText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  recommendationsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.border,
  },
  recommendationsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.text,
    marginBottom: 8,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  recommendationText: {
    fontSize: 13,
    color: SemanticColors.text,
  },
  churnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.orange50,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Palette.orange200,
  },
  churnHeaderInfo: {
    marginLeft: 12,
    flex: 1,
  },
  churnHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Palette.orange700,
  },
  churnHeaderSubtitle: {
    fontSize: 14,
    color: Palette.orange600,
    marginTop: 2,
  },
  churnCard: {
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  churnInfo: {
    flex: 1,
  },
  churnCustomerName: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  churnLastContact: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  churnRiskSection: {
    alignItems: 'center',
  },
  riskMeter: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  riskPercentage: {
    fontSize: 16,
    fontWeight: '700',
  },
  riskLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  churnValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    marginBottom: 12,
  },
  churnValueText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  factorsSection: {
    marginBottom: 12,
  },
  factorsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.text,
    marginBottom: 6,
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  factorText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  suggestedActionsSection: {
    marginBottom: 16,
  },
  suggestedActionsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.text,
    marginBottom: 6,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  actionItemText: {
    fontSize: 13,
    color: SemanticColors.text,
  },
  takeActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  takeActionButtonText: {
    color: Palette.white,
    fontWeight: '600',
    fontSize: 15,
  },
});

export default CustomerInsights;
