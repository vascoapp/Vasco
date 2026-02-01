// =============================================================================
// SUPPLIER PERFORMANCE TRACKER
// =============================================================================
// Tracks and displays supplier performance metrics
// Helps contractors make informed supplier decisions
// Every rating and interaction feeds into the intelligence moat
// =============================================================================

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { trackUserAction } from '../../intelligence/intelligenceEngine';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// TYPES
// ============================================

export interface Supplier {
  id: string;
  name: string;
  logo?: string;
  category: 'bouwmarkt' | 'groothandel' | 'specialist' | 'online';
  website?: string;
  phone?: string;

  // Performance metrics
  metrics: SupplierMetrics;

  // Your relationship
  relationship: {
    orderCount: number;
    totalSpend: number;
    firstOrderDate: string;
    lastOrderDate: string;
    accountNumber?: string;
    discountTier?: string;
  };

  // Tags
  tags: string[];
}

export interface SupplierMetrics {
  // Price performance
  priceCompetitiveness: number; // 0-100, compared to market average
  priceConsistency: number; // 0-100, how stable are prices
  avgPriceVsMarket: number; // % difference from market average

  // Delivery
  deliveryReliability: number; // 0-100
  avgDeliveryDays: number;
  onTimeDeliveryRate: number; // %

  // Quality
  productQuality: number; // 0-100
  returnRate: number; // %
  issueResolutionTime: number; // hours

  // Service
  customerServiceRating: number; // 1-5
  responseTime: number; // hours
  stockAvailability: number; // %

  // Overall
  overallScore: number; // 0-100
  trend: 'improving' | 'stable' | 'declining';
}

interface SupplierReview {
  id: string;
  supplierId: string;
  rating: number;
  title: string;
  comment: string;
  category: 'price' | 'delivery' | 'quality' | 'service';
  date: string;
  orderId?: string;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: 'supplier_bouwmaat',
    name: 'Bouwmaat',
    category: 'bouwmarkt',
    website: 'bouwmaat.nl',
    phone: '0800-2345678',
    metrics: {
      priceCompetitiveness: 78,
      priceConsistency: 85,
      avgPriceVsMarket: -5,
      deliveryReliability: 92,
      avgDeliveryDays: 1.5,
      onTimeDeliveryRate: 94,
      productQuality: 82,
      returnRate: 2.3,
      issueResolutionTime: 24,
      customerServiceRating: 4.2,
      responseTime: 4,
      stockAvailability: 89,
      overallScore: 85,
      trend: 'stable',
    },
    relationship: {
      orderCount: 47,
      totalSpend: 12450,
      firstOrderDate: '2023-03-15',
      lastOrderDate: '2025-01-28',
      accountNumber: 'BM-2023-4567',
      discountTier: 'Gold',
    },
    tags: ['verf', 'gereedschap', 'snel'],
  },
  {
    id: 'supplier_praxis',
    name: 'Praxis',
    category: 'bouwmarkt',
    website: 'praxis.nl',
    phone: '0800-7729497',
    metrics: {
      priceCompetitiveness: 72,
      priceConsistency: 80,
      avgPriceVsMarket: 2,
      deliveryReliability: 85,
      avgDeliveryDays: 2,
      onTimeDeliveryRate: 88,
      productQuality: 78,
      returnRate: 3.1,
      issueResolutionTime: 48,
      customerServiceRating: 3.8,
      responseTime: 8,
      stockAvailability: 82,
      overallScore: 78,
      trend: 'declining',
    },
    relationship: {
      orderCount: 23,
      totalSpend: 5680,
      firstOrderDate: '2023-06-10',
      lastOrderDate: '2025-01-15',
    },
    tags: ['verf', 'tegels', 'breed assortiment'],
  },
  {
    id: 'supplier_technische_unie',
    name: 'Technische Unie',
    category: 'groothandel',
    website: 'technischeunie.nl',
    phone: '030-2345678',
    metrics: {
      priceCompetitiveness: 88,
      priceConsistency: 92,
      avgPriceVsMarket: -12,
      deliveryReliability: 96,
      avgDeliveryDays: 1,
      onTimeDeliveryRate: 98,
      productQuality: 90,
      returnRate: 1.2,
      issueResolutionTime: 12,
      customerServiceRating: 4.6,
      responseTime: 2,
      stockAvailability: 95,
      overallScore: 92,
      trend: 'improving',
    },
    relationship: {
      orderCount: 89,
      totalSpend: 34200,
      firstOrderDate: '2022-09-01',
      lastOrderDate: '2025-01-30',
      accountNumber: 'TU-789456',
      discountTier: 'Platinum',
    },
    tags: ['sanitair', 'elektra', 'groothandel prijzen'],
  },
  {
    id: 'supplier_verfwinkel',
    name: 'Verfwinkel.nl',
    category: 'online',
    website: 'verfwinkel.nl',
    metrics: {
      priceCompetitiveness: 92,
      priceConsistency: 88,
      avgPriceVsMarket: -15,
      deliveryReliability: 90,
      avgDeliveryDays: 2,
      onTimeDeliveryRate: 91,
      productQuality: 85,
      returnRate: 1.8,
      issueResolutionTime: 24,
      customerServiceRating: 4.4,
      responseTime: 3,
      stockAvailability: 87,
      overallScore: 88,
      trend: 'stable',
    },
    relationship: {
      orderCount: 31,
      totalSpend: 8900,
      firstOrderDate: '2023-11-05',
      lastOrderDate: '2025-01-22',
    },
    tags: ['verf', 'beste prijzen', 'snel geleverd'],
  },
  {
    id: 'supplier_sanitairwinkel',
    name: 'Sanitairwinkel.nl',
    category: 'specialist',
    website: 'sanitairwinkel.nl',
    metrics: {
      priceCompetitiveness: 85,
      priceConsistency: 90,
      avgPriceVsMarket: -8,
      deliveryReliability: 88,
      avgDeliveryDays: 3,
      onTimeDeliveryRate: 90,
      productQuality: 92,
      returnRate: 1.5,
      issueResolutionTime: 18,
      customerServiceRating: 4.5,
      responseTime: 4,
      stockAvailability: 83,
      overallScore: 87,
      trend: 'improving',
    },
    relationship: {
      orderCount: 18,
      totalSpend: 15600,
      firstOrderDate: '2024-02-20',
      lastOrderDate: '2025-01-25',
    },
    tags: ['sanitair', 'grohe', 'geberit', 'specialist'],
  },
];

