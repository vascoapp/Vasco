// =============================================================================
// CONTRACTOR DASHBOARD - ServiceTitan-style dashboard for trades contractors
// =============================================================================
// Enhanced with unified command center: decisions, agent actions, evidence capture, ROI
// 4-tab navigation: Dashboard, Jobs, Money, Tools
// =============================================================================

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IntelligenceDashboard } from './IntelligenceDashboard';
import { HoursSavedCard } from '../contractor/HoursSavedCard';
import { Palette } from '../../theme/colors';
import { SemanticColors } from '../../theme/colors';
import { formatCurrency } from '../../i18n/formatting';
import { Spacing } from '../../theme/spacing';
import { JOB_STATUS_CONFIG } from '../../data/mockContractor';
import { useAppState } from '../../state/AppState';

type IconName = keyof typeof Ionicons.glyphMap;
type TabView = 'dashboard' | 'jobs' | 'money' | 'tools';

// Contractor theme color
const CONTRACTOR_COLOR = SemanticColors.actionPrimary;

// =============================================================================
// TAB CONFIGURATION
// =============================================================================

interface TabConfig {
  id: TabView;
  label: string;
  icon: IconName;
}

const TABS: TabConfig[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'jobs', label: 'Jobs', icon: 'construct' },
  { id: 'money', label: 'Money', icon: 'wallet' },
  { id: 'tools', label: 'Tools', icon: 'apps' },
];

// =============================================================================
// MAIN DASHBOARD
// =============================================================================

export type ContractorTabView = TabView;

interface ContractorDashboardProps {
  initialTab?: TabView;
}

