// =============================================================================
// CONTRACTOR NETWORK COMPONENT
// =============================================================================
// Network hub for contractor connections, referrals, and collaboration
// Enables network effects that increase platform value
// =============================================================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors } from '../../theme/colors';
import {
  useContractorNetwork,
  useReferrals,
  ContractorProfile,
  Referral,
} from '../../services/contractorNetworkService';

// ============================================
// MAIN COMPONENT
// ============================================

export function ContractorNetwork() {
  const [activeTab, setActiveTab] = useState<'network' | 'referrals' | 'discover'>('network');
  const [selectedContractor, setSelectedContractor] = useState<ContractorProfile | null>(null);
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [showSendReferral, setShowSendReferral] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    myConnections,
    pendingConnectionRequests,
    searchContractors,
    sendConnectionRequest,
    acceptConnectionRequest,
    declineConnectionRequest,
    isConnected,
    myStats,
    networkStats,
  } = useContractorNetwork();

  const {
    referrals,
    pendingCount,
    acceptReferral,
    declineReferral,
  } = useReferrals();

  const searchResults = useMemo(() => {
    if (!searchQuery && activeTab !== 'discover') return [];
    return searchContractors({
      query: searchQuery || undefined,
      available: activeTab === 'discover' ? true : undefined,
    });
  }, [searchQuery, activeTab, searchContractors]);

  const tabs = [
    {
      key: 'network' as const,
      label: 'Netwerk',
      icon: 'people-outline' as const,
      badge: pendingConnectionRequests.length > 0 ? pendingConnectionRequests.length : undefined,
    },
    {
      key: 'referrals' as const,
      label: 'Referrals',
      icon: 'swap-horizontal-outline' as const,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    {
      key: 'discover' as const,
      label: 'Ontdek',
      icon: 'compass-outline' as const,
    },
  ];

  return (
    <View style={styles.container}>
      {/* Stats Header */}
      <View style={styles.statsHeader}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{myStats.connectionCount}</Text>
          <Text style={styles.statLabel}>Connecties</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{myStats.referralsSent + myStats.referralsReceived}</Text>
          <Text style={styles.statLabel}>Referrals</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: SemanticColors.feedbackSuccess }]}>
            €{myStats.totalEarnedFromReferrals.toLocaleString('nl-NL')}
          </Text>
          <Text style={styles.statLabel}>Verdiend</Text>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={20}
              color={activeTab === tab.key ? SemanticColors.actionPrimary : SemanticColors.textSecondary}
            />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {tab.badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{tab.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Search (for discover tab) */}
      {activeTab === 'discover' && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={SemanticColors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Zoek op naam, vak of regio..."
            placeholderTextColor={SemanticColors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={SemanticColors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'network' && (
          <NetworkTab
            connections={myConnections}
            pendingRequests={pendingConnectionRequests}
            onSelectContractor={setSelectedContractor}
            onAcceptRequest={acceptConnectionRequest}
            onDeclineRequest={declineConnectionRequest}
          />
        )}
        {activeTab === 'referrals' && (
          <ReferralsTab
            referrals={referrals}
            onSelectReferral={setSelectedReferral}
            onAcceptReferral={acceptReferral}
            onDeclineReferral={declineReferral}
            onSendReferral={() => setShowSendReferral(true)}
          />
        )}
        {activeTab === 'discover' && (
          <DiscoverTab
            contractors={searchResults}
            networkStats={networkStats}
            onSelectContractor={setSelectedContractor}
            isConnected={isConnected}
            onConnect={sendConnectionRequest}
          />
        )}
      </ScrollView>

      {/* Contractor Profile Modal */}
      <Modal
        visible={!!selectedContractor}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedContractor(null)}
      >
        {selectedContractor && (
          <ContractorProfileModal
            contractor={selectedContractor}
            isConnected={isConnected(selectedContractor.id)}
            onConnect={() => {
              sendConnectionRequest(selectedContractor.id);
              Alert.alert('Verzoek verzonden', 'Je connectieverzoek is verzonden.');
            }}
            onSendReferral={() => {
              setSelectedContractor(null);
              setShowSendReferral(true);
            }}
            onClose={() => setSelectedContractor(null)}
          />
        )}
      </Modal>

      {/* Referral Detail Modal */}
      <Modal
        visible={!!selectedReferral}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedReferral(null)}
      >
        {selectedReferral && (
          <ReferralDetailModal
            referral={selectedReferral}
            onAccept={() => {
              acceptReferral(selectedReferral.id);
              setSelectedReferral(null);
            }}
            onDecline={() => {
              declineReferral(selectedReferral.id);
              setSelectedReferral(null);
            }}
            onClose={() => setSelectedReferral(null)}
          />
        )}
      </Modal>

      {/* Send Referral Modal */}
      <Modal
        visible={showSendReferral}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSendReferral(false)}
      >
        <SendReferralModal
          connections={myConnections}
          onClose={() => setShowSendReferral(false)}
        />
      </Modal>
    </View>
  );
}

