// =============================================================================
// REPUTATION & REVIEW MANAGER COMPONENT
// =============================================================================
// Manages reviews, ratings, certifications, and reputation scoring
// =============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import {
  useReviews,
  useReputation,
  Review,
  Certification,
} from '../../services/reputationService';

type TabType = 'reviews' | 'score' | 'certifications' | 'stats';

export function ReputationManager() {
  const [activeTab, setActiveTab] = useState<TabType>('reviews');
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [responseText, setResponseText] = useState('');
  const [filterRating, setFilterRating] = useState<number | null>(null);

  const { reviews, respondToReview, stats } = useReviews(filterRating ? { rating: filterRating } : undefined);
  const { score, certifications } = useReputation();

  const tabs: Array<{ key: TabType; label: string; icon: string }> = [
    { key: 'reviews', label: 'Reviews', icon: 'chatbubbles-outline' },
    { key: 'score', label: 'Score', icon: 'star-outline' },
    { key: 'certifications', label: 'Certificaten', icon: 'ribbon-outline' },
    { key: 'stats', label: 'Statistieken', icon: 'analytics-outline' },
  ];

  const handleRespond = (review: Review) => {
    setSelectedReview(review);
    setResponseText('');
    setShowResponseModal(true);
  };

  const submitResponse = () => {
    if (selectedReview && responseText.trim()) {
      respondToReview(selectedReview.id, responseText.trim());
      setShowResponseModal(false);
      setSelectedReview(null);
      setResponseText('');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderStars = (rating: number, size: number = 16) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? 'star' : 'star-outline'}
          size={size}
          color={star <= rating ? Palette.orange500 : SemanticColors.border}
        />
      ))}
    </View>
  );

  const renderReviewCard = (review: Review) => (
    <View key={review.id} style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewerInfo}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{review.customerName.charAt(0)}</Text>
          </View>
          <View>
            <Text style={styles.reviewerName}>{review.customerName}</Text>
            <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
          </View>
        </View>
        <View style={styles.ratingBadge}>
          {renderStars(review.rating, 14)}
        </View>
      </View>

      {review.title && <Text style={styles.reviewTitle}>{review.title}</Text>}
      <Text style={styles.reviewContent}>{review.content}</Text>

      <View style={styles.reviewMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="construct-outline" size={14} color={SemanticColors.textSecondary} />
          <Text style={styles.metaText}>{review.projectType}</Text>
        </View>
        {review.verified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={14} color={Palette.green500} />
            <Text style={styles.verifiedText}>Geverifieerd</Text>
          </View>
        )}
        <View style={styles.helpfulBadge}>
          <Ionicons name="thumbs-up-outline" size={14} color={SemanticColors.textSecondary} />
          <Text style={styles.metaText}>{review.helpful}</Text>
        </View>
      </View>

      {review.response ? (
        <View style={styles.responseBox}>
          <View style={styles.responseHeader}>
            <Ionicons name="chatbubble-outline" size={14} color={Palette.blue500} />
            <Text style={styles.responseLabel}>Jouw reactie</Text>
          </View>
          <Text style={styles.responseText}>{review.response.content}</Text>
          <Text style={styles.responseDate}>{formatDate(review.response.createdAt)}</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.respondButton}
          onPress={() => handleRespond(review)}
        >
          <Ionicons name="chatbubble-outline" size={16} color={Palette.blue500} />
          <Text style={styles.respondButtonText}>Reageren</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderReviewsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Filter Bar */}
      <View style={styles.filterBar}>
        <Text style={styles.filterLabel}>Filter:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, !filterRating && styles.filterChipActive]}
            onPress={() => setFilterRating(null)}
          >
            <Text style={[styles.filterChipText, !filterRating && styles.filterChipTextActive]}>
              Alle ({reviews.length})
            </Text>
          </TouchableOpacity>
          {[5, 4, 3, 2, 1].map((rating) => (
            <TouchableOpacity
              key={rating}
              style={[styles.filterChip, filterRating === rating && styles.filterChipActive]}
              onPress={() => setFilterRating(filterRating === rating ? null : rating)}
            >
              <Ionicons
                name="star"
                size={12}
                color={filterRating === rating ? '#fff' : Palette.orange500}
              />
              <Text style={[styles.filterChipText, filterRating === rating && styles.filterChipTextActive]}>
                {rating}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Reviews List */}
      {reviews.map(renderReviewCard)}

      {reviews.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={48} color={SemanticColors.textSecondary} />
          <Text style={styles.emptyTitle}>Geen reviews</Text>
          <Text style={styles.emptyText}>
            Er zijn nog geen reviews met deze filter.
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderScoreTab = () => {
    const getTrendStyle = (trend: string) => {
      switch (trend) {
        case 'improving': return { color: Palette.green500, icon: 'arrow-up', label: 'Stijgend' };
        case 'declining': return { color: Palette.red500, icon: 'arrow-down', label: 'Dalend' };
        default: return { color: Palette.gray500, icon: 'remove', label: 'Stabiel' };
      }
    };

    const trendStyle = getTrendStyle(score.trend);

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Overall Score */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreValue}>{score.overall}</Text>
            <Text style={styles.scoreMax}>/100</Text>
          </View>
          <View style={styles.scoreMeta}>
            <Text style={styles.scoreTitle}>Reputatiescore</Text>
            <View style={[styles.trendBadge, { backgroundColor: trendStyle.color + '20' }]}>
              <Ionicons name={trendStyle.icon as any} size={14} color={trendStyle.color} />
              <Text style={[styles.trendLabel, { color: trendStyle.color }]}>{trendStyle.label}</Text>
            </View>
            <Text style={styles.percentileText}>Top {100 - score.percentile}% in jouw regio</Text>
          </View>
        </View>

        {/* Category Scores */}
        <View style={styles.categoriesCard}>
          <Text style={styles.sectionTitle}>Scores per categorie</Text>
          {Object.entries(score.categories).map(([key, value]) => {
            const labels: Record<string, string> = {
              quality: 'Kwaliteit',
              communication: 'Communicatie',
              punctuality: 'Punctualiteit',
              value: 'Prijs-kwaliteit',
              cleanliness: 'Netheid',
            };
            return (
              <View key={key} style={styles.categoryRow}>
                <Text style={styles.categoryLabel}>{labels[key]}</Text>
                <View style={styles.categoryBarContainer}>
                  <View style={styles.categoryBar}>
                    <View
                      style={[
                        styles.categoryFill,
                        {
                          width: `${value}%`,
                          backgroundColor: value >= 90 ? Palette.green500 : value >= 80 ? Palette.blue500 : Palette.orange500,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.categoryValue}>{value}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Response Stats */}
        <View style={styles.responseStatsCard}>
          <Text style={styles.sectionTitle}>Reactieprestaties</Text>
          <View style={styles.responseStatsRow}>
            <View style={styles.responseStat}>
              <Text style={styles.responseStatValue}>{score.responseRate}%</Text>
              <Text style={styles.responseStatLabel}>Reactieratio</Text>
            </View>
            <View style={styles.responseStat}>
              <Text style={styles.responseStatValue}>{score.avgResponseTime}u</Text>
              <Text style={styles.responseStatLabel}>Gem. reactietijd</Text>
            </View>
            <View style={styles.responseStat}>
              <Text style={styles.responseStatValue}>{score.totalReviews}</Text>
              <Text style={styles.responseStatLabel}>Totaal reviews</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderCertificationCard = (cert: Certification) => (
    <View key={cert.id} style={styles.certCard}>
      <View style={styles.certIcon}>
        <Ionicons
          name={cert.verified ? 'ribbon' : 'ribbon-outline'}
          size={28}
          color={cert.verified ? Palette.green500 : SemanticColors.textSecondary}
        />
      </View>
      <View style={styles.certInfo}>
        <Text style={styles.certName}>{cert.name}</Text>
        <Text style={styles.certIssuer}>{cert.issuer}</Text>
        <View style={styles.certMeta}>
          <Text style={styles.certDate}>Sinds {formatDate(cert.issuedAt)}</Text>
          {cert.expiresAt && (
            <Text style={styles.certExpiry}>
              Verloopt: {formatDate(cert.expiresAt)}
            </Text>
          )}
        </View>
      </View>
      {cert.verified && (
        <View style={styles.verifiedIndicator}>
          <Ionicons name="checkmark-circle" size={20} color={Palette.green500} />
        </View>
      )}
    </View>
  );

  const renderCertificationsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.certHeader}>
        <Text style={styles.certHeaderTitle}>{certifications.length} certificaten</Text>
        <Text style={styles.certHeaderSubtitle}>
          {certifications.filter((c) => c.verified).length} geverifieerd
        </Text>
      </View>

      {certifications.map(renderCertificationCard)}

      <TouchableOpacity style={styles.addCertButton}>
        <Ionicons name="add-circle-outline" size={24} color={Palette.blue500} />
        <Text style={styles.addCertText}>Certificaat toevoegen</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderStatsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Rating Summary */}
      <View style={styles.ratingsSummary}>
        <View style={styles.ratingsOverview}>
          <Text style={styles.avgRating}>{stats.avgRating.toFixed(1)}</Text>
          {renderStars(Math.round(stats.avgRating), 20)}
          <Text style={styles.totalReviews}>{stats.totalReviews} reviews</Text>
        </View>
        <View style={styles.ratingDistribution}>
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = stats.ratingDistribution[rating] || 0;
            const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
            return (
              <View key={rating} style={styles.distributionRow}>
                <Text style={styles.distributionLabel}>{rating}</Text>
                <Ionicons name="star" size={12} color={Palette.orange500} />
                <View style={styles.distributionBar}>
                  <View
                    style={[styles.distributionFill, { width: `${percentage}%` }]}
                  />
                </View>
                <Text style={styles.distributionCount}>{count}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Top Keywords */}
      <View style={styles.keywordsCard}>
        <Text style={styles.sectionTitle}>Meest genoemde termen</Text>
        <View style={styles.keywordsList}>
          {stats.topKeywords.map((kw, index) => (
            <View
              key={index}
              style={[
                styles.keywordChip,
                { backgroundColor: kw.sentiment === 'positive' ? Palette.green500 + '20' : Palette.red500 + '20' },
              ]}
            >
              <Text
                style={[
                  styles.keywordText,
                  { color: kw.sentiment === 'positive' ? Palette.green500 : Palette.red500 },
                ]}
              >
                {kw.word}
              </Text>
              <Text style={styles.keywordCount}>({kw.count})</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Response Rate */}
      <View style={styles.responseCard}>
        <View style={styles.responseCardHeader}>
          <Text style={styles.sectionTitle}>Reactiepercentage</Text>
          <Text style={styles.responsePercent}>{stats.responseRate}%</Text>
        </View>
        <View style={styles.responseBar}>
          <View style={[styles.responseFill, { width: `${stats.responseRate}%` }]} />
        </View>
        <Text style={styles.responseTip}>
          Reageer op reviews om vertrouwen op te bouwen. Streefdoel: 90%+
        </Text>
      </View>

      {/* Trend */}
      <View style={styles.trendCard}>
        <Ionicons
          name={stats.recentTrend >= 0 ? 'trending-up' : 'trending-down'}
          size={24}
          color={stats.recentTrend >= 0 ? Palette.green500 : Palette.red500}
        />
        <View style={styles.trendContent}>
          <Text style={styles.trendTitle}>Recente trend</Text>
          <Text style={[styles.trendValue, { color: stats.recentTrend >= 0 ? Palette.green500 : Palette.red500 }]}>
            {stats.recentTrend >= 0 ? '+' : ''}{(stats.recentTrend * 100).toFixed(0)}% t.o.v. vorige maand
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.key ? Palette.blue500 : SemanticColors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'reviews' && renderReviewsTab()}
      {activeTab === 'score' && renderScoreTab()}
      {activeTab === 'certifications' && renderCertificationsTab()}
      {activeTab === 'stats' && renderStatsTab()}

      {/* Response Modal */}
      <Modal
        visible={showResponseModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowResponseModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowResponseModal(false)}>
              <Ionicons name="close" size={24} color={SemanticColors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Reageren</Text>
            <TouchableOpacity onPress={submitResponse} disabled={!responseText.trim()}>
              <Text style={[styles.modalAction, !responseText.trim() && styles.modalActionDisabled]}>
                Verstuur
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedReview && (
              <View style={styles.reviewPreview}>
                <View style={styles.reviewPreviewHeader}>
                  <Text style={styles.reviewPreviewName}>{selectedReview.customerName}</Text>
                  {renderStars(selectedReview.rating, 14)}
                </View>
                <Text style={styles.reviewPreviewContent} numberOfLines={3}>
                  {selectedReview.content}
                </Text>
              </View>
            )}

            <TextInput
              style={styles.responseInput}
              placeholder="Schrijf je reactie..."
              placeholderTextColor={SemanticColors.textSecondary}
              value={responseText}
              onChangeText={setResponseText}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            <View style={styles.responseTips}>
              <Text style={styles.responseTipsTitle}>Tips voor een goede reactie:</Text>
              <Text style={styles.responseTipsItem}>• Bedank de klant voor de review</Text>
              <Text style={styles.responseTipsItem}>• Blijf professioneel en vriendelijk</Text>
              <Text style={styles.responseTipsItem}>• Benoem specifieke punten uit de review</Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  activeTab: {
    backgroundColor: Palette.blue500 + '15',
  },
  tabText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: Palette.blue500,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },

  // Filter Bar
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginRight: 8,
  },
  filterScroll: {
    flex: 1,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1,
    borderColor: SemanticColors.border,
    marginRight: 8,
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: Palette.blue500,
    borderColor: Palette.blue500,
  },
  filterChipText: {
    fontSize: 13,
    color: SemanticColors.text,
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  // Review Card
  reviewCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.blue500 + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: Palette.blue500,
  },
  reviewerName: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  reviewDate: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 1,
  },
  ratingBadge: {
    backgroundColor: Palette.orange500 + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.text,
    marginBottom: 6,
  },
  reviewContent: {
    fontSize: 14,
    color: SemanticColors.text,
    lineHeight: 20,
    marginBottom: 12,
  },
  reviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: Palette.green500,
    fontWeight: '500',
  },
  helpfulBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  responseBox: {
    backgroundColor: Palette.blue500 + '10',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: Palette.blue500,
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.blue500,
  },
  responseText: {
    fontSize: 14,
    color: SemanticColors.text,
    lineHeight: 18,
  },
  responseDate: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 6,
  },
  respondButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Palette.blue500,
    gap: 6,
  },
  respondButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Palette.blue500,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.text,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },

  // Score Tab
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
    gap: 20,
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Palette.green500 + '20',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: '700',
    color: Palette.green500,
  },
  scoreMax: {
    fontSize: 16,
    color: Palette.green500,
    marginTop: 12,
  },
  scoreMeta: {
    flex: 1,
  },
  scoreTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.text,
    marginBottom: 8,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    marginBottom: 8,
  },
  trendLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  percentileText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },

  // Categories Card
  categoriesCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.text,
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryLabel: {
    width: 100,
    fontSize: 13,
    color: SemanticColors.text,
  },
  categoryBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryBar: {
    flex: 1,
    height: 8,
    backgroundColor: SemanticColors.border,
    borderRadius: 4,
  },
  categoryFill: {
    height: '100%',
    borderRadius: 4,
  },
  categoryValue: {
    width: 28,
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.text,
    textAlign: 'right',
  },

  // Response Stats Card
  responseStatsCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  responseStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  responseStat: {
    alignItems: 'center',
  },
  responseStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.text,
  },
  responseStatLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },

  // Certifications Tab
  certHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  certHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  certHeaderSubtitle: {
    fontSize: 14,
    color: Palette.green500,
  },
  certCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.border,
    gap: 12,
  },
  certIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Palette.green500 + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  certInfo: {
    flex: 1,
  },
  certName: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  certIssuer: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  certMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  certDate: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  certExpiry: {
    fontSize: 11,
    color: Palette.orange500,
  },
  verifiedIndicator: {},
  addCertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.blue500 + '15',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Palette.blue500,
    borderStyle: 'dashed',
    gap: 8,
  },
  addCertText: {
    fontSize: 15,
    fontWeight: '600',
    color: Palette.blue500,
  },

  // Stats Tab
  ratingsSummary: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  ratingsOverview: {
    alignItems: 'center',
    marginRight: 20,
    paddingRight: 20,
    borderRightWidth: 1,
    borderRightColor: SemanticColors.border,
  },
  avgRating: {
    fontSize: 40,
    fontWeight: '700',
    color: SemanticColors.text,
  },
  totalReviews: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  ratingDistribution: {
    flex: 1,
    justifyContent: 'center',
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  distributionLabel: {
    fontSize: 12,
    color: SemanticColors.text,
    width: 12,
  },
  distributionBar: {
    flex: 1,
    height: 6,
    backgroundColor: SemanticColors.border,
    borderRadius: 3,
  },
  distributionFill: {
    height: '100%',
    backgroundColor: Palette.orange500,
    borderRadius: 3,
  },
  distributionCount: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    width: 16,
    textAlign: 'right',
  },

  // Keywords Card
  keywordsCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  keywordsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  keywordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  keywordText: {
    fontSize: 13,
    fontWeight: '500',
  },
  keywordCount: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },

  // Response Card
  responseCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  responseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  responsePercent: {
    fontSize: 24,
    fontWeight: '700',
    color: Palette.blue500,
  },
  responseBar: {
    height: 8,
    backgroundColor: SemanticColors.border,
    borderRadius: 4,
    marginBottom: 8,
  },
  responseFill: {
    height: '100%',
    backgroundColor: Palette.blue500,
    borderRadius: 4,
  },
  responseTip: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },

  // Trend Card
  trendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
    gap: 12,
  },
  trendContent: {
    flex: 1,
  },
  trendTitle: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  trendValue: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.border,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  modalAction: {
    fontSize: 16,
    fontWeight: '600',
    color: Palette.blue500,
  },
  modalActionDisabled: {
    color: SemanticColors.textSecondary,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  reviewPreview: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  reviewPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reviewPreviewName: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  reviewPreviewContent: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },
  responseInput: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
    fontSize: 15,
    color: SemanticColors.text,
    minHeight: 150,
    marginBottom: 16,
  },
  responseTips: {
    backgroundColor: Palette.blue500 + '10',
    borderRadius: 12,
    padding: 16,
  },
  responseTipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.text,
    marginBottom: 8,
  },
  responseTipsItem: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    lineHeight: 20,
  },
});
