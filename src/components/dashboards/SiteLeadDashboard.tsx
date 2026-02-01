import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { siteApi } from '../../api/vascoApi';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { hapticError, hapticSuccess } from '../../utils/haptics';

import {
  mockProjects,
  mockSiteMetrics,
  getProjectById,
} from '../../data/mockProjects';
import {
  formatCurrency,
  formatPercent,
  getCurrencyForCountry,
  getComplianceRequirements,
} from '../../modules/countryModules';
import type { Project, SiteMetrics, SiteEvent, Risk } from '../../types/buildos';

type Recommendation = {
  classification: string;
  action: string;
};

const EVENT_TYPES = ['progress', 'delay', 'safety', 'quality', 'weather', 'rfi', 'delivery', 'inspection'];

export function SiteLeadDashboard() {
  // Project selection
  const [selectedProjectId, setSelectedProjectId] = useState<string>('uk-001');

  // Event logging
  const [eventType, setEventType] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventSeverity, setEventSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeSection, setActiveSection] = useState<'metrics' | 'events' | 'risks' | 'actions'>('metrics');

  // API results
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [generatedDailyReport, setGeneratedDailyReport] = useState<string | null>(null);
  const [generatedSafetyBriefing, setGeneratedSafetyBriefing] = useState<string | null>(null);
  const [generatedBlockerEscalation, setGeneratedBlockerEscalation] = useState<string | null>(null);

  // Derived data
  const selectedProject = useMemo(() => getProjectById(selectedProjectId), [selectedProjectId]);
  const siteMetrics = useMemo(() => mockSiteMetrics[selectedProjectId], [selectedProjectId]);
  const currency = useMemo(() => selectedProject ? getCurrencyForCountry(selectedProject.country) : 'GBP', [selectedProject]);
  const complianceReqs = useMemo(() => selectedProject ? getComplianceRequirements(selectedProject.country) : [], [selectedProject]);

  // Progress health
  const progressHealth = useMemo(() => {
    if (!siteMetrics) return null;

    return {
      overallProgress: siteMetrics.overallPercentComplete,
      plannedProgress: siteMetrics.plannedPercentComplete,
      variance: siteMetrics.progressVariance,
      status: siteMetrics.progressVariance >= -2 ? 'on-track' :
              siteMetrics.progressVariance >= -5 ? 'at-risk' : 'behind',
    };
  }, [siteMetrics]);

  // Safety metrics
  const safetyHealth = useMemo(() => {
    if (!siteMetrics) return null;

    const safetyScore = siteMetrics.ltir < 0.5 ? 'excellent' :
                        siteMetrics.ltir < 1.0 ? 'good' :
                        siteMetrics.ltir < 2.0 ? 'fair' : 'poor';

    return {
      hoursWorked: siteMetrics.hoursWorked,
      incidents: siteMetrics.incidentsTotal,
      nearMisses: siteMetrics.nearMissesThisPeriod,
      ltir: siteMetrics.ltir,
      safetyScore,
    };
  }, [siteMetrics]);

  // Quality metrics
  const qualityHealth = useMemo(() => {
    if (!siteMetrics) return null;

    return {
      defectsOpen: siteMetrics.defectsOpenTotal,
      defectsClosed: siteMetrics.defectsClosedTotal,
      closureRate: siteMetrics.defectClosureRate,
      reworkCost: siteMetrics.reworkCostToDate,
    };
  }, [siteMetrics]);

  // Constraints
  const constraintStatus = useMemo(() => {
    if (!siteMetrics) return null;

    return {
      openRfis: siteMetrics.openRfis,
      avgRfiResponse: siteMetrics.avgRfiResponseDays,
      openConstraints: siteMetrics.openConstraints,
      clearedThisWeek: siteMetrics.constraintsClearedThisWeek,
    };
  }, [siteMetrics]);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleError = (err: unknown) => {
    setError(err instanceof Error ? err.message : 'An error occurred');
    hapticError();
  };

  const logSiteEvent = async () => {
    clearMessages();
    if (!eventType || !eventDescription) {
      setError('Event type and description are required');
      return;
    }
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await siteApi.logEvent(selectedProjectId, today, eventType, eventDescription);
      setSuccess(`Event logged: ${eventType}`);
      hapticSuccess();
      setEventType('');
      setEventDescription('');
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    clearMessages();
    setLoading(true);
    try {
      const data = await siteApi.getRecommendations(selectedProjectId);
      setRecommendations(data);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const generateDailyReport = () => {
    clearMessages();
    if (!selectedProject || !siteMetrics || !progressHealth || !safetyHealth || !qualityHealth || !constraintStatus) {
      setError('No project data available');
      return;
    }

    const risks = selectedProject.risks.filter(r => r.status !== 'closed');
    const activities = selectedProject.scheduleActivities.filter(a => a.status === 'in-progress');

    const report = `
DAILY SITE REPORT
=================
Project: ${selectedProject.name}
Date: ${new Date().toISOString().split('T')[0]}
Weather: Clear, 18°C
Report By: Site Lead

PROGRESS SUMMARY
----------------
Overall Progress: ${progressHealth.overallProgress}% (Plan: ${progressHealth.plannedProgress}%)
Variance: ${progressHealth.variance > 0 ? '+' : ''}${progressHealth.variance}%
Status: ${progressHealth.status.toUpperCase()}

Active Work Fronts:
${activities.slice(0, 4).map(a => `- ${a.name}: ${a.percentComplete}% complete`).join('\n')}

SAFETY
------
Hours Worked Today: ${Math.floor(safetyHealth.hoursWorked / 335)}
Total Hours to Date: ${safetyHealth.hoursWorked.toLocaleString()}
LTIR: ${safetyHealth.ltir}
Incidents This Period: ${siteMetrics.incidentsThisPeriod}
Near Misses This Period: ${safetyHealth.nearMisses}

Safety Observations:
- All personnel wearing required PPE
- Site housekeeping satisfactory
- Fire escape routes clear

QUALITY
-------
Open Defects: ${qualityHealth.defectsOpen}
Closed Defects: ${qualityHealth.defectsClosed}
Closure Rate: ${formatPercent(qualityHealth.closureRate)}
Rework Cost to Date: ${formatCurrency(qualityHealth.reworkCost, currency)}

Quality Issues:
${qualityHealth.defectsOpen > 10 ? '- High defect count requires attention' : '- Defect levels acceptable'}

CONSTRAINTS & RFIs
------------------
Open RFIs: ${constraintStatus.openRfis}
Avg RFI Response: ${constraintStatus.avgRfiResponse} days
Open Constraints: ${constraintStatus.openConstraints}
Cleared This Week: ${constraintStatus.clearedThisWeek}

RISKS
-----
${risks.slice(0, 3).map(r => `- [${r.category}] ${r.description} (Score: ${r.score})`).join('\n') || 'No active risks'}

COMPLIANCE (${selectedProject.country})
${complianceReqs.filter(c => c.mandatory).slice(0, 3).map(c => `- ${c.code}: ${c.name}`).join('\n')}

TOMORROW'S FOCUS
----------------
${activities.filter(a => a.isCriticalPath).slice(0, 3).map(a => `- ${a.name}`).join('\n') || '- Continue current work fronts'}

RESOURCES ON SITE
-----------------
Main Contractor: ${selectedProject.contracts.find(c => c.type === 'main-contractor')?.counterparty || 'TBC'}
Workforce: Est. ${Math.floor(safetyHealth.hoursWorked / 335 / 8)} personnel

Generated by: BuildOS Site Agent
Report Time: ${new Date().toISOString()}
    `.trim();

    setGeneratedDailyReport(report);
    setSuccess('Daily report generated');
    hapticSuccess();
  };

  const generateSafetyBriefing = () => {
    clearMessages();
    if (!selectedProject || !safetyHealth) {
      setError('No project data available');
      return;
    }

    const risks = selectedProject.risks.filter(r => r.category === 'health-safety' && r.status !== 'closed');
    const activities = selectedProject.scheduleActivities.filter(a => a.status === 'in-progress');

    const briefing = `
DAILY SAFETY BRIEFING
${'='.repeat(50)}
Project: ${selectedProject.name}
Date: ${new Date().toISOString().split('T')[0]}
Time: 07:00
Briefing By: Site Lead

TODAY'S SAFETY FOCUS
--------------------
Topic: Working at Height
Duration: 10 minutes

KEY POINTS TO COVER
-------------------
1. All work at height requires valid permit
2. Edge protection must be in place before access
3. Harness inspection checklist must be completed
4. Rescue plan to be reviewed with team
5. Weather conditions - wind speed limits

ACTIVE WORKS TODAY
------------------
${activities.slice(0, 4).map(a => `- ${a.name}`).join('\n') || '- General construction activities'}

ZONE-SPECIFIC HAZARDS
---------------------
Zone A (Main Building):
- Crane operations in progress
- Exclusion zones marked with barriers
- Hard hat and hi-vis mandatory

Zone B (Foundations):
- Deep excavations present
- Edge protection required
- No entry without banksman

Zone C (Access Roads):
- HGV movements throughout day
- Pedestrian routes clearly marked
- Speed limit: 5 mph

H&S PERFORMANCE
---------------
LTIR: ${safetyHealth.ltir.toFixed(2)} (Target: <1.0)
Hours Worked: ${safetyHealth.hoursWorked.toLocaleString()}
Last Incident: ${safetyHealth.incidents > 0 ? 'Review required' : 'Zero incidents'}
Near Misses (Week): ${safetyHealth.nearMisses}

ACTIVE SAFETY RISKS
-------------------
${risks.length > 0 ? risks.map(r => `- ${r.description} (Score: ${r.score})`).join('\n') : '- No specific H&S risks identified'}

EMERGENCY PROCEDURES
--------------------
Fire Assembly Point: Car Park Area A
First Aider on Site: [Name] - Welfare Unit
Emergency Number: Site Office x100
Nearest A&E: [Local Hospital] - 15 min drive

PPE REQUIREMENTS TODAY
----------------------
[ ] Hard hat (always)
[ ] Hi-vis vest (always)
[ ] Safety boots (always)
[ ] Gloves (task specific)
[ ] Eye protection (as required)
[ ] Harness (working at height)

TOOLBOX TALK SIGN-OFF
---------------------
Topic Covered: Working at Height
Attendance: _____ personnel
Queries Raised: _________________

Briefing Completed: _______ (time)
Site Lead Signature: _____________

Generated by: BuildOS Site Agent
Report Date: ${new Date().toISOString()}
    `.trim();

    setGeneratedSafetyBriefing(briefing);
    setSuccess('Safety briefing generated');
    hapticSuccess();
  };

  const generateBlockerEscalation = () => {
    clearMessages();
    if (!selectedProject || !constraintStatus) {
      setError('No project data available');
      return;
    }

    const risks = selectedProject.risks.filter(r => r.status !== 'closed').sort((a, b) => b.score - a.score);
    const criticalActivities = selectedProject.scheduleActivities.filter(a => a.isCriticalPath && a.status !== 'completed');
    const delayedActivities = selectedProject.scheduleActivities.filter(a => a.status === 'delayed');

    const escalation = `
BLOCKER ESCALATION REPORT
${'='.repeat(50)}
Project: ${selectedProject.name}
Date: ${new Date().toISOString().split('T')[0]}
Priority: ${delayedActivities.length > 2 || constraintStatus.openConstraints > 10 ? 'HIGH' : 'MEDIUM'}
From: Site Lead
To: Project Manager / COO

EXECUTIVE SUMMARY
-----------------
This escalation report identifies ${constraintStatus.openConstraints} open constraints and ${delayedActivities.length} delayed activities requiring management attention. ${constraintStatus.openRfis > 10 ? 'RFI queue is critical.' : ''}

CRITICAL BLOCKERS
-----------------
${delayedActivities.length > 0 ? delayedActivities.map(a =>
  `1. ${a.name}
   WBS: ${a.wbsCode}
   Status: DELAYED
   Impact: ${a.isCriticalPath ? 'CRITICAL PATH' : 'Non-critical'}
   Resolution Required: Immediate`
).join('\n\n') : 'No activities currently delayed'}

OPEN CONSTRAINTS (${constraintStatus.openConstraints})
${'─'.repeat(40)}
${constraintStatus.openConstraints > 0 ? `
Priority 1: Design Information
- RFIs pending: ${constraintStatus.openRfis}
- Avg response time: ${constraintStatus.avgRfiResponse} days
- Action: Design team to prioritize responses

Priority 2: Material Deliveries
- [Pending specific details from site team]
- Action: Procurement to confirm delivery dates

Priority 3: Subcontractor Resources
- [Pending specific details from site team]
- Action: Commercial team to follow up
` : 'No significant constraints identified'}

RFI STATUS
----------
Open RFIs: ${constraintStatus.openRfis}
Average Response: ${constraintStatus.avgRfiResponse} days
Target Response: 3 days
Status: ${constraintStatus.avgRfiResponse > 3 ? 'BEHIND TARGET - ESCALATE' : 'Within target'}

Cleared This Week: ${constraintStatus.clearedThisWeek}

SCHEDULE IMPACT ASSESSMENT
--------------------------
Critical Path Activities at Risk:
${criticalActivities.filter(a => a.status === 'in-progress' || a.status === 'delayed').slice(0, 3).map(a =>
  `- ${a.name}: ${a.percentComplete}% complete, ${a.float} days float`
).join('\n') || '- No critical activities at immediate risk'}

Potential Delay: ${delayedActivities.length > 0 ? 'Review required' : 'None identified'}

RISK REGISTER ITEMS
-------------------
High-Score Risks Requiring Attention:
${risks.filter(r => r.score >= 9).slice(0, 3).map(r =>
  `- [${r.category}] ${r.description}
    Score: ${r.score} | Owner: ${r.owner}
    Cost Exposure: ${r.costExposure ? fmt(r.costExposure) : 'N/A'}
    Schedule Exposure: ${r.scheduleExposureDays ? r.scheduleExposureDays + ' days' : 'N/A'}`
).join('\n\n') || '- No high-score risks'}

REQUESTED ACTIONS
-----------------
1. ${constraintStatus.openRfis > 10 ? 'Urgent design team meeting to clear RFI backlog' : 'Continue monitoring RFI queue'}
2. ${delayedActivities.length > 0 ? 'Review recovery plan for delayed activities' : 'Maintain current progress'}
3. ${risks.filter(r => r.score >= 12).length > 0 ? 'Risk review meeting for critical items' : 'Standard risk monitoring'}

NEXT REVIEW
-----------
Date: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
Attendees: Site Lead, PM, COO

Generated by: BuildOS Site Agent
Report Date: ${new Date().toISOString()}
    `.trim();

    setGeneratedBlockerEscalation(escalation);
    setSuccess('Blocker escalation generated');
    hapticSuccess();
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'safety':
        return Colors.danger;
      case 'delay':
        return Colors.warning;
      case 'progress':
        return Colors.success;
      case 'quality':
        return Colors.accentMuted;
      case 'rfi':
        return Colors.accentDeep;
      default:
        return Colors.muted;
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 12) return Colors.danger;
    if (score >= 6) return Colors.warning;
    return Colors.success;
  };

  const fmt = (amount: number) => formatCurrency(amount, currency);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={Typography.title}>Site Lead Dashboard</Text>

      {/* Project Selector */}
      <View style={styles.projectSelector}>
        {mockProjects.filter(p => mockSiteMetrics[p.id]).map((project) => (
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
        {(['metrics', 'events', 'risks', 'actions'] as const).map((section) => (
          <Pressable
            key={section}
            style={[styles.tab, activeSection === section && styles.tabActive]}
            onPress={() => setActiveSection(section)}
          >
            <Text style={[styles.tabText, activeSection === section && styles.tabTextActive]}>
              {section === 'metrics' ? 'Metrics' :
               section === 'events' ? 'Events' :
               section === 'risks' ? 'Risks' : 'Actions'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Site Metrics Section */}
      {activeSection === 'metrics' && selectedProject && progressHealth && safetyHealth && qualityHealth && constraintStatus && (
        <>
          {/* Progress Card */}
          <View style={styles.card}>
            <Text style={Typography.subtitle}>Progress</Text>
            <View style={[
              styles.healthBanner,
              progressHealth.status === 'on-track' && styles.healthGreen,
              progressHealth.status === 'at-risk' && styles.healthYellow,
              progressHealth.status === 'behind' && styles.healthRed,
            ]}>
              <View>
                <Text style={styles.healthStatus}>
                  {progressHealth.status === 'on-track' ? 'On Track' :
                   progressHealth.status === 'at-risk' ? 'At Risk' : 'Behind Schedule'}
                </Text>
                <Text style={styles.healthVariance}>
                  {progressHealth.variance > 0 ? '+' : ''}{progressHealth.variance}% vs plan
                </Text>
              </View>
              <View style={styles.progressCircle}>
                <Text style={styles.progressValue}>{progressHealth.overallProgress}%</Text>
              </View>
            </View>

            <View style={styles.progressComparison}>
              <View style={styles.progressBarContainer}>
                <Text style={styles.progressBarLabel}>Actual</Text>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${progressHealth.overallProgress}%` }]} />
                </View>
                <Text style={styles.progressBarValue}>{progressHealth.overallProgress}%</Text>
              </View>
              <View style={styles.progressBarContainer}>
                <Text style={styles.progressBarLabel}>Planned</Text>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFillPlan, { width: `${progressHealth.plannedProgress}%` }]} />
                </View>
                <Text style={styles.progressBarValue}>{progressHealth.plannedProgress}%</Text>
              </View>
            </View>
          </View>

          {/* Safety Card */}
          <View style={styles.card}>
            <Text style={Typography.subtitle}>Safety</Text>
            <View style={styles.safetyGrid}>
              <View style={[styles.safetyCard, styles.safetyMain]}>
                <Text style={styles.safetyValue}>{safetyHealth.ltir.toFixed(2)}</Text>
                <Text style={styles.safetyLabel}>LTIR</Text>
                <View style={[
                  styles.safetyBadge,
                  safetyHealth.safetyScore === 'excellent' && styles.badgeGreen,
                  safetyHealth.safetyScore === 'good' && styles.badgeGreen,
                  safetyHealth.safetyScore === 'fair' && styles.badgeYellow,
                  safetyHealth.safetyScore === 'poor' && styles.badgeRed,
                ]}>
                  <Text style={styles.safetyBadgeText}>{safetyHealth.safetyScore}</Text>
                </View>
              </View>
              <View style={styles.safetyCard}>
                <Text style={styles.safetyValue}>{safetyHealth.hoursWorked.toLocaleString()}</Text>
                <Text style={styles.safetyLabel}>Hours Worked</Text>
              </View>
              <View style={styles.safetyCard}>
                <Text style={[styles.safetyValue, safetyHealth.incidents > 0 && styles.dangerText]}>
                  {safetyHealth.incidents}
                </Text>
                <Text style={styles.safetyLabel}>Incidents Total</Text>
              </View>
              <View style={styles.safetyCard}>
                <Text style={styles.safetyValue}>{safetyHealth.nearMisses}</Text>
                <Text style={styles.safetyLabel}>Near Misses (Week)</Text>
              </View>
            </View>
          </View>

          {/* Quality Card */}
          <View style={styles.card}>
            <Text style={Typography.subtitle}>Quality</Text>
            <View style={styles.qualityGrid}>
              <View style={styles.qualityItem}>
                <Text style={[styles.qualityValue, qualityHealth.defectsOpen > 20 && styles.dangerText]}>
                  {qualityHealth.defectsOpen}
                </Text>
                <Text style={styles.qualityLabel}>Open Defects</Text>
              </View>
              <View style={styles.qualityItem}>
                <Text style={styles.qualityValue}>{qualityHealth.defectsClosed}</Text>
                <Text style={styles.qualityLabel}>Closed</Text>
              </View>
              <View style={styles.qualityItem}>
                <Text style={styles.qualityValue}>{formatPercent(qualityHealth.closureRate)}</Text>
                <Text style={styles.qualityLabel}>Closure Rate</Text>
              </View>
              <View style={styles.qualityItem}>
                <Text style={styles.qualityValue}>{fmt(qualityHealth.reworkCost)}</Text>
                <Text style={styles.qualityLabel}>Rework Cost</Text>
              </View>
            </View>
          </View>

          {/* Constraints Card */}
          <View style={styles.card}>
            <Text style={Typography.subtitle}>Constraints & RFIs</Text>
            <View style={styles.constraintGrid}>
              <View style={styles.constraintItem}>
                <Text style={[styles.constraintValue, constraintStatus.openRfis > 15 && styles.warningText]}>
                  {constraintStatus.openRfis}
                </Text>
                <Text style={styles.constraintLabel}>Open RFIs</Text>
              </View>
              <View style={styles.constraintItem}>
                <Text style={styles.constraintValue}>{constraintStatus.avgRfiResponse}d</Text>
                <Text style={styles.constraintLabel}>Avg Response</Text>
              </View>
              <View style={styles.constraintItem}>
                <Text style={styles.constraintValue}>{constraintStatus.openConstraints}</Text>
                <Text style={styles.constraintLabel}>Open Constraints</Text>
              </View>
              <View style={styles.constraintItem}>
                <Text style={[styles.constraintValue, styles.successText]}>
                  {constraintStatus.clearedThisWeek}
                </Text>
                <Text style={styles.constraintLabel}>Cleared (Week)</Text>
              </View>
            </View>
          </View>
        </>
      )}

      {/* Events Section */}
      {activeSection === 'events' && selectedProject && (
        <View style={styles.card}>
          <Text style={Typography.subtitle}>Log Site Event</Text>

          {/* Event Type Selector */}
          <View style={styles.eventTypeGrid}>
            {EVENT_TYPES.map((type) => (
              <Pressable
                key={type}
                style={[
                  styles.eventTypePill,
                  eventType === type && styles.eventTypePillActive,
                  eventType === type && { borderColor: getEventTypeColor(type) },
                ]}
                onPress={() => setEventType(type)}
              >
                <Text style={[
                  styles.eventTypeText,
                  eventType === type && { color: getEventTypeColor(type) },
                ]}>
                  {type}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Severity Selector */}
          {eventType && (
            <View style={styles.severitySection}>
              <Text style={styles.severityLabel}>Severity:</Text>
              <View style={styles.severityRow}>
                {(['low', 'medium', 'high', 'critical'] as const).map((sev) => (
                  <Pressable
                    key={sev}
                    style={[
                      styles.severityPill,
                      eventSeverity === sev && styles.severityPillActive,
                    ]}
                    onPress={() => setEventSeverity(sev)}
                  >
                    <Text style={[
                      styles.severityText,
                      eventSeverity === sev && styles.severityTextActive,
                    ]}>
                      {sev}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder="Event description..."
            placeholderTextColor={Colors.muted}
            value={eventDescription}
            onChangeText={setEventDescription}
            multiline
            numberOfLines={3}
          />

          <Pressable style={styles.button} onPress={logSiteEvent}>
            <Text style={styles.buttonText}>Log Event</Text>
          </Pressable>

          {/* Get Recommendations */}
          <View style={styles.divider} />
          <Text style={Typography.subtitle}>Site Recommendations</Text>
          <Pressable style={[styles.button, styles.buttonSecondary]} onPress={fetchRecommendations}>
            <Text style={styles.buttonTextSecondary}>Get AI Recommendations</Text>
          </Pressable>

          {recommendations && (
            <View style={styles.recommendationsCard}>
              {recommendations.map((rec, index) => (
                <View key={index} style={styles.recRow}>
                  <View style={[styles.recDot, { backgroundColor: getEventTypeColor(rec.classification) }]} />
                  <View style={styles.recContent}>
                    <Text style={styles.recClassification}>{rec.classification}</Text>
                    <Text style={Typography.muted}>{rec.action}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Risks Section */}
      {activeSection === 'risks' && selectedProject && (
        <View style={styles.card}>
          <Text style={Typography.subtitle}>Active Risks</Text>

          {selectedProject.risks.filter(r => r.status !== 'closed').length === 0 ? (
            <Text style={Typography.muted}>No active risks</Text>
          ) : (
            selectedProject.risks
              .filter(r => r.status !== 'closed')
              .sort((a, b) => b.score - a.score)
              .map((risk) => (
                <View key={risk.id} style={styles.riskCard}>
                  <View style={styles.riskHeader}>
                    <View style={[styles.riskScore, { backgroundColor: getRiskColor(risk.score) + '30' }]}>
                      <Text style={[styles.riskScoreText, { color: getRiskColor(risk.score) }]}>
                        {risk.score}
                      </Text>
                    </View>
                    <View style={styles.riskInfo}>
                      <Text style={styles.riskCategory}>{risk.category}</Text>
                      <Text style={Typography.body}>{risk.description}</Text>
                    </View>
                  </View>
                  <View style={styles.riskDetails}>
                    <View style={styles.riskDetail}>
                      <Text style={Typography.muted}>Likelihood</Text>
                      <Text style={styles.riskDetailValue}>{risk.likelihood}/5</Text>
                    </View>
                    <View style={styles.riskDetail}>
                      <Text style={Typography.muted}>Impact</Text>
                      <Text style={styles.riskDetailValue}>{risk.impact}/5</Text>
                    </View>
                    {risk.costExposure && (
                      <View style={styles.riskDetail}>
                        <Text style={Typography.muted}>Cost Exposure</Text>
                        <Text style={styles.riskDetailValue}>{fmt(risk.costExposure)}</Text>
                      </View>
                    )}
                    {risk.scheduleExposureDays && (
                      <View style={styles.riskDetail}>
                        <Text style={Typography.muted}>Schedule</Text>
                        <Text style={styles.riskDetailValue}>{risk.scheduleExposureDays}d</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.riskMitigation}>
                    <Text style={styles.mitigationLabel}>Mitigation:</Text>
                    <Text style={Typography.muted}>{risk.mitigation}</Text>
                  </View>
                  <View style={styles.riskFooter}>
                    <Text style={Typography.muted}>Owner: {risk.owner}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: Colors.accentMuted + '30' }]}>
                      <Text style={styles.statusBadgeText}>{risk.status}</Text>
                    </View>
                  </View>
                </View>
              ))
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
              <Pressable style={styles.quickActionButton} onPress={generateDailyReport}>
                <View style={styles.quickActionIcon}>
                  <Text style={styles.quickActionIconText}>📝</Text>
                </View>
                <Text style={styles.quickActionLabel}>Daily Report</Text>
              </Pressable>
              <Pressable style={styles.quickActionButton} onPress={generateSafetyBriefing}>
                <View style={styles.quickActionIcon}>
                  <Text style={styles.quickActionIconText}>⚠️</Text>
                </View>
                <Text style={styles.quickActionLabel}>Safety Brief</Text>
              </Pressable>
              <Pressable style={styles.quickActionButton} onPress={generateBlockerEscalation}>
                <View style={styles.quickActionIcon}>
                  <Text style={styles.quickActionIconText}>🚨</Text>
                </View>
                <Text style={styles.quickActionLabel}>Escalation</Text>
              </Pressable>
            </View>
          </View>

          {/* Generated Documents */}
          {(generatedDailyReport || generatedSafetyBriefing || generatedBlockerEscalation) && (
            <View style={styles.card}>
              <Text style={Typography.subtitle}>Generated Documents</Text>

              {generatedDailyReport && (
                <View style={styles.generatedDocument}>
                  <View style={styles.documentHeader}>
                    <Text style={styles.documentTitle}>Daily Site Report</Text>
                    <View style={styles.documentBadge}>
                      <Text style={styles.documentBadgeText}>DRAFT</Text>
                    </View>
                  </View>
                  <ScrollView style={styles.documentContent} nestedScrollEnabled>
                    <Text style={styles.documentText}>{generatedDailyReport}</Text>
                  </ScrollView>
                </View>
              )}

              {generatedSafetyBriefing && (
                <View style={styles.generatedDocument}>
                  <View style={styles.documentHeader}>
                    <Text style={styles.documentTitle}>Safety Briefing</Text>
                    <View style={styles.documentBadge}>
                      <Text style={styles.documentBadgeText}>DRAFT</Text>
                    </View>
                  </View>
                  <ScrollView style={styles.documentContent} nestedScrollEnabled>
                    <Text style={styles.documentText}>{generatedSafetyBriefing}</Text>
                  </ScrollView>
                </View>
              )}

              {generatedBlockerEscalation && (
                <View style={styles.generatedDocument}>
                  <View style={styles.documentHeader}>
                    <Text style={styles.documentTitle}>Blocker Escalation</Text>
                    <View style={[styles.documentBadge, styles.documentBadgeUrgent]}>
                      <Text style={styles.documentBadgeTextUrgent}>ESCALATE</Text>
                    </View>
                  </View>
                  <ScrollView style={styles.documentContent} nestedScrollEnabled>
                    <Text style={styles.documentText}>{generatedBlockerEscalation}</Text>
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
  healthYellow: {
    backgroundColor: Colors.warning + '20',
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
  progressCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.accentDeep,
  },
  progressValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  progressComparison: {
    gap: 12,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBarLabel: {
    color: Colors.muted,
    fontSize: 11,
    width: 50,
  },
  progressBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.accentDeep,
    borderRadius: 4,
  },
  progressBarFillPlan: {
    height: '100%',
    backgroundColor: Colors.muted,
    borderRadius: 4,
  },
  progressBarValue: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
    width: 40,
    textAlign: 'right',
  },
  safetyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  safetyCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  safetyMain: {
    minWidth: '100%',
  },
  safetyValue: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  safetyLabel: {
    color: Colors.muted,
    fontSize: 11,
    marginTop: 4,
  },
  safetyBadge: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  badgeGreen: {
    backgroundColor: Colors.success + '30',
  },
  badgeYellow: {
    backgroundColor: Colors.warning + '30',
  },
  badgeRed: {
    backgroundColor: Colors.danger + '30',
  },
  safetyBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: Colors.text,
  },
  dangerText: {
    color: Colors.danger,
  },
  warningText: {
    color: Colors.warning,
  },
  successText: {
    color: Colors.success,
  },
  qualityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  qualityItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  qualityValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  qualityLabel: {
    color: Colors.muted,
    fontSize: 10,
    marginTop: 4,
  },
  constraintGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  constraintItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  constraintValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  constraintLabel: {
    color: Colors.muted,
    fontSize: 10,
    marginTop: 4,
  },
  eventTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  eventTypePill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  eventTypePillActive: {
    backgroundColor: Colors.surface,
  },
  eventTypeText: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  severitySection: {
    gap: 8,
  },
  severityLabel: {
    color: Colors.muted,
    fontSize: 12,
  },
  severityRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  severityPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  severityPillActive: {
    borderColor: Colors.accentMuted,
  },
  severityText: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  severityTextActive: {
    color: Colors.accentMuted,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
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
  buttonSecondary: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buttonTextSecondary: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  recommendationsCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
    gap: 8,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  recContent: {
    flex: 1,
  },
  recClassification: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  riskCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
    gap: 12,
  },
  riskHeader: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  riskScore: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  riskScoreText: {
    fontSize: 16,
    fontWeight: '700',
  },
  riskInfo: {
    flex: 1,
  },
  riskCategory: {
    color: Colors.accentMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  riskDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  riskDetail: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 8,
    minWidth: '45%',
    flex: 1,
  },
  riskDetailValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  riskMitigation: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  mitigationLabel: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  riskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: Colors.text,
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
  sectionLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
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
  documentBadgeUrgent: {
    backgroundColor: Colors.danger + '30',
  },
  documentBadgeTextUrgent: {
    color: Colors.danger,
    fontSize: 10,
    fontWeight: '700',
  },
});