// ============================================
// COMPONENTS
// ============================================

interface SupplierTrackerProps {
  onClose?: () => void;
}

export function SupplierTracker({ onClose }: SupplierTrackerProps) {
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'price' | 'reliability' | 'spend'>('score');
  const [showAddReview, setShowAddReview] = useState(false);

  const sortedSuppliers = [...MOCK_SUPPLIERS].sort((a, b) => {
    switch (sortBy) {
      case 'score':
        return b.metrics.overallScore - a.metrics.overallScore;
      case 'price':
        return a.metrics.avgPriceVsMarket - b.metrics.avgPriceVsMarket;
      case 'reliability':
        return b.metrics.deliveryReliability - a.metrics.deliveryReliability;
      case 'spend':
        return b.relationship.totalSpend - a.relationship.totalSpend;
      default:
        return 0;
    }
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onClose && (
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
        )}
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Leveranciers</Text>
          <Text style={styles.headerSubtitle}>{MOCK_SUPPLIERS.length} leveranciers gevolgd</Text>
        </View>
        <Pressable style={styles.addButton}>
          <Ionicons name="add" size={24} color="#fff" />
        </Pressable>
      </View>

      {/* Summary Stats */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>€{(MOCK_SUPPLIERS.reduce((sum, s) => sum + s.relationship.totalSpend, 0) / 1000).toFixed(1)}K</Text>
          <Text style={styles.summaryLabel}>Totaal besteed</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{MOCK_SUPPLIERS.reduce((sum, s) => sum + s.relationship.orderCount, 0)}</Text>
          <Text style={styles.summaryLabel}>Bestellingen</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: SemanticColors.feedbackSuccess }]}>-8%</Text>
          <Text style={styles.summaryLabel}>vs marktprijs</Text>
        </View>
      </View>

      {/* Sort Options */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sorteer op:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortOptions}>
          {[
            { id: 'score', label: 'Score' },
            { id: 'price', label: 'Prijs' },
            { id: 'reliability', label: 'Betrouwbaarheid' },
            { id: 'spend', label: 'Uitgaven' },
          ].map((option) => (
            <Pressable
              key={option.id}
              style={[styles.sortOption, sortBy === option.id && styles.sortOptionActive]}
              onPress={() => setSortBy(option.id as typeof sortBy)}
            >
              <Text style={[styles.sortOptionText, sortBy === option.id && styles.sortOptionTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Supplier List */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {sortedSuppliers.map((supplier) => (
          <SupplierCard
            key={supplier.id}
            supplier={supplier}
            onPress={() => setSelectedSupplier(supplier)}
          />
        ))}
        <View style={{ height: 50 }} />
      </ScrollView>

      {/* Supplier Detail Modal */}
      <Modal
        visible={!!selectedSupplier}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        {selectedSupplier && (
          <SupplierDetail
            supplier={selectedSupplier}
            onClose={() => setSelectedSupplier(null)}
            onAddReview={() => setShowAddReview(true)}
          />
        )}
      </Modal>

      {/* Add Review Modal */}
      <Modal
        visible={showAddReview}
        animationType="slide"
        presentationStyle="formSheet"
      >
        <AddReviewForm
          supplier={selectedSupplier}
          onClose={() => setShowAddReview(false)}
          onSubmit={(review) => {
            // Track for intelligence
            trackUserAction('supplier_reviewed', {
              supplierId: selectedSupplier?.id,
              rating: review.rating,
              category: review.category,
            });
            setShowAddReview(false);
          }}
        />
      </Modal>
    </View>
  );
}

// ============================================
// SUPPLIER CARD
// ============================================

function SupplierCard({ supplier, onPress }: { supplier: Supplier; onPress: () => void }) {
  const getCategoryConfig = (category: Supplier['category']) => {
    switch (category) {
      case 'bouwmarkt':
        return { label: 'Bouwmarkt', icon: 'storefront' as IconName, color: Palette.hermesOrange };
      case 'groothandel':
        return { label: 'Groothandel', icon: 'business' as IconName, color: Palette.dustyBlue };
      case 'specialist':
        return { label: 'Specialist', icon: 'star' as IconName, color: Palette.sageGreen };
      case 'online':
        return { label: 'Online', icon: 'globe' as IconName, color: '#8B5CF6' };
    }
  };

  const getTrendIcon = (trend: SupplierMetrics['trend']): IconName => {
    switch (trend) {
      case 'improving': return 'trending-up';
      case 'declining': return 'trending-down';
      case 'stable': return 'remove';
    }
  };

  const getTrendColor = (trend: SupplierMetrics['trend']) => {
    switch (trend) {
      case 'improving': return SemanticColors.feedbackSuccess;
      case 'declining': return SemanticColors.feedbackError;
      case 'stable': return SemanticColors.textTertiary;
    }
  };

  const categoryConfig = getCategoryConfig(supplier.category);
  const scoreColor = supplier.metrics.overallScore >= 85
    ? SemanticColors.feedbackSuccess
    : supplier.metrics.overallScore >= 70
    ? Palette.hermesOrange
    : SemanticColors.feedbackWarning;

  return (
    <Pressable style={styles.supplierCard} onPress={onPress}>
      {/* Header */}
      <View style={styles.supplierHeader}>
        <View style={styles.supplierInfo}>
          <View style={[styles.supplierIcon, { backgroundColor: categoryConfig.color + '15' }]}>
            <Ionicons name={categoryConfig.icon} size={24} color={categoryConfig.color} />
          </View>
          <View>
            <Text style={styles.supplierName}>{supplier.name}</Text>
            <View style={styles.supplierMeta}>
              <Text style={[styles.categoryBadge, { color: categoryConfig.color }]}>
                {categoryConfig.label}
              </Text>
              {supplier.relationship.discountTier && (
                <View style={styles.tierBadge}>
                  <Ionicons name="ribbon" size={10} color={Palette.hermesOrange} />
                  <Text style={styles.tierText}>{supplier.relationship.discountTier}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={styles.scoreContainer}>
          <Text style={[styles.scoreValue, { color: scoreColor }]}>
            {supplier.metrics.overallScore}
          </Text>
          <View style={styles.trendIndicator}>
            <Ionicons
              name={getTrendIcon(supplier.metrics.trend)}
              size={14}
              color={getTrendColor(supplier.metrics.trend)}
            />
          </View>
        </View>
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Ionicons name="cash-outline" size={14} color={SemanticColors.textTertiary} />
          <Text style={styles.metricValue}>
            {supplier.metrics.avgPriceVsMarket > 0 ? '+' : ''}{supplier.metrics.avgPriceVsMarket}%
          </Text>
          <Text style={styles.metricLabel}>vs markt</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Ionicons name="car-outline" size={14} color={SemanticColors.textTertiary} />
          <Text style={styles.metricValue}>{supplier.metrics.onTimeDeliveryRate}%</Text>
          <Text style={styles.metricLabel}>op tijd</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Ionicons name="star-outline" size={14} color={SemanticColors.textTertiary} />
          <Text style={styles.metricValue}>{supplier.metrics.customerServiceRating}</Text>
          <Text style={styles.metricLabel}>service</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Ionicons name="wallet-outline" size={14} color={SemanticColors.textTertiary} />
          <Text style={styles.metricValue}>€{(supplier.relationship.totalSpend / 1000).toFixed(1)}K</Text>
          <Text style={styles.metricLabel}>besteed</Text>
        </View>
      </View>

      {/* Tags */}
      <View style={styles.tagsRow}>
        {supplier.tags.slice(0, 4).map((tag, index) => (
          <View key={index} style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

// ============================================
// SUPPLIER DETAIL
// ============================================

function SupplierDetail({
  supplier,
  onClose,
  onAddReview,
}: {
  supplier: Supplier;
  onClose: () => void;
  onAddReview: () => void;
}) {
  const formatCurrency = (amount: number) => `€${amount.toLocaleString('nl-NL')}`;

  const getScoreColor = (score: number) => {
    if (score >= 85) return SemanticColors.feedbackSuccess;
    if (score >= 70) return Palette.hermesOrange;
    return SemanticColors.feedbackWarning;
  };

  return (
    <View style={styles.detailContainer}>
      {/* Header */}
      <View style={styles.detailHeader}>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.detailTitle}>{supplier.name}</Text>
        <Pressable style={styles.reviewButton} onPress={onAddReview}>
          <Ionicons name="create-outline" size={20} color={Palette.hermesOrange} />
        </Pressable>
      </View>

      <ScrollView style={styles.detailContent}>
        {/* Score Hero */}
        <View style={styles.scoreHero}>
          <View style={[styles.scoreCircle, { borderColor: getScoreColor(supplier.metrics.overallScore) }]}>
            <Text style={[styles.heroScoreValue, { color: getScoreColor(supplier.metrics.overallScore) }]}>
              {supplier.metrics.overallScore}
            </Text>
            <Text style={styles.heroScoreLabel}>Score</Text>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{supplier.relationship.orderCount}</Text>
              <Text style={styles.heroStatLabel}>Bestellingen</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{formatCurrency(supplier.relationship.totalSpend)}</Text>
              <Text style={styles.heroStatLabel}>Totaal besteed</Text>
            </View>
          </View>
        </View>

        {/* Performance Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance</Text>
          <View style={styles.performanceList}>
            <PerformanceRow
              label="Prijs Competitiviteit"
              value={supplier.metrics.priceCompetitiveness}
              icon="cash"
            />
            <PerformanceRow
              label="Levering Betrouwbaarheid"
              value={supplier.metrics.deliveryReliability}
              icon="car"
            />
            <PerformanceRow
              label="Product Kwaliteit"
              value={supplier.metrics.productQuality}
              icon="shield-checkmark"
            />
            <PerformanceRow
              label="Voorraad Beschikbaarheid"
              value={supplier.metrics.stockAvailability}
              icon="cube"
            />
          </View>
        </View>

        {/* Key Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailItemLabel}>Gem. levertijd</Text>
              <Text style={styles.detailItemValue}>{supplier.metrics.avgDeliveryDays} dagen</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailItemLabel}>Op tijd %</Text>
              <Text style={styles.detailItemValue}>{supplier.metrics.onTimeDeliveryRate}%</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailItemLabel}>Retour %</Text>
              <Text style={styles.detailItemValue}>{supplier.metrics.returnRate}%</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailItemLabel}>Reactietijd</Text>
              <Text style={styles.detailItemValue}>{supplier.metrics.responseTime}u</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailItemLabel}>Service rating</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color="#F59E0B" />
                <Text style={styles.detailItemValue}>{supplier.metrics.customerServiceRating}</Text>
              </View>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailItemLabel}>vs Marktprijs</Text>
              <Text style={[styles.detailItemValue, {
                color: supplier.metrics.avgPriceVsMarket < 0
                  ? SemanticColors.feedbackSuccess
                  : SemanticColors.feedbackError
              }]}>
                {supplier.metrics.avgPriceVsMarket > 0 ? '+' : ''}{supplier.metrics.avgPriceVsMarket}%
              </Text>
            </View>
          </View>
        </View>

        {/* Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <View style={styles.contactCard}>
            {supplier.website && (
              <View style={styles.contactRow}>
                <Ionicons name="globe-outline" size={18} color={SemanticColors.textSecondary} />
                <Text style={styles.contactText}>{supplier.website}</Text>
              </View>
            )}
            {supplier.phone && (
              <View style={styles.contactRow}>
                <Ionicons name="call-outline" size={18} color={SemanticColors.textSecondary} />
                <Text style={styles.contactText}>{supplier.phone}</Text>
              </View>
            )}
            {supplier.relationship.accountNumber && (
              <View style={styles.contactRow}>
                <Ionicons name="card-outline" size={18} color={SemanticColors.textSecondary} />
                <Text style={styles.contactText}>Account: {supplier.relationship.accountNumber}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

function PerformanceRow({ label, value, icon }: { label: string; value: number; icon: IconName }) {
  const getColor = (v: number) => {
    if (v >= 85) return SemanticColors.feedbackSuccess;
    if (v >= 70) return Palette.hermesOrange;
    return SemanticColors.feedbackWarning;
  };

  return (
    <View style={styles.performanceRow}>
      <Ionicons name={icon} size={18} color={SemanticColors.textSecondary} />
      <Text style={styles.performanceLabel}>{label}</Text>
      <View style={styles.performanceBar}>
        <View style={[styles.performanceBarFill, { width: `${value}%`, backgroundColor: getColor(value) }]} />
      </View>
      <Text style={[styles.performanceValue, { color: getColor(value) }]}>{value}</Text>
    </View>
  );
}

// ============================================
// ADD REVIEW FORM
// ============================================

function AddReviewForm({
  supplier,
  onClose,
  onSubmit,
}: {
  supplier: Supplier | null;
  onClose: () => void;
  onSubmit: (review: Partial<SupplierReview>) => void;
}) {
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState<SupplierReview['category']>('service');
  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    onSubmit({
      rating,
      category,
      comment,
    });
  };

  return (
    <View style={styles.reviewFormContainer}>
      <View style={styles.reviewFormHeader}>
        <Pressable onPress={onClose}>
          <Text style={styles.cancelText}>Annuleren</Text>
        </Pressable>
        <Text style={styles.reviewFormTitle}>Beoordeling</Text>
        <Pressable onPress={handleSubmit} disabled={rating === 0}>
          <Text style={[styles.submitText, rating === 0 && styles.submitTextDisabled]}>
            Verstuur
          </Text>
        </Pressable>
      </View>

      <ScrollView style={styles.reviewFormContent}>
        <Text style={styles.supplierReviewName}>{supplier?.name}</Text>

        {/* Rating */}
        <View style={styles.ratingSection}>
          <Text style={styles.ratingSectionTitle}>Hoe tevreden ben je?</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => setRating(star)} style={styles.starButton}>
                <Ionicons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={36}
                  color={star <= rating ? '#F59E0B' : SemanticColors.textTertiary}
                />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Category */}
        <View style={styles.categorySection}>
          <Text style={styles.ratingSectionTitle}>Waar gaat je feedback over?</Text>
          <View style={styles.categoryOptions}>
            {[
              { id: 'price', label: 'Prijs', icon: 'cash' as IconName },
              { id: 'delivery', label: 'Levering', icon: 'car' as IconName },
              { id: 'quality', label: 'Kwaliteit', icon: 'shield-checkmark' as IconName },
              { id: 'service', label: 'Service', icon: 'headset' as IconName },
            ].map((cat) => (
              <Pressable
                key={cat.id}
                style={[styles.categoryOption, category === cat.id && styles.categoryOptionActive]}
                onPress={() => setCategory(cat.id as SupplierReview['category'])}
              >
                <Ionicons
                  name={cat.icon}
                  size={20}
                  color={category === cat.id ? Palette.hermesOrange : SemanticColors.textSecondary}
                />
                <Text style={[styles.categoryOptionText, category === cat.id && styles.categoryOptionTextActive]}>
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Comment */}
        <View style={styles.commentSection}>
          <Text style={styles.ratingSectionTitle}>Toelichting (optioneel)</Text>
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="Deel je ervaring..."
            placeholderTextColor={SemanticColors.textTertiary}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Data Note */}
        <View style={styles.dataNote}>
          <Ionicons name="shield-checkmark" size={14} color={SemanticColors.textTertiary} />
          <Text style={styles.dataNoteText}>
            Je feedback helpt andere aannemers en verbetert onze aanbevelingen
          </Text>
        </View>
      </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  summaryLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  sortLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginRight: Spacing.sm,
  },
  sortOptions: {
    flexDirection: 'row',
  },
  sortOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: Spacing.xs,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  sortOptionActive: {
    backgroundColor: Palette.hermesOrange,
  },
  sortOptionText: {
    fontSize: 12,
    fontWeight: '500',
    color: SemanticColors.textSecondary,
  },
  sortOptionTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },

  // Supplier Card
  supplierCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  supplierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  supplierInfo: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  supplierIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supplierName: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  supplierMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
  },
  categoryBadge: {
    fontSize: 12,
    fontWeight: '500',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Palette.pastelOrange + '30',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tierText: {
    fontSize: 10,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  trendIndicator: {
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.sm,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  metricLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  metricDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  tag: {
    backgroundColor: SemanticColors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },

  // Detail
  detailContainer: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  detailTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    textAlign: 'center',
  },
  reviewButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  scoreHero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.lg,
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroScoreValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  heroScoreLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  heroStats: {
    flex: 1,
    gap: Spacing.sm,
  },
  heroStat: {},
  heroStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  heroStatLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  performanceList: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  performanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  performanceLabel: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  performanceBar: {
    width: 80,
    height: 6,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  performanceBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  performanceValue: {
    fontSize: 14,
    fontWeight: '600',
    width: 30,
    textAlign: 'right',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    overflow: 'hidden',
  },
  detailItem: {
    width: '50%',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  detailItemLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginBottom: 4,
  },
  detailItemValue: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contactCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  contactText: {
    fontSize: 14,
    color: SemanticColors.textPrimary,
  },

  // Review Form
  reviewFormContainer: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  reviewFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  cancelText: {
    fontSize: 16,
    color: SemanticColors.textSecondary,
  },
  reviewFormTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },
  submitTextDisabled: {
    color: SemanticColors.textTertiary,
  },
  reviewFormContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  supplierReviewName: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  ratingSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    marginBottom: Spacing.md,
  },
  starsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  starButton: {
    padding: 4,
  },
  categorySection: {
    marginBottom: Spacing.xl,
  },
  categoryOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryOption: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  categoryOptionActive: {
    borderColor: Palette.hermesOrange,
    backgroundColor: Palette.pastelOrange + '20',
  },
  categoryOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: SemanticColors.textSecondary,
  },
  categoryOptionTextActive: {
    color: Palette.hermesOrange,
  },
  commentSection: {
    marginBottom: Spacing.lg,
  },
  commentInput: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    padding: Spacing.md,
    fontSize: 14,
    color: SemanticColors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  dataNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dataNoteText: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },
});
