// =============================================================================
// TODAY - Contractor Dashboard
// =============================================================================
// The command center for a solo contractor's day
// Shows active work, earnings, and AI-powered insights
// Connected to real services for live data
// =============================================================================

import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { AIRecommendations } from '../../src/components/intelligence/AIRecommendations';
import { useAuth } from '../../src/context/AuthContext';

// Import service hooks
import { useDaySchedule, useScheduler } from '../../src/services/smartSchedulerService';
import { useCashFlow } from '../../src/services/cashFlowService';
import { useProactiveInsights } from '../../src/services/aiAssistantService';
import { useDashboardSummary } from '../../src/services/analyticsService';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// TYPES
// ============================================

interface ActiveJobData {
  id: string;
  title: string;
  customer: string;
  address: string;
  timeElapsed: string;
  scheduled: string;
}

interface EarningsData {
  today: number;
  thisWeek: number;
  outstanding: number;
  pendingQuotes: number;
}

interface CustomerDecisionsData {
  overdue: number;
  pending: number;
  customers: Array<{ name: string; overdue: number; pending: number }>;
}

interface UpcomingJobData {
  id: string;
  title: string;
  time: string;
  customer: string;
}

interface AlertData {
  id: string;
  type: string;
  text: string;
  time: string;
  positive: boolean;
}

// ============================================
// COMPONENTS
// ============================================

function ActiveJobCard({ job, onPress }: { job: ActiveJobData; onPress: () => void }) {
  return (
    <Pressable style={styles.activeJobCard} onPress={onPress}>
      <View style={styles.activeJobHeader}>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>ACTIVE</Text>
        </View>
        <Text style={styles.timeElapsed}>{job.timeElapsed}</Text>
      </View>

      <Text style={styles.activeJobTitle}>{job.title}</Text>
      <Text style={styles.activeJobCustomer}>{job.customer}</Text>

      <View style={styles.activeJobFooter}>
        <View style={styles.activeJobLocation}>
          <Ionicons name="location" size={14} color={SemanticColors.textTertiary} />
          <Text style={styles.activeJobAddress} numberOfLines={1}>{job.address}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Palette.hermesOrange} />
      </View>
    </Pressable>
  );
}

function EarningsCard({ earnings }: { earnings: EarningsData }) {
  const router = useRouter();

  return (
    <View style={styles.earningsCard}>
      <Text style={styles.sectionTitle}>Inkomsten</Text>

      <View style={styles.earningsGrid}>
        <Pressable style={styles.earningItem} onPress={() => router.push('/(contractor)/jobs')}>
          <Text style={styles.earningValue}>€{Math.round(earnings.today).toLocaleString('nl-NL')}</Text>
          <Text style={styles.earningLabel}>Vandaag</Text>
        </Pressable>

        <View style={styles.earningsDivider} />

        <Pressable style={styles.earningItem} onPress={() => router.push('/(contractor)/money')}>
          <Text style={[styles.earningValue, { color: Palette.hermesOrange }]}>
            €{Math.round(earnings.thisWeek).toLocaleString('nl-NL')}
          </Text>
          <Text style={styles.earningLabel}>Deze Week</Text>
        </Pressable>

        <View style={styles.earningsDivider} />

        <Pressable style={styles.earningItem} onPress={() => router.push('/(contractor)/money')}>
          <Text style={styles.earningValue}>€{Math.round(earnings.outstanding).toLocaleString('nl-NL')}</Text>
          <Text style={styles.earningLabel}>Openstaand</Text>
        </Pressable>
      </View>

      {earnings.pendingQuotes > 0 && (
        <Pressable
          style={styles.pendingQuotesBar}
          onPress={() => router.push('/(contractor)/money')}
        >
          <Ionicons name="document-text" size={16} color={Palette.terracotta} />
          <Text style={styles.pendingQuotesText}>
            {earnings.pendingQuotes} {earnings.pendingQuotes === 1 ? 'offerte wacht' : 'offertes wachten'} op antwoord
          </Text>
          <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
        </Pressable>
      )}
    </View>
  );
}