// ============================================
// TAB COMPONENTS
// ============================================

function NetworkTab({
  connections,
  pendingRequests,
  onSelectContractor,
  onAcceptRequest,
  onDeclineRequest,
}: {
  connections: ContractorProfile[];
  pendingRequests: Array<{ id: string; fromContractorId: string; fromContractorName: string; message?: string }>;
  onSelectContractor: (c: ContractorProfile) => void;
  onAcceptRequest: (id: string) => void;
  onDeclineRequest: (id: string) => void;
}) {
  return (
    <View style={styles.tabContent}>
      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Connectieverzoeken</Text>
          {pendingRequests.map((request) => (
            <View key={request.id} style={styles.requestCard}>
              <View style={styles.requestAvatar}>
                <Text style={styles.avatarText}>
                  {request.fromContractorName.charAt(0)}
                </Text>
              </View>
              <View style={styles.requestInfo}>
                <Text style={styles.requestName}>{request.fromContractorName}</Text>
                {request.message && (
                  <Text style={styles.requestMessage} numberOfLines={2}>
                    {request.message}
                  </Text>
                )}
              </View>
              <View style={styles.requestActions}>
                <TouchableOpacity
                  style={styles.declineButton}
                  onPress={() => onDeclineRequest(request.id)}
                >
                  <Ionicons name="close" size={20} color={SemanticColors.feedbackError} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => onAcceptRequest(request.id)}
                >
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Connections */}
      <Text style={styles.sectionTitle}>Mijn Connecties ({connections.length})</Text>
      {connections.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color={SemanticColors.textSecondary} />
          <Text style={styles.emptyTitle}>Nog geen connecties</Text>
          <Text style={styles.emptyText}>
            Ontdek vakgenoten en bouw je netwerk op via de Ontdek tab.
          </Text>
        </View>
      ) : (
        <View style={styles.connectionsGrid}>
          {connections.map((contractor) => (
            <TouchableOpacity
              key={contractor.id}
              style={styles.connectionCard}
              onPress={() => onSelectContractor(contractor)}
            >
              <View style={styles.connectionAvatar}>
                <Text style={styles.avatarText}>{contractor.name.charAt(0)}</Text>
                {contractor.verified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={SemanticColors.actionPrimary} />
                  </View>
                )}
              </View>
              <Text style={styles.connectionName} numberOfLines={1}>
                {contractor.name}
              </Text>
              <Text style={styles.connectionSkill}>{contractor.primarySkill}</Text>
              <View style={styles.connectionRating}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text style={styles.connectionRatingText}>{contractor.rating}</Text>
              </View>
              <View style={[
                styles.availabilityIndicator,
                { backgroundColor: contractor.availability === 'available' ? SemanticColors.feedbackSuccess : '#FF9500' }
              ]} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function ReferralsTab({
  referrals,
  onSelectReferral,
  onAcceptReferral,
  onDeclineReferral,
  onSendReferral,
}: {
  referrals: Referral[];
  onSelectReferral: (r: Referral) => void;
  onAcceptReferral: (id: string) => void;
  onDeclineReferral: (id: string) => void;
  onSendReferral: () => void;
}) {
  const pending = referrals.filter((r) => r.toContractorId === 'me' && r.status === 'pending');
  const active = referrals.filter((r) => r.status === 'accepted');
  const history = referrals.filter((r) => r.status === 'completed' || r.status === 'declined');

  return (
    <View style={styles.tabContent}>
      {/* Send Referral CTA */}
      <TouchableOpacity style={styles.sendReferralCta} onPress={onSendReferral}>
        <View style={styles.ctaIcon}>
          <Ionicons name="paper-plane" size={24} color={SemanticColors.actionPrimary} />
        </View>
        <View style={styles.ctaContent}>
          <Text style={styles.ctaTitle}>Stuur een referral</Text>
          <Text style={styles.ctaSubtitle}>Help een klant aan de juiste vakman</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color={SemanticColors.textSecondary} />
      </TouchableOpacity>

      {/* Pending Referrals */}
      {pending.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Nieuwe Referrals</Text>
          {pending.map((referral) => (
            <ReferralCard
              key={referral.id}
              referral={referral}
              onPress={() => onSelectReferral(referral)}
              showActions
              onAccept={() => onAcceptReferral(referral.id)}
              onDecline={() => onDeclineReferral(referral.id)}
            />
          ))}
        </>
      )}

      {/* Active Referrals */}
      {active.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Actieve Referrals</Text>
          {active.map((referral) => (
            <ReferralCard
              key={referral.id}
              referral={referral}
              onPress={() => onSelectReferral(referral)}
            />
          ))}
        </>
      )}

      {/* History */}
      {history.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Geschiedenis</Text>
          {history.slice(0, 5).map((referral) => (
            <ReferralCard
              key={referral.id}
              referral={referral}
              onPress={() => onSelectReferral(referral)}
              compact
            />
          ))}
        </>
      )}

      {referrals.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="swap-horizontal" size={48} color={SemanticColors.textSecondary} />
          <Text style={styles.emptyTitle}>Geen referrals</Text>
          <Text style={styles.emptyText}>
            Start met het doorverwijzen van klanten naar vakgenoten in je netwerk.
          </Text>
        </View>
      )}
    </View>
  );
}

function ReferralCard({
  referral,
  onPress,
  showActions,
  onAccept,
  onDecline,
  compact,
}: {
  referral: Referral;
  onPress: () => void;
  showActions?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  compact?: boolean;
}) {
  const isReceived = referral.toContractorId === 'me';
  const otherParty = isReceived ? referral.fromContractorName : referral.toContractorName;

  const getStatusColor = (status: Referral['status']) => {
    switch (status) {
      case 'pending': return SemanticColors.feedbackWarning;
      case 'accepted': return SemanticColors.actionPrimary;
      case 'completed': return SemanticColors.feedbackSuccess;
      case 'declined': return SemanticColors.feedbackError;
      default: return SemanticColors.textSecondary;
    }
  };

  const getStatusLabel = (status: Referral['status']) => {
    switch (status) {
      case 'pending': return 'Nieuw';
      case 'accepted': return 'Actief';
      case 'completed': return 'Afgerond';
      case 'declined': return 'Afgewezen';
      case 'expired': return 'Verlopen';
      default: return status;
    }
  };

  if (compact) {
    return (
      <TouchableOpacity style={styles.referralCardCompact} onPress={onPress}>
        <View style={[styles.referralDirection, { backgroundColor: isReceived ? SemanticColors.feedbackSuccess + '20' : SemanticColors.actionPrimary + '20' }]}>
          <Ionicons
            name={isReceived ? 'arrow-down' : 'arrow-up'}
            size={16}
            color={isReceived ? SemanticColors.feedbackSuccess : SemanticColors.actionPrimary}
          />
        </View>
        <View style={styles.referralCompactInfo}>
          <Text style={styles.referralCompactCustomer}>{referral.customerName}</Text>
          <Text style={styles.referralCompactMeta}>
            {otherParty} • {referral.jobType}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(referral.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(referral.status) }]}>
            {getStatusLabel(referral.status)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.referralCard} onPress={onPress}>
      <View style={styles.referralHeader}>
        <View style={[styles.referralDirection, { backgroundColor: isReceived ? SemanticColors.feedbackSuccess + '20' : SemanticColors.actionPrimary + '20' }]}>
          <Ionicons
            name={isReceived ? 'arrow-down' : 'arrow-up'}
            size={20}
            color={isReceived ? SemanticColors.feedbackSuccess : SemanticColors.actionPrimary}
          />
        </View>
        <View style={styles.referralInfo}>
          <Text style={styles.referralCustomer}>{referral.customerName}</Text>
          <Text style={styles.referralMeta}>
            {isReceived ? 'Van' : 'Naar'} {otherParty}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(referral.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(referral.status) }]}>
            {getStatusLabel(referral.status)}
          </Text>
        </View>
      </View>

      <View style={styles.referralDetails}>
        <View style={styles.referralDetail}>
          <Ionicons name="construct-outline" size={16} color={SemanticColors.textSecondary} />
          <Text style={styles.referralDetailText}>{referral.jobType}</Text>
        </View>
        <View style={styles.referralDetail}>
          <Ionicons name="location-outline" size={16} color={SemanticColors.textSecondary} />
          <Text style={styles.referralDetailText}>{referral.location}</Text>
        </View>
        <View style={styles.referralDetail}>
          <Ionicons name="cash-outline" size={16} color={SemanticColors.textSecondary} />
          <Text style={styles.referralDetailText}>
            €{referral.estimatedValue.toLocaleString('nl-NL')}
          </Text>
        </View>
      </View>

      {showActions && (
        <View style={styles.referralActions}>
          <TouchableOpacity
            style={styles.referralDeclineButton}
            onPress={(e) => { e.stopPropagation(); onDecline?.(); }}
          >
            <Text style={styles.referralDeclineText}>Afwijzen</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.referralAcceptButton}
            onPress={(e) => { e.stopPropagation(); onAccept?.(); }}
          >
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
            <Text style={styles.referralAcceptText}>Accepteren</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

function DiscoverTab({
  contractors,
  networkStats,
  onSelectContractor,
  isConnected,
  onConnect,
}: {
  contractors: ContractorProfile[];
  networkStats: {
    totalContractors: number;
    topSkills: Array<{ skill: string; count: number }>;
    topRegions: Array<{ region: string; count: number }>;
  };
  onSelectContractor: (c: ContractorProfile) => void;
  isConnected: (id: string) => boolean;
  onConnect: (id: string, message?: string) => void;
}) {
  return (
    <View style={styles.tabContent}>
      {/* Network Overview */}
      <View style={styles.networkOverview}>
        <Text style={styles.networkOverviewTitle}>Vasco Netwerk</Text>
        <Text style={styles.networkOverviewSubtitle}>
          {networkStats.totalContractors} vakmannen in Nederland
        </Text>
        <View style={styles.skillTags}>
          {networkStats.topSkills.slice(0, 4).map((skill) => (
            <View key={skill.skill} style={styles.skillTag}>
              <Text style={styles.skillTagText}>{skill.skill}</Text>
              <Text style={styles.skillTagCount}>{skill.count}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Contractor List */}
      {contractors.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Resultaten ({contractors.length})</Text>
          {contractors.map((contractor) => (
            <ContractorListItem
              key={contractor.id}
              contractor={contractor}
              onPress={() => onSelectContractor(contractor)}
              isConnected={isConnected(contractor.id)}
              onConnect={() => {
                onConnect(contractor.id);
                Alert.alert('Verzoek verzonden', 'Je connectieverzoek is verzonden.');
              }}
            />
          ))}
        </>
      ) : (
        <View style={styles.discoverPrompt}>
          <Ionicons name="search" size={48} color={SemanticColors.textSecondary} />
          <Text style={styles.discoverPromptTitle}>Zoek vakgenoten</Text>
          <Text style={styles.discoverPromptText}>
            Zoek op naam, vak (bijv. "loodgieter") of regio om vakgenoten te vinden.
          </Text>
        </View>
      )}
    </View>
  );
}

function ContractorListItem({
  contractor,
  onPress,
  isConnected,
  onConnect,
}: {
  contractor: ContractorProfile;
  onPress: () => void;
  isConnected: boolean;
  onConnect: () => void;
}) {
  return (
    <TouchableOpacity style={styles.contractorListItem} onPress={onPress}>
      <View style={styles.contractorAvatar}>
        <Text style={styles.avatarText}>{contractor.name.charAt(0)}</Text>
        {contractor.verified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={14} color={SemanticColors.actionPrimary} />
          </View>
        )}
      </View>

      <View style={styles.contractorInfo}>
        <View style={styles.contractorNameRow}>
          <Text style={styles.contractorName}>{contractor.name}</Text>
          {contractor.premiumMember && (
            <Ionicons name="diamond" size={14} color="#FFD700" />
          )}
        </View>
        <Text style={styles.contractorCompany}>{contractor.companyName}</Text>
        <View style={styles.contractorMeta}>
          <Text style={styles.contractorSkill}>{contractor.primarySkill}</Text>
          <Text style={styles.contractorDot}>•</Text>
          <Text style={styles.contractorLocation}>{contractor.city}</Text>
          <Text style={styles.contractorDot}>•</Text>
          <View style={styles.contractorRating}>
            <Ionicons name="star" size={12} color="#FFD700" />
            <Text style={styles.contractorRatingText}>{contractor.rating}</Text>
          </View>
        </View>
      </View>

      {isConnected ? (
        <View style={styles.connectedBadge}>
          <Ionicons name="checkmark-circle" size={20} color={SemanticColors.feedbackSuccess} />
        </View>
      ) : (
        <TouchableOpacity
          style={styles.connectButton}
          onPress={(e) => { e.stopPropagation(); onConnect(); }}
        >
          <Ionicons name="person-add" size={18} color={SemanticColors.actionPrimary} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ============================================
// MODALS
// ============================================

function ContractorProfileModal({
  contractor,
  isConnected,
  onConnect,
  onSendReferral,
  onClose,
}: {
  contractor: ContractorProfile;
  isConnected: boolean;
  onConnect: () => void;
  onSendReferral: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <TouchableOpacity style={styles.modalClose} onPress={onClose}>
          <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
        </TouchableOpacity>

        <ScrollView style={styles.modalBody}>
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{contractor.name.charAt(0)}</Text>
              {contractor.verified && (
                <View style={styles.profileVerified}>
                  <Ionicons name="checkmark-circle" size={24} color={SemanticColors.actionPrimary} />
                </View>
              )}
            </View>
            <Text style={styles.profileName}>{contractor.name}</Text>
            {contractor.companyName && (
              <Text style={styles.profileCompany}>{contractor.companyName}</Text>
            )}
            <View style={styles.profileLocation}>
              <Ionicons name="location" size={16} color={SemanticColors.textSecondary} />
              <Text style={styles.profileLocationText}>
                {contractor.city}, {contractor.region}
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.profileStats}>
            <View style={styles.profileStat}>
              <View style={styles.profileStatRow}>
                <Ionicons name="star" size={18} color="#FFD700" />
                <Text style={styles.profileStatValue}>{contractor.rating}</Text>
              </View>
              <Text style={styles.profileStatLabel}>{contractor.reviewCount} reviews</Text>
            </View>
            <View style={styles.profileStatDivider} />
            <View style={styles.profileStat}>
              <Text style={styles.profileStatValue}>{contractor.completedJobs}</Text>
              <Text style={styles.profileStatLabel}>Klussen</Text>
            </View>
            <View style={styles.profileStatDivider} />
            <View style={styles.profileStat}>
              <Text style={styles.profileStatValue}>{contractor.yearsExperience}j</Text>
              <Text style={styles.profileStatLabel}>Ervaring</Text>
            </View>
          </View>

          {/* Skills */}
          <View style={styles.profileSection}>
            <Text style={styles.profileSectionTitle}>Specialisaties</Text>
            <View style={styles.profileSkills}>
              {contractor.skills.map((skill) => (
                <View key={skill} style={styles.profileSkillChip}>
                  <Text style={styles.profileSkillText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Certifications */}
          {contractor.certifications.length > 0 && (
            <View style={styles.profileSection}>
              <Text style={styles.profileSectionTitle}>Certificeringen</Text>
              {contractor.certifications.map((cert) => (
                <View key={cert} style={styles.certificationItem}>
                  <Ionicons name="ribbon" size={18} color={SemanticColors.actionPrimary} />
                  <Text style={styles.certificationText}>{cert}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Referral Info */}
          {contractor.acceptsReferrals && (
            <View style={styles.profileSection}>
              <Text style={styles.profileSectionTitle}>Referral Info</Text>
              <View style={styles.referralInfo}>
                <View style={styles.referralInfoRow}>
                  <Text style={styles.referralInfoLabel}>Referral score</Text>
                  <Text style={styles.referralInfoValue}>{contractor.referralScore}/100</Text>
                </View>
                <View style={styles.referralInfoRow}>
                  <Text style={styles.referralInfoLabel}>Responstijd</Text>
                  <Text style={styles.referralInfoValue}>{contractor.responseTime}u gemiddeld</Text>
                </View>
                <View style={styles.referralInfoRow}>
                  <Text style={styles.referralInfoLabel}>Referrals ontvangen</Text>
                  <Text style={styles.referralInfoValue}>{contractor.referralsReceived}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Availability */}
          <View style={styles.profileSection}>
            <Text style={styles.profileSectionTitle}>Beschikbaarheid</Text>
            <View style={styles.availabilityRow}>
              <View style={[
                styles.availabilityDot,
                { backgroundColor: contractor.availability === 'available' ? SemanticColors.feedbackSuccess : '#FF9500' }
              ]} />
              <Text style={styles.availabilityText}>
                {contractor.availability === 'available'
                  ? 'Beschikbaar voor nieuwe projecten'
                  : contractor.availability === 'busy'
                  ? `Druk bezet, weer beschikbaar ${contractor.nextAvailableDate ? `vanaf ${new Date(contractor.nextAvailableDate).toLocaleDateString('nl-NL')}` : 'binnenkort'}`
                  : 'Momenteel niet beschikbaar'}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Actions */}
        <View style={styles.profileActions}>
          {isConnected ? (
            <TouchableOpacity style={styles.sendReferralButton} onPress={onSendReferral}>
              <Ionicons name="paper-plane" size={20} color="#FFFFFF" />
              <Text style={styles.sendReferralText}>Referral sturen</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.connectProfileButton} onPress={onConnect}>
              <Ionicons name="person-add" size={20} color="#FFFFFF" />
              <Text style={styles.connectProfileText}>Verbinden</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

function ReferralDetailModal({
  referral,
  onAccept,
  onDecline,
  onClose,
}: {
  referral: Referral;
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
}) {
  const isReceived = referral.toContractorId === 'me';
  const isPending = referral.status === 'pending' && isReceived;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Referral Details</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody}>
          {/* Direction */}
          <View style={styles.referralDetailHeader}>
            <View style={[styles.referralDirectionLarge, { backgroundColor: isReceived ? SemanticColors.feedbackSuccess + '20' : SemanticColors.actionPrimary + '20' }]}>
              <Ionicons
                name={isReceived ? 'arrow-down' : 'arrow-up'}
                size={32}
                color={isReceived ? SemanticColors.feedbackSuccess : SemanticColors.actionPrimary}
              />
            </View>
            <Text style={styles.referralDetailDirection}>
              {isReceived ? 'Ontvangen van' : 'Verstuurd naar'}
            </Text>
            <Text style={styles.referralDetailParty}>
              {isReceived ? referral.fromContractorName : referral.toContractorName}
            </Text>
          </View>

          {/* Customer Info */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Klantgegevens</Text>
            <View style={styles.detailRow}>
              <Ionicons name="person" size={18} color={SemanticColors.textSecondary} />
              <Text style={styles.detailText}>{referral.customerName}</Text>
            </View>
            {referral.customerContact && (
              <View style={styles.detailRow}>
                <Ionicons name="call" size={18} color={SemanticColors.textSecondary} />
                <Text style={styles.detailText}>{referral.customerContact}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Ionicons name="location" size={18} color={SemanticColors.textSecondary} />
              <Text style={styles.detailText}>{referral.location}</Text>
            </View>
          </View>

          {/* Job Info */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Opdracht</Text>
            <View style={styles.detailRow}>
              <Ionicons name="construct" size={18} color={SemanticColors.textSecondary} />
              <Text style={styles.detailText}>{referral.jobType}</Text>
            </View>
            <Text style={styles.jobDescription}>{referral.jobDescription}</Text>
            <View style={styles.valueRow}>
              <Text style={styles.valueLabel}>Geschatte waarde</Text>
              <Text style={styles.valueAmount}>€{referral.estimatedValue.toLocaleString('nl-NL')}</Text>
            </View>
          </View>

          {/* Commission Info */}
          {referral.status === 'completed' && (
            <View style={styles.commissionBox}>
              <Ionicons name="cash" size={24} color={SemanticColors.feedbackSuccess} />
              <View style={styles.commissionContent}>
                <Text style={styles.commissionTitle}>
                  {isReceived ? 'Commissie betaald' : 'Commissie ontvangen'}
                </Text>
                <Text style={styles.commissionAmount}>€{referral.commission?.toFixed(2)}</Text>
              </View>
            </View>
          )}

          {/* Feedback */}
          {referral.senderFeedback && (
            <View style={styles.feedbackSection}>
              <Text style={styles.feedbackTitle}>Feedback</Text>
              <View style={styles.feedbackCard}>
                <View style={styles.feedbackRating}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name={star <= (referral.senderRating || 0) ? 'star' : 'star-outline'}
                      size={18}
                      color="#FFD700"
                    />
                  ))}
                </View>
                <Text style={styles.feedbackText}>"{referral.senderFeedback}"</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Actions */}
        {isPending && (
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalDeclineButton} onPress={onDecline}>
              <Text style={styles.modalDeclineText}>Afwijzen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalAcceptButton} onPress={onAccept}>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              <Text style={styles.modalAcceptText}>Accepteren</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

function SendReferralModal({
  connections,
  onClose,
}: {
  connections: ContractorProfile[];
  onClose: () => void;
}) {
  const { sendReferral } = useReferrals();
  const [selectedContractor, setSelectedContractor] = useState<ContractorProfile | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [jobType, setJobType] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [location, setLocation] = useState('');

  const handleSend = () => {
    if (!selectedContractor || !customerName || !jobType || !estimatedValue || !location) {
      Alert.alert('Vul alle velden in', 'Alle velden zijn verplicht om een referral te versturen.');
      return;
    }

    sendReferral({
      toContractorId: selectedContractor.id,
      customerName,
      jobType,
      jobDescription,
      estimatedValue: parseFloat(estimatedValue),
      location,
    });

    Alert.alert('Referral verstuurd!', `Je referral is verstuurd naar ${selectedContractor.name}.`);
    onClose();
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.sendReferralModal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Referral versturen</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody}>
          {/* Select Contractor */}
          <Text style={styles.fieldLabel}>Naar wie?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.contractorSelect}>
            {connections.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.contractorSelectItem,
                  selectedContractor?.id === c.id && styles.contractorSelectItemActive,
                ]}
                onPress={() => setSelectedContractor(c)}
              >
                <View style={styles.contractorSelectAvatar}>
                  <Text style={styles.avatarText}>{c.name.charAt(0)}</Text>
                </View>
                <Text style={styles.contractorSelectName} numberOfLines={1}>{c.name}</Text>
                <Text style={styles.contractorSelectSkill}>{c.primarySkill}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Customer Info */}
          <Text style={styles.fieldLabel}>Klantnaam</Text>
          <TextInput
            style={styles.input}
            placeholder="Naam van de klant"
            value={customerName}
            onChangeText={setCustomerName}
            placeholderTextColor={SemanticColors.textSecondary}
          />

          <Text style={styles.fieldLabel}>Type werk</Text>
          <TextInput
            style={styles.input}
            placeholder="Bijv. Badkamer renovatie"
            value={jobType}
            onChangeText={setJobType}
            placeholderTextColor={SemanticColors.textSecondary}
          />

          <Text style={styles.fieldLabel}>Omschrijving</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Beschrijf het werk..."
            value={jobDescription}
            onChangeText={setJobDescription}
            multiline
            numberOfLines={3}
            placeholderTextColor={SemanticColors.textSecondary}
          />

          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Text style={styles.fieldLabel}>Geschatte waarde (€)</Text>
              <TextInput
                style={styles.input}
                placeholder="2500"
                value={estimatedValue}
                onChangeText={setEstimatedValue}
                keyboardType="numeric"
                placeholderTextColor={SemanticColors.textSecondary}
              />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.fieldLabel}>Locatie</Text>
              <TextInput
                style={styles.input}
                placeholder="Amsterdam"
                value={location}
                onChangeText={setLocation}
                placeholderTextColor={SemanticColors.textSecondary}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.sendReferralActions}>
          <TouchableOpacity style={styles.cancelSendButton} onPress={onClose}>
            <Text style={styles.cancelSendText}>Annuleren</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmSendButton} onPress={handleSend}>
            <Ionicons name="paper-plane" size={20} color="#FFFFFF" />
            <Text style={styles.confirmSendText}>Versturen</Text>
          </TouchableOpacity>
        </View>
      </View>
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

  // Stats Header
  statsHeader: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceBackground,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginVertical: 8,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceBackground,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: SemanticColors.actionPrimary,
  },
  tabLabel: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  tabLabelActive: {
    color: SemanticColors.actionPrimary,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: SemanticColors.feedbackError,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceBackground,
    margin: 16,
    marginBottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: SemanticColors.textPrimary,
  },

  // Content
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },

  // Section
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 12,
    marginTop: 8,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },

  // Connection Request Card
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  requestAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SemanticColors.actionPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  requestMessage: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  declineButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SemanticColors.feedbackError + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SemanticColors.feedbackSuccess,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Connections Grid
  connectionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  connectionCard: {
    width: '47%',
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    position: 'relative',
  },
  connectionAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SemanticColors.actionPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 8,
  },
  connectionName: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    textAlign: 'center',
  },
  connectionSkill: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  connectionRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  connectionRatingText: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  availabilityIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // Send Referral CTA
  sendReferralCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.actionPrimary + '10',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.actionPrimary + '30',
  },
  ctaIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SemanticColors.actionPrimary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  ctaContent: {
    flex: 1,
  },
  ctaTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  ctaSubtitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // Referral Card
  referralCard: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  referralCardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  referralHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  referralDirection: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  referralInfo: {
    flex: 1,
  },
  referralCustomer: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  referralMeta: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  referralCompactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  referralCompactCustomer: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  referralCompactMeta: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  referralDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
  },
  referralDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  referralDetailText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  referralActions: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    paddingTop: 12,
  },
  referralDeclineButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: SemanticColors.surfaceBackground,
    alignItems: 'center',
  },
  referralDeclineText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  referralAcceptButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: SemanticColors.feedbackSuccess,
  },
  referralAcceptText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Discover Tab
  networkOverview: {
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  networkOverviewTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  networkOverviewSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  skillTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  skillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  skillTagText: {
    fontSize: 13,
    color: '#FFFFFF',
  },
  skillTagCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  discoverPrompt: {
    alignItems: 'center',
    padding: 32,
  },
  discoverPromptTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginTop: 16,
  },
  discoverPromptText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },

  // Contractor List Item
  contractorListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  contractorAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: SemanticColors.actionPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  contractorInfo: {
    flex: 1,
  },
  contractorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contractorName: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  contractorCompany: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  contractorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  contractorSkill: {
    fontSize: 12,
    color: SemanticColors.actionPrimary,
    fontWeight: '500',
  },
  contractorDot: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginHorizontal: 6,
  },
  contractorLocation: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  contractorRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  contractorRatingText: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  connectedBadge: {
    padding: 8,
  },
  connectButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SemanticColors.actionPrimary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  modalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 8,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  modalDeclineButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: SemanticColors.surfaceBackground,
    alignItems: 'center',
  },
  modalDeclineText: {
    fontSize: 16,
    color: SemanticColors.textSecondary,
  },
  modalAcceptButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: SemanticColors.feedbackSuccess,
  },
  modalAcceptText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Profile Modal
  profileHeader: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 20,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: SemanticColors.actionPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  profileAvatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  profileVerified: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 12,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  profileCompany: {
    fontSize: 15,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  profileLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  profileLocationText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  profileStats: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  profileStat: {
    flex: 1,
    alignItems: 'center',
  },
  profileStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  profileStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  profileStatLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  profileStatDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginHorizontal: 12,
  },
  profileSection: {
    marginBottom: 20,
  },
  profileSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 12,
  },
  profileSkills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  profileSkillChip: {
    backgroundColor: SemanticColors.actionPrimary + '15',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  profileSkillText: {
    fontSize: 14,
    color: SemanticColors.actionPrimary,
    fontWeight: '500',
  },
  certificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  certificationText: {
    fontSize: 14,
    color: SemanticColors.textPrimary,
  },
  referralInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  referralInfoLabel: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  referralInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  availabilityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  availabilityText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    flex: 1,
  },
  profileActions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  sendReferralButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SemanticColors.actionPrimary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  sendReferralText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  connectProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SemanticColors.actionPrimary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  connectProfileText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Referral Detail Modal
  referralDetailHeader: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  referralDirectionLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  referralDetailDirection: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  referralDetailParty: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginTop: 4,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  detailText: {
    fontSize: 15,
    color: SemanticColors.textPrimary,
  },
  jobDescription: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceBackground,
    padding: 16,
    borderRadius: 10,
  },
  valueLabel: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  valueAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  commissionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.feedbackSuccess + '15',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 20,
  },
  commissionContent: {
    flex: 1,
  },
  commissionTitle: {
    fontSize: 14,
    color: SemanticColors.feedbackSuccess,
  },
  commissionAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
    marginTop: 2,
  },
  feedbackSection: {
    marginBottom: 20,
  },
  feedbackTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 12,
  },
  feedbackCard: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 12,
    padding: 16,
  },
  feedbackRating: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  feedbackText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },

  // Send Referral Modal
  sendReferralModal: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 8,
    marginTop: 16,
  },
  contractorSelect: {
    marginBottom: 8,
  },
  contractorSelectItem: {
    alignItems: 'center',
    padding: 12,
    marginRight: 12,
    borderRadius: 12,
    backgroundColor: SemanticColors.surfaceBackground,
    width: 100,
  },
  contractorSelectItemActive: {
    backgroundColor: SemanticColors.actionPrimary + '20',
    borderWidth: 2,
    borderColor: SemanticColors.actionPrimary,
  },
  contractorSelectAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SemanticColors.actionPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  contractorSelectName: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    textAlign: 'center',
  },
  contractorSelectSkill: {
    fontSize: 10,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  input: {
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: SemanticColors.textPrimary,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputHalf: {
    flex: 1,
  },
  sendReferralActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  cancelSendButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  cancelSendText: {
    fontSize: 16,
    color: SemanticColors.textSecondary,
  },
  confirmSendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: SemanticColors.actionPrimary,
  },
  confirmSendText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ContractorNetwork;
