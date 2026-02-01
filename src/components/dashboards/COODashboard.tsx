import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { cooApi } from '../../api/vascoApi';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import {
  mockProjects,
  mockDeliveryMetrics,
  getProjectById,
} from '../../data/mockProjects';
import {
  formatCurrency,
  formatPercent,
  calculateScheduleVariance,
  calculatePermitStatus,
  getPermitClock,
  getCurrencyForCountry,
  PERMIT_CLOCKS,
} from '../../modules/countryModules';
import {
  generatePermitAlerts,
  generatePermitDashboard,
  getConditionsByStatus,
  type PermitAlert,
  type PermitDashboardData,
} from '../../modules/permitTracker';
import type { Project, DeliveryMetrics, ScheduleActivity, Permit } from '../../types/buildos';
import { hapticError, hapticSuccess } from '../../utils/haptics';

type ScheduleRecommendation = {
  phase: string;
  recommendation: 'on_track' | 'add_buffer' | 'replan';
  reason?: string;
};

export function COODashboard() {
  // Project selection
  const [selectedProjectId, setSelectedProjectId] = useState<string>('uk-001');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeSection, setActiveSection] = useState<'schedule' | 'permits' | 'procurement' | 'actions'>('schedule');

  // API results
  const [scheduleRecommendations, setScheduleRecommendations] = useState<ScheduleRecommendation[] | null>(null);
  const [generatedReforecast, setGeneratedReforecast] = useState<string | null>(null);
  const [generatedChangeOrderSummary, setGeneratedChangeOrderSummary] = useState<string | null>(null);
  const [generatedPermitPackage, setGeneratedPermitPackage] = useState<string | null>(null);

  // Derived data
  const selectedProject = useMemo(() => getProjectById(selectedProjectId), [selectedProjectId]);
  const deliveryMetrics = useMemo(() => mockDeliveryMetrics[selectedProjectId], [selectedProjectId]);
  const currency = useMemo(() => selectedProject ? getCurrencyForCountry(selectedProject.country) : 'GBP', [selectedProject]);

  // Schedule health calculations
  const scheduleHealth = useMemo(() => {
    if (!selectedProject || !deliveryMetrics) return null;

    const plannedEnd = selectedProject.plannedEndDate;
    const forecastEnd = selectedProject.forecastEndDate || plannedEnd;
    const variance = calculateScheduleVariance(plannedEnd, forecastEnd);

    const criticalActivities = selectedProject.scheduleActivities.filter(a => a.isCriticalPath);
    const delayedActivities = selectedProject.scheduleActivities.filter(a => a.status === 'delayed' || a.status === 'in-progress');
    const completedActivities = selectedProject.scheduleActivities.filter(a => a.status === 'completed');

    return {
      spi: deliveryMetrics.spiSchedulePerformanceIndex,
      varianceDays: variance.varianceDays,
      status: variance.status,
      criticalPathFloat: deliveryMetrics.criticalPathFloat,
      progressPercent: completedActivities.length / selectedProject.scheduleActivities.length * 100,
      criticalActivities,
      delayedCount: delayedActivities.length,
    };
  }, [selectedProject, deliveryMetrics]);

  // Permit tracking
  const permitStatuses = useMemo(() => {
    if (!selectedProject) return [];

    return selectedProject.permits.map((permit) => {
      if (!permit.submissionDate || !permit.targetDecisionDate) {
        return { permit, status: null };
      }

      const status = calculatePermitStatus(
        permit.submissionDate,
        permit.targetDecisionDate
      );

      return { permit, status };
    });
  }, [selectedProject]);

  // Enhanced permit dashboard data
  const permitDashboard = useMemo<PermitDashboardData | null>(() => {
    if (!selectedProject) return null;
    return generatePermitDashboard(selectedProject.permits);
  }, [selectedProject]);

  // All permit alerts
  const permitAlerts = useMemo<PermitAlert[]>(() => {
    if (!selectedProject) return [];
    return selectedProject.permits.flatMap((permit) => generatePermitAlerts(permit));
  }, [selectedProject]);

  // Conditions by status
  const conditionsStatus = useMemo(() => {
    if (!selectedProject) return { pending: [], discharged: [], overdue: [] };
    return getConditionsByStatus(selectedProject.permits);
  }, [selectedProject]);

  // Procurement risk
  const procurementRisk = useMemo(() => {
    if (!deliveryMetrics) return null;

    const totalContracts = deliveryMetrics.contractsAwarded + deliveryMetrics.contractsPending;
    const awardedPercent = totalContracts > 0
      ? deliveryMetrics.contractsAwarded / totalContracts
      : 0;

    return {
      awarded: deliveryMetrics.contractsAwarded,
      pending: deliveryMetrics.contractsPending,
      awardedPercent,
      riskValue: deliveryMetrics.procurementRiskValue,
      changeOrders: {
        submitted: deliveryMetrics.changeOrdersSubmitted,
        approved: deliveryMetrics.changeOrdersApproved,
        value: deliveryMetrics.changeOrdersValue,
        avgCycleTime: deliveryMetrics.avgChangeOrderCycleTime,
      },
    };
  }, [deliveryMetrics]);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleError = (err: unknown) => {
    setError(err instanceof Error ? err.message : 'An error occurred');
    hapticError();
  };

  const getScheduleRecommendations = async () => {
    clearMessages();
    if (!selectedProjectId) {
      setError('No project selected');
      return;
    }
    setLoading(true);
    try {
      const data = await cooApi.getRecommendations(selectedProjectId);
      setScheduleRecommendations(data);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const generateReforecast = () => {
    clearMessages();
    if (!selectedProject || !deliveryMetrics || !scheduleHealth) {
      setError('No project data available');
      return;
    }

    const criticalPath = selectedProject.scheduleActivities.filter(a => a.isCriticalPath);
    const delayedActivities = selectedProject.scheduleActivities.filter(
      a => a.status === 'delayed' || (a.status === 'in-progress' && a.forecastFinish && a.forecastFinish > a.plannedFinish)
    );

    const reforecast = `
SCHEDULE REFORECAST REPORT
==========================
Project: ${selectedProject.name}
Generated: ${new Date().toISOString().split('T')[0]}
Period: ${selectedProject.phase}

EXECUTIVE SUMMARY
-----------------
Current SPI: ${scheduleHealth.spi.toFixed(2)}
Schedule Status: ${scheduleHealth.status.toUpperCase()}
Days Variance: ${scheduleHealth.varianceDays > 0 ? '+' : ''}${scheduleHealth.varianceDays} days
Critical Path Float: ${scheduleHealth.criticalPathFloat} days

CURRENT DATES
-------------
Planned Completion: ${selectedProject.plannedEndDate}
Forecast Completion: ${selectedProject.forecastEndDate || 'TBD'}
Baseline Start: ${selectedProject.plannedStartDate}
Actual Start: ${selectedProject.actualStartDate || 'Not started'}

CRITICAL PATH ANALYSIS
----------------------
${criticalPath.map(a => `- ${a.name} (${a.wbsCode}): ${a.percentComplete}% complete
  Planned: ${a.plannedFinish} | Forecast: ${a.forecastFinish || a.plannedFinish}`).join('\n')}

DELAYED ACTIVITIES (${delayedActivities.length})
${delayedActivities.length > 0 ? delayedActivities.map(a => {
  const delay = a.forecastFinish
    ? Math.ceil((new Date(a.forecastFinish).getTime() - new Date(a.plannedFinish).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  return `- ${a.name}: ${delay > 0 ? delay + ' days behind' : 'At risk'}`;
}).join('\n') : 'None identified'}

RECOMMENDED RECOVERY ACTIONS
----------------------------
${scheduleHealth.spi < 0.95 ? `1. Review critical path resource loading
2. Consider acceleration options for delayed activities
3. Evaluate scope reduction opportunities
4. Assess weather/site access constraints` : `1. Maintain current execution pace
2. Monitor upcoming critical milestones
3. Proactive constraint management`}

PROCUREMENT IMPACT
------------------
Contracts Awarded: ${procurementRisk?.awarded || 0} / ${(procurementRisk?.awarded || 0) + (procurementRisk?.pending || 0)}
At-Risk Value: ${formatCurrency(procurementRisk?.riskValue || 0, currency)}
Change Orders Pending: ${procurementRisk?.changeOrders.submitted || 0} - ${procurementRisk?.changeOrders.approved || 0}

NEXT PERIOD FOCUS
-----------------
${criticalPath.filter(a => a.status === 'in-progress' || a.status === 'not-started').slice(0, 3).map(a => `- Complete: ${a.name}`).join('\n')}

Generated by: BuildOS COO Agent
Report Date: ${new Date().toISOString()}
    `.trim();

    setGeneratedReforecast(reforecast);
    setSuccess('Reforecast report generated');
    hapticSuccess();
  };

  const generateChangeOrderSummary = () => {
    clearMessages();
    if (!selectedProject || !procurementRisk) {
      setError('No project data available');
      return;
    }

    const pendingCOs = procurementRisk.changeOrders.submitted - procurementRisk.changeOrders.approved;

    const summary = `
CHANGE ORDER SUMMARY REPORT
${'='.repeat(50)}
Project: ${selectedProject.name}
Period: ${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
Currency: ${currency}

OVERVIEW
--------
Total Change Orders: ${procurementRisk.changeOrders.submitted}
Approved: ${procurementRisk.changeOrders.approved}
Pending Review: ${pendingCOs}
Approval Rate: ${formatPercent(procurementRisk.changeOrders.approved / Math.max(1, procurementRisk.changeOrders.submitted))}

FINANCIAL IMPACT
----------------
Approved Value: ${fmt(procurementRisk.changeOrders.value)}
% of Original Contract: ${formatPercent(procurementRisk.changeOrders.value / Math.max(1, selectedProject.totalBudget))}
Contingency Impact: ${fmt(Math.min(procurementRisk.changeOrders.value, selectedProject.contingency - selectedProject.contingencyUsed))}

PROCESSING METRICS
------------------
Average Cycle Time: ${procurementRisk.changeOrders.avgCycleTime > 0 ? procurementRisk.changeOrders.avgCycleTime + ' days' : 'N/A'}
Target Cycle Time: 14 days
Performance: ${procurementRisk.changeOrders.avgCycleTime <= 14 ? 'Meeting target' : 'Above target - review process'}

BY CONTRACT
-----------
${selectedProject.contracts.map(c => {
  const coCost = c.variations?.reduce((sum: number, vo) => sum + vo.amount, 0) || 0;
  const coCount = c.variations?.length || 0;
  return `${c.counterparty}:
  Original: ${fmt(c.contractSum)}
  Variations: ${coCount} (${fmt(coCost)})
  Current: ${fmt(c.contractSum + coCost)}`;
}).join('\n\n')}

TREND ANALYSIS
--------------
${procurementRisk.changeOrders.value > selectedProject.contingency * 0.5
  ? '⚠️  Change order value exceeds 50% of contingency - close monitoring required'
  : '✓ Change order levels within acceptable range'}

${pendingCOs > 3
  ? '⚠️  ' + pendingCOs + ' pending change orders - expedite review cycle'
  : '✓ Pending queue manageable'}

RECOMMENDATIONS
---------------
1. ${pendingCOs > 0 ? 'Expedite review of pending change orders' : 'Maintain change order review process'}
2. ${procurementRisk.changeOrders.avgCycleTime > 14 ? 'Review and streamline approval workflow' : 'Current approval cycle is efficient'}
3. Continue proactive scope management to minimize further changes

Generated by: BuildOS COO Agent
Report Date: ${new Date().toISOString()}
    `.trim();

    setGeneratedChangeOrderSummary(summary);
    setSuccess('Change order summary generated');
    hapticSuccess();
  };

  const generatePermitPackage = () => {
    clearMessages();
    if (!selectedProject) {
      setError('No project data available');
      return;
    }

    const pendingPermits = selectedProject.permits.filter(p =>
      p.status === 'under-review' || p.status === 'submitted' || p.status === 'not-submitted'
    );
    const approvedPermits = selectedProject.permits.filter(p =>
      p.status === 'approved' || p.status === 'approved-with-conditions'
    );

    const permitPackage = `
PERMIT STATUS PACKAGE
${'='.repeat(50)}
Project: ${selectedProject.name}
Location: ${selectedProject.country === 'UK' ? 'United Kingdom' : selectedProject.country === 'NL' ? 'Netherlands' : 'Germany'}
Generated: ${new Date().toISOString().split('T')[0]}

EXECUTIVE SUMMARY
-----------------
Total Permits Required: ${selectedProject.permits.length}
Approved: ${approvedPermits.length}
Pending/Under Review: ${pendingPermits.length}
Completion: ${formatPercent(approvedPermits.length / Math.max(1, selectedProject.permits.length))}

STATUTORY TIMELINES (${selectedProject.country})
${'─'.repeat(40)}
${PERMIT_CLOCKS.filter(c => c.country === selectedProject.country).map(clock =>
  `${clock.permitType}: ${clock.standardDays} days${clock.extendedDays ? ` (extended: ${clock.extendedDays}d)` : ''}`
).join('\n')}

APPROVED PERMITS
----------------
${approvedPermits.length > 0 ? approvedPermits.map(p => `
✓ ${p.type}
  Reference: ${p.reference || 'Pending'}
  Authority: ${p.authority}
  Approved: ${p.actualDecisionDate || 'N/A'}
  Conditions: ${p.conditions.length > 0 ? p.conditions.filter(c => !c.dischargedDate).length + ' outstanding' : 'None'}
`).join('') : 'No permits approved yet'}

PENDING PERMITS
---------------
${pendingPermits.length > 0 ? pendingPermits.map(p => {
  const status = p.submissionDate && p.targetDecisionDate
    ? calculatePermitStatus(p.submissionDate, p.targetDecisionDate)
    : null;
  return `
⏳ ${p.type}
  Authority: ${p.authority}
  Status: ${p.status.replace(/-/g, ' ')}
  ${p.submissionDate ? `Submitted: ${p.submissionDate}` : 'Submission: Pending'}
  ${p.targetDecisionDate ? `Target Decision: ${p.targetDecisionDate}` : ''}
  ${status ? `Days Remaining: ${status.daysRemaining > 0 ? status.daysRemaining : 'OVERDUE by ' + Math.abs(status.daysRemaining) + ' days'}` : ''}
`;
}).join('') : 'All permits approved'}

CONDITIONS TRACKER
------------------
${selectedProject.permits.flatMap(p => p.conditions).length > 0 ?
  `Total Conditions: ${selectedProject.permits.flatMap(p => p.conditions).length}
Discharged: ${selectedProject.permits.flatMap(p => p.conditions).filter(c => c.dischargedDate).length}
Outstanding: ${selectedProject.permits.flatMap(p => p.conditions).filter(c => !c.dischargedDate).length}

Outstanding Conditions:
${selectedProject.permits.flatMap(p => p.conditions.filter(c => !c.dischargedDate).map(c => ({...c, permitType: p.type})))
  .slice(0, 5)
  .map(c => `- ${c.permitType}: ${c.description}${c.triggerPoint ? ` (Trigger: ${c.triggerPoint})` : ''}`)
  .join('\n')}`
  : 'No conditions to track'}

RISK ASSESSMENT
---------------
${pendingPermits.some(p => p.submissionDate && p.targetDecisionDate && calculatePermitStatus(p.submissionDate, p.targetDecisionDate).status === 'overdue')
  ? '🔴 CRITICAL: Overdue permit decisions - escalate immediately'
  : pendingPermits.some(p => p.submissionDate && p.targetDecisionDate && calculatePermitStatus(p.submissionDate, p.targetDecisionDate).status === 'at-risk')
    ? '🟡 AT RISK: Permits approaching decision deadline'
    : '🟢 ON TRACK: All permits within statutory timelines'}

NEXT STEPS
----------
${pendingPermits.filter(p => p.status === 'not-submitted').length > 0
  ? `1. Prepare and submit ${pendingPermits.filter(p => p.status === 'not-submitted').length} pending permit applications`
  : '1. Continue monitoring active permit applications'}
2. Follow up with authorities on pending decisions
3. Prepare condition discharge applications as construction progresses

Generated by: BuildOS COO Agent
Report Date: ${new Date().toISOString()}
    `.trim();

    setGeneratedPermitPackage(permitPackage);
    setSuccess('Permit status package generated');
    hapticSuccess();
  };

  const getStatusColor = (status: 'ahead' | 'on-track' | 'delayed' | string) => {
    switch (status) {
      case 'ahead':
        return Colors.success;
      case 'on-track':
        return Colors.accentMuted;
      case 'delayed':
        return Colors.danger;
      default:
        return Colors.muted;
    }
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'on_track':
        return Colors.success;
      case 'add_buffer':
        return Colors.warning;
      case 'replan':
        return Colors.danger;
      default:
        return Colors.muted;
    }
  };

  const getPermitStatusColor = (status: 'on-track' | 'at-risk' | 'overdue') => {
    switch (status) {
      case 'on-track':
        return Colors.success;
      case 'at-risk':
        return Colors.warning;
      case 'overdue':
        return Colors.danger;
    }
  };

  const fmt = (amount: number) => formatCurrency(amount, currency);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={Typography.title}>COO Dashboard</Text>

      {/* Project Selector */}
      <View style={styles.projectSelector}>
        {mockProjects.map((project) => (
          <Pressable
            key={project.id}
            style={[
              styles.projectPill,
              selectedProjectId === project.id && styles.projectPillActive,
            ]}
            onPress={() => setSelectedProjectId(project.id)}
          >
            <Text style={styles.projectCountry}>{project.country}</Text>
            <Text
              style={[
                styles.projectName,
                selectedProjectId === project.id && styles.projectNameActive,
              ]}
              numberOfLines={1}
            >
              {project.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Section Tabs */}
      <View style={styles.tabRow}>
        {(['schedule', 'permits', 'procurement', 'actions'] as const).map((section) => (
          <Pressable
            key={section}
            style={[styles.tab, activeSection === section && styles.tabActive]}
            onPress={() => setActiveSection(section)}
          >
            <Text style={[styles.tabText, activeSection === section && styles.tabTextActive]}>
              {section === 'schedule' ? 'Schedule' :
               section === 'permits' ? 'Permits' :
               section === 'procurement' ? 'Procurement' : 'Actions'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Schedule Section */}
      {activeSection === 'schedule' && selectedProject && scheduleHealth && (
        <View style={styles.card}>
          <Text style={Typography.subtitle}>Schedule Performance</Text>

          {/* Schedule Health Banner */}
          <View style={[
            styles.healthBanner,
            scheduleHealth.status === 'ahead' && styles.healthGreen,
            scheduleHealth.status === 'on-track' && styles.healthBlue,
            scheduleHealth.status === 'delayed' && styles.healthRed,
          ]}>
            <View>
              <Text style={styles.healthStatus}>
                {scheduleHealth.status === 'ahead' ? 'Ahead of Schedule' :
                 scheduleHealth.status === 'on-track' ? 'On Track' :
                 'Behind Schedule'}
              </Text>
              <Text style={styles.healthVariance}>
                {scheduleHealth.varianceDays > 0 ? '+' : ''}{scheduleHealth.varianceDays} days
              </Text>
            </View>
            <View style={styles.spiCircle}>
              <Text style={styles.spiValue}>{scheduleHealth.spi.toFixed(2)}</Text>
              <Text style={styles.spiLabel}>SPI</Text>
            </View>
          </View>

          {/* KPIs */}
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{scheduleHealth.progressPercent.toFixed(0)}%</Text>
              <Text style={styles.kpiLabel}>Complete</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{scheduleHealth.criticalPathFloat}</Text>
              <Text style={styles.kpiLabel}>Float (days)</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{scheduleHealth.criticalActivities.length}</Text>
              <Text style={styles.kpiLabel}>Critical Tasks</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiValue, scheduleHealth.delayedCount > 0 && styles.kpiDanger]}>
                {scheduleHealth.delayedCount}
              </Text>
              <Text style={styles.kpiLabel}>Delayed</Text>
            </View>
          </View>

          {/* Key Dates */}
          <View style={styles.datesCard}>
            <Text style={styles.sectionLabel}>Key Dates</Text>
            <View style={styles.dateRow}>
              <Text style={Typography.body}>Planned Completion</Text>
              <Text style={Typography.body}>{selectedProject.plannedEndDate}</Text>
            </View>
            {selectedProject.forecastEndDate && (
              <View style={styles.dateRow}>
                <Text style={Typography.muted}>Forecast Completion</Text>
                <Text style={[
                  Typography.body,
                  { color: getStatusColor(scheduleHealth.status) },
                ]}>
                  {selectedProject.forecastEndDate}
                </Text>
              </View>
            )}
          </View>

          {/* Critical Path Activities */}
          <View style={styles.activitiesCard}>
            <Text style={styles.sectionLabel}>Critical Path</Text>
            {scheduleHealth.criticalActivities.slice(0, 5).map((activity) => (
              <View key={activity.id} style={styles.activityRow}>
                <View style={styles.activityInfo}>
                  <Text style={Typography.body}>{activity.name}</Text>
                  <Text style={Typography.muted}>{activity.wbsCode}</Text>
                </View>
                <View style={styles.activityProgress}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${activity.percentComplete}%` },
                        activity.status === 'delayed' && styles.progressDelayed,
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>{activity.percentComplete}%</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Get AI Recommendations */}
          <Pressable style={styles.button} onPress={getScheduleRecommendations}>
            <Text style={styles.buttonText}>Get Schedule Recommendations</Text>
          </Pressable>

          {scheduleRecommendations && (
            <View style={styles.recommendationsCard}>
              <Text style={styles.sectionLabel}>AI Recommendations</Text>
              {scheduleRecommendations.map((rec, index) => (
                <View key={index} style={styles.recRow}>
                  <Text style={Typography.body}>{rec.phase}</Text>
                  <View style={[
                    styles.recBadge,
                    { backgroundColor: getRecommendationColor(rec.recommendation) + '30' },
                  ]}>
                    <Text style={[
                      styles.recBadgeText,
                      { color: getRecommendationColor(rec.recommendation) },
                    ]}>
                      {rec.recommendation.replace('_', ' ')}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Permits Section */}
      {activeSection === 'permits' && selectedProject && permitDashboard && (
        <View style={styles.card}>
          <Text style={Typography.subtitle}>Permit Tracking</Text>

          {/* Urgent Alerts Banner */}
          {permitAlerts.filter(a => a.severity === 'critical').length > 0 && (
            <View style={styles.urgentAlertsBanner}>
              <Text style={styles.urgentAlertsTitle}>
                {permitAlerts.filter(a => a.severity === 'critical').length} Critical Alert{permitAlerts.filter(a => a.severity === 'critical').length > 1 ? 's' : ''}
              </Text>
              {permitAlerts.filter(a => a.severity === 'critical').slice(0, 2).map((alert) => (
                <View key={alert.id} style={styles.urgentAlertItem}>
                  <Text style={styles.urgentAlertText}>{alert.title}</Text>
                  <Text style={styles.urgentAlertAction}>{alert.actionRequired}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Permit Overview KPIs */}
          <View style={styles.permitKpiGrid}>
            <View style={styles.permitKpiCard}>
              <Text style={styles.permitKpiValue}>{permitDashboard.totalPermits}</Text>
              <Text style={styles.permitKpiLabel}>Total Permits</Text>
            </View>
            <View style={styles.permitKpiCard}>
              <Text style={[styles.permitKpiValue, { color: Colors.success }]}>
                {permitDashboard.byStatus.approved + permitDashboard.byStatus.approvedWithConditions}
              </Text>
              <Text style={styles.permitKpiLabel}>Approved</Text>
            </View>
            <View style={styles.permitKpiCard}>
              <Text style={[styles.permitKpiValue, { color: Colors.warning }]}>
                {permitDashboard.byStatus.pending}
              </Text>
              <Text style={styles.permitKpiLabel}>Pending</Text>
            </View>
            <View style={styles.permitKpiCard}>
              <Text style={styles.permitKpiValue}>
                {formatPercent(permitDashboard.conditionsProgress.percentComplete)}
              </Text>
              <Text style={styles.permitKpiLabel}>Conditions Done</Text>
            </View>
          </View>

          {/* Upcoming Deadlines */}
          {permitDashboard.upcomingDeadlines.length > 0 && (
            <View style={styles.upcomingDeadlinesCard}>
              <Text style={styles.sectionLabel}>Upcoming Deadlines</Text>
              {permitDashboard.upcomingDeadlines.slice(0, 3).map((deadline) => (
                <View key={deadline.permitId + deadline.deadline} style={styles.deadlineRow}>
                  <View style={styles.deadlineInfo}>
                    <Text style={Typography.body}>{deadline.permitType}</Text>
                    <Text style={Typography.muted}>{deadline.deadline}</Text>
                  </View>
                  <View style={[
                    styles.deadlineBadge,
                    deadline.daysRemaining <= 3 && styles.deadlineCritical,
                    deadline.daysRemaining > 3 && deadline.daysRemaining <= 7 && styles.deadlineWarning,
                    deadline.daysRemaining > 7 && styles.deadlineNormal,
                  ]}>
                    <Text style={styles.deadlineBadgeText}>
                      {deadline.daysRemaining}d
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Conditions Progress */}
          <View style={styles.conditionsProgressCard}>
            <View style={styles.conditionsProgressHeader}>
              <Text style={styles.sectionLabel}>Conditions Progress</Text>
              <Text style={styles.conditionsProgressPercent}>
                {permitDashboard.conditionsProgress.discharged}/{permitDashboard.conditionsProgress.total}
              </Text>
            </View>
            <View style={styles.conditionsProgressBar}>
              <View
                style={[
                  styles.conditionsProgressFill,
                  { width: `${permitDashboard.conditionsProgress.percentComplete * 100}%` },
                ]}
              />
            </View>
            {conditionsStatus.pending.filter(c => c.priority === 'high').length > 0 && (
              <View style={styles.highPriorityConditions}>
                <Text style={styles.highPriorityLabel}>High Priority (Pre-commencement):</Text>
                {conditionsStatus.pending.filter(c => c.priority === 'high').slice(0, 2).map((cs) => (
                  <Text key={cs.condition.id} style={styles.highPriorityCondition}>
                    {cs.permitType}: {cs.condition.description.substring(0, 50)}...
                  </Text>
                ))}
              </View>
            )}
          </View>

          {/* Permit Clock Reference */}
          <View style={styles.permitClockInfo}>
            <Text style={styles.sectionLabel}>Statutory Timelines ({selectedProject.country})</Text>
            <View style={styles.clockRow}>
              {PERMIT_CLOCKS.filter(c => c.country === selectedProject.country).slice(0, 2).map((clock) => (
                <View key={clock.permitType} style={styles.clockCard}>
                  <Text style={styles.clockType}>{clock.permitType.replace(/-/g, ' ')}</Text>
                  <Text style={styles.clockDays}>{clock.standardDays} days</Text>
                  {clock.extendedDays && (
                    <Text style={Typography.muted}>Extended: {clock.extendedDays}d</Text>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Active Permits */}
          <View style={styles.permitsSection}>
            <Text style={styles.sectionLabel}>Active Permits</Text>
            {permitStatuses.length === 0 ? (
              <Text style={Typography.muted}>No permits tracked</Text>
            ) : (
              permitStatuses.map(({ permit, status }) => (
                <View key={permit.id} style={styles.permitCard}>
                  <View style={styles.permitHeader}>
                    <View>
                      <Text style={Typography.body}>{permit.type}</Text>
                      {permit.reference && (
                        <Text style={Typography.muted}>{permit.reference}</Text>
                      )}
                    </View>
                    <View style={[
                      styles.permitStatusBadge,
                      permit.status === 'approved' && styles.statusApproved,
                      permit.status === 'approved-with-conditions' && styles.statusApproved,
                      permit.status === 'under-review' && styles.statusPending,
                      permit.status === 'submitted' && styles.statusPending,
                      permit.status === 'rejected' && styles.statusRejected,
                    ]}>
                      <Text style={styles.permitStatusText}>
                        {permit.status.replace(/-/g, ' ')}
                      </Text>
                    </View>
                  </View>

                  <Text style={Typography.muted}>Authority: {permit.authority}</Text>

                  {status && permit.status !== 'approved' && permit.status !== 'approved-with-conditions' && (
                    <View style={styles.permitProgress}>
                      <View style={styles.permitProgressBar}>
                        <View
                          style={[
                            styles.permitProgressFill,
                            { width: `${Math.min(100, status.percentElapsed)}%` },
                            { backgroundColor: getPermitStatusColor(status.status) },
                          ]}
                        />
                      </View>
                      <View style={styles.permitProgressInfo}>
                        <Text style={[
                          styles.permitDaysRemaining,
                          { color: getPermitStatusColor(status.status) },
                        ]}>
                          {status.daysRemaining > 0
                            ? `${status.daysRemaining} days remaining`
                            : `${Math.abs(status.daysRemaining)} days overdue`}
                        </Text>
                        <Text style={Typography.muted}>
                          Target: {permit.targetDecisionDate}
                        </Text>
                      </View>
                    </View>
                  )}

                  {permit.conditions.length > 0 && (
                    <View style={styles.conditionsSection}>
                      <Text style={styles.conditionsLabel}>
                        Conditions: {permit.conditions.filter(c => c.dischargedDate).length}/{permit.conditions.length} discharged
                      </Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        </View>
      )}

      {/* Procurement Section */}
      {activeSection === 'procurement' && selectedProject && procurementRisk && (
        <View style={styles.card}>
          <Text style={Typography.subtitle}>Procurement & Change Orders</Text>

          {/* Contract Status */}
          <View style={styles.procurementOverview}>
            <View style={styles.procurementCard}>
              <Text style={styles.procurementValue}>{procurementRisk.awarded}</Text>
              <Text style={styles.procurementLabel}>Contracts Awarded</Text>
            </View>
            <View style={styles.procurementCard}>
              <Text style={[styles.procurementValue, procurementRisk.pending > 0 && styles.procurementWarning]}>
                {procurementRisk.pending}
              </Text>
              <Text style={styles.procurementLabel}>Pending Award</Text>
            </View>
            <View style={styles.procurementCard}>
              <Text style={styles.procurementValue}>{fmt(procurementRisk.riskValue)}</Text>
              <Text style={styles.procurementLabel}>At-Risk Value</Text>
            </View>
          </View>

          {/* Procurement Progress */}
          <View style={styles.procurementProgressCard}>
            <View style={styles.procurementProgressHeader}>
              <Text style={styles.sectionLabel}>Procurement Progress</Text>
              <Text style={styles.procurementPercent}>
                {formatPercent(procurementRisk.awardedPercent)}
              </Text>
            </View>
            <View style={styles.procurementBar}>
              <View
                style={[
                  styles.procurementFill,
                  { width: `${procurementRisk.awardedPercent * 100}%` },
                ]}
              />
            </View>
          </View>

          {/* Change Orders */}
          <View style={styles.changeOrdersCard}>
            <Text style={styles.sectionLabel}>Change Orders</Text>
            <View style={styles.coGrid}>
              <View style={styles.coItem}>
                <Text style={styles.coValue}>{procurementRisk.changeOrders.submitted}</Text>
                <Text style={styles.coLabel}>Submitted</Text>
              </View>
              <View style={styles.coItem}>
                <Text style={styles.coValue}>{procurementRisk.changeOrders.approved}</Text>
                <Text style={styles.coLabel}>Approved</Text>
              </View>
              <View style={styles.coItem}>
                <Text style={styles.coValue}>{fmt(procurementRisk.changeOrders.value)}</Text>
                <Text style={styles.coLabel}>Total Value</Text>
              </View>
              <View style={styles.coItem}>
                <Text style={styles.coValue}>
                  {procurementRisk.changeOrders.avgCycleTime > 0
                    ? `${procurementRisk.changeOrders.avgCycleTime}d`
                    : 'N/A'}
                </Text>
                <Text style={styles.coLabel}>Avg Cycle Time</Text>
              </View>
            </View>
          </View>

          {/* Active Contracts */}
          {selectedProject.contracts.length > 0 && (
            <View style={styles.contractsSection}>
              <Text style={styles.sectionLabel}>Active Contracts</Text>
              {selectedProject.contracts.map((contract) => (
                <View key={contract.id} style={styles.contractRow}>
                  <View style={styles.contractInfo}>
                    <Text style={Typography.body}>{contract.counterparty}</Text>
                    <Text style={Typography.muted}>{contract.description}</Text>
                  </View>
                  <View>
                    <Text style={styles.contractValue}>{fmt(contract.contractSum)}</Text>
                    <Text style={[styles.contractStatus, { color: Colors.success }]}>
                      {contract.status}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Actions Section */}
      {activeSection === 'actions' && selectedProject && (
        <>
          {/* Quick Actions Bar */}
          <View style={styles.quickActionsCard}>
            <Text style={styles.sectionLabel}>Quick Actions</Text>
            <View style={styles.quickActionsGrid}>
              <Pressable style={styles.quickActionButton} onPress={generateReforecast}>
                <View style={styles.quickActionIcon}>
                  <Text style={styles.quickActionIconText}>📅</Text>
                </View>
                <Text style={styles.quickActionLabel}>Reforecast</Text>
              </Pressable>
              <Pressable style={styles.quickActionButton} onPress={generateChangeOrderSummary}>
                <View style={styles.quickActionIcon}>
                  <Text style={styles.quickActionIconText}>📋</Text>
                </View>
                <Text style={styles.quickActionLabel}>CO Summary</Text>
              </Pressable>
              <Pressable style={styles.quickActionButton} onPress={generatePermitPackage}>
                <View style={styles.quickActionIcon}>
                  <Text style={styles.quickActionIconText}>📄</Text>
                </View>
                <Text style={styles.quickActionLabel}>Permit Package</Text>
              </Pressable>
            </View>
          </View>

          {/* Generated Documents */}
          {(generatedReforecast || generatedChangeOrderSummary || generatedPermitPackage) && (
            <View style={styles.card}>
              <Text style={Typography.subtitle}>Generated Documents</Text>

              {generatedReforecast && (
                <View style={styles.generatedDocument}>
                  <View style={styles.documentHeader}>
                    <Text style={styles.documentTitle}>Reforecast Report</Text>
                    <View style={styles.documentBadge}>
                      <Text style={styles.documentBadgeText}>DRAFT</Text>
                    </View>
                  </View>
                  <ScrollView style={styles.documentContent} nestedScrollEnabled>
                    <Text style={styles.documentText}>{generatedReforecast}</Text>
                  </ScrollView>
                </View>
              )}

              {generatedChangeOrderSummary && (
                <View style={styles.generatedDocument}>
                  <View style={styles.documentHeader}>
                    <Text style={styles.documentTitle}>Change Order Summary</Text>
                    <View style={styles.documentBadge}>
                      <Text style={styles.documentBadgeText}>DRAFT</Text>
                    </View>
                  </View>
                  <ScrollView style={styles.documentContent} nestedScrollEnabled>
                    <Text style={styles.documentText}>{generatedChangeOrderSummary}</Text>
                  </ScrollView>
                </View>
              )}

              {generatedPermitPackage && (
                <View style={styles.generatedDocument}>
                  <View style={styles.documentHeader}>
                    <Text style={styles.documentTitle}>Permit Status Package</Text>
                    <View style={styles.documentBadge}>
                      <Text style={styles.documentBadgeText}>DRAFT</Text>
                    </View>
                  </View>
                  <ScrollView style={styles.documentContent} nestedScrollEnabled>
                    <Text style={styles.documentText}>{generatedPermitPackage}</Text>
                  </ScrollView>
                </View>
              )}
            </View>
          )}
        </>
      )}

      {loading && <ActivityIndicator size="large" color={Colors.accentDeep} style={styles.loader} />}
      {error !== '' && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {success !== '' && (
        <View style={styles.successCard}>
          <Text style={styles.successText}>{success}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: 100,
  },
  projectSelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  projectPill: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  projectPillActive: {
    borderColor: Colors.accentDeep,
    backgroundColor: Colors.surface,
  },
  projectCountry: {
    color: Colors.accentMuted,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  projectName: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  projectNameActive: {
    color: Colors.text,
  },
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Colors.surface,
  },
  tabText: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.text,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  healthBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
  },
  healthGreen: {
    backgroundColor: Colors.success + '20',
  },
  healthBlue: {
    backgroundColor: Colors.accentMuted + '20',
  },
  healthRed: {
    backgroundColor: Colors.danger + '20',
  },
  healthStatus: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  healthVariance: {
    color: Colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  spiCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  spiValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  spiLabel: {
    color: Colors.muted,
    fontSize: 10,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  kpiValue: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  kpiDanger: {
    color: Colors.danger,
  },
  kpiLabel: {
    color: Colors.muted,
    fontSize: 11,
    marginTop: 4,
  },
  datesCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
    gap: 8,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  activitiesCard: {
    gap: 8,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  activityInfo: {
    flex: 1,
  },
  activityProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    width: 60,
    height: 6,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accentMuted,
    borderRadius: 3,
  },
  progressDelayed: {
    backgroundColor: Colors.danger,
  },
  progressText: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '600',
    width: 35,
    textAlign: 'right',
  },
  button: {
    backgroundColor: Colors.accentDeep,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#0B0C0F',
    fontSize: 14,
    fontWeight: '700',
  },
  recommendationsCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
  },
  recRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  recBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  recBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  permitClockInfo: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
  },
  clockRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  clockCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: Spacing.sm,
  },
  clockType: {
    color: Colors.muted,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  clockDays: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginVertical: 4,
  },
  permitsSection: {
    gap: 12,
  },
  permitCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
    gap: 8,
  },
  permitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  permitStatusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.muted + '30',
  },
  statusApproved: {
    backgroundColor: Colors.success + '30',
  },
  statusPending: {
    backgroundColor: Colors.warning + '30',
  },
  statusRejected: {
    backgroundColor: Colors.danger + '30',
  },
  permitStatusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: Colors.text,
  },
  permitProgress: {
    gap: 6,
  },
  permitProgressBar: {
    height: 6,
    backgroundColor: Colors.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  permitProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  permitProgressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  permitDaysRemaining: {
    fontSize: 12,
    fontWeight: '600',
  },
  conditionsSection: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  conditionsLabel: {
    color: Colors.muted,
    fontSize: 11,
  },
  procurementOverview: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  procurementCard: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  procurementValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  procurementWarning: {
    color: Colors.warning,
  },
  procurementLabel: {
    color: Colors.muted,
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  procurementProgressCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
  },
  procurementProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  procurementPercent: {
    color: Colors.accentMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  procurementBar: {
    height: 8,
    backgroundColor: Colors.surface,
    borderRadius: 4,
    overflow: 'hidden',
  },
  procurementFill: {
    height: '100%',
    backgroundColor: Colors.accentMuted,
    borderRadius: 4,
  },
  changeOrdersCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
  },
  coGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  coItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  coValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  coLabel: {
    color: Colors.muted,
    fontSize: 10,
    marginTop: 4,
  },
  contractsSection: {
    gap: 8,
  },
  contractRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  contractInfo: {
    flex: 1,
  },
  contractValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  contractStatus: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
    textTransform: 'capitalize',
  },
  generatedDocument: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    overflow: 'hidden',
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  documentTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  documentBadge: {
    backgroundColor: Colors.warning + '30',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  documentBadgeText: {
    color: Colors.warning,
    fontSize: 10,
    fontWeight: '700',
  },
  documentContent: {
    maxHeight: 300,
    padding: Spacing.md,
  },
  documentText: {
    color: Colors.text,
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  loader: {
    marginVertical: Spacing.lg,
  },
  errorCard: {
    backgroundColor: Colors.danger + '20',
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
  },
  successCard: {
    backgroundColor: Colors.success + '20',
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  successText: {
    color: Colors.success,
    fontSize: 13,
  },
  quickActionsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentDeep + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionIconText: {
    fontSize: 18,
  },
  quickActionLabel: {
    color: Colors.text,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Enhanced Permit Tracker Styles
  urgentAlertsBanner: {
    backgroundColor: Colors.danger + '20',
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.danger,
    gap: 8,
  },
  urgentAlertsTitle: {
    color: Colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  urgentAlertItem: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.danger + '40',
  },
  urgentAlertText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  urgentAlertAction: {
    color: Colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  permitKpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  permitKpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  permitKpiValue: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  permitKpiLabel: {
    color: Colors.muted,
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  upcomingDeadlinesCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
  },
  deadlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  deadlineInfo: {
    flex: 1,
  },
  deadlineBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  deadlineCritical: {
    backgroundColor: Colors.danger + '30',
  },
  deadlineWarning: {
    backgroundColor: Colors.warning + '30',
  },
  deadlineNormal: {
    backgroundColor: Colors.accentMuted + '30',
  },
  deadlineBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  conditionsProgressCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
    gap: 8,
  },
  conditionsProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conditionsProgressPercent: {
    color: Colors.accentMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  conditionsProgressBar: {
    height: 8,
    backgroundColor: Colors.surface,
    borderRadius: 4,
    overflow: 'hidden',
  },
  conditionsProgressFill: {
    height: '100%',
    backgroundColor: Colors.success,
    borderRadius: 4,
  },
  highPriorityConditions: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 4,
  },
  highPriorityLabel: {
    color: Colors.warning,
    fontSize: 11,
    fontWeight: '700',
  },
  highPriorityCondition: {
    color: Colors.muted,
    fontSize: 11,
    paddingLeft: 8,
  },
});
