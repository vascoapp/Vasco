// =============================================================================
// LEAD GENERATION COMPONENT
// =============================================================================
// Lead capture, scoring, and conversion tracking
// =============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Linking,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { formatCurrency } from '../../i18n/formatting';
import {
  useLeads,
  useLeadStats,
  Lead,
} from '../../services/leadGenerationService';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { useTranslation } from 'react-i18next';// =============================================================================
// TYPES
// =============================================================================

type TabType = 'leads' | 'hot' | 'stats';

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const LeadScoreBadge: React.FC<{ score: number }> = ({ score }) => {
  const getScoreColor = () => {
    if (score >= 80) return Palette.green500;
    if (score >= 60) return Palette.yellow500;
    if (score >= 40) return Palette.orange500;
    return Palette.gray400;
  };

  return (
    <View style={[styles.scoreBadge, { backgroundColor: getScoreColor() }]}>
      <Text style={styles.scoreText}>{score}</Text>
    </View>
  );
};

const StageBadge: React.FC<{ stage: Lead['status'] }> = ({ stage }) => {
  const getStageConfig = () => {
    switch (stage) {
      case 'new':
        return { label: 'Nieuw', color: Palette.blue500 };
      case 'contacted':
        return { label: 'Gecontacteerd', color: "#a855f7" };
      case 'qualified':
        return { label: 'Gekwalificeerd', color: Palette.yellow500 };
      case 'proposal_sent':
        return { label: 'Offerte', color: Palette.orange500 };
      case 'negotiating':
        return { label: 'Onderhandeling', color: '#a855f7' };
      case 'won':
        return { label: 'Gewonnen', color: Palette.green500 };
      case 'lost':
        return { label: 'Verloren', color: Palette.red500 };
      default:
        return { label: stage, color: Palette.gray500 };
    }
  };

  const config = getStageConfig();
  return (
    <View style={[styles.stageBadge, { backgroundColor: config.color + '20' }]}>
      <Text style={[styles.stageBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

const LeadCard: React.FC<{
  lead: Lead;
  onContact: () => void;
  onUpdateStage: (stage: Lead['status']) => void;
}> = ({ lead, onContact, onUpdateStage }) => {
  const [expanded, setExpanded] = useState(false);

  const getSourceIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (lead.source) {
      case 'website': return 'globe-outline';
      case 'referral': return 'people-outline';
      case 'google_ads': return 'search-outline';
      case 'social_media': return 'share-social-outline';
      case 'phone': return 'call-outline';
      default: return 'ellipse-outline';
    }
  };

  const daysSinceCreated = Math.floor(
    (Date.now() - lead.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Pressable
      style={styles.leadCard}
      onPress={() => setExpanded(!expanded)}
    >
      <View style={styles.leadHeader}>
        <View style={styles.leadInfo}>
          <View style={styles.leadTitleRow}>
            <Text style={styles.leadName}>{lead.customerInfo.name}</Text>
            <LeadScoreBadge score={lead.score} />
          </View>
          <View style={styles.leadMeta}>
            <Ionicons name={getSourceIcon()} size={14} color={SemanticColors.textSecondary} />
            <Text style={styles.leadMetaText}>{lead.source}</Text>
            <Text style={styles.leadMetaDot}>•</Text>
            <Text style={styles.leadMetaText}>{daysSinceCreated}d geleden</Text>
          </View>
        </View>
        <StageBadge stage={lead.status} />
      </View>

      <View style={styles.leadDetails}>
        <View style={styles.leadDetailRow}>
          <Ionicons name="construct-outline" size={16} color={SemanticColors.textSecondary} />
          <Text style={styles.leadDetailText}>{lead.requestType}</Text>
        </View>
        {lead.estimatedValue && (
          <View style={styles.leadDetailRow}>
            <Ionicons name="cash-outline" size={16} color={SemanticColors.textSecondary} />
            <Text style={styles.leadDetailText}>
              {formatCurrency(lead.estimatedValue)} geschat
            </Text>
          </View>
        )}
      </View>

      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.contactInfo}>
            {lead.customerInfo.email && (
              <View style={styles.contactRow}>
                <Ionicons name="mail-outline" size={16} color={SemanticColors.textSecondary} />
                <Text style={styles.contactText}>{lead.customerInfo.email}</Text>
              </View>
            )}
            <View style={styles.contactRow}>
              <Ionicons name="call-outline" size={16} color={SemanticColors.textSecondary} />
              <Text style={styles.contactText}>{lead.customerInfo.phone}</Text>
            </View>
            {(lead.customerInfo.address || lead.customerInfo.city) && (
            <View style={styles.contactRow}>
              <Ionicons name="location-outline" size={16} color={SemanticColors.textSecondary} />
              <Text style={styles.contactText}>{[lead.customerInfo.address, lead.customerInfo.city].filter(Boolean).join(', ')}</Text>
            </View>
            )}
          </View>

          {lead.description && (
            <View style={styles.notesSection}>
              <Text style={styles.notesLabel}>Notities:</Text>
              <Text style={styles.notesText}>{lead.description}</Text>
            </View>
          )}

          <View style={styles.leadActions}>
            <Pressable style={styles.actionButton} onPress={onContact}>
              <Ionicons name="call" size={18} color={Palette.white} />
              <Text style={styles.actionButtonText}>Bellen</Text>
            </Pressable>
            {lead.status === 'new' && (
              <Pressable
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={() => onUpdateStage('contacted')}
              >
                <Ionicons name="checkmark" size={18} color={SemanticColors.actionPrimary} />
                <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
                  Gecontacteerd
                </Text>
              </Pressable>
            )}
            {lead.status === 'contacted' && (
              <Pressable
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={() => onUpdateStage('qualified')}
              >
                <Ionicons name="star" size={18} color={SemanticColors.actionPrimary} />
                <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
                  Kwalificeer
                </Text>
              </Pressable>
            )}
            {(lead.status === 'qualified' || lead.status === 'negotiating') && (
              <Pressable
                style={[styles.actionButton, { backgroundColor: Palette.hermesOrange }]}
                onPress={() => onUpdateStage('proposal_sent')}
              >
                <Ionicons name="document-text" size={18} color={Palette.white} />
                <Text style={styles.actionButtonText}>Offerte maken</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </Pressable>
  );
};

const StatCard: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
}> = ({ icon, label, value, trend, trendUp }) => (
  <View style={styles.statCard}>
    <View style={styles.statHeader}>
      <View style={styles.statIconContainer}>
        <Ionicons name={icon} size={20} color={SemanticColors.actionPrimary} />
      </View>
      {trend && (
        <View style={[styles.trendBadge, { backgroundColor: trendUp ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)" }]}>
          <Ionicons
            name={trendUp ? 'trending-up' : 'trending-down'}
            size={12}
            color={trendUp ? Palette.green600 : Palette.red600}
          />
          <Text style={[styles.trendText, { color: trendUp ? Palette.green600 : Palette.red600 }]}>
            {trend}
          </Text>
        </View>
      )}
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const FunnelStage: React.FC<{
  label: string;
  count: number;
  percentage: number;
  color: string;
}> = ({ label, count, percentage, color }) => (
  <View style={styles.funnelStage}>
    <View style={styles.funnelInfo}>
      <Text style={styles.funnelLabel}>{label}</Text>
      <Text style={styles.funnelCount}>{count}</Text>
    </View>
    <View style={styles.funnelBarContainer}>
      <View style={[styles.funnelBar, { width: `${percentage}%`, backgroundColor: color }]} />
    </View>
  </View>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const LeadGeneration: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('leads');
  const [searchQuery, setSearchQuery] = useState('');
  const { leads, loading, updateStatus } = useLeads();
  const stats = useLeadStats();

  const filteredLeads = leads.filter(lead =>
    lead.customerInfo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.requestType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hotLeads = leads.filter(l => l.score >= 70 && l.status !== 'won' && l.status !== 'lost');

  const handleContact = (lead: Lead) => {
    Linking.openURL('tel:' + lead.customerInfo.phone);
  };

  const handleUpdateStage = (leadId: string, stage: Lead['status']) => {
    updateStatus(leadId, stage);
  };

  // Calculate funnel data
  const funnelData = [
    { label: 'Nieuw', count: leads.filter(l => l.status === 'new').length, color: Palette.blue500 },
    { label: 'Gecontacteerd', count: leads.filter(l => l.status === 'contacted').length, color: "#a855f7" },
    { label: 'Gekwalificeerd', count: leads.filter(l => l.status === 'qualified').length, color: Palette.yellow500 },
    { label: 'Offerte', count: leads.filter(l => l.status === 'proposal_sent').length, color: Palette.orange500 },
    { label: 'Gewonnen', count: leads.filter(l => l.status === 'won').length, color: Palette.green500 },
  ];
  const maxCount = Math.max(...funnelData.map(d => d.count), 1);

  const renderContent = () => {
    switch (activeTab) {
      case 'leads':
        return (
          <View style={styles.tabContent}>
            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={20} color={SemanticColors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Zoek leads..."
                placeholderTextColor={SemanticColors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>{t('common.loading', 'Loading...')}</Text>
              </View>
            ) : (
              filteredLeads.map(lead => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onContact={() => handleContact(lead)}
                  onUpdateStage={(stage) => handleUpdateStage(lead.id, stage)}
                />
              ))
            )}
          </View>
        );

      case 'hot':
        return (
          <View style={styles.tabContent}>
            <View style={styles.hotLeadsHeader}>
              <Ionicons name="flame" size={24} color={Palette.orange500} />
              <Text style={styles.hotLeadsTitle}>Hot Leads</Text>
              <Text style={styles.hotLeadsSubtitle}>Score 70+ • Actief in funnel</Text>
            </View>

            {hotLeads.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="leaf-outline" size={48} color={SemanticColors.textSecondary} />
                <Text style={styles.emptyText}>{t('leads.noHotLeads', 'No hot leads right now')}</Text>
              </View>
            ) : (
              hotLeads.map(lead => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onContact={() => handleContact(lead)}
                  onUpdateStage={(stage) => handleUpdateStage(lead.id, stage)}
                />
              ))
            )}
          </View>
        );

      case 'stats':
        return (
          <View style={styles.tabContent}>
            <View style={styles.statsGrid}>
              <StatCard
                icon="people-outline"
                label="Totaal Leads"
                value={stats.totalLeads}
              />
              <StatCard
                icon="flame-outline"
                label="Hot Leads"
                value={stats.hotLeads}
                trend="+15%"
                trendUp
              />
              <StatCard
                icon="trophy-outline"
                label="Conversie"
                value={`${stats.conversionRate}%`}
              />
              <StatCard
                icon="cash-outline"
                label="Gem. Waarde"
                value={formatCurrency(stats.totalLeads > 0 ? Math.round(stats.pipelineValue / stats.totalLeads) : 0)}
              />
            </View>

            <View style={styles.funnelSection}>
              <Text style={styles.sectionTitle}>Lead Funnel</Text>
              <View style={styles.funnelContainer}>
                {funnelData.map((stage, index) => (
                  <FunnelStage
                    key={index}
                    label={stage.label}
                    count={stage.count}
                    percentage={(stage.count / maxCount) * 100}
                    color={stage.color}
                  />
                ))}
              </View>
            </View>

            <View style={styles.sourcesSection}>
              <Text style={styles.sectionTitle}>Top Bronnen</Text>
              <View style={styles.sourcesList}>
                {[
                  { source: 'Google', leads: 12, icon: 'search-outline' },
                  { source: 'Verwijzingen', leads: 8, icon: 'people-outline' },
                  { source: 'Website', leads: 6, icon: 'globe-outline' },
                  { source: 'Social Media', leads: 4, icon: 'share-social-outline' },
                ].map((item, index) => (
                  <View key={index} style={styles.sourceItem}>
                    <View style={styles.sourceIconContainer}>
                      <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={18} color={SemanticColors.actionPrimary} />
                    </View>
                    <Text style={styles.sourceName}>{item.source}</Text>
                    <Text style={styles.sourceCount}>{item.leads} leads</Text>
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
        <Text style={styles.title}>Lead Generatie</Text>
        <Pressable style={styles.addButton}>
          <Ionicons name="add" size={24} color={Palette.white} />
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {[
          { key: 'leads', label: 'Alle Leads', icon: 'list-outline' },
          { key: 'hot', label: 'Hot', icon: 'flame-outline' },
          { key: 'stats', label: 'Statistieken', icon: 'stats-chart-outline' },
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SemanticColors.actionPrimary,
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
    borderRadius: 8,
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
    borderRadius: 12,
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
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.titleSize,
  },
  leadCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  leadInfo: {
    flex: 1,
  },
  leadTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leadName: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  scoreBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    color: Palette.white,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.sectionFamily,
  },
  leadMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  leadMetaText: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
  },
  leadMetaDot: {
    color: SemanticColors.textSecondary,
    marginHorizontal: 4,
  },
  stageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stageBadgeText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
  },
  leadDetails: {
    gap: 6,
  },
  leadDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leadDetailText: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
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
  notesSection: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  notesLabel: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
    marginBottom: 4,
  },
  notesText: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
  },
  leadActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.actionPrimary,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    color: Palette.white,
    fontFamily: TYPE.titleFamily,
    fontSize: TYPE.bodySize - 1,
  },
  secondaryButton: {
    backgroundColor: SemanticColors.actionPrimary + '15',
  },
  secondaryButtonText: {
    color: SemanticColors.actionPrimary,
  },
  hotLeadsHeader: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 16,
  },
  hotLeadsTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
    marginTop: 8,
  },
  hotLeadsSubtitle: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
    marginTop: 4,
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
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SemanticColors.actionPrimary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  trendText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
  },
  statValue: {
    fontSize: TYPE.displaySize - 4,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  statLabel: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  funnelSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginBottom: 16,
  },
  funnelContainer: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 12,
  },
  funnelStage: {
    gap: 4,
  },
  funnelInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  funnelLabel: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
  },
  funnelCount: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  funnelBarContainer: {
    height: 8,
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 4,
    overflow: 'hidden',
  },
  funnelBar: {
    height: '100%',
    borderRadius: 4,
  },
  sourcesSection: {
    marginBottom: 24,
  },
  sourcesList: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  sourceIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SemanticColors.actionPrimary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sourceName: {
    flex: 1,
    fontSize: TYPE.bodySize,
    color: SemanticColors.textPrimary,
  },
  sourceCount: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
  },
});

export default LeadGeneration;
