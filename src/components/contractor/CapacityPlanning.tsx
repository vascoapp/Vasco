/**
 * Capacity Planning Component
 *
 * Helps contractors:
 * - See their availability at a glance
 * - Get accurate job duration estimates
 * - Identify potential delays before they happen
 * - Generate customer-ready availability responses
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useCapacityForecast,
  useAvailabilityWindows,
  useDurationEstimate,
  useDelayAnalysis,
  useCapacityAlerts,
  useCustomerQuoteResponse,
  usePredictionAccuracy,
} from '../../services/capacityPlanningService';
import {
  CapacitySlot,
  AvailabilityWindow,
  DurationEstimate,
  DelayAnalysis,
  CapacityAlert,
  JobScope,
  CustomerQuoteResponse,
} from '../../types/capacity-planning';

// ============================================
// COLOR PALETTE
// ============================================

const colors = {
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#6366F1',

  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceHover: '#F1F5F9',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  text: '#1E293B',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',

  // Capacity status colors
  available: '#10B981',
  partial: '#F59E0B',
  busy: '#EF4444',
  unavailable: '#94A3B8',
};

// ============================================
// TYPES
// ============================================

type TabType = 'capacity' | 'estimate' | 'alerts' | 'accuracy';

interface EstimatorInput {
  jobType: string;
  size: 'small' | 'medium' | 'large';
  complexity: 'simple' | 'moderate' | 'complex';
  isOutdoor: boolean;
  requiresPermit: boolean;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CapacityPlanning() {
  const [activeTab, setActiveTab] = useState<TabType>('capacity');

  const tabs = [
    { id: 'capacity' as TabType, label: 'Availability', icon: 'calendar-outline' },
    { id: 'estimate' as TabType, label: 'Estimator', icon: 'calculator-outline' },
    { id: 'alerts' as TabType, label: 'Alerts', icon: 'warning-outline' },
    { id: 'accuracy' as TabType, label: 'Accuracy', icon: 'analytics-outline' },
  ];

  const { data: alerts } = useCapacityAlerts('active');
  const unreadAlerts = alerts.filter((a) => a.status === 'active').length;

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <View style={styles.tabContent}>
              <Ionicons
                name={tab.icon as any}
                size={18}
                color={activeTab === tab.id ? colors.primary : colors.textSecondary}
              />
              <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {tab.id === 'alerts' && unreadAlerts > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadAlerts}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'capacity' && <CapacityTab />}
        {activeTab === 'estimate' && <EstimatorTab />}
        {activeTab === 'alerts' && <AlertsTab />}
        {activeTab === 'accuracy' && <AccuracyTab />}
      </ScrollView>
    </View>
  );
}

// ============================================
// CAPACITY TAB
// ============================================

function CapacityTab() {
  const { data: forecast, loading } = useCapacityForecast(undefined, 14);
  const [selectedDay, setSelectedDay] = useState<CapacitySlot | null>(null);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading capacity forecast...</Text>
      </View>
    );
  }

  // Calculate summary stats
  const stats = useMemo(() => {
    const available = forecast.filter((d) => d.status === 'available').length;
    const partial = forecast.filter((d) => d.status === 'partial').length;
    const busy = forecast.filter((d) => d.status === 'busy').length;
    const totalAvailableHours = forecast.reduce((sum, d) => sum + d.availableHours, 0);
    const avgUtilization = forecast.reduce((sum, d) => sum + d.utilization, 0) / forecast.length;

    return { available, partial, busy, totalAvailableHours, avgUtilization };
  }, [forecast]);

  return (
    <View>
      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderLeftColor: colors.success }]}>
          <Text style={styles.summaryValue}>{stats.totalAvailableHours}h</Text>
          <Text style={styles.summaryLabel}>Available Next 2 Weeks</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: colors.info }]}>
          <Text style={styles.summaryValue}>{Math.round(stats.avgUtilization)}%</Text>
          <Text style={styles.summaryLabel}>Avg Utilization</Text>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.available }]} />
          <Text style={styles.legendText}>Available ({stats.available})</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.partial }]} />
          <Text style={styles.legendText}>Partial ({stats.partial})</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.busy }]} />
          <Text style={styles.legendText}>Busy ({stats.busy})</Text>
        </View>
      </View>

      {/* Calendar View */}
      <View style={styles.calendarContainer}>
        <Text style={styles.sectionTitle}>Next 2 Weeks</Text>
        <View style={styles.calendar}>
          {forecast.map((day) => (
            <TouchableOpacity
              key={day.date}
              style={[
                styles.calendarDay,
                selectedDay?.date === day.date && styles.calendarDaySelected,
              ]}
              onPress={() => setSelectedDay(day)}
            >
              <Text style={styles.calendarDayName}>{day.dayOfWeek.slice(0, 3)}</Text>
              <Text style={styles.calendarDayDate}>
                {new Date(day.date).getDate()}
              </Text>
              <View
                style={[
                  styles.capacityIndicator,
                  {
                    backgroundColor:
                      day.status === 'available'
                        ? colors.available
                        : day.status === 'partial'
                          ? colors.partial
                          : day.status === 'busy'
                            ? colors.busy
                            : colors.unavailable,
                  },
                ]}
              />
              <Text style={styles.calendarHours}>{day.availableHours}h</Text>
              {day.weatherRisk !== 'none' && (
                <Ionicons
                  name={day.weatherRisk === 'high' ? 'rainy' : 'cloud-outline'}
                  size={12}
                  color={day.weatherRisk === 'high' ? colors.danger : colors.warning}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Selected Day Details */}
      {selectedDay && <DayDetails day={selectedDay} onClose={() => setSelectedDay(null)} />}

      {/* Quick Availability Finder */}
      <QuickAvailabilityFinder />
    </View>
  );
}

// ============================================
// DAY DETAILS
// ============================================

function DayDetails({ day, onClose }: { day: CapacitySlot; onClose: () => void }) {
  const statusColors = {
    available: colors.success,
    partial: colors.warning,
    busy: colors.danger,
    unavailable: colors.textMuted,
  };

  return (
    <View style={styles.dayDetails}>
      <View style={styles.dayDetailsHeader}>
        <View>
          <Text style={styles.dayDetailsTitle}>
            {new Date(day.date).toLocaleDateString('en-GB', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: statusColors[day.status] }]} />
            <Text style={styles.statusText}>{day.status.charAt(0).toUpperCase() + day.status.slice(1)}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close-circle-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Hours breakdown */}
      <View style={styles.hoursBreakdown}>
        <View style={styles.hoursStat}>
          <Text style={styles.hoursValue}>{day.totalHours}h</Text>
          <Text style={styles.hoursLabel}>Total</Text>
        </View>
        <View style={styles.hoursStat}>
          <Text style={styles.hoursValue}>{day.bookedHours}h</Text>
          <Text style={styles.hoursLabel}>Booked</Text>
        </View>
        <View style={styles.hoursStat}>
          <Text style={[styles.hoursValue, { color: colors.success }]}>{day.availableHours}h</Text>
          <Text style={styles.hoursLabel}>Available</Text>
        </View>
      </View>

      {/* Utilization bar */}
      <View style={styles.utilizationContainer}>
        <View style={styles.utilizationBarBg}>
          <View
            style={[
              styles.utilizationBarFill,
              {
                width: `${day.utilization}%`,
                backgroundColor:
                  day.utilization > 85 ? colors.danger : day.utilization > 50 ? colors.warning : colors.success,
              },
            ]}
          />
        </View>
        <Text style={styles.utilizationText}>{day.utilization}% utilized</Text>
      </View>

      {/* Weather */}
      {day.weatherForecast && (
        <View style={styles.weatherSection}>
          <Ionicons
            name={
              day.weatherForecast.condition === 'clear'
                ? 'sunny-outline'
                : day.weatherForecast.condition === 'rain'
                  ? 'rainy-outline'
                  : 'cloud-outline'
            }
            size={20}
            color={day.weatherForecast.suitableForOutdoor ? colors.success : colors.warning}
          />
          <Text style={styles.weatherText}>
            {day.weatherForecast.condition.charAt(0).toUpperCase() + day.weatherForecast.condition.slice(1)},{' '}
            {day.weatherForecast.temperature}°C
            {!day.weatherForecast.suitableForOutdoor && ' - Not ideal for outdoor work'}
          </Text>
        </View>
      )}

      {/* Scheduled Jobs */}
      {day.jobs.length > 0 && (
        <View style={styles.jobsSection}>
          <Text style={styles.jobsSectionTitle}>Scheduled Jobs</Text>
          {day.jobs.map((job) => (
            <View key={job.jobId} style={styles.jobItem}>
              <View style={styles.jobInfo}>
                <Text style={styles.jobTitle}>{job.jobTitle}</Text>
                <Text style={styles.jobCustomer}>{job.customerName}</Text>
              </View>
              <View style={styles.jobMeta}>
                <Text style={styles.jobHours}>{job.estimatedHours}h</Text>
                {job.status === 'at-risk' && (
                  <View style={styles.atRiskBadge}>
                    <Ionicons name="warning" size={12} color={colors.danger} />
                    <Text style={styles.atRiskText}>At Risk</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ============================================
// QUICK AVAILABILITY FINDER
// ============================================

function QuickAvailabilityFinder() {
  const [hours, setHours] = useState(8);
  const [jobType, setJobType] = useState('interior-painting');
  const [isOutdoor, setIsOutdoor] = useState(false);

  const { data: windows, loading } = useAvailabilityWindows(hours, jobType, isOutdoor);

  return (
    <View style={styles.finderContainer}>
      <Text style={styles.sectionTitle}>Find Availability</Text>
      <Text style={styles.sectionSubtitle}>When can you fit in a new job?</Text>

      {/* Quick filters */}
      <View style={styles.finderFilters}>
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Hours needed</Text>
          <View style={styles.hourButtons}>
            {[4, 8, 16, 24].map((h) => (
              <TouchableOpacity
                key={h}
                style={[styles.hourButton, hours === h && styles.hourButtonActive]}
                onPress={() => setHours(h)}
              >
                <Text style={[styles.hourButtonText, hours === h && styles.hourButtonTextActive]}>
                  {h}h
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.outdoorToggle}
          onPress={() => setIsOutdoor(!isOutdoor)}
        >
          <Ionicons
            name={isOutdoor ? 'checkbox' : 'square-outline'}
            size={20}
            color={isOutdoor ? colors.primary : colors.textSecondary}
          />
          <Text style={styles.outdoorToggleText}>Outdoor work (weather-dependent)</Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 16 }} />
      ) : windows.length > 0 ? (
        <View style={styles.windowsList}>
          {windows.map((window, index) => (
            <WindowCard key={`${window.startDate}-${index}`} window={window} />
          ))}
        </View>
      ) : (
        <View style={styles.noResults}>
          <Ionicons name="calendar-outline" size={32} color={colors.textMuted} />
          <Text style={styles.noResultsText}>No availability found in the next 30 days</Text>
        </View>
      )}
    </View>
  );
}

function WindowCard({ window }: { window: AvailabilityWindow }) {
  return (
    <View style={styles.windowCard}>
      <View style={styles.windowMain}>
        <View>
          <Text style={styles.windowDisplay}>{window.displayText}</Text>
          <Text style={styles.windowHours}>{window.totalAvailableHours} hours available</Text>
        </View>
        <View style={styles.confidenceBadge}>
          <Text
            style={[
              styles.confidenceText,
              {
                color:
                  window.confidence >= 80 ? colors.success : window.confidence >= 60 ? colors.warning : colors.danger,
              },
            ]}
          >
            {window.confidence}% confident
          </Text>
        </View>
      </View>

      {window.constraints.length > 0 && (
        <View style={styles.constraintsRow}>
          {window.constraints.map((c, i) => (
            <View key={i} style={styles.constraintChip}>
              <Ionicons
                name={c.type === 'weather' ? 'cloud-outline' : 'information-circle-outline'}
                size={12}
                color={c.severity === 'blocking' ? colors.danger : colors.warning}
              />
              <Text style={styles.constraintText}>{c.description}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ============================================
// ESTIMATOR TAB
// ============================================

function EstimatorTab() {
  const [input, setInput] = useState<EstimatorInput>({
    jobType: 'interior-painting',
    size: 'medium',
    complexity: 'moderate',
    isOutdoor: false,
    requiresPermit: false,
  });

  const [showCustomerResponse, setShowCustomerResponse] = useState(false);

  const scope: JobScope = {
    size: input.size,
    complexity: input.complexity,
    isOutdoor: input.isOutdoor,
    requiresPermit: input.requiresPermit,
  };

  const { data: estimate, loading: estimateLoading } = useDurationEstimate(input.jobType, scope);
  const { data: delays, loading: delaysLoading } = useDelayAnalysis(
    input.jobType,
    scope,
    new Date().toISOString()
  );
  const { data: customerResponse } = useCustomerQuoteResponse(input.jobType, scope);

  const jobTypes = [
    { id: 'interior-painting', label: 'Interior Painting' },
    { id: 'exterior-painting', label: 'Exterior Painting' },
    { id: 'wallpaper-installation', label: 'Wallpaper' },
    { id: 'carpentry-repair', label: 'Carpentry' },
    { id: 'general-maintenance', label: 'General Maintenance' },
    { id: 'plastering', label: 'Plastering' },
    { id: 'tiling', label: 'Tiling' },
    { id: 'flooring', label: 'Flooring' },
  ];

  return (
    <View>
      {/* Job Type Selector */}
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Job Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {jobTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[styles.chip, input.jobType === type.id && styles.chipActive]}
                onPress={() => setInput({ ...input, jobType: type.id })}
              >
                <Text style={[styles.chipText, input.jobType === type.id && styles.chipTextActive]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Size Selector */}
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Job Size</Text>
        <View style={styles.segmentedControl}>
          {(['small', 'medium', 'large'] as const).map((size) => (
            <TouchableOpacity
              key={size}
              style={[styles.segment, input.size === size && styles.segmentActive]}
              onPress={() => setInput({ ...input, size })}
            >
              <Text style={[styles.segmentText, input.size === size && styles.segmentTextActive]}>
                {size.charAt(0).toUpperCase() + size.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Complexity Selector */}
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Complexity</Text>
        <View style={styles.segmentedControl}>
          {(['simple', 'moderate', 'complex'] as const).map((complexity) => (
            <TouchableOpacity
              key={complexity}
              style={[styles.segment, input.complexity === complexity && styles.segmentActive]}
              onPress={() => setInput({ ...input, complexity })}
            >
              <Text
                style={[styles.segmentText, input.complexity === complexity && styles.segmentTextActive]}
              >
                {complexity.charAt(0).toUpperCase() + complexity.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Toggles */}
      <View style={styles.togglesRow}>
        <TouchableOpacity
          style={styles.toggle}
          onPress={() => setInput({ ...input, isOutdoor: !input.isOutdoor })}
        >
          <Ionicons
            name={input.isOutdoor ? 'checkbox' : 'square-outline'}
            size={20}
            color={input.isOutdoor ? colors.primary : colors.textSecondary}
          />
          <Text style={styles.toggleText}>Outdoor Work</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toggle}
          onPress={() => setInput({ ...input, requiresPermit: !input.requiresPermit })}
        >
          <Ionicons
            name={input.requiresPermit ? 'checkbox' : 'square-outline'}
            size={20}
            color={input.requiresPermit ? colors.primary : colors.textSecondary}
          />
          <Text style={styles.toggleText}>Requires Permit</Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      {estimateLoading || delaysLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
      ) : (
        estimate && delays && (
          <View style={styles.estimateResults}>
            {/* Duration Estimate Card */}
            <View style={styles.estimateCard}>
              <View style={styles.estimateHeader}>
                <Text style={styles.estimateTitle}>Duration Estimate</Text>
                <View
                  style={[
                    styles.confidencePill,
                    {
                      backgroundColor:
                        estimate.confidence >= 80
                          ? colors.success + '20'
                          : estimate.confidence >= 60
                            ? colors.warning + '20'
                            : colors.danger + '20',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.confidencePillText,
                      {
                        color:
                          estimate.confidence >= 80
                            ? colors.success
                            : estimate.confidence >= 60
                              ? colors.warning
                              : colors.danger,
                      },
                    ]}
                  >
                    {estimate.confidence}% confidence
                  </Text>
                </View>
              </View>

              <View style={styles.durationDisplay}>
                <Text style={styles.durationValue}>{estimate.estimatedHours}</Text>
                <Text style={styles.durationUnit}>hours</Text>
              </View>

              <Text style={styles.durationRange}>
                Range: {estimate.rangeMin} - {estimate.rangeMax} hours
              </Text>

              {/* Breakdown */}
              <View style={styles.breakdown}>
                <Text style={styles.breakdownTitle}>Breakdown</Text>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Preparation</Text>
                  <Text style={styles.breakdownValue}>{estimate.breakdown.preparation}h</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Core Work</Text>
                  <Text style={styles.breakdownValue}>{estimate.breakdown.coreWork}h</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Cleanup</Text>
                  <Text style={styles.breakdownValue}>{estimate.breakdown.cleanup}h</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Buffer</Text>
                  <Text style={styles.breakdownValue}>{estimate.breakdown.buffer}h</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Travel</Text>
                  <Text style={styles.breakdownValue}>{estimate.breakdown.travelTime}h</Text>
                </View>
              </View>

              {/* AI Reasoning */}
              <View style={styles.reasoningBox}>
                <Ionicons name="bulb-outline" size={16} color={colors.info} />
                <Text style={styles.reasoningText}>{estimate.reasoning}</Text>
              </View>
            </View>

            {/* Delay Risks Card */}
            <View style={styles.delayCard}>
              <View style={styles.delayHeader}>
                <Text style={styles.delayTitle}>Potential Delays</Text>
                <View
                  style={[
                    styles.riskPill,
                    {
                      backgroundColor:
                        delays.overallDelayRisk === 'critical'
                          ? colors.danger + '20'
                          : delays.overallDelayRisk === 'high'
                            ? colors.warning + '20'
                            : colors.success + '20',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.riskPillText,
                      {
                        color:
                          delays.overallDelayRisk === 'critical'
                            ? colors.danger
                            : delays.overallDelayRisk === 'high'
                              ? colors.warning
                              : colors.success,
                      },
                    ]}
                  >
                    {delays.overallDelayRisk.charAt(0).toUpperCase() + delays.overallDelayRisk.slice(1)} Risk
                  </Text>
                </View>
              </View>

              <View style={styles.delayStats}>
                <View style={styles.delayStat}>
                  <Text style={styles.delayStatValue}>{delays.mostLikelyDelay}h</Text>
                  <Text style={styles.delayStatLabel}>Most Likely</Text>
                </View>
                <View style={styles.delayStat}>
                  <Text style={styles.delayStatValue}>{delays.worstCaseDelay}h</Text>
                  <Text style={styles.delayStatLabel}>Worst Case</Text>
                </View>
              </View>

              {/* Top Risks */}
              <View style={styles.topRisks}>
                <Text style={styles.topRisksTitle}>Top Risk Factors</Text>
                {delays.topRisks.slice(0, 3).map((risk, index) => (
                  <View key={risk.id} style={styles.riskItem}>
                    <View style={styles.riskIcon}>
                      <Ionicons
                        name={
                          risk.category === 'weather'
                            ? 'cloud-outline'
                            : risk.category === 'material'
                              ? 'cube-outline'
                              : risk.category === 'customer'
                                ? 'person-outline'
                                : 'warning-outline'
                        }
                        size={16}
                        color={colors.warning}
                      />
                    </View>
                    <View style={styles.riskInfo}>
                      <Text style={styles.riskName}>{risk.name}</Text>
                      <Text style={styles.riskDesc}>
                        {risk.probability}% chance • +{risk.impactHours}h impact
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Proactive Actions */}
              {delays.proactiveActions.length > 0 && (
                <View style={styles.proactiveSection}>
                  <Text style={styles.proactiveTitle}>Prevent Delays</Text>
                  {delays.proactiveActions.slice(0, 2).map((action, index) => (
                    <View key={index} style={styles.actionItem}>
                      <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
                      <Text style={styles.actionText}>{action.action}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Customer Response Button */}
            <TouchableOpacity
              style={styles.customerResponseButton}
              onPress={() => setShowCustomerResponse(true)}
            >
              <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
              <Text style={styles.customerResponseButtonText}>Generate Customer Quote Response</Text>
            </TouchableOpacity>

            {/* Customer Response Modal */}
            {showCustomerResponse && customerResponse && (
              <CustomerResponseModal
                response={customerResponse}
                onClose={() => setShowCustomerResponse(false)}
              />
            )}
          </View>
        )
      )}
    </View>
  );
}

// ============================================
// CUSTOMER RESPONSE MODAL
// ============================================

function CustomerResponseModal({
  response,
  onClose,
}: {
  response: CustomerQuoteResponse;
  onClose: () => void;
}) {
  const message = `Thank you for your enquiry!

I can start on ${new Date(response.recommendedStart).toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' })}.

Estimated duration: ${response.estimatedDuration}
Expected completion: ${new Date(response.estimatedCompletion).toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' })}

${response.confidenceExplanation}

${response.knownRisks.length > 0 ? 'Please note: ' + response.knownRisks.map((r) => r.customerMessage).join('. ') : ''}

${response.rushAvailable ? `Rush service available (+${response.rushPremium}% fee)` : ''}`;

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Customer Quote Response</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.responsePreview}>
              <Text style={styles.responseText}>{message}</Text>
            </View>

            {/* Confidence indicator */}
            <View style={styles.confidenceSection}>
              <View style={styles.confidenceRow}>
                <Text style={styles.confidenceLabelModal}>Estimate Confidence:</Text>
                <View
                  style={[
                    styles.confidenceBadgeModal,
                    {
                      backgroundColor:
                        response.confidenceLevel === 'high'
                          ? colors.success + '20'
                          : response.confidenceLevel === 'medium'
                            ? colors.warning + '20'
                            : colors.danger + '20',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        response.confidenceLevel === 'high'
                          ? colors.success
                          : response.confidenceLevel === 'medium'
                            ? colors.warning
                            : colors.danger,
                      fontWeight: '600',
                    }}
                  >
                    {response.confidenceLevel.charAt(0).toUpperCase() + response.confidenceLevel.slice(1)}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.copyButton}>
              <Ionicons name="copy-outline" size={18} color="#FFF" />
              <Text style={styles.copyButtonText}>Copy to Clipboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ============================================
// ALERTS TAB
// ============================================

function AlertsTab() {
  const { data: alerts, loading, acknowledge, resolve } = useCapacityAlerts();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const activeAlerts = alerts.filter((a) => a.status === 'active');
  const acknowledgedAlerts = alerts.filter((a) => a.status === 'acknowledged');

  const severityColors = {
    info: colors.info,
    warning: colors.warning,
    danger: colors.danger,
    critical: colors.danger,
  };

  const severityIcons = {
    info: 'information-circle-outline',
    warning: 'warning-outline',
    danger: 'alert-circle-outline',
    critical: 'alert-circle',
  };

  return (
    <View>
      {/* Active Alerts */}
      <Text style={styles.sectionTitle}>Active Alerts ({activeAlerts.length})</Text>

      {activeAlerts.length === 0 ? (
        <View style={styles.noAlerts}>
          <Ionicons name="checkmark-circle-outline" size={48} color={colors.success} />
          <Text style={styles.noAlertsTitle}>All Clear!</Text>
          <Text style={styles.noAlertsText}>No active capacity alerts</Text>
        </View>
      ) : (
        activeAlerts.map((alert) => (
          <View key={alert.id} style={styles.alertCard}>
            <View style={[styles.alertIconContainer, { backgroundColor: severityColors[alert.severity] + '20' }]}>
              <Ionicons
                name={severityIcons[alert.severity] as any}
                size={24}
                color={severityColors[alert.severity]}
              />
            </View>
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>{alert.title}</Text>
              <Text style={styles.alertMessage}>{alert.message}</Text>

              {alert.suggestedActions.length > 0 && (
                <View style={styles.alertActions}>
                  <Text style={styles.alertActionsLabel}>Suggested Actions:</Text>
                  {alert.suggestedActions.map((action, index) => (
                    <View key={index} style={styles.alertActionItem}>
                      <Text style={styles.alertActionBullet}>•</Text>
                      <Text style={styles.alertActionText}>{action}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.alertButtons}>
                <TouchableOpacity
                  style={styles.alertButton}
                  onPress={() => acknowledge(alert.id)}
                >
                  <Text style={styles.alertButtonText}>Acknowledge</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.alertButton, styles.alertButtonPrimary]}
                  onPress={() => resolve(alert.id)}
                >
                  <Text style={[styles.alertButtonText, styles.alertButtonTextPrimary]}>Resolve</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))
      )}

      {/* Acknowledged Alerts */}
      {acknowledgedAlerts.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
            Acknowledged ({acknowledgedAlerts.length})
          </Text>
          {acknowledgedAlerts.map((alert) => (
            <View key={alert.id} style={[styles.alertCard, styles.alertCardAcknowledged]}>
              <View style={[styles.alertIconContainer, { backgroundColor: colors.textMuted + '20' }]}>
                <Ionicons name="checkmark-circle-outline" size={24} color={colors.textMuted} />
              </View>
              <View style={styles.alertContent}>
                <Text style={[styles.alertTitle, { color: colors.textSecondary }]}>{alert.title}</Text>
                <Text style={[styles.alertMessage, { color: colors.textMuted }]}>{alert.message}</Text>
                <TouchableOpacity
                  style={[styles.alertButton, { marginTop: 8 }]}
                  onPress={() => resolve(alert.id)}
                >
                  <Text style={styles.alertButtonText}>Mark Resolved</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

// ============================================
// ACCURACY TAB
// ============================================

function AccuracyTab() {
  const { data: accuracy, loading } = usePredictionAccuracy('month');

  if (loading || !accuracy) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>Prediction Accuracy</Text>
      <Text style={styles.sectionSubtitle}>How well your estimates match reality</Text>

      {/* Summary Stats */}
      <View style={styles.accuracyStats}>
        <View style={styles.accuracyStat}>
          <Text style={styles.accuracyValue}>{accuracy.onTimeRate}%</Text>
          <Text style={styles.accuracyLabel}>On-Time Completion</Text>
        </View>
        <View style={styles.accuracyStat}>
          <Text style={styles.accuracyValue}>{accuracy.avgEstimateErrorPercent}%</Text>
          <Text style={styles.accuracyLabel}>Avg Estimate Error</Text>
        </View>
        <View style={styles.accuracyStat}>
          <Text style={styles.accuracyValue}>{accuracy.totalJobs}</Text>
          <Text style={styles.accuracyLabel}>Jobs This Month</Text>
        </View>
      </View>

      {/* Trend Indicator */}
      <View style={styles.trendCard}>
        <Ionicons
          name={
            accuracy.trend === 'improving'
              ? 'trending-up'
              : accuracy.trend === 'declining'
                ? 'trending-down'
                : 'remove-outline'
          }
          size={24}
          color={accuracy.trend === 'improving' ? colors.success : accuracy.trend === 'declining' ? colors.danger : colors.warning}
        />
        <Text style={styles.trendText}>
          Your estimates are{' '}
          <Text style={{ fontWeight: '600' }}>
            {accuracy.trend === 'improving'
              ? 'getting more accurate'
              : accuracy.trend === 'declining'
                ? 'becoming less accurate'
                : 'staying consistent'}
          </Text>
        </Text>
      </View>

      {/* Accuracy by Job Type */}
      <View style={styles.byTypeSection}>
        <Text style={styles.byTypeTitle}>Accuracy by Job Type</Text>
        {Object.entries(accuracy.accuracyByJobType).map(([type, rate]) => (
          <View key={type} style={styles.byTypeRow}>
            <Text style={styles.byTypeName}>{type.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</Text>
            <View style={styles.byTypeBar}>
              <View
                style={[
                  styles.byTypeBarFill,
                  {
                    width: `${rate}%`,
                    backgroundColor: rate >= 80 ? colors.success : rate >= 60 ? colors.warning : colors.danger,
                  },
                ]}
              />
            </View>
            <Text style={styles.byTypeRate}>{rate}%</Text>
          </View>
        ))}
      </View>

      {/* Common Delays */}
      <View style={styles.commonDelaysSection}>
        <Text style={styles.commonDelaysTitle}>Most Common Overrun Causes</Text>
        {accuracy.mostCommonDelays.map((delay, index) => (
          <View key={index} style={styles.commonDelayItem}>
            <View style={styles.commonDelayRank}>
              <Text style={styles.commonDelayRankText}>{index + 1}</Text>
            </View>
            <View style={styles.commonDelayInfo}>
              <Text style={styles.commonDelayCause}>{delay.cause}</Text>
              <Text style={styles.commonDelayStats}>
                {delay.count} times • Avg +{delay.avgHours}h
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Improvement Tips */}
      <View style={styles.tipsSection}>
        <Text style={styles.tipsTitle}>Tips to Improve Accuracy</Text>
        <View style={styles.tipItem}>
          <Ionicons name="bulb-outline" size={18} color={colors.info} />
          <Text style={styles.tipText}>Add 15-20% buffer for first-time job types</Text>
        </View>
        <View style={styles.tipItem}>
          <Ionicons name="bulb-outline" size={18} color={colors.info} />
          <Text style={styles.tipText}>Conduct site visits before complex jobs</Text>
        </View>
        <View style={styles.tipItem}>
          <Ionicons name="bulb-outline" size={18} color={colors.info} />
          <Text style={styles.tipText}>Document scope changes to refine future estimates</Text>
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
    backgroundColor: colors.background,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: colors.primary,
  },
  badge: {
    backgroundColor: colors.danger,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },

  // Content
  content: {
    flex: 1,
    padding: 16,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
  },

  // Summary Cards
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // Legend
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Calendar
  calendarContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: -8,
    marginBottom: 16,
  },
  calendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  calendarDay: {
    width: '13%',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  calendarDaySelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  calendarDayName: {
    fontSize: 10,
    color: colors.textMuted,
  },
  calendarDayDate: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginVertical: 4,
  },
  capacityIndicator: {
    width: 24,
    height: 4,
    borderRadius: 2,
    marginVertical: 4,
  },
  calendarHours: {
    fontSize: 10,
    color: colors.textSecondary,
  },

  // Day Details
  dayDetails: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  dayDetailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  hoursBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  hoursStat: {
    alignItems: 'center',
  },
  hoursValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  hoursLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  utilizationContainer: {
    marginBottom: 16,
  },
  utilizationBarBg: {
    height: 8,
    backgroundColor: colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  utilizationBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  utilizationText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'right',
  },
  weatherSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: colors.borderLight,
    borderRadius: 8,
    marginBottom: 16,
  },
  weatherText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  jobsSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
  },
  jobsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  jobItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  jobInfo: {
    flex: 1,
  },
  jobTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  jobCustomer: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  jobMeta: {
    alignItems: 'flex-end',
  },
  jobHours: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  atRiskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.danger + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  atRiskText: {
    fontSize: 10,
    color: colors.danger,
    fontWeight: '600',
  },

  // Finder
  finderContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  finderFilters: {
    marginTop: 8,
  },
  filterGroup: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  hourButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  hourButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.borderLight,
  },
  hourButtonActive: {
    backgroundColor: colors.primary,
  },
  hourButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  hourButtonTextActive: {
    color: '#FFF',
  },
  outdoorToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  outdoorToggleText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  windowsList: {
    marginTop: 16,
    gap: 12,
  },
  windowCard: {
    backgroundColor: colors.borderLight,
    borderRadius: 8,
    padding: 12,
  },
  windowMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  windowDisplay: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  windowHours: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.surface,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '500',
  },
  constraintsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  constraintChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  constraintText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noResultsText: {
    marginTop: 8,
    color: colors.textMuted,
  },

  // Estimator
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: '#FFF',
    fontWeight: '500',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.borderLight,
    borderRadius: 8,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
  togglesRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 24,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleText: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  // Estimate Results
  estimateResults: {
    gap: 16,
  },
  estimateCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  estimateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  estimateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  confidencePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidencePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  durationDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 8,
  },
  durationValue: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.primary,
  },
  durationUnit: {
    fontSize: 20,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  durationRange: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  breakdown: {
    backgroundColor: colors.borderLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  breakdownLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  reasoningBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: colors.info + '10',
    borderRadius: 8,
  },
  reasoningText: {
    flex: 1,
    fontSize: 12,
    color: colors.info,
    lineHeight: 18,
  },

  // Delay Card
  delayCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  delayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  delayTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  riskPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  riskPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  delayStats: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
  },
  delayStat: {
    alignItems: 'center',
  },
  delayStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.warning,
  },
  delayStatLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  topRisks: {
    marginBottom: 16,
  },
  topRisksTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  riskItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  riskIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.warning + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  riskInfo: {
    flex: 1,
  },
  riskName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  riskDesc: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  proactiveSection: {
    backgroundColor: colors.success + '10',
    borderRadius: 8,
    padding: 12,
  },
  proactiveTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
    marginBottom: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  actionText: {
    fontSize: 12,
    color: colors.text,
  },

  // Customer Response Button
  customerResponseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary + '10',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  customerResponseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  modalBody: {
    padding: 16,
  },
  responsePreview: {
    backgroundColor: colors.borderLight,
    borderRadius: 8,
    padding: 16,
  },
  responseText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  confidenceSection: {
    marginTop: 16,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceLabelModal: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  confidenceBadgeModal: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
  },
  copyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },

  // Alerts
  noAlerts: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  noAlertsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.success,
    marginTop: 12,
  },
  noAlertsText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  alertCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alertCardAcknowledged: {
    opacity: 0.7,
  },
  alertIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  alertMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  alertActions: {
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.borderLight,
    borderRadius: 8,
  },
  alertActionsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  alertActionItem: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  alertActionBullet: {
    color: colors.textSecondary,
  },
  alertActionText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  alertButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  alertButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.borderLight,
  },
  alertButtonPrimary: {
    backgroundColor: colors.primary,
  },
  alertButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  alertButtonTextPrimary: {
    color: '#FFF',
  },

  // Accuracy
  accuracyStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  accuracyStat: {
    alignItems: 'center',
  },
  accuracyValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
  },
  accuracyLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  trendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  trendText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  byTypeSection: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  byTypeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  byTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  byTypeName: {
    width: 120,
    fontSize: 13,
    color: colors.textSecondary,
  },
  byTypeBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 12,
  },
  byTypeBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  byTypeRate: {
    width: 40,
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'right',
  },
  commonDelaysSection: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  commonDelaysTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  commonDelayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  commonDelayRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.warning + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commonDelayRankText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.warning,
  },
  commonDelayInfo: {
    flex: 1,
  },
  commonDelayCause: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  commonDelayStats: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  tipsSection: {
    backgroundColor: colors.info + '10',
    borderRadius: 12,
    padding: 16,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.info,
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
});

export default CapacityPlanning;
