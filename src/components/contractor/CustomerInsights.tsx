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
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { formatCurrency, formatMoney } from '../../i18n/formatting';
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
    <Pressable
      style={styles.customerCard}
      onPress={() => setExpanded(!expanded)}
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
          <Text style={styles.statValue}>{formatCurrency(customer.lifetimeValue)}</Text>
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
                  <Ionicons name="hardware-chip-outline" size={16} color={SemanticColors.actionPrimary} />
                  <Text style={styles.equipmentText}>
                    {eq.type} - {eq.brand} {eq.model}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.customerActions}>
            <Pressable style={styles.actionButton} onPress={onView}>
              <Ionicons name="person-outline" size={18} color={SemanticColors.actionPrimary} />
              <Text style={styles.actionButtonText}>Profiel</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.primaryButton]}>
              <Ionicons name="call" size={18} color={Palette.white} />
              <Text style={[styles.actionButtonText, styles.primaryButtonText]}>Bellen</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Pressable>
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
        <Text style={styles.segmentStatValue}>{formatCurrency(segment.avgLifetimeValue)}</Text>
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
            <Ionicons name="checkmark" size={12} color={SemanticColors.actionPrimary} />
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
          {formatCurrency(prediction.lifetimeValue)} lifetime value
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

      <Pressable style={styles.takeActionButton} onPress={onTakeAction}>
        <Ionicons name="call" size={18} color={Palette.white} />
        <Text style={styles.takeActionButtonText}>Neem Contact Op</Text>
      </Pressable>
    </View>
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
    <Text style={styles.statCardValue}>{value}</Text>
    <Text style={styles.statCardLabel}>{label}</Text>
  </View>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const CustomerInsights: React.FC = () => {
  const { t } = useTranslation();
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
    const daysSinceContact = Math.floor(
      (Date.now() - customer.lastContact.getTime()) / (1000 * 60 * 60 * 24)
    );
    const typeLabel = customer.type === 'commercial' ? 'Zakelijk' : 'Particulier';
    const paymentLabels: Record<string, string> = {
      excellent: 'Uitstekend',
      good: 'Goed',
      average: 'Gemiddeld',
      poor: 'Slecht',
    };

    Alert.alert(
      customer.name,
      `Type: ${typeLabel}\n` +
      `Telefoon: ${customer.phone}\n` +
      (customer.email ? `E-mail: ${customer.email}\n` : '') +
      `Adres: ${customer.address}, ${customer.city}\n\n` +
      `Totaal klussen: ${customer.totalJobs}\n` +
      `Gem. kluswaarde: ${formatMoney(customer.avgJobValue)}\n` +
      `Lifetime value: ${formatMoney(customer.lifetimeValue)}\n` +
      `Tevredenheid: ${customer.satisfaction.toFixed(1)} / 5\n` +
      `Betaalgedrag: ${paymentLabels[customer.paymentBehavior] ?? customer.paymentBehavior}\n` +
      `Laatste contact: ${daysSinceContact} dagen geleden`,
      [{ text: 'Sluiten', style: 'cancel' }],
    );
  };

  const handleTakeAction = (prediction: ChurnPrediction) => {
    const daysSinceContact = Math.floor(
      (Date.now() - prediction.lastContact.getTime()) / (1000 * 60 * 60 * 24)
    );

    Alert.alert(
      t('customerInsights.actionFor', 'Action for {{name}}', { name: prediction.customerName }),
      `${t('customerInsights.churnRisk', 'Churn risk')}: ${prediction.probability}%\n` +
      `${t('customerInsights.lifetimeValue', 'Lifetime value')}: ${formatMoney(prediction.lifetimeValue)}\n` +
      `${t('customerInsights.lastContact', 'Last contact')}: ${daysSinceContact} ${t('common.daysAgo', 'days ago')}`,
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('customerInsights.contactCustomer', 'Contact customer'),
          onPress: () => {
            Alert.alert(t('customerInsights.contactCustomer', 'Contact customer'), t('customerInsights.contactMessage', 'Contact {{name}}.', { name: prediction.customerName }));
          },
        },
        {
          text: t('customerInsights.sendReminder', 'Send reminder'),
          onPress: () => {
            Alert.alert(t('customerInsights.reminder', 'Reminder'), t('customerInsights.reminderSent', 'Reminder sent to {{name}}.', { name: prediction.customerName }));
          },
        },
      ],
    );
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
                <Text style={styles.loadingText}>{t('common.loading', 'Loading...')}</Text>
              </View>
            ) : filteredCustomers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color={SemanticColors.textSecondary} />
                <Text style={styles.emptyText}>{t('customers.noCustomersFound', 'No customers found')}</Text>
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
              <Text style={styles.segmentsTitle}>{t('customers.segments', 'Customer segments')}</Text>
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
        <Text style={styles.title}>{t('customers.insights', 'Customer insights')}</Text>
        <Pressable style={styles.filterButton}>
          <Ionicons name="filter-outline" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {[
          { key: 'customers', label: 'Klanten', icon: 'people-outline' },
          { key: 'segments', label: 'Segmenten', icon: 'pie-chart-outline' },
          { key: 'churn', label: 'Churn Risico', icon: 'warning-outline' },
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
  filterButton: {
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: TYPE.titleSize,
    color: SemanticColors.textPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
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
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  statCardLabel: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
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
    color: SemanticColors.textPrimary,
    fontFamily: TYPE.labelFamily,
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
  },
  customerCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
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
    fontSize: TYPE.titleSize + 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  customerTypeBadge: {
    backgroundColor: SemanticColors.actionPrimary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  customerTypeText: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.actionPrimary,
    fontFamily: TYPE.labelFamily,
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
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginLeft: 4,
  },
  riskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
  },
  riskText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
  },
  customerStats: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: RADIUS.sm,
    padding: 12,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  statLabel: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginHorizontal: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: SemanticColors.actionPrimary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
  },
  tagText: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.actionPrimary,
    fontFamily: TYPE.labelFamily,
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
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
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
  },
  equipmentSection: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginBottom: 8,
  },
  equipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  equipmentText: {
    fontSize: TYPE.bodySize - 1,
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
  segmentsHeader: {
    marginBottom: 16,
  },
  segmentsTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  segmentsSubtitle: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  segmentCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  segmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  segmentName: {
    fontSize: TYPE.titleSize + 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  segmentCount: {
    backgroundColor: SemanticColors.actionPrimary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
  },
  segmentCountText: {
    color: Palette.white,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
  },
  segmentDescription: {
    fontSize: TYPE.bodySize - 1,
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
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  segmentStatLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  criteriaSection: {
    marginBottom: 12,
  },
  criteriaLabel: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
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
    backgroundColor: SemanticColors.surfaceBackground,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  criteriaText: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  recommendationsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  recommendationsLabel: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginBottom: 8,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  recommendationText: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textPrimary,
  },
  churnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.orange50,
    borderRadius: RADIUS.md,
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
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.orange700,
  },
  churnHeaderSubtitle: {
    fontSize: TYPE.bodySize - 1,
    color: Palette.orange600,
    marginTop: 2,
  },
  churnCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  churnInfo: {
    flex: 1,
  },
  churnCustomerName: {
    fontSize: TYPE.titleSize + 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  churnLastContact: {
    fontSize: TYPE.captionSize,
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
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.sectionFamily,
  },
  riskLabel: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
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
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
  },
  factorsSection: {
    marginBottom: 12,
  },
  factorsLabel: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginBottom: 6,
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  factorText: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
  },
  suggestedActionsSection: {
    marginBottom: 16,
  },
  suggestedActionsLabel: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginBottom: 6,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  actionItemText: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textPrimary,
  },
  takeActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.actionPrimary,
    paddingVertical: 12,
    borderRadius: RADIUS.sm,
    gap: 8,
  },
  takeActionButtonText: {
    color: Palette.white,
    fontFamily: TYPE.titleFamily,
    fontSize: TYPE.bodySize,
  },
});

export default CustomerInsights;
