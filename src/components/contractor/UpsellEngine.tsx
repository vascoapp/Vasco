// =============================================================================
// UPSELL ENGINE COMPONENT
// =============================================================================
// Intelligent upselling recommendations and performance tracking
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
  useUpsellRecommendations,
  useUpsellPerformance,
  useUpsellStats,
  UpsellOpportunity,
  ActiveRecommendation,
} from '../../services/upsellEngineService';

// =============================================================================
// TYPES
// =============================================================================

type TabType = 'opportunities' | 'scripts' | 'performance';

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const TypeBadge: React.FC<{ type: UpsellOpportunity['type'] }> = ({ type }) => {
  const getConfig = () => {
    switch (type) {
      case 'upsell':
        return { label: 'Upsell', color: Palette.blue500 };
      case 'cross_sell':
        return { label: 'Cross-sell', color: "#a855f7" };
      case 'addon':
        return { label: 'Add-on', color: Palette.green500 };
      case 'upgrade':
        return { label: 'Upgrade', color: Palette.orange500 };
      default:
        return { label: type, color: Palette.gray500 };
    }
  };

  const config = getConfig();
  return (
    <View style={[styles.typeBadge, { backgroundColor: config.color + '20' }]}>
      <Text style={[styles.typeBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

const ProbabilityMeter: React.FC<{ probability: number }> = ({ probability }) => {
  const getColor = () => {
    if (probability >= 50) return Palette.green500;
    if (probability >= 30) return Palette.yellow500;
    return Palette.gray400;
  };

  return (
    <View style={styles.probabilityContainer}>
      <View style={styles.probabilityBar}>
        <View
          style={[
            styles.probabilityFill,
            { width: `${probability}%`, backgroundColor: getColor() },
          ]}
        />
      </View>
      <Text style={[styles.probabilityText, { color: getColor() }]}>{probability}%</Text>
    </View>
  );
};

const OpportunityCard: React.FC<{
  opportunity: UpsellOpportunity;
  onPresent: () => void;
  onAccept: () => void;
  onDecline: () => void;
}> = ({ opportunity, onPresent, onAccept, onDecline }) => {
  const [expanded, setExpanded] = useState(false);
  const [showScript, setShowScript] = useState(false);

  return (
    <TouchableOpacity
      style={styles.opportunityCard}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.opportunityHeader}>
        <View style={styles.opportunityInfo}>
          <View style={styles.opportunityTitleRow}>
            <Text style={styles.opportunityTitle}>{opportunity.title}</Text>
            <TypeBadge type={opportunity.type} />
          </View>
          <Text style={styles.opportunityDescription} numberOfLines={expanded ? undefined : 2}>
            {opportunity.description}
          </Text>
        </View>
      </View>

      <View style={styles.opportunityMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="cash-outline" size={16} color={SemanticColors.actionPrimary} />
          <Text style={styles.metaValue}>€{opportunity.suggestedPrice}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="trending-up-outline" size={16} color={Palette.green500} />
          <Text style={styles.metaValue}>{opportunity.margin}% marge</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Kans:</Text>
          <ProbabilityMeter probability={opportunity.probability} />
        </View>
      </View>

      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.timingSection}>
            <Ionicons name="time-outline" size={16} color={SemanticColors.textSecondary} />
            <Text style={styles.timingText}>
              <Text style={styles.timingLabel}>Beste moment: </Text>
              {opportunity.bestTiming}
            </Text>
          </View>

          <View style={styles.talkingPointsSection}>
            <Text style={styles.sectionLabel}>Verkoopargumenten</Text>
            {opportunity.talkingPoints.map((point, index) => (
              <View key={index} style={styles.talkingPoint}>
                <Ionicons name="checkmark-circle" size={16} color={Palette.green500} />
                <Text style={styles.talkingPointText}>{point}</Text>
              </View>
            ))}
          </View>

          {showScript && opportunity.objectionHandlers.length > 0 && (
            <View style={styles.objectionsSection}>
              <Text style={styles.sectionLabel}>Bezwaren Afhandelen</Text>
              {opportunity.objectionHandlers.map((handler, index) => (
                <View key={index} style={styles.objectionItem}>
                  <View style={styles.objectionRow}>
                    <Ionicons name="help-circle" size={16} color={Palette.orange500} />
                    <Text style={styles.objectionText}>{handler.objection}</Text>
                  </View>
                  <View style={styles.responseRow}>
                    <Ionicons name="chatbubble" size={16} color={Palette.blue500} />
                    <Text style={styles.responseText}>{handler.response}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.toggleScriptButton}
            onPress={() => setShowScript(!showScript)}
          >
            <Text style={styles.toggleScriptText}>
              {showScript ? 'Verberg scripts' : 'Toon bezwaar-scripts'}
            </Text>
            <Ionicons
              name={showScript ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={SemanticColors.actionPrimary}
            />
          </TouchableOpacity>

          {opportunity.status === 'pending' && (
            <View style={styles.opportunityActions}>
              <TouchableOpacity style={styles.presentButton} onPress={onPresent}>
                <Ionicons name="megaphone-outline" size={18} color={Palette.white} />
                <Text style={styles.presentButtonText}>Presenteren</Text>
              </TouchableOpacity>
            </View>
          )}

          {opportunity.status === 'presented' && (
            <View style={styles.opportunityActions}>
              <TouchableOpacity
                style={[styles.outcomeButton, styles.declineButton]}
                onPress={onDecline}
              >
                <Ionicons name="close" size={18} color={Palette.red500} />
                <Text style={[styles.outcomeButtonText, { color: Palette.red500 }]}>
                  Afgewezen
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.outcomeButton, styles.acceptButton]}
                onPress={onAccept}
              >
                <Ionicons name="checkmark" size={18} color={Palette.white} />
                <Text style={[styles.outcomeButtonText, { color: Palette.white }]}>
                  Geaccepteerd
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const PerformanceChart: React.FC<{
  data: { period: string; acceptanceRate: number; revenue: number }[];
}> = ({ data }) => {
  const maxRevenue = Math.max(...data.map(d => d.revenue));

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartBars}>
        {data.map((item, index) => (
          <View key={index} style={styles.chartBarWrapper}>
            <View style={styles.chartBarContainer}>
              <View
                style={[
                  styles.chartBar,
                  { height: `${(item.revenue / maxRevenue) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.chartLabel}>{item.period}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const StatCard: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  subtext?: string;
}> = ({ icon, label, value, subtext }) => (
  <View style={styles.statCard}>
    <View style={styles.statIconContainer}>
      <Ionicons name={icon} size={20} color={SemanticColors.actionPrimary} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    {subtext && <Text style={styles.statSubtext}>{subtext}</Text>}
  </View>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const UpsellEngine: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('opportunities');
  const { recommendation, present, recordOutcome } = useUpsellRecommendations('job-123');
  const performance = useUpsellPerformance(6);
  const stats = useUpsellStats();

  const handlePresent = (opportunityId: string) => {
    if (recommendation) {
      present(recommendation.id, opportunityId);
    }
  };

  const handleAccept = (opportunityId: string) => {
    if (recommendation) {
      recordOutcome(recommendation.id, opportunityId, true);
    }
  };

  const handleDecline = (opportunityId: string) => {
    if (recommendation) {
      recordOutcome(recommendation.id, opportunityId, false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'opportunities':
        return (
          <View style={styles.tabContent}>
            {recommendation && (
              <View style={styles.activeJobBanner}>
                <View style={styles.jobBannerContent}>
                  <Ionicons name="construct" size={20} color={SemanticColors.actionPrimary} />
                  <View style={styles.jobBannerInfo}>
                    <Text style={styles.jobBannerTitle}>
                      Klus bij {recommendation.customerName}
                    </Text>
                    <Text style={styles.jobBannerSubtitle}>
                      {recommendation.opportunities.length} upsell mogelijkheden •
                      €{recommendation.totalPotentialValue} potentieel
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {recommendation?.opportunities.map(opp => (
              <OpportunityCard
                key={opp.id}
                opportunity={opp}
                onPresent={() => handlePresent(opp.id)}
                onAccept={() => handleAccept(opp.id)}
                onDecline={() => handleDecline(opp.id)}
              />
            ))}

            {!recommendation && (
              <View style={styles.emptyState}>
                <Ionicons name="bulb-outline" size={48} color={SemanticColors.textSecondary} />
                <Text style={styles.emptyText}>Geen actieve klus geselecteerd</Text>
                <Text style={styles.emptySubtext}>
                  Open een klus om upsell mogelijkheden te zien
                </Text>
              </View>
            )}
          </View>
        );

      case 'scripts':
        return (
          <View style={styles.tabContent}>
            <View style={styles.scriptsHeader}>
              <Text style={styles.scriptsTitle}>Verkoop Scripts</Text>
              <Text style={styles.scriptsSubtitle}>
                Bewezen scripts voor effectieve upselling
              </Text>
            </View>

            {[
              {
                title: 'Opening bij onderhoud',
                script: '"Tijdens het onderhoud is mij iets opgevallen wat ik graag met u wil bespreken..."',
                tip: 'Creëer nieuwsgierigheid, niet urgentie',
              },
              {
                title: 'Waarde benadrukken',
                script: '"Met deze upgrade bespaart u gemiddeld €X per jaar op uw energierekening"',
                tip: 'Focus op concrete besparingen',
              },
              {
                title: 'Sociale bewijsvoering',
                script: '"Veel van onze klanten in deze wijk hebben hier al voor gekozen"',
                tip: 'Gebruik lokale voorbeelden',
              },
              {
                title: 'Bezwaar: te duur',
                script: '"Ik begrijp dat het een investering is. Laten we eens kijken naar de terugverdientijd..."',
                tip: 'Erken het bezwaar, focus op lange termijn',
              },
            ].map((script, index) => (
              <View key={index} style={styles.scriptCard}>
                <Text style={styles.scriptTitle}>{script.title}</Text>
                <View style={styles.scriptQuote}>
                  <Text style={styles.scriptText}>{script.script}</Text>
                </View>
                <View style={styles.scriptTip}>
                  <Ionicons name="bulb" size={14} color={Palette.yellow600} />
                  <Text style={styles.scriptTipText}>{script.tip}</Text>
                </View>
              </View>
            ))}
          </View>
        );

      case 'performance':
        return (
          <View style={styles.tabContent}>
            <View style={styles.statsGrid}>
              <StatCard
                icon="megaphone-outline"
                label="Gepresenteerd"
                value={stats.presentedThisMonth}
                subtext="deze maand"
              />
              <StatCard
                icon="checkmark-circle-outline"
                label="Geaccepteerd"
                value={stats.acceptedThisMonth}
                subtext="deze maand"
              />
              <StatCard
                icon="cash-outline"
                label="Extra Omzet"
                value={`€${stats.revenueThisMonth.toLocaleString()}`}
                subtext="deze maand"
              />
              <StatCard
                icon="trending-up-outline"
                label="Acceptatiegraad"
                value={`${stats.avgAcceptanceRate}%`}
                subtext="gemiddeld"
              />
            </View>

            <View style={styles.chartSection}>
              <Text style={styles.sectionTitle}>Omzet Trend (6 maanden)</Text>
              <View style={styles.chartCard}>
                <PerformanceChart data={performance} />
              </View>
            </View>

            <View style={styles.topPerformersSection}>
              <Text style={styles.sectionTitle}>Top Presterende Upsells</Text>
              <View style={styles.topPerformersList}>
                {[
                  { name: 'Onderhoudscontract', rate: 45, revenue: 4500 },
                  { name: 'Slimme Thermostaat', rate: 35, revenue: 2800 },
                  { name: 'CO-melder', rate: 55, revenue: 1200 },
                  { name: 'Radiator Spoelen', rate: 30, revenue: 900 },
                ].map((item, index) => (
                  <View key={index} style={styles.topPerformerItem}>
                    <View style={styles.topPerformerRank}>
                      <Text style={styles.topPerformerRankText}>{index + 1}</Text>
                    </View>
                    <View style={styles.topPerformerInfo}>
                      <Text style={styles.topPerformerName}>{item.name}</Text>
                      <Text style={styles.topPerformerStats}>
                        {item.rate}% acceptatie • €{item.revenue} omzet
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Upsell Engine</Text>
        <View style={styles.todayStats}>
          <Ionicons name="flash" size={16} color={Palette.yellow500} />
          <Text style={styles.todayStatsText}>{stats.opportunitiesToday} kansen vandaag</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {[
          { key: 'opportunities', label: 'Kansen', icon: 'bulb-outline' },
          { key: 'scripts', label: 'Scripts', icon: 'document-text-outline' },
          { key: 'performance', label: 'Prestaties', icon: 'stats-chart-outline' },
        ].map(tab => (
          <TouchableOpacity
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
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  todayStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  todayStatsText: {
    fontSize: 13,
    fontWeight: '600',
    color: "#a16207",
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
    borderRadius: 8,
    backgroundColor: SemanticColors.surfaceBackground,
    gap: 6,
  },
  tabActive: {
    backgroundColor: SemanticColors.actionPrimary + '15',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
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
  activeJobBanner: {
    backgroundColor: SemanticColors.actionPrimary + '10',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.actionPrimary + '30',
  },
  jobBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  jobBannerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  jobBannerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  jobBannerSubtitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  opportunityCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  opportunityHeader: {
    marginBottom: 12,
  },
  opportunityInfo: {
    flex: 1,
  },
  opportunityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  opportunityTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  opportunityDescription: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    lineHeight: 20,
  },
  opportunityMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  metaLabel: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  probabilityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  probabilityBar: {
    width: 40,
    height: 6,
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 3,
    overflow: 'hidden',
  },
  probabilityFill: {
    height: '100%',
    borderRadius: 3,
  },
  probabilityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  timingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    backgroundColor: SemanticColors.surfaceBackground,
    padding: 12,
    borderRadius: 8,
  },
  timingText: {
    fontSize: 14,
    color: SemanticColors.textPrimary,
  },
  timingLabel: {
    fontWeight: '600',
  },
  talkingPointsSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 8,
  },
  talkingPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  talkingPointText: {
    fontSize: 14,
    color: SemanticColors.textPrimary,
    flex: 1,
  },
  objectionsSection: {
    marginBottom: 16,
  },
  objectionItem: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  objectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  objectionText: {
    flex: 1,
    fontSize: 14,
    color: Palette.orange700,
    fontWeight: '500',
  },
  responseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  responseText: {
    flex: 1,
    fontSize: 14,
    color: SemanticColors.textPrimary,
    fontStyle: 'italic',
  },
  toggleScriptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  toggleScriptText: {
    fontSize: 14,
    color: SemanticColors.actionPrimary,
    fontWeight: '500',
  },
  opportunityActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  presentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.actionPrimary,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  presentButtonText: {
    color: Palette.white,
    fontWeight: '600',
    fontSize: 15,
  },
  outcomeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  declineButton: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  acceptButton: {
    backgroundColor: Palette.green500,
  },
  outcomeButtonText: {
    fontWeight: '600',
    fontSize: 15,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: SemanticColors.textPrimary,
    fontWeight: '500',
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  scriptsHeader: {
    marginBottom: 20,
  },
  scriptsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  scriptsSubtitle: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  scriptCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  scriptTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 10,
  },
  scriptQuote: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: SemanticColors.actionPrimary,
    marginBottom: 10,
  },
  scriptText: {
    fontSize: 14,
    color: SemanticColors.textPrimary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  scriptTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scriptTipText: {
    fontSize: 13,
    color: "#a16207",
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SemanticColors.actionPrimary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  statLabel: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  statSubtext: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  chartSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 12,
  },
  chartCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  chartContainer: {
    height: 150,
  },
  chartBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 20,
  },
  chartBarWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarContainer: {
    width: 24,
    height: 100,
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: 4,
  },
  chartLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 6,
  },
  topPerformersSection: {
    marginBottom: 24,
  },
  topPerformersList: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  topPerformerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  topPerformerRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: SemanticColors.actionPrimary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  topPerformerRankText: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.actionPrimary,
  },
  topPerformerInfo: {
    flex: 1,
  },
  topPerformerName: {
    fontSize: 15,
    fontWeight: '500',
    color: SemanticColors.textPrimary,
  },
  topPerformerStats: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
});

export default UpsellEngine;
