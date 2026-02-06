// =============================================================================
// TEAM MANAGEMENT COMPONENT
// =============================================================================
// Comprehensive team and employee management interface
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
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import {
  useTeamMembers,
  useTimeTracking,
  useTeamPerformance,
  useLeaveRequests,
  useTeamStats,
  TeamMember,
  TimeEntry,
  PerformanceMetrics,
  LeaveRequest,
} from '../../services/teamManagementService';

const { width } = Dimensions.get('window');

type TabType = 'team' | 'time' | 'performance' | 'leave';

export function TeamManagement() {
  const [activeTab, setActiveTab] = useState<TabType>('team');
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedLeaveRequest, setSelectedLeaveRequest] = useState<LeaveRequest | null>(null);

  const { members, loading: membersLoading } = useTeamMembers();
  const { entries, clockIn, clockOut, approveEntry } = useTimeTracking();
  const { metrics } = useTeamPerformance();
  const { requests, approveRequest, denyRequest } = useLeaveRequests();
  const stats = useTeamStats();

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'team', label: 'Team', icon: 'people' },
    { id: 'time', label: 'Uren', icon: 'time' },
    { id: 'performance', label: 'Prestaties', icon: 'trending-up' },
    { id: 'leave', label: 'Verlof', icon: 'calendar' },
  ];

  const renderStatsBar = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.statsBar}
      contentContainerStyle={styles.statsBarContent}
    >
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{stats.activeMembers}</Text>
        <Text style={styles.statLabel}>Actief</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{stats.todaysClockedIn}</Text>
        <Text style={styles.statLabel}>Ingeklokt</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{stats.avgPerformance}%</Text>
        <Text style={styles.statLabel}>Gem. Score</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={[styles.statValue, stats.pendingLeaveRequests > 0 && styles.warningValue]}>
          {stats.pendingLeaveRequests}
        </Text>
        <Text style={styles.statLabel}>Verlof Pending</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={[styles.statValue, stats.expiringCertifications > 0 && styles.warningValue]}>
          {stats.expiringCertifications}
        </Text>
        <Text style={styles.statLabel}>Cert. Verloopt</Text>
      </View>
    </ScrollView>
  );

  const renderTeamTab = () => (
    <ScrollView style={styles.tabContent}>
      {members.map((member) => (
        <TouchableOpacity
          key={member.id}
          style={styles.memberCard}
          onPress={() => {
            setSelectedMember(member);
            setShowMemberModal(true);
          }}
        >
          <View style={styles.memberHeader}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>
                {member.firstName[0]}{member.lastName[0]}
              </Text>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: member.status === 'active' ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning },
                ]}
              />
            </View>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>
                {member.firstName} {member.lastName}
              </Text>
              <Text style={styles.memberRole}>{getRoleName(member.role)}</Text>
            </View>
            <View style={styles.memberScore}>
              <Text style={styles.scoreValue}>{member.performanceScore}</Text>
              <Text style={styles.scoreLabel}>Score</Text>
            </View>
          </View>

          <View style={styles.memberSkills}>
            {member.skills.slice(0, 3).map((skill) => (
              <View key={skill.id} style={styles.skillBadge}>
                <Text style={styles.skillText}>{skill.name}</Text>
                {skill.verified && (
                  <Ionicons name="checkmark-circle" size={12} color={SemanticColors.feedbackSuccess} />
                )}
              </View>
            ))}
            {member.skills.length > 3 && (
              <Text style={styles.moreSkills}>+{member.skills.length - 3}</Text>
            )}
          </View>

          <View style={styles.memberFooter}>
            <View style={styles.footerItem}>
              <Ionicons name="ribbon" size={14} color={SemanticColors.textSecondary} />
              <Text style={styles.footerText}>
                {member.certifications.length} certificaten
              </Text>
            </View>
            <View style={styles.footerItem}>
              <Ionicons name="cash" size={14} color={SemanticColors.textSecondary} />
              <Text style={styles.footerText}>€{member.hourlyRate}/uur</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.addButton}>
        <Ionicons name="add-circle" size={24} color={SemanticColors.actionPrimary} />
        <Text style={styles.addButtonText}>Nieuw teamlid toevoegen</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderTimeTab = () => {
    const todayEntries = entries.filter(
      (e) => e.date.toDateString() === new Date().toDateString()
    );

    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Vandaag</Text>
          <Text style={styles.sectionSubtitle}>
            {new Date().toLocaleDateString('nl-NL', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Text>
        </View>

        {todayEntries.map((entry) => {
          const member = members.find((m) => m.id === entry.memberId);
          return (
            <View key={entry.id} style={styles.timeCard}>
              <View style={styles.timeHeader}>
                <View style={styles.timeAvatar}>
                  <Text style={styles.timeAvatarText}>
                    {member?.firstName[0]}{member?.lastName[0]}
                  </Text>
                </View>
                <View style={styles.timeInfo}>
                  <Text style={styles.timeName}>
                    {member?.firstName} {member?.lastName}
                  </Text>
                  <Text style={styles.timeJob}>{entry.jobName || 'Geen opdracht'}</Text>
                </View>
                <View
                  style={[
                    styles.timeStatus,
                    {
                      backgroundColor:
                        entry.status === 'in_progress'
                          ? SemanticColors.feedbackSuccess + '20'
                          : entry.status === 'completed'
                          ? Palette.primary + '20'
                          : SemanticColors.feedbackWarning + '20',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.timeStatusText,
                      {
                        color:
                          entry.status === 'in_progress'
                            ? SemanticColors.feedbackSuccess
                            : entry.status === 'completed'
                            ? Palette.primary
                            : SemanticColors.feedbackWarning,
                      },
                    ]}
                  >
                    {entry.status === 'in_progress'
                      ? 'Actief'
                      : entry.status === 'completed'
                      ? 'Voltooid'
                      : 'Goedgekeurd'}
                  </Text>
                </View>
              </View>

              <View style={styles.timeDetails}>
                <View style={styles.timeDetail}>
                  <Ionicons name="log-in" size={16} color={SemanticColors.feedbackSuccess} />
                  <Text style={styles.timeDetailText}>
                    {entry.clockIn.toLocaleTimeString('nl-NL', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                {entry.clockOut && (
                  <View style={styles.timeDetail}>
                    <Ionicons name="log-out" size={16} color={SemanticColors.feedbackError} />
                    <Text style={styles.timeDetailText}>
                      {entry.clockOut.toLocaleTimeString('nl-NL', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                )}
                {entry.totalHours && (
                  <View style={styles.timeDetail}>
                    <Ionicons name="time" size={16} color={SemanticColors.actionPrimary} />
                    <Text style={styles.timeDetailText}>{entry.totalHours}u</Text>
                  </View>
                )}
                {entry.location && (
                  <View style={styles.timeDetail}>
                    <Ionicons name="location" size={16} color={SemanticColors.textSecondary} />
                    <Text style={styles.timeDetailText}>GPS ✓</Text>
                  </View>
                )}
              </View>

              {entry.status === 'completed' && (
                <TouchableOpacity
                  style={styles.approveButton}
                  onPress={() => approveEntry(entry.id)}
                >
                  <Ionicons name="checkmark-circle" size={18} color={SemanticColors.feedbackSuccess} />
                  <Text style={styles.approveButtonText}>Goedkeuren</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {todayEntries.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={48} color={SemanticColors.textSecondary} />
            <Text style={styles.emptyText}>Nog geen uren geregistreerd vandaag</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  const renderPerformanceTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Teamprestaties</Text>
        <Text style={styles.sectionSubtitle}>Januari 2024</Text>
      </View>

      {metrics.map((metric) => {
        const member = members.find((m) => m.id === metric.memberId);
        return (
          <View key={metric.memberId} style={styles.performanceCard}>
            <View style={styles.performanceHeader}>
              <View style={styles.performanceAvatar}>
                <Text style={styles.performanceAvatarText}>
                  {member?.firstName[0]}{member?.lastName[0]}
                </Text>
              </View>
              <View style={styles.performanceInfo}>
                <Text style={styles.performanceName}>
                  {member?.firstName} {member?.lastName}
                </Text>
                <Text style={styles.performanceRole}>{getRoleName(member?.role)}</Text>
              </View>
              <View style={styles.efficiencyBadge}>
                <Text style={styles.efficiencyValue}>€{Math.round(metric.efficiency)}</Text>
                <Text style={styles.efficiencyLabel}>/uur</Text>
              </View>
            </View>

            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{metric.jobsCompleted}</Text>
                <Text style={styles.metricLabel}>Klussen</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{metric.averageJobRating}</Text>
                <Text style={styles.metricLabel}>Beoordeling</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{metric.onTimePercentage}%</Text>
                <Text style={styles.metricLabel}>Op Tijd</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{metric.callbackRate}%</Text>
                <Text style={styles.metricLabel}>Callbacks</Text>
              </View>
            </View>

            <View style={styles.revenueBar}>
              <View style={styles.revenueInfo}>
                <Text style={styles.revenueLabel}>Omzet gegenereerd</Text>
                <Text style={styles.revenueValue}>
                  €{metric.revenueGenerated.toLocaleString('nl-NL')}
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(100, (metric.revenueGenerated / 30000) * 100)}%` },
                  ]}
                />
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );

  const renderLeaveTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Verlofaanvragen</Text>
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="filter" size={18} color={SemanticColors.actionPrimary} />
          <Text style={styles.filterButtonText}>Filter</Text>
        </TouchableOpacity>
      </View>

      {requests
        .filter((r) => r.status === 'pending')
        .map((request) => (
          <View key={request.id} style={styles.leaveCard}>
            <View style={styles.leaveHeader}>
              <View style={styles.leaveInfo}>
                <Text style={styles.leaveName}>{request.memberName}</Text>
                <View style={styles.leaveType}>
                  <Ionicons
                    name={getLeaveIcon(request.type)}
                    size={14}
                    color={SemanticColors.actionPrimary}
                  />
                  <Text style={styles.leaveTypeText}>{getLeaveTypeName(request.type)}</Text>
                </View>
              </View>
              <View style={styles.leaveDays}>
                <Text style={styles.leaveDaysValue}>{request.totalDays}</Text>
                <Text style={styles.leaveDaysLabel}>dagen</Text>
              </View>
            </View>

            <View style={styles.leaveDates}>
              <Text style={styles.leaveDateText}>
                {request.startDate.toLocaleDateString('nl-NL')} -{' '}
                {request.endDate.toLocaleDateString('nl-NL')}
              </Text>
              {request.reason && <Text style={styles.leaveReason}>{request.reason}</Text>}
            </View>

            <View style={styles.leaveActions}>
              <TouchableOpacity
                style={[styles.leaveActionButton, styles.approveAction]}
                onPress={() => approveRequest(request.id)}
              >
                <Ionicons name="checkmark" size={18} color={Palette.white} />
                <Text style={styles.approveActionText}>Goedkeuren</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.leaveActionButton, styles.denyAction]}
                onPress={() => denyRequest(request.id)}
              >
                <Ionicons name="close" size={18} color={SemanticColors.feedbackError} />
                <Text style={styles.denyActionText}>Afwijzen</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Goedgekeurd Verlof</Text>
      </View>

      {requests
        .filter((r) => r.status === 'approved')
        .map((request) => (
          <View key={request.id} style={[styles.leaveCard, styles.approvedLeave]}>
            <View style={styles.leaveHeader}>
              <View style={styles.leaveInfo}>
                <Text style={styles.leaveName}>{request.memberName}</Text>
                <View style={styles.leaveType}>
                  <Ionicons
                    name={getLeaveIcon(request.type)}
                    size={14}
                    color={SemanticColors.feedbackSuccess}
                  />
                  <Text style={[styles.leaveTypeText, { color: SemanticColors.feedbackSuccess }]}>
                    {getLeaveTypeName(request.type)}
                  </Text>
                </View>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: SemanticColors.feedbackSuccess + '20' }]}>
                <Text style={[styles.statusBadgeText, { color: SemanticColors.feedbackSuccess }]}>
                  Goedgekeurd
                </Text>
              </View>
            </View>
            <View style={styles.leaveDates}>
              <Text style={styles.leaveDateText}>
                {request.startDate.toLocaleDateString('nl-NL')} -{' '}
                {request.endDate.toLocaleDateString('nl-NL')}
              </Text>
            </View>
          </View>
        ))}
    </ScrollView>
  );

  const renderMemberModal = () => (
    <Modal
      visible={showMemberModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowMemberModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowMemberModal(false)}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Teamlid Details</Text>
          <TouchableOpacity>
            <Ionicons name="create-outline" size={24} color={SemanticColors.actionPrimary} />
          </TouchableOpacity>
        </View>

        {selectedMember && (
          <ScrollView style={styles.modalContent}>
            <View style={styles.profileSection}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  {selectedMember.firstName[0]}{selectedMember.lastName[0]}
                </Text>
              </View>
              <Text style={styles.profileName}>
                {selectedMember.firstName} {selectedMember.lastName}
              </Text>
              <Text style={styles.profileRole}>{getRoleName(selectedMember.role)}</Text>
              <View style={styles.profileScore}>
                <Text style={styles.profileScoreValue}>{selectedMember.performanceScore}</Text>
                <Text style={styles.profileScoreLabel}>Prestatie Score</Text>
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Contact</Text>
              <View style={styles.detailRow}>
                <Ionicons name="mail" size={18} color={SemanticColors.textSecondary} />
                <Text style={styles.detailText}>{selectedMember.email}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="call" size={18} color={SemanticColors.textSecondary} />
                <Text style={styles.detailText}>{selectedMember.phone}</Text>
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Vaardigheden</Text>
              <View style={styles.skillsList}>
                {selectedMember.skills.map((skill) => (
                  <View key={skill.id} style={styles.skillItem}>
                    <View style={styles.skillInfo}>
                      <Text style={styles.skillName}>{skill.name}</Text>
                      <Text style={styles.skillLevel}>{getSkillLevelName(skill.level)}</Text>
                    </View>
                    {skill.verified && (
                      <Ionicons name="checkmark-circle" size={20} color={SemanticColors.feedbackSuccess} />
                    )}
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Certificaten</Text>
              {selectedMember.certifications.map((cert) => (
                <View key={cert.id} style={styles.certItem}>
                  <View style={styles.certInfo}>
                    <Text style={styles.certName}>{cert.name}</Text>
                    <Text style={styles.certIssuer}>{cert.issuingBody}</Text>
                    <Text style={styles.certExpiry}>
                      Geldig tot: {cert.expiryDate.toLocaleDateString('nl-NL')}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.certStatus,
                      {
                        backgroundColor:
                          cert.status === 'valid'
                            ? SemanticColors.feedbackSuccess + '20'
                            : cert.status === 'expiring_soon'
                            ? SemanticColors.feedbackWarning + '20'
                            : SemanticColors.feedbackError + '20',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.certStatusText,
                        {
                          color:
                            cert.status === 'valid'
                              ? SemanticColors.feedbackSuccess
                              : cert.status === 'expiring_soon'
                              ? SemanticColors.feedbackWarning
                              : SemanticColors.feedbackError,
                        },
                      ]}
                    >
                      {cert.status === 'valid'
                        ? 'Geldig'
                        : cert.status === 'expiring_soon'
                        ? 'Verloopt'
                        : 'Verlopen'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Beschikbaarheid</Text>
              <View style={styles.availabilityGrid}>
                {Object.entries(selectedMember.availability).map(([day, avail]) => (
                  <View key={day} style={styles.availDay}>
                    <Text style={styles.availDayName}>{getDayName(day)}</Text>
                    {avail.available ? (
                      <Text style={styles.availTime}>
                        {avail.startTime} - {avail.endTime}
                      </Text>
                    ) : (
                      <Text style={styles.availOff}>Vrij</Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Team Management</Text>
        <Text style={styles.subtitle}>
          {stats.activeMembers} actieve medewerkers
        </Text>
      </View>

      {renderStatsBar()}

      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.activeTab]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon as any}
              size={20}
              color={activeTab === tab.id ? SemanticColors.actionPrimary : SemanticColors.textSecondary}
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.id && styles.activeTabLabel,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'team' && renderTeamTab()}
      {activeTab === 'time' && renderTimeTab()}
      {activeTab === 'performance' && renderPerformanceTab()}
      {activeTab === 'leave' && renderLeaveTab()}

      {renderMemberModal()}
    </View>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function getRoleName(role?: string): string {
  const roles: Record<string, string> = {
    owner: 'Eigenaar',
    foreman: 'Voorman',
    technician: 'Monteur',
    apprentice: 'Leerling',
    admin: 'Administratie',
  };
  return roles[role || ''] || role || '';
}

function getSkillLevelName(level: string): string {
  const levels: Record<string, string> = {
    beginner: 'Beginner',
    intermediate: 'Gevorderd',
    expert: 'Expert',
  };
  return levels[level] || level;
}

function getDayName(day: string): string {
  const days: Record<string, string> = {
    monday: 'Ma',
    tuesday: 'Di',
    wednesday: 'Wo',
    thursday: 'Do',
    friday: 'Vr',
    saturday: 'Za',
    sunday: 'Zo',
  };
  return days[day] || day;
}

function getLeaveTypeName(type: string): string {
  const types: Record<string, string> = {
    vacation: 'Vakantie',
    sick: 'Ziek',
    personal: 'Persoonlijk',
    training: 'Training',
  };
  return types[type] || type;
}

function getLeaveIcon(type: string): any {
  const icons: Record<string, string> = {
    vacation: 'sunny',
    sick: 'medkit',
    personal: 'person',
    training: 'school',
  };
  return icons[type] || 'calendar';
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  statsBar: {
    maxHeight: 80,
  },
  statsBarContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  statItem: {
    backgroundColor: SemanticColors.surfacePrimary,
    padding: 12,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  warningValue: {
    color: SemanticColors.feedbackWarning,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: SemanticColors.surfacePrimary,
    gap: 6,
  },
  activeTab: {
    backgroundColor: SemanticColors.actionPrimary + '15',
  },
  tabLabel: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    fontWeight: '500',
  },
  activeTabLabel: {
    color: SemanticColors.actionPrimary,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  memberCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SemanticColors.actionPrimary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.actionPrimary,
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: SemanticColors.surfacePrimary,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  memberRole: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  memberScore: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.actionPrimary,
  },
  scoreLabel: {
    fontSize: 10,
    color: SemanticColors.textSecondary,
  },
  memberSkills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 6,
  },
  skillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceBackground,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  skillText: {
    fontSize: 12,
    color: SemanticColors.textPrimary,
  },
  moreSkills: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  memberFooter: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    gap: 16,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.actionPrimary + '40',
    borderStyle: 'dashed',
    marginBottom: 20,
    gap: 8,
  },
  addButtonText: {
    fontSize: 15,
    color: SemanticColors.actionPrimary,
    fontWeight: '500',
  },
  timeCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  timeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SemanticColors.actionPrimary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.actionPrimary,
  },
  timeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  timeName: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  timeJob: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  timeStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timeStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeDetails: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  timeDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeDetailText: {
    fontSize: 13,
    color: SemanticColors.textPrimary,
  },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: SemanticColors.feedbackSuccess + '15',
    borderRadius: 10,
    gap: 6,
  },
  approveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 15,
    color: SemanticColors.textSecondary,
    marginTop: 12,
  },
  performanceCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  performanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  performanceAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SemanticColors.actionPrimary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  performanceAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.actionPrimary,
  },
  performanceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  performanceName: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  performanceRole: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  efficiencyBadge: {
    alignItems: 'center',
    backgroundColor: SemanticColors.feedbackSuccess + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  efficiencyValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  efficiencyLabel: {
    fontSize: 10,
    color: SemanticColors.feedbackSuccess,
  },
  metricsGrid: {
    flexDirection: 'row',
    marginTop: 16,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  metricLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  revenueBar: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  revenueInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  revenueLabel: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  revenueValue: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  progressBar: {
    height: 6,
    backgroundColor: SemanticColors.borderDefault,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: 3,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterButtonText: {
    fontSize: 14,
    color: SemanticColors.actionPrimary,
  },
  leaveCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  approvedLeave: {
    opacity: 0.8,
  },
  leaveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leaveInfo: {
    flex: 1,
  },
  leaveName: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  leaveType: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  leaveTypeText: {
    fontSize: 13,
    color: SemanticColors.actionPrimary,
  },
  leaveDays: {
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceBackground,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  leaveDaysValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  leaveDaysLabel: {
    fontSize: 10,
    color: SemanticColors.textSecondary,
  },
  leaveDates: {
    marginTop: 12,
  },
  leaveDateText: {
    fontSize: 14,
    color: SemanticColors.textPrimary,
  },
  leaveReason: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  leaveActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  leaveActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  approveAction: {
    backgroundColor: SemanticColors.feedbackSuccess,
  },
  approveActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Palette.white,
  },
  denyAction: {
    backgroundColor: SemanticColors.feedbackError + '15',
  },
  denyActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.feedbackError,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  modalContent: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: SemanticColors.actionPrimary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    fontSize: 28,
    fontWeight: '600',
    color: SemanticColors.actionPrimary,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginTop: 12,
  },
  profileRole: {
    fontSize: 15,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  profileScore: {
    marginTop: 16,
    alignItems: 'center',
  },
  profileScoreValue: {
    fontSize: 32,
    fontWeight: '700',
    color: SemanticColors.actionPrimary,
  },
  profileScoreLabel: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  detailSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  detailText: {
    fontSize: 15,
    color: SemanticColors.textPrimary,
  },
  skillsList: {
    gap: 8,
  },
  skillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SemanticColors.surfacePrimary,
    padding: 12,
    borderRadius: 10,
  },
  skillInfo: {
    flex: 1,
  },
  skillName: {
    fontSize: 15,
    fontWeight: '500',
    color: SemanticColors.textPrimary,
  },
  skillLevel: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  certItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SemanticColors.surfacePrimary,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  certInfo: {
    flex: 1,
  },
  certName: {
    fontSize: 15,
    fontWeight: '500',
    color: SemanticColors.textPrimary,
  },
  certIssuer: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  certExpiry: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  certStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  certStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  availabilityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  availDay: {
    backgroundColor: SemanticColors.surfacePrimary,
    padding: 10,
    borderRadius: 10,
    minWidth: 70,
    alignItems: 'center',
  },
  availDayName: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  availTime: {
    fontSize: 11,
    color: SemanticColors.textPrimary,
    marginTop: 4,
  },
  availOff: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
});

export default TeamManagement;
