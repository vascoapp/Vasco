// Contractor Dashboard - ServiceTitan-style dashboard for individual trades contractors
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IntelligenceDashboard } from './IntelligenceDashboard';
import { Palette } from '../../theme/colors';
import { SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import {
  MOCK_CONTRACTOR_METRICS,
  MOCK_JOBS,
  MOCK_QUOTES,
  MOCK_CONTRACTOR_INVOICES,
  MOCK_SCHEDULE,
  MOCK_CONTRACTOR_PROFILE,
  JOB_STATUS_CONFIG,
} from '../../data/mockContractor';

type IconName = keyof typeof Ionicons.glyphMap;

export function ContractorDashboard() {
  const router = useRouter();
  const [showIntelligence, setShowIntelligence] = useState(false);
  const metrics = MOCK_CONTRACTOR_METRICS;
  const profile = MOCK_CONTRACTOR_PROFILE;

  // Get today's jobs
  const today = new Date().toISOString().split('T')[0];
  const todaysSchedule = MOCK_SCHEDULE.filter((s) => s.date === today || s.date === '2024-02-01');

  // Get active jobs
  const activeJobs = MOCK_JOBS.filter((j) => j.status === 'in-progress' || j.status === 'scheduled');

  // Get pending quotes
  const pendingQuotes = MOCK_QUOTES.filter((q) => q.status === 'sent' || q.status === 'viewed');

  // Get outstanding invoices
  const outstandingInvoices = MOCK_CONTRACTOR_INVOICES.filter(
    (i) => i.status === 'sent' || i.status === 'overdue'
  );

  const formatCurrency = (amount: number) => {
    return `€${amount.toLocaleString('nl-NL')}`;
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning</Text>
          <Text style={styles.businessName}>{profile.tradeName || profile.businessName}</Text>
        </View>
        <View style={styles.tradeBadge}>
          <Ionicons name="color-palette" size={14} color={SemanticColors.actionPrimary} />
          <Text style={styles.tradeBadgeText}>Painter</Text>
        </View>
      </View>

      {/* Quick Stats Row */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: SemanticColors.feedbackSuccessBg }]}>
            <Ionicons name="wallet" size={18} color={SemanticColors.feedbackSuccess} />
          </View>
          <Text style={styles.statValue}>{formatCurrency(metrics.revenueThisMonth)}</Text>
          <Text style={styles.statLabel}>This Month</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: SemanticColors.feedbackWarningBg }]}>
            <Ionicons name="time" size={18} color={SemanticColors.feedbackWarning} />
          </View>
          <Text style={styles.statValue}>{formatCurrency(metrics.invoicesOutstandingValue)}</Text>
          <Text style={styles.statLabel}>Outstanding</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: SemanticColors.feedbackInfoBg }]}>
            <Ionicons name="calendar" size={18} color={SemanticColors.feedbackInfo} />
          </View>
          <Text style={styles.statValue}>{metrics.scheduledJobsCount}</Text>
          <Text style={styles.statLabel}>Scheduled</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
            <Ionicons name="document-text" size={18} color="#8B5CF6" />
          </View>
          <Text style={styles.statValue}>{metrics.quotesOutstanding}</Text>
          <Text style={styles.statLabel}>Quotes Out</Text>
        </View>
      </View>

      {/* Intelligence Widget */}
      <Pressable style={styles.intelligenceWidget} onPress={() => setShowIntelligence(true)}>
        <View style={styles.intelligenceIcon}>
          <Ionicons name="sparkles" size={22} color={Palette.hermesOrange} />
        </View>
        <View style={styles.intelligenceContent}>
          <View style={styles.intelligenceHeader}>
            <Text style={styles.intelligenceTitle}>Vasco Intelligence</Text>
            <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
          </View>
          <Text style={styles.intelligenceSubtitle}>€4.280 bespaard · 156 datapunten</Text>
          <View style={styles.intelligenceTip}>
            <Ionicons name="bulb-outline" size={12} color={Palette.hermesOrange} />
            <Text style={styles.intelligenceTipText}>3 nieuwe tips beschikbaar</Text>
          </View>
        </View>
      </Pressable>

      {/* Today's Schedule */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Schedule</Text>
          <Pressable style={styles.seeAllButton}>
            <Text style={styles.seeAllText}>Calendar</Text>
            <Ionicons name="chevron-forward" size={14} color={SemanticColors.actionPrimary} />
          </Pressable>
        </View>
        {todaysSchedule.length > 0 ? (
          <View style={styles.scheduleList}>
            {todaysSchedule.map((item) => (
              <Pressable key={item.id} style={styles.scheduleCard}>
                <View style={[styles.scheduleIndicator, { backgroundColor: item.color || SemanticColors.actionPrimary }]} />
                <View style={styles.scheduleContent}>
                  <View style={styles.scheduleTime}>
                    <Ionicons name="time-outline" size={14} color={SemanticColors.textSecondary} />
                    <Text style={styles.scheduleTimeText}>
                      {item.startTime} - {item.endTime}
                    </Text>
                  </View>
                  <Text style={styles.scheduleTitle}>{item.title}</Text>
                  {item.address && (
                    <View style={styles.scheduleLocation}>
                      <Ionicons name="location-outline" size={12} color={SemanticColors.textTertiary} />
                      <Text style={styles.scheduleLocationText}>
                        {item.address.street}, {item.address.city}
                      </Text>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={32} color={SemanticColors.textTertiary} />
            <Text style={styles.emptyText}>No jobs scheduled for today</Text>
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Pressable style={styles.quickActionButton}>
          <View style={[styles.quickActionIcon, { backgroundColor: SemanticColors.feedbackSuccessBg }]}>
            <Ionicons name="add-circle" size={22} color={SemanticColors.feedbackSuccess} />
          </View>
          <Text style={styles.quickActionText}>New Job</Text>
        </Pressable>
        <Pressable style={styles.quickActionButton}>
          <View style={[styles.quickActionIcon, { backgroundColor: SemanticColors.feedbackInfoBg }]}>
            <Ionicons name="document-text" size={22} color={SemanticColors.feedbackInfo} />
          </View>
          <Text style={styles.quickActionText}>New Quote</Text>
        </Pressable>
        <Pressable style={styles.quickActionButton}>
          <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
            <Ionicons name="receipt" size={22} color="#8B5CF6" />
          </View>
          <Text style={styles.quickActionText}>Invoice</Text>
        </Pressable>
        <Pressable style={styles.quickActionButton}>
          <View style={[styles.quickActionIcon, { backgroundColor: SemanticColors.feedbackWarningBg }]}>
            <Ionicons name="time" size={22} color={SemanticColors.feedbackWarning} />
          </View>
          <Text style={styles.quickActionText}>Clock In</Text>
        </Pressable>
      </View>

      {/* Active Jobs */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Jobs</Text>
          <Pressable style={styles.seeAllButton}>
            <Text style={styles.seeAllText}>View all</Text>
            <Ionicons name="chevron-forward" size={14} color={SemanticColors.actionPrimary} />
          </Pressable>
        </View>
        <View style={styles.jobsList}>
          {activeJobs.map((job) => {
            const statusConfig = JOB_STATUS_CONFIG[job.status];
            return (
              <Pressable key={job.id} style={styles.jobCard}>
                <View style={styles.jobHeader}>
                  <View style={styles.jobInfo}>
                    <Text style={styles.jobTitle}>{job.title}</Text>
                    <Text style={styles.jobCustomer}>
                      {MOCK_JOBS.find((j) => j.id === job.id)?.address.street}
                    </Text>
                  </View>
                  <View style={[styles.jobStatus, { backgroundColor: statusConfig.color + '20' }]}>
                    <Ionicons
                      name={statusConfig.icon as IconName}
                      size={12}
                      color={statusConfig.color}
                    />
                    <Text style={[styles.jobStatusText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>
                <View style={styles.jobFooter}>
                  <View style={styles.jobDetail}>
                    <Ionicons name="calendar-outline" size={12} color={SemanticColors.textTertiary} />
                    <Text style={styles.jobDetailText}>{job.scheduledDate}</Text>
                  </View>
                  {job.agreedAmount && (
                    <Text style={styles.jobAmount}>{formatCurrency(job.agreedAmount)}</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Pending Quotes */}
      {pendingQuotes.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pending Quotes</Text>
            <Pressable style={styles.seeAllButton}>
              <Text style={styles.seeAllText}>View all</Text>
              <Ionicons name="chevron-forward" size={14} color={SemanticColors.actionPrimary} />
            </Pressable>
          </View>
          <View style={styles.quotesList}>
            {pendingQuotes.map((quote) => (
              <Pressable key={quote.id} style={styles.quoteCard}>
                <View style={styles.quoteHeader}>
                  <Text style={styles.quoteRef}>{quote.reference}</Text>
                  <View
                    style={[
                      styles.quoteStatus,
                      {
                        backgroundColor:
                          quote.status === 'viewed'
                            ? SemanticColors.feedbackSuccessBg
                            : SemanticColors.feedbackInfoBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.quoteStatusText,
                        {
                          color:
                            quote.status === 'viewed'
                              ? SemanticColors.feedbackSuccess
                              : SemanticColors.feedbackInfo,
                        },
                      ]}
                    >
                      {quote.status === 'viewed' ? 'Viewed' : 'Sent'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.quoteTitle}>{quote.title}</Text>
                <View style={styles.quoteFooter}>
                  <Text style={styles.quoteExpiry}>
                    Valid until {new Date(quote.validUntil).toLocaleDateString('nl-NL')}
                  </Text>
                  <Text style={styles.quoteAmount}>{formatCurrency(quote.total)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Outstanding Invoices */}
      {outstandingInvoices.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Outstanding Invoices</Text>
            {metrics.overdueInvoices > 0 && (
              <View style={styles.overdueAlert}>
                <Ionicons name="alert-circle" size={14} color={SemanticColors.feedbackError} />
                <Text style={styles.overdueAlertText}>{metrics.overdueInvoices} overdue</Text>
              </View>
            )}
          </View>
          <View style={styles.invoicesList}>
            {outstandingInvoices.map((invoice) => (
              <Pressable key={invoice.id} style={styles.invoiceCard}>
                <View style={styles.invoiceHeader}>
                  <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
                  <View
                    style={[
                      styles.invoiceStatus,
                      {
                        backgroundColor:
                          invoice.status === 'overdue'
                            ? SemanticColors.feedbackErrorBg
                            : SemanticColors.feedbackWarningBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.invoiceStatusText,
                        {
                          color:
                            invoice.status === 'overdue'
                              ? SemanticColors.feedbackError
                              : SemanticColors.feedbackWarning,
                        },
                      ]}
                    >
                      {invoice.status === 'overdue' ? 'Overdue' : 'Pending'}
                    </Text>
                  </View>
                </View>
                <View style={styles.invoiceFooter}>
                  <Text style={styles.invoiceDue}>
                    Due {new Date(invoice.dueDate).toLocaleDateString('nl-NL')}
                  </Text>
                  <Text style={styles.invoiceAmount}>{formatCurrency(invoice.amountDue)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Performance Snapshot */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Performance</Text>
        <View style={styles.performanceGrid}>
          <View style={styles.performanceCard}>
            <Text style={styles.performanceValue}>{metrics.quoteConversionRate}%</Text>
            <Text style={styles.performanceLabel}>Quote Win Rate</Text>
          </View>
          <View style={styles.performanceCard}>
            <Text style={styles.performanceValue}>{metrics.averagePaymentDays}d</Text>
            <Text style={styles.performanceLabel}>Avg. Payment</Text>
          </View>
          <View style={styles.performanceCard}>
            <Text style={styles.performanceValue}>{metrics.repeatCustomerRate}%</Text>
            <Text style={styles.performanceLabel}>Repeat Rate</Text>
          </View>
          <View style={styles.performanceCard}>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={16} color="#F59E0B" />
              <Text style={styles.performanceValue}>{metrics.averageRating}</Text>
            </View>
            <Text style={styles.performanceLabel}>{metrics.totalReviews} reviews</Text>
          </View>
        </View>
      </View>

      {/* Power Tools - Advanced Features */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Power Tools</Text>
        <View style={styles.toolsGrid}>
          <Pressable style={styles.toolCard} onPress={() => router.push('/contractor/pricebook')}>
            <View style={[styles.toolIcon, { backgroundColor: '#8B5CF620' }]}>
              <Ionicons name="book" size={22} color="#8B5CF6" />
            </View>
            <Text style={styles.toolTitle}>Pricebook</Text>
            <Text style={styles.toolDesc}>Service catalog</Text>
          </Pressable>
          <Pressable style={styles.toolCard} onPress={() => router.push('/contractor/tiered-quote')}>
            <View style={[styles.toolIcon, { backgroundColor: SemanticColors.feedbackSuccessBg }]}>
              <Ionicons name="layers" size={22} color={SemanticColors.feedbackSuccess} />
            </View>
            <Text style={styles.toolTitle}>Smart Quote</Text>
            <Text style={styles.toolDesc}>Good-Better-Best</Text>
          </Pressable>
          <Pressable style={styles.toolCard} onPress={() => router.push('/contractor/purchasing')}>
            <View style={[styles.toolIcon, { backgroundColor: SemanticColors.feedbackInfoBg }]}>
              <Ionicons name="trending-down" size={22} color={SemanticColors.feedbackInfo} />
            </View>
            <Text style={styles.toolTitle}>Smart Buy</Text>
            <Text style={styles.toolDesc}>Save on materials</Text>
          </Pressable>
          <Pressable style={styles.toolCard} onPress={() => router.push('/contractor/payments')}>
            <View style={[styles.toolIcon, { backgroundColor: '#CC006620' }]}>
              <Ionicons name="card" size={22} color="#CC0066" />
            </View>
            <Text style={styles.toolTitle}>Payments</Text>
            <Text style={styles.toolDesc}>iDEAL & Mollie</Text>
          </Pressable>
        </View>
      </View>

      {/* Intelligence Modal */}
      <Modal
        visible={showIntelligence}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <IntelligenceDashboard onClose={() => setShowIntelligence(false)} />
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    color: SemanticColors.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  businessName: {
    color: SemanticColors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  tradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SemanticColors.actionPrimary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tradeBadgeText: {
    color: SemanticColors.actionPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  intelligenceWidget: {
    flexDirection: 'row',
    backgroundColor: Palette.pastelOrange + '20',
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.hermesOrange + '30',
    gap: Spacing.md,
  },
  intelligenceIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Palette.hermesOrange + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  intelligenceContent: {
    flex: 1,
    gap: 4,
  },
  intelligenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  intelligenceTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  intelligenceSubtitle: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  intelligenceTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  intelligenceTipText: {
    fontSize: 12,
    fontWeight: '500',
    color: Palette.hermesOrange,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 6,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: SemanticColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    color: SemanticColors.actionPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  scheduleList: {
    gap: Spacing.xs,
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  scheduleIndicator: {
    width: 4,
    height: 48,
    borderRadius: 2,
  },
  scheduleContent: {
    flex: 1,
    gap: 4,
  },
  scheduleTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scheduleTimeText: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  scheduleTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  scheduleLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scheduleLocationText: {
    color: SemanticColors.textTertiary,
    fontSize: 12,
  },
  emptyState: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  emptyText: {
    color: SemanticColors.textTertiary,
    fontSize: 14,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  jobsList: {
    gap: Spacing.xs,
  },
  jobCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  jobInfo: {
    flex: 1,
    gap: 2,
  },
  jobTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  jobCustomer: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  jobStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  jobStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  jobDetailText: {
    color: SemanticColors.textTertiary,
    fontSize: 12,
  },
  jobAmount: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  quotesList: {
    gap: Spacing.xs,
  },
  quoteCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 6,
  },
  quoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quoteRef: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  quoteStatus: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  quoteStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  quoteTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  quoteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quoteExpiry: {
    color: SemanticColors.textTertiary,
    fontSize: 11,
  },
  quoteAmount: {
    color: SemanticColors.actionPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  overdueAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackErrorBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  overdueAlertText: {
    color: SemanticColors.feedbackError,
    fontSize: 11,
    fontWeight: '600',
  },
  invoicesList: {
    gap: Spacing.xs,
  },
  invoiceCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 6,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceNumber: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  invoiceStatus: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  invoiceStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  invoiceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceDue: {
    color: SemanticColors.textTertiary,
    fontSize: 12,
  },
  invoiceAmount: {
    color: SemanticColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  performanceCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    alignItems: 'center',
    gap: 4,
  },
  performanceValue: {
    color: SemanticColors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  performanceLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  toolCard: {
    width: '48%',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 8,
  },
  toolIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolTitle: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  toolDesc: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
  },
});
