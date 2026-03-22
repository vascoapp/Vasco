// =============================================================================
// SUBCONTRACTORS — Onderaannemers beheer
// =============================================================================
import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Linking, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import {
  useSubcontractors,
  useSubcontractorAssignments,
  useSubcontractorStats,
  type Subcontractor,
  type SubcontractorAssignment,
} from '../../src/services/subcontractorService';
import { useAppState } from '../../src/state/AppState';
import { hapticSuccess } from '../../src/utils/haptics';
import { FadeIn } from '../../src/components/shared/FadeIn';
import { useTranslation } from 'react-i18next';

type IconName = keyof typeof Ionicons.glyphMap;
type TabType = 'lijst' | 'opdrachten';

export default function SubcontractorsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('lijst');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { subcontractors, assign } = useSubcontractors();
  const { assignments, updateStatus } = useSubcontractorAssignments();
  const stats = useSubcontractorStats();
  const { jobs } = useAppState();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => { setRefreshing(true); setTimeout(() => { setRefreshing(false); hapticSuccess(); }, 600); }, []);

  const activeJobs = jobs.filter(j => ['scheduled', 'in-progress', 'accepted'].includes(j.status));

  const handleAssign = (sub: Subcontractor) => {
    if (activeJobs.length === 0) {
      Alert.alert(t('subcontractors.noJobs', 'Geen klussen'), t('subcontractors.noActiveJobs', 'Er zijn geen actieve klussen om toe te wijzen.'));
      return;
    }
    Alert.alert(t('subcontractors.assignToJob', 'Toewijzen aan klus'), `${sub.name} ${t('subcontractors.assign', 'toewijzen')}:`, [
      ...activeJobs.slice(0, 5).map(job => ({
        text: job.title,
        onPress: () => {
          assign(sub.id, job.id, job.title, sub.hourlyRate, 'hourly');
          Alert.alert(t('subcontractors.assigned', 'Toegewezen'), `${sub.name} ${t('subcontractors.assignedTo', 'is toegewezen aan')} "${job.title}".`);
        },
      })),
      { text: t('subcontractors.cancel', 'Annuleren'), style: 'cancel' as const },
    ]);
  };

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    return (
      <View style={styles.starsRow}>
        {Array.from({ length: 5 }, (_, i) => (
          <Ionicons
            key={i}
            name={i < full ? 'star' : i === full && half ? 'star-half' : 'star-outline'}
            size={12}
            color={i < full || (i === full && half) ? SemanticColors.feedbackWarning : SemanticColors.textTertiary}
          />
        ))}
        <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('subcontractors.title', 'Onderaannemers')}</Text>
          <Text style={styles.headerSubtitle}>
            {stats.totalSubcontractors} {t('subcontractors.subcontractors', 'onderaannemers')} · {stats.activeAssignments} {t('subcontractors.activeAssignments', 'actieve opdrachten')}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <FadeIn delay={0} duration={400}>
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalSubcontractors}</Text>
            <Text style={styles.statLabel}>{t('subcontractors.total', 'Totaal')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Palette.hermesOrange }]}>{stats.activeAssignments}</Text>
            <Text style={styles.statLabel}>{t('subcontractors.active', 'Actief')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>€{stats.totalSpentThisMonth.toLocaleString('nl-NL')}</Text>
            <Text style={styles.statLabel}>{t('subcontractors.spent', 'Besteed')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, stats.expiringCredentials > 0 && { color: SemanticColors.feedbackWarning }]}>
              {stats.expiringCredentials}
            </Text>
            <Text style={styles.statLabel}>{t('subcontractors.certExpiring', 'Cert. verloopt')}</Text>
          </View>
        </View>
      </FadeIn>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <Pressable style={[styles.tab, activeTab === 'lijst' && styles.tabActive]} onPress={() => setActiveTab('lijst')}>
          <Text style={[styles.tabText, activeTab === 'lijst' && styles.tabTextActive]}>{t('subcontractors.tabList', 'Onderaannemers')}</Text>
        </Pressable>
        <Pressable style={[styles.tab, activeTab === 'opdrachten' && styles.tabActive]} onPress={() => setActiveTab('opdrachten')}>
          <Text style={[styles.tabText, activeTab === 'opdrachten' && styles.tabTextActive]}>{t('subcontractors.tabAssignments', 'Opdrachten')}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />}>
        {activeTab === 'lijst' ? (
          <View style={{ gap: 6 }}>
            {subcontractors.map(sub => {
              const isExpanded = expandedId === sub.id;
              const expiringSoon = sub.credentials.filter(c => c.expiryDate <= new Date(Date.now() + 90 * 86400000));
              return (
                <View key={sub.id}>
                  <Pressable style={styles.subCard} onPress={() => setExpandedId(isExpanded ? null : sub.id)}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>{sub.name.split(' ').map(n => n[0]).join('')}</Text>
                    </View>
                    <View style={styles.subInfo}>
                      <Text style={styles.subName}>{sub.name}</Text>
                      <Text style={styles.subTrade}>{sub.trade}{sub.companyName ? ` · ${sub.companyName}` : ''}</Text>
                      {renderStars(sub.rating)}
                    </View>
                    <View style={styles.subRight}>
                      <Text style={styles.subRate}>€{sub.hourlyRate}/u</Text>
                      <Text style={styles.subJobs}>{sub.completedJobs} {t('subcontractors.jobs', 'klussen')}</Text>
                    </View>
                  </Pressable>

                  {isExpanded && (
                    <View style={styles.expandedContent}>
                      <Pressable style={styles.contactRow} onPress={() => Linking.openURL(`tel:${sub.phone}`)}>
                        <Ionicons name="call-outline" size={14} color={SemanticColors.textSecondary} />
                        <Text style={styles.contactText}>{sub.phone}</Text>
                      </Pressable>
                      {sub.email && (
                        <Pressable style={styles.contactRow} onPress={() => Linking.openURL(`mailto:${sub.email}`)}>
                          <Ionicons name="mail-outline" size={14} color={SemanticColors.textSecondary} />
                          <Text style={styles.contactText}>{sub.email}</Text>
                        </Pressable>
                      )}
                      {sub.kvkNumber && (
                        <View style={styles.contactRow}>
                          <Ionicons name="business-outline" size={14} color={SemanticColors.textSecondary} />
                          <Text style={styles.contactText}>KvK: {sub.kvkNumber}</Text>
                        </View>
                      )}

                      {/* Credentials */}
                      {sub.credentials.length > 0 && (
                        <View style={styles.credSection}>
                          <Text style={styles.credTitle}>{t('subcontractors.certifications', 'Certificeringen')}</Text>
                          {sub.credentials.map(cred => {
                            const isExpiring = cred.expiryDate <= new Date(Date.now() + 90 * 86400000);
                            return (
                              <View key={cred.id} style={styles.credRow}>
                                <Ionicons
                                  name={cred.verified ? 'shield-checkmark' : 'shield-outline'}
                                  size={14}
                                  color={isExpiring ? SemanticColors.feedbackWarning : SemanticColors.feedbackSuccess}
                                />
                                <Text style={styles.credName}>{cred.name}</Text>
                                <Text style={[styles.credExpiry, isExpiring && { color: SemanticColors.feedbackWarning }]}>
                                  {cred.expiryDate.toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      )}

                      <Pressable style={styles.assignButton} onPress={() => handleAssign(sub)}>
                        <Ionicons name="add-circle-outline" size={16} color={Palette.hermesOrange} />
                        <Text style={styles.assignButtonText}>{t('subcontractors.assignToJob', 'Toewijzen aan klus')}</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={{ gap: 6 }}>
            {assignments.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={40} color={SemanticColors.textTertiary} />
                <Text style={styles.emptyText}>{t('subcontractors.noAssignments', 'Geen opdrachten')}</Text>
              </View>
            ) : (
              assignments.map(a => {
                const statusConfig: Record<string, { label: string; color: string }> = {
                  assigned: { label: t('subcontractors.statusAssigned', 'Toegewezen'), color: SemanticColors.feedbackInfo },
                  'in-progress': { label: t('subcontractors.statusInProgress', 'Bezig'), color: Palette.hermesOrange },
                  completed: { label: t('subcontractors.statusCompleted', 'Afgerond'), color: SemanticColors.feedbackSuccess },
                  cancelled: { label: t('subcontractors.statusCancelled', 'Geannuleerd'), color: SemanticColors.feedbackError },
                };
                const config = statusConfig[a.status] ?? { label: a.status, color: SemanticColors.textTertiary };

                return (
                  <View key={a.id} style={styles.assignmentCard}>
                    <View style={[styles.assignmentAccent, { backgroundColor: config.color }]} />
                    <View style={styles.assignmentInfo}>
                      <Text style={styles.assignmentName}>{a.subcontractorName}</Text>
                      <Text style={styles.assignmentJob} numberOfLines={1}>{a.jobTitle}</Text>
                      <View style={styles.assignmentMeta}>
                        <Text style={[styles.assignmentStatus, { color: config.color }]}>{config.label}</Text>
                        <Text style={styles.assignmentHours}>{a.hoursLogged}u {t('subcontractors.logged', 'gelogd')}</Text>
                      </View>
                    </View>
                    <View style={styles.assignmentRight}>
                      <Text style={styles.assignmentCost}>€{a.totalCost.toLocaleString('nl-NL')}</Text>
                      <Text style={styles.assignmentRate}>
                        €{a.agreedRate}/{a.rateType === 'hourly' ? 'u' : t('subcontractors.fixed', 'vast')}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: SafeArea.side, paddingTop: SafeArea.top, paddingBottom: Spacing.sm },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 24, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  headerSubtitle: { fontSize: 14, color: SemanticColors.textSecondary, marginTop: 2 },
  statsBar: { flexDirection: 'row', marginHorizontal: SafeArea.side, backgroundColor: Palette.hermesOrange + '08', borderRadius: 12, padding: Spacing.md, marginBottom: Spacing.sm },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  statLabel: { fontSize: 10, color: SemanticColors.textSecondary, marginTop: 2, letterSpacing: 0.3 },
  statDivider: { width: 1, backgroundColor: SemanticColors.borderDefault, marginHorizontal: Spacing.xs },
  tabBar: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 6, paddingBottom: Spacing.sm },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 12, backgroundColor: SemanticColors.surfacePrimary, alignItems: 'center' },
  tabActive: { backgroundColor: Palette.hermesOrange },
  tabText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: SemanticColors.textTertiary },
  tabTextActive: { color: '#fff' },
  scrollView: { flex: 1, paddingHorizontal: SafeArea.side },
  subCard: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, gap: Spacing.sm, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12 },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.hermesOrange + '15', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: Palette.hermesOrange },
  subInfo: { flex: 1 },
  subName: { fontSize: 15, fontFamily: 'Manrope_600SemiBold', color: SemanticColors.textPrimary },
  subTrade: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 1 },
  subRight: { alignItems: 'flex-end' },
  subRate: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  subJobs: { fontSize: 11, color: SemanticColors.textTertiary, marginTop: 1 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  ratingText: { fontSize: 11, color: SemanticColors.textSecondary, marginLeft: 4 },
  expandedContent: { backgroundColor: SemanticColors.surfacePrimary, marginTop: -6, marginBottom: 6, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, padding: Spacing.sm, paddingTop: Spacing.xs, gap: 6 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactText: { fontSize: 13, color: SemanticColors.textPrimary },
  credSection: { marginTop: 4, gap: 4 },
  credTitle: { fontSize: 11, fontFamily: 'Manrope_700Bold', color: SemanticColors.textSecondary, letterSpacing: 0.3 },
  credRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  credName: { flex: 1, fontSize: 12, color: SemanticColors.textPrimary },
  credExpiry: { fontSize: 11, color: SemanticColors.textSecondary },
  assignButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Palette.hermesOrange + '10', paddingVertical: 8, borderRadius: 8, marginTop: 4 },
  assignButtonText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Palette.hermesOrange },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyText: { fontSize: 14, color: SemanticColors.textTertiary },
  assignmentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, overflow: 'hidden' },
  assignmentAccent: { width: 3, alignSelf: 'stretch' },
  assignmentInfo: { flex: 1, padding: Spacing.sm },
  assignmentName: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: SemanticColors.textPrimary },
  assignmentJob: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 1 },
  assignmentMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  assignmentStatus: { fontSize: 11, fontFamily: 'Manrope_600SemiBold' },
  assignmentHours: { fontSize: 11, color: SemanticColors.textTertiary },
  assignmentRight: { alignItems: 'flex-end', paddingRight: Spacing.sm },
  assignmentCost: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: SemanticColors.textPrimary },
  assignmentRate: { fontSize: 11, color: SemanticColors.textTertiary, marginTop: 1 },
});