function QuickActions() {
  const router = useRouter();

  const actions: { icon: IconName; label: string; route: string; color: string }[] = [
    { icon: 'add-circle', label: 'New Quote', route: '/contractor/tiered-quote', color: Palette.hermesOrange },
    { icon: 'time', label: 'Clock In', route: '/(contractor)/jobs', color: SemanticColors.feedbackSuccess },
    { icon: 'document-text', label: 'Invoice', route: '/(contractor)/money', color: Palette.terracotta },
    { icon: 'cart', label: 'Buy Smart', route: '/(contractor)/savings', color: SemanticColors.feedbackInfo },
  ];

  return (
    <View style={styles.quickActions}>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          style={styles.quickActionButton}
          onPress={() => router.push(action.route as any)}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: action.color + '15' }]}>
            <Ionicons name={action.icon} size={24} color={action.color} />
          </View>
          <Text style={styles.quickActionLabel}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function UpcomingJobs({ jobs }: { jobs: UpcomingJobData[] }) {
  const router = useRouter();

  return (
    <View style={styles.upcomingCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Komende Afspraken</Text>
        <Pressable onPress={() => router.push('/(contractor)/jobs')}>
          <Text style={styles.seeAllLink}>Bekijk Alle</Text>
        </Pressable>
      </View>

      {jobs.map((job, index) => (
        <Pressable
          key={job.id}
          style={[styles.upcomingJob, index < jobs.length - 1 && styles.upcomingJobBorder]}
          onPress={() => router.push(`/contractor/job/${job.id}` as any)}
        >
          <View style={styles.upcomingJobTime}>
            <Ionicons name="time-outline" size={16} color={SemanticColors.textTertiary} />
            <Text style={styles.upcomingJobTimeText}>{job.time}</Text>
          </View>
          <View style={styles.upcomingJobInfo}>
            <Text style={styles.upcomingJobTitle}>{job.title}</Text>
            <Text style={styles.upcomingJobCustomer}>{job.customer}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
        </Pressable>
      ))}
    </View>
  );
}

function CustomerDecisionsCard({ decisions }: { decisions: CustomerDecisionsData }) {
  const router = useRouter();

  const hasOverdue = decisions.overdue > 0;

  return (
    <Pressable
      style={[styles.decisionsCard, hasOverdue && styles.decisionsCardAlert]}
      onPress={() => router.push('/(contractor)/decisions')}
    >
      <View style={styles.decisionsHeader}>
        <View style={styles.decisionsIcon}>
          <Ionicons
            name={hasOverdue ? 'alert-circle' : 'checkbox'}
            size={24}
            color={hasOverdue ? SemanticColors.feedbackError : SemanticColors.feedbackInfo}
          />
        </View>
        <View style={styles.decisionsInfo}>
          <Text style={styles.decisionsTitle}>Klantbeslissingen</Text>
          <Text style={styles.decisionsSubtitle}>
            {hasOverdue
              ? `${decisions.overdue} verlopen, ${decisions.pending} in afwachting`
              : `${decisions.pending} beslissingen wachten op antwoord`}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={SemanticColors.textTertiary} />
      </View>

      {hasOverdue && decisions.customers.filter(c => c.overdue > 0).length > 0 && (
        <View style={styles.decisionsCustomers}>
          {decisions.customers.filter(c => c.overdue > 0).map((customer, index) => (
            <View key={index} style={styles.decisionsCustomerRow}>
              <Text style={styles.decisionsCustomerName}>{customer.name}</Text>
              <View style={styles.decisionsOverdueBadge}>
                <Text style={styles.decisionsOverdueText}>{customer.overdue} verlopen</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {hasOverdue && (
        <View style={styles.decisionsAction}>
          <Ionicons name="notifications" size={14} color={Palette.hermesOrange} />
          <Text style={styles.decisionsActionText}>Stuur herinneringen</Text>
        </View>
      )}
    </Pressable>
  );
}

function RecentAlerts({ alerts }: { alerts: AlertData[] }) {
  const getAlertIcon = (type: string): IconName => {
    switch (type) {
      case 'payment': return 'checkmark-circle';
      case 'quote': return 'eye';
      case 'price': return 'pricetag';
      default: return 'notifications';
    }
  };

  return (
    <View style={styles.alertsCard}>
      <Text style={styles.sectionTitle}>Recente Activiteit</Text>

      {alerts.map((alert) => (
        <View key={alert.id} style={styles.alertItem}>
          <View style={[
            styles.alertIcon,
            { backgroundColor: alert.positive ? SemanticColors.feedbackSuccessBg : SemanticColors.surfaceSecondary }
          ]}>
            <Ionicons
              name={getAlertIcon(alert.type)}
              size={16}
              color={alert.positive ? SemanticColors.feedbackSuccess : SemanticColors.textSecondary}
            />
          </View>
          <Text style={styles.alertText}>{alert.text}</Text>
          <Text style={styles.alertTime}>{alert.time}</Text>
        </View>
      ))}
    </View>
  );
}

// ============================================
// MAIN SCREEN
// ============================================

export default function TodayScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  // Get today's date in ISO format
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Connect to services
  const daySchedule = useDaySchedule(today);
  const { jobs: allJobs } = useScheduler();
  const { summary: cashFlowSummary, invoices } = useCashFlow();
  const { insights } = useProactiveInsights();
  const dashboardSummary = useDashboardSummary();

  // Derive data from services
  const activeJob = useMemo(() => {
    const inProgressJob = daySchedule.jobs.find(j => j.status === 'in_progress');
    if (!inProgressJob) return null;

    // Calculate elapsed time
    const startTime = new Date(inProgressJob.startTime);
    const now = new Date();
    const elapsedMs = now.getTime() - startTime.getTime();
    const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
    const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));

    return {
      id: inProgressJob.id,
      title: inProgressJob.projectName,
      customer: inProgressJob.customerName,
      address: inProgressJob.address,
      timeElapsed: `${hours}h ${minutes}m`,
      scheduled: `${new Date(inProgressJob.startTime).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })} - ${new Date(inProgressJob.endTime).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`,
    };
  }, [daySchedule.jobs]);

  const upcomingJobs = useMemo(() => {
    return daySchedule.jobs
      .filter(j => j.status === 'scheduled')
      .slice(0, 3)
      .map(job => ({
        id: job.id,
        title: job.projectName,
        time: new Date(job.startTime).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
        customer: job.customerName,
      }));
  }, [daySchedule.jobs]);

  const earnings = useMemo(() => {
    const paidToday = invoices
      .filter(i => i.status === 'paid' && i.paidDate?.startsWith(today))
      .reduce((sum, i) => sum + i.amount, 0);

    const pendingQuotes = invoices.filter(i => i.status === 'sent' || i.status === 'viewed').length;

    return {
      today: paidToday || dashboardSummary.revenue.value / 30, // Estimate if no data
      thisWeek: dashboardSummary.revenue.value / 4, // Weekly estimate
      outstanding: cashFlowSummary.pendingIncome,
      pendingQuotes,
    };
  }, [invoices, cashFlowSummary, dashboardSummary, today]);

  const customerDecisions = useMemo(() => {
    const overdueInvoices = invoices.filter(i => i.status === 'overdue');
    const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'viewed');

    // Group by customer
    const customerMap = new Map<string, { name: string; overdue: number; pending: number }>();

    overdueInvoices.forEach(inv => {
      const existing = customerMap.get(inv.customerId) || { name: inv.customerName, overdue: 0, pending: 0 };
      existing.overdue++;
      customerMap.set(inv.customerId, existing);
    });

    pendingInvoices.forEach(inv => {
      const existing = customerMap.get(inv.customerId) || { name: inv.customerName, overdue: 0, pending: 0 };
      existing.pending++;
      customerMap.set(inv.customerId, existing);
    });

    return {
      overdue: overdueInvoices.length,
      pending: pendingInvoices.length,
      customers: Array.from(customerMap.values()),
    };
  }, [invoices]);

  const recentAlerts = useMemo(() => {
    return insights.slice(0, 3).map((insight, index) => ({
      id: insight.id,
      type: insight.type === 'warning' ? 'payment' : insight.type === 'opportunity' ? 'quote' : 'price',
      text: insight.title,
      time: index === 0 ? '10m geleden' : index === 1 ? '1u geleden' : '2u geleden',
      positive: insight.type !== 'warning',
    }));
  }, [insights]);

  // Greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Goedemorgen';
    if (hour < 18) return 'Goedemiddag';
    return 'Goedenavond';
  }, []);

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('nl-NL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    // Services will automatically update when their data changes
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}, {user?.name?.split(' ')[0] || 'Thomas'}</Text>
          <Text style={styles.date}>{formattedDate}</Text>
        </View>
        <Pressable style={styles.profileButton} onPress={() => router.push('/profile' as any)}>
          <Ionicons name="person-circle" size={40} color={Palette.charcoal} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />
        }
      >
        {/* Active Job */}
        {activeJob && (
          <ActiveJobCard
            job={activeJob}
            onPress={() => router.push(`/contractor/job/${activeJob.id}` as any)}
          />
        )}

        {/* Quick Actions */}
        <QuickActions />

        {/* Earnings */}
        <EarningsCard earnings={earnings} />

        {/* Customer Decisions */}
        <CustomerDecisionsCard decisions={customerDecisions} />

        {/* AI Insights */}
        <View style={styles.aiSection}>
          <AIRecommendations userId="current-user" maxItems={2} showHeader />
        </View>

        {/* Upcoming Jobs */}
        {upcomingJobs.length > 0 && <UpcomingJobs jobs={upcomingJobs} />}

        {/* Recent Alerts */}
        {recentAlerts.length > 0 && <RecentAlerts alerts={recentAlerts} />}

        <View style={{ height: 100 }} />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  date: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  profileButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },

  // Active Job
  activeJobCard: {
    backgroundColor: Palette.hermesOrange,
    borderRadius: 16,
    padding: Spacing.lg,
  },
  activeJobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  timeElapsed: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  activeJobTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  activeJobCustomer: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: Spacing.md,
  },
  activeJobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  activeJobLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  activeJobAddress: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    flex: 1,
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    alignItems: 'center',
    gap: 6,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },

  // Earnings
  earningsCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  seeAllLink: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },
  earningsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  earningItem: {
    flex: 1,
    alignItems: 'center',
  },
  earningValue: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  earningLabel: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    marginTop: 4,
  },
  earningsDivider: {
    width: 1,
    height: 36,
    backgroundColor: SemanticColors.borderDefault,
  },
  pendingQuotesBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  pendingQuotesText: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },

  // AI Section
  aiSection: {
    // Container for AI recommendations
  },

  // Upcoming Jobs
  upcomingCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  upcomingJob: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  upcomingJobBorder: {
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  upcomingJobTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 100,
  },
  upcomingJobTimeText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    fontWeight: '500',
  },
  upcomingJobInfo: {
    flex: 1,
  },
  upcomingJobTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  upcomingJobCustomer: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },

  // Alerts
  alertsCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  alertIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.textPrimary,
  },
  alertTime: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },

  // Customer Decisions Card
  decisionsCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  decisionsCardAlert: {
    borderColor: SemanticColors.feedbackError + '40',
    borderLeftWidth: 3,
    borderLeftColor: SemanticColors.feedbackError,
  },
  decisionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  decisionsIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: SemanticColors.feedbackInfoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decisionsInfo: {
    flex: 1,
  },
  decisionsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  decisionsSubtitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  decisionsCustomers: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    gap: Spacing.xs,
  },
  decisionsCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  decisionsCustomerName: {
    fontSize: 13,
    color: SemanticColors.textPrimary,
  },
  decisionsOverdueBadge: {
    backgroundColor: SemanticColors.feedbackErrorBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  decisionsOverdueText: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.feedbackError,
  },
  decisionsAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  decisionsActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },
});