export function ContractorDashboard({ initialTab = 'dashboard' }: ContractorDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabView>(initialTab);
  const [showIntelligence, setShowIntelligence] = useState(false);
  const [showROI, setShowROI] = useState(false);

  const { jobs, quotes, invoices, metrics, businessProfile, jobMaterials, materials, suppliers, priceObservations } = useAppState();

  // Get active jobs
  const activeJobs = jobs.filter((j) => j.status === 'in-progress' || j.status === 'scheduled');

  // Get jobs ready for completion (in-progress jobs that can be marked complete)
  const jobsReadyToComplete = jobs.filter((j) => j.status === 'in-progress');

  // Get jobs ready for handover (completed jobs that need handover package)
  const jobsReadyForHandover = jobs.filter((j) => j.status === 'completed');

  // Get pending quotes
  const pendingQuotes = quotes.filter((q) => q.status === 'sent');

  // Get outstanding invoices
  const outstandingInvoices = invoices.filter(
    (i) => i.status === 'sent' || i.status === 'overdue'
  );

  // Schedule: derive from jobs with scheduled date and active status
  const todaysSchedule = jobs
    .filter((j) => j.scheduledDate && ['scheduled', 'in-progress'].includes(j.status))
    .map((j) => ({
      id: j.id,
      title: j.title,
      startTime: j.scheduledStartTime,
      endTime: j.scheduledEndTime,
      color: j.status === 'in-progress' ? SemanticColors.feedbackSuccess : CONTRACTOR_COLOR,
      address: j.address ? { street: j.address.street, city: j.address.city } : undefined,
    }));

  // Decision trackers (not yet wired)
  const totalOverdueDecisions = 0;
  const totalPendingDecisions = 0;

  // ── Material spend KPIs ──
  const allJobMaterials = Object.values(jobMaterials).flat();
  const totalMaterialSpend = allJobMaterials.reduce((s, jm) => s + (jm.totalPrice ?? 0), 0);
  const pendingMaterials = allJobMaterials.filter((jm) => jm.status === 'planned' || jm.status === 'ordered');
  const topSupplier = suppliers.length > 0
    ? suppliers.reduce((best, s) => (s.totalSpend > best.totalSpend ? s : best), suppliers[0])
    : null;

  // Find sale opportunities from price observations
  const saleAlerts = Object.values(priceObservations)
    .flat()
    .filter((po) => po.isSale)
    .slice(0, 3);

  // formatCurrency imported from ../../i18n/formatting

  // =============================================================================
  // RENDER TAB CONTENT
  // =============================================================================

  const renderDashboardTab = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
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

      {/* Customer Decisions Alert */}
      {(totalOverdueDecisions > 0 || totalPendingDecisions > 0) && (
        <Pressable
          style={[
            styles.decisionsAlert,
            totalOverdueDecisions > 0 && styles.decisionsAlertUrgent
          ]}
          onPress={() => router.push('/(contractor)/decisions')}
        >
          <View style={[
            styles.decisionsAlertIcon,
            { backgroundColor: totalOverdueDecisions > 0
              ? SemanticColors.feedbackErrorBg
              : SemanticColors.feedbackWarningBg
            }
          ]}>
            <Ionicons
              name={totalOverdueDecisions > 0 ? "alert-circle" : "people"}
              size={20}
              color={totalOverdueDecisions > 0
                ? SemanticColors.feedbackError
                : SemanticColors.feedbackWarning
              }
            />
          </View>
          <View style={styles.decisionsAlertContent}>
            <Text style={styles.decisionsAlertTitle}>
              {totalOverdueDecisions > 0
                ? `${totalOverdueDecisions} klantbeslissingen te laat`
                : `${totalPendingDecisions} klantbeslissingen wachten`
              }
            </Text>
            <Text style={styles.decisionsAlertSubtitle}>
              Tap om herinneringen te sturen
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
        </Pressable>
      )}

      {/* Today's Schedule */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Schedule</Text>
          <Pressable style={styles.seeAllButton}>
            <Text style={styles.seeAllText}>Calendar</Text>
            <Ionicons name="chevron-forward" size={14} color={CONTRACTOR_COLOR} />
          </Pressable>
        </View>
        {todaysSchedule.length > 0 ? (
          <View style={styles.scheduleList}>
            {todaysSchedule.map((item) => (
              <Pressable key={item.id} style={styles.scheduleCard}>
                <View style={[styles.scheduleIndicator, { backgroundColor: item.color || CONTRACTOR_COLOR }]} />
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

      {/* Material Spend Snapshot */}
      {(totalMaterialSpend > 0 || saleAlerts.length > 0) && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Materialen</Text>
            <Pressable style={styles.seeAllButton} onPress={() => router.push('/hub/materials')}>
              <Text style={styles.seeAllText}>Catalogus</Text>
              <Ionicons name="chevron-forward" size={14} color={CONTRACTOR_COLOR} />
            </Pressable>
          </View>

          {/* Spend strip */}
          <View style={styles.materialStatsStrip}>
            <View style={styles.materialStatItem}>
              <Text style={styles.materialStatValue}>{formatCurrency(totalMaterialSpend)}</Text>
              <Text style={styles.materialStatLabel}>Totaal besteed</Text>
            </View>
            <View style={styles.materialStatDivider} />
            <View style={styles.materialStatItem}>
              <Text style={styles.materialStatValue}>{pendingMaterials.length}</Text>
              <Text style={styles.materialStatLabel}>In bestelling</Text>
            </View>
            <View style={styles.materialStatDivider} />
            <View style={styles.materialStatItem}>
              <Text style={[styles.materialStatValue, topSupplier ? { fontSize: 13 } : undefined]} numberOfLines={1}>
                {topSupplier?.name ?? '-'}
              </Text>
              <Text style={styles.materialStatLabel}>Top leverancier</Text>
            </View>
          </View>

          {/* Sale alerts */}
          {saleAlerts.length > 0 && (
            <View style={styles.saleAlertsCard}>
              <View style={styles.saleAlertsHeader}>
                <Ionicons name="pricetag" size={14} color={SemanticColors.feedbackSuccess} />
                <Text style={styles.saleAlertsTitle}>Actie-aanbiedingen</Text>
              </View>
              {saleAlerts.map((po) => (
                <View key={po.id} style={styles.saleAlertRow}>
                  <Text style={styles.saleAlertName} numberOfLines={1}>{po.materialName}</Text>
                  <View style={styles.saleAlertPrices}>
                    {po.regularPrice && (
                      <Text style={styles.saleAlertOldPrice}>
                        {formatCurrency(po.regularPrice)}
                      </Text>
                    )}
                    <Text style={styles.saleAlertNewPrice}>
                      {formatCurrency(po.price)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

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

      <View style={{ height: 100 }} />
    </ScrollView>
  );

  const renderJobsTab = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Jobs Stats Banner */}
      <View style={styles.statsBanner}>
        <View style={styles.statsBannerItem}>
          <Text style={styles.statsBannerValue}>{activeJobs.length}</Text>
          <Text style={styles.statsBannerLabel}>Active</Text>
        </View>
        <View style={styles.statsBannerDivider} />
        <View style={styles.statsBannerItem}>
          <Text style={[styles.statsBannerValue, { color: SemanticColors.feedbackSuccess }]}>
            {jobsReadyToComplete.length}
          </Text>
          <Text style={styles.statsBannerLabel}>To Complete</Text>
        </View>
        <View style={styles.statsBannerDivider} />
        <View style={styles.statsBannerItem}>
          <Text style={[styles.statsBannerValue, { color: SemanticColors.feedbackInfo }]}>
            {jobsReadyForHandover.length}
          </Text>
          <Text style={styles.statsBannerLabel}>Handover</Text>
        </View>
      </View>

      {/* Jobs Ready to Complete - Evidence Capture */}
      {jobsReadyToComplete.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Ready to Complete</Text>
            <View style={styles.completeHint}>
              <Ionicons name="camera" size={12} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.completeHintText}>Add photos → Generate invoice</Text>
            </View>
          </View>
          <View style={styles.completeJobsList}>
            {jobsReadyToComplete.map((job) => (
              <Pressable
                key={job.id}
                style={styles.completeJobCard}
                onPress={() => router.push('/contractor/closeout')}
              >
                <View style={styles.completeJobIcon}>
                  <Ionicons name="checkmark-circle" size={24} color={SemanticColors.feedbackSuccess} />
                </View>
                <View style={styles.completeJobContent}>
                  <Text style={styles.completeJobTitle}>{job.title}</Text>
                  <Text style={styles.completeJobCustomer}>{job.customerId ?? ''}</Text>
                </View>
                <View style={styles.completeJobAction}>
                  <View style={styles.completeButton}>
                    <Ionicons name="camera" size={14} color="#fff" />
                    <Text style={styles.completeButtonText}>Complete</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Jobs Ready for Handover - P0 Feature */}
      {jobsReadyForHandover.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Ready for Handover</Text>
            <View style={styles.handoverHint}>
              <Ionicons name="gift" size={12} color={SemanticColors.feedbackInfo} />
              <Text style={styles.handoverHintText}>Build handover package</Text>
            </View>
          </View>
          <View style={styles.handoverJobsList}>
            {jobsReadyForHandover.map((job) => (
              <Pressable
                key={job.id}
                style={styles.handoverJobCard}
                onPress={() => router.push(`/contractor/handover/${job.id}`)}
              >
                <View style={styles.handoverJobIcon}>
                  <Ionicons name="gift" size={24} color={SemanticColors.feedbackInfo} />
                </View>
                <View style={styles.handoverJobContent}>
                  <Text style={styles.handoverJobTitle}>{job.title}</Text>
                  <Text style={styles.handoverJobCustomer}>{job.customerId ?? ''}</Text>
                </View>
                <View style={styles.handoverJobAction}>
                  <View style={styles.handoverButton}>
                    <Ionicons name="document-attach" size={14} color="#fff" />
                    <Text style={styles.handoverButtonText}>Handover</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Active Jobs */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Jobs</Text>
          <Pressable style={styles.seeAllButton}>
            <Text style={styles.seeAllText}>View all</Text>
            <Ionicons name="chevron-forward" size={14} color={CONTRACTOR_COLOR} />
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
                      {job.description ?? ''}
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
                    <Text style={styles.jobDetailText}>{new Date(job.updatedAt).toLocaleDateString(undefined)}</Text>
                  </View>
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
              <Ionicons name="chevron-forward" size={14} color={CONTRACTOR_COLOR} />
            </Pressable>
          </View>
          <View style={styles.quotesList}>
            {pendingQuotes.map((quote) => (
              <Pressable key={quote.id} style={styles.quoteCard}>
                <View style={styles.quoteHeader}>
                  <Text style={styles.quoteRef}>{quote.id}</Text>
                  <View
                    style={[
                      styles.quoteStatus,
                      { backgroundColor: SemanticColors.feedbackInfoBg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.quoteStatusText,
                        { color: SemanticColors.feedbackInfo },
                      ]}
                    >
                      Sent
                    </Text>
                  </View>
                </View>
                <Text style={styles.quoteTitle}>{quote.job || quote.customer}</Text>
                <View style={styles.quoteFooter}>
                  <Text style={styles.quoteExpiry}>{quote.lastUpdated}</Text>
                  <Text style={styles.quoteAmount}>{formatCurrency(quote.amount)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );

  const renderMoneyTab = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Money Stats Banner */}
      <View style={[styles.statsBanner, { backgroundColor: SemanticColors.feedbackSuccessBg }]}>
        <View style={styles.statsBannerItem}>
          <Text style={[styles.statsBannerValue, { color: SemanticColors.feedbackSuccess }]}>
            {formatCurrency(metrics.revenueThisMonth)}
          </Text>
          <Text style={styles.statsBannerLabel}>This Month</Text>
        </View>
        <View style={styles.statsBannerDivider} />
        <View style={styles.statsBannerItem}>
          <Text style={[styles.statsBannerValue, { color: SemanticColors.feedbackWarning }]}>
            {formatCurrency(metrics.invoicesOutstandingValue)}
          </Text>
          <Text style={styles.statsBannerLabel}>Outstanding</Text>
        </View>
        <View style={styles.statsBannerDivider} />
        <View style={styles.statsBannerItem}>
          <Text style={[styles.statsBannerValue, { color: SemanticColors.feedbackError }]}>
            {metrics.overdueInvoices}
          </Text>
          <Text style={styles.statsBannerLabel}>Overdue</Text>
        </View>
      </View>

      {/* Outstanding Invoices */}
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
          {outstandingInvoices.map((invoice) => {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + invoice.dueInDays);
            return (
              <Pressable key={invoice.id} style={styles.invoiceCard}>
                <View style={styles.invoiceHeader}>
                  <Text style={styles.invoiceNumber}>{invoice.id}</Text>
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
                    Due {dueDate.toLocaleDateString(undefined)}
                  </Text>
                  <Text style={styles.invoiceAmount}>{formatCurrency(invoice.amount)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Performance Snapshot */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Performance</Text>
        <View style={styles.performanceGrid}>
          <View style={styles.performanceCard}>
            <Text style={styles.performanceValue}>{metrics.activeJobsCount}</Text>
            <Text style={styles.performanceLabel}>Active Jobs</Text>
          </View>
          <View style={styles.performanceCard}>
            <Text style={styles.performanceValue}>{metrics.quotesOutstanding}</Text>
            <Text style={styles.performanceLabel}>Quotes Out</Text>
          </View>
          <View style={styles.performanceCard}>
            <Text style={styles.performanceValue}>{metrics.scheduledJobsCount}</Text>
            <Text style={styles.performanceLabel}>Scheduled</Text>
          </View>
          <View style={styles.performanceCard}>
            <Text style={styles.performanceValue}>{metrics.overdueInvoices}</Text>
            <Text style={styles.performanceLabel}>Overdue</Text>
          </View>
        </View>
      </View>

      {/* Money Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsList}>
          <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/payments')}>
            <View style={[styles.actionIcon, { backgroundColor: '#CC006620' }]}>
              <Ionicons name="card" size={20} color="#CC0066" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Accept Payments</Text>
              <Text style={styles.actionSubtitle}>iDEAL & Mollie integration</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
          <Pressable style={styles.actionItem}>
            <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackSuccessBg }]}>
              <Ionicons name="receipt" size={20} color={SemanticColors.feedbackSuccess} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Create Invoice</Text>
              <Text style={styles.actionSubtitle}>Generate from completed job</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
          <Pressable style={styles.actionItem}>
            <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackInfoBg }]}>
              <Ionicons name="send" size={20} color={SemanticColors.feedbackInfo} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Send Reminders</Text>
              <Text style={styles.actionSubtitle}>Chase overdue payments</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
        </View>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );

  const renderToolsTab = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Power Tools */}
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
          <Pressable style={styles.toolCard} onPress={() => router.push('/contractor/purchase-orders')}>
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

      {/* Vasco Intelligence */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Intelligence</Text>
        <Pressable style={styles.intelligenceCard} onPress={() => setShowIntelligence(true)}>
          <View style={styles.intelligenceCardIcon}>
            <Ionicons name="sparkles" size={28} color={Palette.hermesOrange} />
          </View>
          <View style={styles.intelligenceCardContent}>
            <Text style={styles.intelligenceCardTitle}>Vasco Intelligence</Text>
            <Text style={styles.intelligenceCardSubtitle}>AI-powered insights & recommendations</Text>
            <View style={styles.intelligenceCardStats}>
              <View style={styles.intelligenceCardStat}>
                <Text style={styles.intelligenceCardStatValue}>{formatCurrency(4280)}</Text>
                <Text style={styles.intelligenceCardStatLabel}>saved</Text>
              </View>
              <View style={styles.intelligenceCardStat}>
                <Text style={styles.intelligenceCardStatValue}>156</Text>
                <Text style={styles.intelligenceCardStatLabel}>data points</Text>
              </View>
              <View style={styles.intelligenceCardStat}>
                <Text style={styles.intelligenceCardStatValue}>3</Text>
                <Text style={styles.intelligenceCardStatLabel}>new tips</Text>
              </View>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={SemanticColors.textTertiary} />
        </Pressable>
      </View>

      {/* Business ROI */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Business ROI</Text>
        <Pressable style={styles.roiCard} onPress={() => setShowROI(true)}>
          <View style={styles.roiCardIcon}>
            <Ionicons name="analytics" size={28} color={SemanticColors.feedbackSuccess} />
          </View>
          <View style={styles.roiCardContent}>
            <Text style={styles.roiCardTitle}>Hours Saved Dashboard</Text>
            <Text style={styles.roiCardSubtitle}>Track your time savings & ROI</Text>
            <View style={styles.roiCardHighlight}>
              <Text style={styles.roiCardHighlightValue}>12.5 uur</Text>
              <Text style={styles.roiCardHighlightLabel}>saved this week</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={SemanticColors.textTertiary} />
        </Pressable>
      </View>

      {/* Additional Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>More</Text>
        <View style={styles.actionsList}>
          <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/decisions')}>
            <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackWarningBg }]}>
              <Ionicons name="people" size={20} color={SemanticColors.feedbackWarning} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Customer Decisions</Text>
              <Text style={styles.actionSubtitle}>Track pending approvals</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
          <Pressable style={styles.actionItem}>
            <View style={[styles.actionIcon, { backgroundColor: SemanticColors.surfaceSecondary }]}>
              <Ionicons name="settings" size={20} color={SemanticColors.textSecondary} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Settings</Text>
              <Text style={styles.actionSubtitle}>Account & preferences</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
        </View>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Good morning</Text>
            <Text style={styles.businessName}>{businessProfile.businessName || 'My Business'}</Text>
          </View>
          <View style={styles.tradeBadge}>
            <Ionicons name="color-palette" size={14} color={CONTRACTOR_COLOR} />
            <Text style={styles.tradeBadgeText}>Painter</Text>
          </View>
        </View>

        {/* Status Pills */}
        <View style={styles.statusPills}>
          <Pressable
            style={[styles.statusPill, outstandingInvoices.length > 0 && styles.statusPillWarning]}
            onPress={() => setActiveTab('money')}
          >
            <Ionicons name="wallet" size={14} color={outstandingInvoices.length > 0 ? SemanticColors.feedbackWarning : SemanticColors.textSecondary} />
            <Text style={[styles.statusPillText, outstandingInvoices.length > 0 && { color: SemanticColors.feedbackWarning }]}>
              {outstandingInvoices.length} Outstanding
            </Text>
          </Pressable>
          <Pressable
            style={[styles.statusPill, activeJobs.length > 0 && styles.statusPillActive]}
            onPress={() => setActiveTab('jobs')}
          >
            <Ionicons name="construct" size={14} color={activeJobs.length > 0 ? CONTRACTOR_COLOR : SemanticColors.textSecondary} />
            <Text style={[styles.statusPillText, activeJobs.length > 0 && styles.statusPillTextActive]}>
              {activeJobs.length} Jobs
            </Text>
          </Pressable>
          <View style={styles.statusPill}>
            <Ionicons name="calendar" size={14} color={SemanticColors.textSecondary} />
            <Text style={styles.statusPillText}>{todaysSchedule.length} Today</Text>
          </View>
        </View>
      </View>

      {/* Internal tab bar removed - using bottom navigation instead */}

      {/* Tab Content */}
      {activeTab === 'dashboard' && renderDashboardTab()}
      {activeTab === 'jobs' && renderJobsTab()}
      {activeTab === 'money' && renderMoneyTab()}
      {activeTab === 'tools' && renderToolsTab()}

      {/* Intelligence Modal */}
      <Modal
        visible={showIntelligence}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <IntelligenceDashboard onClose={() => setShowIntelligence(false)} />
      </Modal>

      {/* ROI Dashboard Modal */}
      <Modal
        visible={showROI}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowROI(false)} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color={SemanticColors.textSecondary} />
            </Pressable>
            <Text style={styles.modalTitle}>Business ROI</Text>
            <View style={styles.modalHeaderRight} />
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <HoursSavedCard />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  tabContent: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },

  // Header
  header: {
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  headerTop: {
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
    fontSize: 22,
    fontWeight: '700',
  },
  tradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: CONTRACTOR_COLOR + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tradeBadgeText: {
    color: CONTRACTOR_COLOR,
    fontSize: 12,
    fontWeight: '600',
  },

  // Status Pills
  statusPills: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusPillActive: {
    backgroundColor: CONTRACTOR_COLOR + '15',
  },
  statusPillWarning: {
    backgroundColor: SemanticColors.feedbackWarningBg,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '500',
    color: SemanticColors.textSecondary,
  },
  statusPillTextActive: {
    color: CONTRACTOR_COLOR,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    paddingHorizontal: Spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: 4,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: CONTRACTOR_COLOR,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: SemanticColors.textTertiary,
  },
  tabLabelActive: {
    color: CONTRACTOR_COLOR,
    fontWeight: '600',
  },

  // Stats Banner
  statsBanner: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  statsBannerItem: {
    flex: 1,
    alignItems: 'center',
  },
  statsBannerValue: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  statsBannerLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  statsBannerDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginHorizontal: Spacing.sm,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
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

  // Hero Savings Card
  heroSavingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.feedbackSuccessBg,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackSuccess + '30',
    gap: Spacing.md,
  },
  heroSavingsIcon: {
    width: 52,
    height: 52,
    borderRadius: 13,
    backgroundColor: SemanticColors.feedbackSuccess + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSavingsContent: {
    flex: 1,
  },
  heroSavingsValue: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  heroSavingsLabel: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  heroSavingsSubtext: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  heroSavingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  heroSavingsButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: CONTRACTOR_COLOR,
  },

  // Customer Decisions Alert
  decisionsAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.feedbackWarningBg,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackWarning + '30',
    gap: Spacing.sm,
  },
  decisionsAlertUrgent: {
    backgroundColor: SemanticColors.feedbackErrorBg,
    borderColor: SemanticColors.feedbackError + '30',
  },
  decisionsAlertIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decisionsAlertContent: {
    flex: 1,
  },
  decisionsAlertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  decisionsAlertSubtitle: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // Intelligence Widget
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

  // Section
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
    color: CONTRACTOR_COLOR,
    fontSize: 13,
    fontWeight: '600',
  },

  // Schedule
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

  // Quick Actions
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

  // Jobs List
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

  // Complete Jobs
  completeJobsList: {
    gap: Spacing.xs,
  },
  completeJobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.feedbackSuccessBg,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackSuccess + '20',
    gap: Spacing.sm,
  },
  completeJobIcon: {
    width: 44,
    height: 44,
    borderRadius: 11,
    backgroundColor: SemanticColors.feedbackSuccess + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeJobContent: {
    flex: 1,
  },
  completeJobTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  completeJobCustomer: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  completeJobAction: {
    alignItems: 'flex-end',
    gap: 6,
  },
  completeJobAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackSuccess,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  completeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  completeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  completeHintText: {
    fontSize: 10,
    fontWeight: '500',
    color: SemanticColors.feedbackSuccess,
  },

  // Handover Jobs
  handoverJobsList: {
    gap: Spacing.xs,
  },
  handoverJobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.feedbackInfoBg,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackInfo + '20',
    gap: Spacing.sm,
  },
  handoverJobIcon: {
    width: 44,
    height: 44,
    borderRadius: 11,
    backgroundColor: SemanticColors.feedbackInfo + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handoverJobContent: {
    flex: 1,
  },
  handoverJobTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  handoverJobCustomer: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  handoverJobAction: {
    alignItems: 'flex-end',
    gap: 6,
  },
  handoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackInfo,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  handoverButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  handoverHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackInfoBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  handoverHintText: {
    fontSize: 10,
    fontWeight: '500',
    color: SemanticColors.feedbackInfo,
  },

  // Quotes
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
    color: CONTRACTOR_COLOR,
    fontSize: 14,
    fontWeight: '700',
  },

  // Invoices
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

  // Performance Grid
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

  // Tools Grid
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

  // Intelligence Card
  intelligenceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.pastelOrange + '20',
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.hermesOrange + '30',
    gap: Spacing.md,
  },
  intelligenceCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: Palette.hermesOrange + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  intelligenceCardContent: {
    flex: 1,
    gap: 4,
  },
  intelligenceCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  intelligenceCardSubtitle: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  intelligenceCardStats: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: 6,
  },
  intelligenceCardStat: {
    alignItems: 'center',
  },
  intelligenceCardStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Palette.hermesOrange,
  },
  intelligenceCardStatLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },

  // ROI Card
  roiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.feedbackSuccessBg,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackSuccess + '30',
    gap: Spacing.md,
  },
  roiCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: SemanticColors.feedbackSuccess + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roiCardContent: {
    flex: 1,
    gap: 4,
  },
  roiCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  roiCardSubtitle: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  roiCardHighlight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 4,
  },
  roiCardHighlightValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  roiCardHighlightLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },

  // Actions List
  actionsList: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
    gap: Spacing.sm,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  actionSubtitle: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  modalHeaderRight: {
    width: 40,
  },
  modalContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: 100,
  },

  // Material Spend KPIs
  materialStatsStrip: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  materialStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  materialStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  materialStatLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  materialStatDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginHorizontal: Spacing.xs,
  },
  saleAlertsCard: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackSuccess + '20',
    gap: Spacing.xs,
  },
  saleAlertsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  saleAlertsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
  },
  saleAlertRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  saleAlertName: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.textPrimary,
    fontWeight: '500',
  },
  saleAlertPrices: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saleAlertOldPrice: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    textDecorationLine: 'line-through',
  },
  saleAlertNewPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
});
