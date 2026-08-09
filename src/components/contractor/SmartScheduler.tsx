// =============================================================================
// SMART SCHEDULER COMPONENT
// =============================================================================
// AI-powered scheduling with weather awareness and route optimization
// =============================================================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import {
  useScheduler,
  useDaySchedule,
  useWeekSchedule,
  useWeatherAlerts,
  ScheduledJob,
  DaySchedule,
  ScheduleConflict,
  ScheduleOptimization,
} from '../../services/smartSchedulerService';
import { predictDuration, type DurationPrediction } from '../../intelligence/predictions';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { formatDayMonthAuto, formatTimeAuto } from '../../i18n/formatting';
type ViewType = 'day' | 'week' | 'list';

export function SmartScheduler() {
  // Dutch 'u' (uren) was hardcoded here — an English contractor read "7.5u".
  // common.durationH is the localised unit: {{h}}h · {{h}}u · {{h}} Std.
  const hoursLabel = (h: number) =>
    t('common.durationH', { defaultValue: '{{h}}h', h: h.toFixed(1) });
  const { t } = useTranslation();
  const { user } = useAuth();
  const [viewType, setViewType] = useState<ViewType>('week');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showJobModal, setShowJobModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<ScheduledJob | null>(null);
  const [showOptimizations, setShowOptimizations] = useState(false);
  const [durationPrediction, setDurationPrediction] = useState<DurationPrediction | null>(null);

  // Fetch duration prediction when a job is selected
  React.useEffect(() => {
    if (selectedJob) {
      predictDuration({
        trade: user?.trade ?? 'general',
        country: user?.country ?? 'NL',
        jobType: selectedJob.type,
        estimatedHours: selectedJob.duration ? selectedJob.duration / 60 : undefined,
      }).then(setDurationPrediction).catch(() => setDurationPrediction(null));
    } else {
      setDurationPrediction(null);
    }
  }, [selectedJob, user?.trade, user?.country]);

  const { jobs, conflicts, optimizations, rescheduleJob, cancelJob, updateStatus } = useScheduler();
  const daySchedule = useDaySchedule(selectedDate);
  const weekSchedule = useWeekSchedule(selectedDate);
  const weatherAlerts = useWeatherAlerts();

  const getWeekDates = () => {
    const dates: string[] = [];
    const start = new Date(selectedDate);
    start.setDate(start.getDate() - start.getDay() + 1); // Monday

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  const weekDates = useMemo(getWeekDates, [selectedDate]);

  const getJobTypeStyle = (type: ScheduledJob['type']) => {
    switch (type) {
      case 'job': return { color: Palette.blue500, icon: 'construct-outline', label: 'Werk' };
      case 'quote_visit': return { color: Palette.hermesOrange, icon: 'document-text-outline', label: 'Offerte' };
      case 'follow_up': return { color: Palette.orange500, icon: 'chatbubble-outline', label: 'Follow-up' };
      case 'personal': return { color: Palette.gray500, icon: 'person-outline', label: 'Persoonlijk' };
      default: return { color: Palette.gray500, icon: 'calendar-outline', label: type };
    }
  };

  const getPriorityStyle = (priority: ScheduledJob['priority']) => {
    switch (priority) {
      case 'urgent': return { color: Palette.red500, label: 'Urgent' };
      case 'high': return { color: Palette.orange500, label: 'Hoog' };
      case 'medium': return { color: Palette.blue500, label: 'Middel' };
      case 'low': return { color: Palette.gray500, label: 'Laag' };
    }
  };

  const getWeatherIcon = (condition: string) => {
    switch (condition) {
      case 'sunny': return { icon: 'sunny-outline', color: Palette.orange500 };
      case 'cloudy': return { icon: 'cloudy-outline', color: Palette.gray500 };
      case 'rainy': return { icon: 'rainy-outline', color: Palette.blue500 };
      case 'stormy': return { icon: 'thunderstorm-outline', color: Palette.hermesOrange };
      case 'snow': return { icon: 'snow-outline', color: Palette.blue500 };
      default: return { icon: 'partly-sunny-outline', color: Palette.gray500 };
    }
  };

  const formatTime = (dateStr: string) => {
    return formatTimeAuto(new Date(dateStr));
  };

  const formatDate = (dateStr: string) => {
    return formatDayMonthAuto(new Date(dateStr));
  };

  const openJob = (job: ScheduledJob) => {
    setSelectedJob(job);
    setShowJobModal(true);
  };

  const renderConflictBanner = () => {
    if (conflicts.length === 0) return null;

    return (
      <Pressable style={styles.conflictBanner}>
        <Ionicons name="warning-outline" size={20} color={Palette.red500} />
        <Text style={styles.conflictText}>
          {conflicts.length} planning{conflicts.length > 1 ? 'conflicten' : 'conflict'} gedetecteerd
        </Text>
        <Ionicons name="chevron-forward" size={18} color={Palette.red500} />
      </Pressable>
    );
  };

  const renderOptimizationsBanner = () => {
    if (optimizations.length === 0) return null;

    return (
      <Pressable
        style={styles.optimizationBanner}
        onPress={() => setShowOptimizations(true)}
      >
        <Ionicons name="bulb-outline" size={20} color={Palette.green500} />
        <Text style={styles.optimizationText}>
          {optimizations.length} optimalisatie{optimizations.length > 1 ? 'suggesties' : 'suggestie'}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={Palette.green500} />
      </Pressable>
    );
  };

  const renderWeatherAlert = () => {
    if (weatherAlerts.length === 0) return null;

    return (
      <View style={styles.weatherAlert}>
        <Ionicons name="rainy-outline" size={18} color={Palette.orange500} />
        <Text style={styles.weatherAlertText}>
          {weatherAlerts.length} buitenklus{weatherAlerts.length > 1 ? 'sen' : ''} met slecht weer
        </Text>
      </View>
    );
  };

  const renderJobCard = (job: ScheduledJob, compact: boolean = false) => {
    const typeStyle = getJobTypeStyle(job.type);
    const priorityStyle = getPriorityStyle(job.priority);
    const hasWeatherWarning = job.weatherSensitive && weatherAlerts.some((a) => a.jobId === job.id);

    return (
      <Pressable
        key={job.id}
        style={[styles.jobCard, compact && styles.jobCardCompact]}
        onPress={() => openJob(job)}
      >
        <View style={[styles.jobTypeIndicator, { backgroundColor: typeStyle.color }]} />
        <View style={styles.jobContent}>
          <View style={styles.jobHeader}>
            <Text style={styles.jobTime}>
              {formatTime(job.startTime)} - {formatTime(job.endTime)}
            </Text>
            {hasWeatherWarning && (
              <Ionicons name="rainy-outline" size={14} color={Palette.orange500} />
            )}
            {job.priority === 'urgent' || job.priority === 'high' ? (
              <View style={[styles.priorityDot, { backgroundColor: priorityStyle.color }]} />
            ) : null}
          </View>
          <Text style={styles.jobTitle} numberOfLines={1}>{job.projectName}</Text>
          {!compact && (
            <>
              <Text style={styles.jobCustomer}>{job.customerName}</Text>
              <View style={styles.jobMeta}>
                <Ionicons name="location-outline" size={12} color={SemanticColors.textSecondary} />
                <Text style={styles.jobAddress} numberOfLines={1}>{job.address}</Text>
              </View>
            </>
          )}
        </View>
      </Pressable>
    );
  };

  const renderDayColumn = (dateStr: string, schedule: DaySchedule) => {
    const isToday = dateStr === new Date().toISOString().split('T')[0];
    const isSelected = dateStr === selectedDate;
    const weatherStyle = getWeatherIcon(schedule.weatherOverview.condition);
    const dayOfWeek = formatDayMonthAuto(new Date(dateStr));
    const dayNum = new Date(dateStr).getDate();

    return (
      <View key={dateStr} style={[styles.dayColumn, isSelected && styles.dayColumnSelected]}>
        <Pressable
          style={[styles.dayHeader, isToday && styles.dayHeaderToday]}
          onPress={() => setSelectedDate(dateStr)}
        >
          <Text style={[styles.dayOfWeek, isToday && styles.dayTextToday]}>{dayOfWeek}</Text>
          <Text style={[styles.dayNumber, isToday && styles.dayTextToday]}>{dayNum}</Text>
          <View style={styles.dayWeather}>
            <Ionicons name={weatherStyle.icon as any} size={14} color={weatherStyle.color} />
          </View>
        </Pressable>

        <View style={styles.dayJobs}>
          {schedule.jobs.length === 0 ? (
            <View style={styles.emptyDay}>
              <Text style={styles.emptyDayText}>Vrij</Text>
            </View>
          ) : (
            schedule.jobs.slice(0, 3).map((job) => renderJobCard(job, true))
          )}
          {schedule.jobs.length > 3 && (
            <Text style={styles.moreJobs}>+{schedule.jobs.length - 3} meer</Text>
          )}
        </View>

        <View style={styles.dayUtilization}>
          <View style={styles.utilizationBar}>
            <View
              style={[
                styles.utilizationFill,
                {
                  width: `${Math.min(schedule.utilization, 100)}%`,
                  backgroundColor: schedule.utilization > 90 ? Palette.red500 : schedule.utilization > 70 ? Palette.orange500 : Palette.green500,
                },
              ]}
            />
          </View>
          <Text style={styles.utilizationText}>{schedule.utilization}%</Text>
        </View>
      </View>
    );
  };

  const renderWeekView = () => (
    <View style={styles.weekView}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {weekSchedule.map((schedule, index) => renderDayColumn(weekDates[index], schedule))}
      </ScrollView>
    </View>
  );

  const renderDayView = () => (
    <ScrollView style={styles.dayView} showsVerticalScrollIndicator={false}>
      {/* Day Header */}
      <View style={styles.dayViewHeader}>
        <Pressable onPress={() => {
          const prev = new Date(selectedDate);
          prev.setDate(prev.getDate() - 1);
          setSelectedDate(prev.toISOString().split('T')[0]);
        }}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={styles.dayViewTitle}>
          <Text style={styles.dayViewDate}>{formatDate(selectedDate)}</Text>
          <View style={styles.dayViewWeather}>
            <Ionicons
              name={getWeatherIcon(daySchedule.weatherOverview.condition).icon as any}
              size={18}
              color={getWeatherIcon(daySchedule.weatherOverview.condition).color}
            />
            <Text style={styles.dayViewTemp}>{daySchedule.weatherOverview.temperature}°C</Text>
            {!daySchedule.weatherOverview.suitableForOutdoor && (
              <Text style={styles.notSuitableText}>Ongeschikt voor buitenwerk</Text>
            )}
          </View>
        </View>
        <Pressable onPress={() => {
          const next = new Date(selectedDate);
          next.setDate(next.getDate() + 1);
          setSelectedDate(next.toISOString().split('T')[0]);
        }}>
          <Ionicons name="chevron-forward" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
      </View>

      {/* Day Stats */}
      <View style={styles.dayStats}>
        <View style={styles.dayStat}>
          <Text style={styles.dayStatValue}>{daySchedule.jobs.length}</Text>
          <Text style={styles.dayStatLabel}>Afspraken</Text>
        </View>
        <View style={styles.dayStat}>
          <Text style={styles.dayStatValue}>{hoursLabel(daySchedule.totalWorkTime / 60)}</Text>
          <Text style={styles.dayStatLabel}>Werktijd</Text>
        </View>
        <View style={styles.dayStat}>
          <Text style={styles.dayStatValue}>{daySchedule.totalTravelTime}m</Text>
          <Text style={styles.dayStatLabel}>Reistijd</Text>
        </View>
        <View style={styles.dayStat}>
          <Text style={[styles.dayStatValue, { color: daySchedule.utilization > 90 ? Palette.red500 : daySchedule.utilization > 70 ? Palette.orange500 : Palette.green500 }]}>
            {daySchedule.utilization}%
          </Text>
          <Text style={styles.dayStatLabel}>Bezetting</Text>
        </View>
      </View>

      {/* Jobs List */}
      <View style={styles.jobsList}>
        {daySchedule.jobs.length === 0 ? (
          <View style={styles.emptyDayView}>
            <Ionicons name="calendar-outline" size={48} color={SemanticColors.textSecondary} />
            <Text style={styles.emptyTitle}>{t('scheduler.noAppointments', 'No appointments')}</Text>
            <Text style={styles.emptyText}>Deze dag is nog vrij</Text>
          </View>
        ) : (
          daySchedule.jobs.map((job) => renderJobCard(job, false))
        )}
      </View>
    </ScrollView>
  );

  const renderListView = () => {
    const upcomingJobs = jobs
      .filter((j) => j.status === 'scheduled' && new Date(j.startTime) >= new Date())
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    // Group by date
    const groupedJobs: Record<string, ScheduledJob[]> = {};
    upcomingJobs.forEach((job) => {
      const date = job.startTime.split('T')[0];
      if (!groupedJobs[date]) groupedJobs[date] = [];
      groupedJobs[date].push(job);
    });

    return (
      <ScrollView style={styles.listView} showsVerticalScrollIndicator={false}>
        {Object.entries(groupedJobs).map(([date, dateJobs]) => (
          <View key={date} style={styles.dateGroup}>
            <Text style={styles.dateGroupTitle}>{formatDate(date)}</Text>
            {dateJobs.map((job) => renderJobCard(job, false))}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderOptimizationsModal = () => (
    <Modal
      visible={showOptimizations}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowOptimizations(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Pressable onPress={() => setShowOptimizations(false)}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
          <Text style={styles.modalTitle}>Optimalisaties</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.modalContent}>
          {optimizations.map((opt) => (
            <View key={opt.id} style={styles.optimizationCard}>
              <View style={styles.optimizationIcon}>
                <Ionicons
                  name={opt.type === 'travel' ? 'car-outline' : opt.type === 'weather' ? 'rainy-outline' : 'flash-outline'}
                  size={24}
                  color={Palette.green500}
                />
              </View>
              <View style={styles.optimizationContent}>
                <Text style={styles.optimizationTitle}>{opt.title}</Text>
                <Text style={styles.optimizationDesc}>{opt.description}</Text>
                <View style={styles.optimizationSaving}>
                  <Ionicons name="time-outline" size={14} color={Palette.green500} />
                  <Text style={styles.optimizationSavingText}>{opt.potentialSaving}</Text>
                </View>
              </View>
              <Pressable style={styles.applyButton}>
                <Text style={styles.applyButtonText}>Toepassen</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );

  const renderJobModal = () => (
    <Modal
      visible={showJobModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowJobModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Pressable onPress={() => setShowJobModal(false)}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </Pressable>
          <Text style={styles.modalTitle}>Afspraak details</Text>
          <Pressable>
            <Ionicons name="create-outline" size={24} color={Palette.blue500} />
          </Pressable>
        </View>

        {selectedJob && (
          <ScrollView style={styles.modalContent}>
            <View style={styles.jobDetailHeader}>
              <View style={[styles.jobDetailType, { backgroundColor: getJobTypeStyle(selectedJob.type).color + '20' }]}>
                <Ionicons
                  name={getJobTypeStyle(selectedJob.type).icon as any}
                  size={24}
                  color={getJobTypeStyle(selectedJob.type).color}
                />
              </View>
              <View style={styles.jobDetailInfo}>
                <Text style={styles.jobDetailTitle}>{selectedJob.projectName}</Text>
                <Text style={styles.jobDetailCustomer}>{selectedJob.customerName}</Text>
              </View>
            </View>

            <View style={styles.jobDetailSection}>
              <View style={styles.jobDetailRow}>
                <Ionicons name="time-outline" size={20} color={SemanticColors.textSecondary} />
                <View style={styles.jobDetailRowContent}>
                  <Text style={styles.jobDetailLabel}>Tijd</Text>
                  <Text style={styles.jobDetailValue}>
                    {formatDate(selectedJob.startTime)}, {formatTime(selectedJob.startTime)} - {formatTime(selectedJob.endTime)}
                  </Text>
                </View>
              </View>

              <View style={styles.jobDetailRow}>
                <Ionicons name="location-outline" size={20} color={SemanticColors.textSecondary} />
                <View style={styles.jobDetailRowContent}>
                  <Text style={styles.jobDetailLabel}>Locatie</Text>
                  <Text style={styles.jobDetailValue}>{selectedJob.address}</Text>
                </View>
              </View>

              <View style={styles.jobDetailRow}>
                <Ionicons name="flag-outline" size={20} color={SemanticColors.textSecondary} />
                <View style={styles.jobDetailRowContent}>
                  <Text style={styles.jobDetailLabel}>Prioriteit</Text>
                  <Text style={[styles.jobDetailValue, { color: getPriorityStyle(selectedJob.priority).color }]}>
                    {getPriorityStyle(selectedJob.priority).label}
                  </Text>
                </View>
              </View>

              {selectedJob.weatherSensitive && (
                <View style={styles.jobDetailRow}>
                  <Ionicons name="cloud-outline" size={20} color={SemanticColors.textSecondary} />
                  <View style={styles.jobDetailRowContent}>
                    <Text style={styles.jobDetailLabel}>Buitenwerk</Text>
                    <Text style={styles.jobDetailValue}>Weersafhankelijk</Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.jobActions}>
              <Pressable style={styles.startJobButton}>
                <Ionicons name="play-circle-outline" size={20} color="#fff" />
                <Text style={styles.startJobText}>Start werkzaamheden</Text>
              </Pressable>

              <View style={styles.jobActionRow}>
                <Pressable style={styles.rescheduleButton}>
                  <Ionicons name="calendar-outline" size={18} color={Palette.blue500} />
                  <Text style={styles.rescheduleText}>Verplaatsen</Text>
                </Pressable>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => {
                    cancelJob(selectedJob.id);
                    setShowJobModal(false);
                  }}
                >
                  <Ionicons name="close-circle-outline" size={18} color={Palette.red500} />
                  <Text style={styles.cancelText}>{t('common.cancel', 'Cancel')}</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* View Selector */}
      <View style={styles.viewSelector}>
        {(['day', 'week', 'list'] as ViewType[]).map((view) => (
          <Pressable
            key={view}
            style={[styles.viewButton, viewType === view && styles.viewButtonActive]}
            onPress={() => setViewType(view)}
          >
            <Ionicons
              name={view === 'day' ? 'today-outline' : view === 'week' ? 'calendar-outline' : 'list-outline'}
              size={18}
              color={viewType === view ? Palette.blue500 : SemanticColors.textSecondary}
            />
            <Text style={[styles.viewButtonText, viewType === view && styles.viewButtonTextActive]}>
              {view === 'day' ? 'Dag' : view === 'week' ? 'Week' : 'Lijst'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Alerts */}
      {renderConflictBanner()}
      {renderOptimizationsBanner()}
      {renderWeatherAlert()}

      {/* Content */}
      {viewType === 'week' && renderWeekView()}
      {viewType === 'day' && renderDayView()}
      {viewType === 'list' && renderListView()}

      {/* Add Button */}
      <Pressable style={styles.addButton}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      {/* Modals */}
      {renderOptimizationsModal()}
      {renderJobModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },

  // View Selector
  viewSelector: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    gap: 8,
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    gap: 6,
  },
  viewButtonActive: {
    backgroundColor: Palette.blue500 + '15',
  },
  viewButtonText: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    fontFamily: TYPE.labelFamily,
  },
  viewButtonTextActive: {
    color: Palette.blue500,
  },

  // Banners
  conflictBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.red500 + '15',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  conflictText: {
    flex: 1,
    fontSize: TYPE.captionSize,
    color: Palette.red500,
    fontFamily: TYPE.labelFamily,
  },
  optimizationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.green500 + '15',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  optimizationText: {
    flex: 1,
    fontSize: TYPE.captionSize,
    color: Palette.green500,
    fontFamily: TYPE.labelFamily,
  },
  weatherAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.orange500 + '15',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  weatherAlertText: {
    fontSize: TYPE.labelSize,
    color: Palette.orange500,
  },

  // Week View
  weekView: {
    flex: 1,
    padding: 8,
  },
  dayColumn: {
    width: 120,
    marginHorizontal: 4,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  dayColumnSelected: {
    borderColor: Palette.blue500,
  },
  dayHeader: {
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  dayHeaderToday: {
    backgroundColor: Palette.blue500,
  },
  dayOfWeek: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
  },
  dayNumber: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  dayTextToday: {
    color: Palette.white,
  },
  dayWeather: {
    marginTop: 4,
  },
  dayJobs: {
    flex: 1,
    padding: 6,
    minHeight: 200,
  },
  emptyDay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDayText: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  moreJobs: {
    fontSize: TYPE.tinySize,
    color: Palette.blue500,
    textAlign: 'center',
    marginTop: 4,
  },
  dayUtilization: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
    gap: 6,
  },
  utilizationBar: {
    flex: 1,
    height: 4,
    backgroundColor: SemanticColors.borderDefault,
    borderRadius: 2,
  },
  utilizationFill: {
    height: '100%',
    borderRadius: 2,
  },
  utilizationText: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textSecondary,
    width: 28,
    textAlign: 'right',
  },

  // Job Card
  jobCard: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  jobCardCompact: {
    marginBottom: 4,
  },
  jobTypeIndicator: {
    width: 4,
  },
  jobContent: {
    flex: 1,
    padding: 10,
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  jobTime: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
    fontFamily: TYPE.labelFamily,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  jobTitle: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  jobCustomer: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  jobMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  jobAddress: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
    flex: 1,
  },

  // Day View
  dayView: {
    flex: 1,
  },
  dayViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  dayViewTitle: {
    alignItems: 'center',
  },
  dayViewDate: {
    fontSize: TYPE.titleSize + 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  dayViewWeather: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  dayViewTemp: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
  },
  notSuitableText: {
    fontSize: TYPE.tinySize,
    color: Palette.orange500,
  },
  dayStats: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  dayStat: {
    flex: 1,
    alignItems: 'center',
  },
  dayStatValue: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  dayStatLabel: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  jobsList: {
    padding: 16,
  },
  emptyDayView: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginTop: 12,
  },
  emptyText: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },

  // List View
  listView: {
    flex: 1,
    padding: 16,
  },
  dateGroup: {
    marginBottom: 20,
  },
  dateGroupTitle: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },

  // Add Button
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Palette.blue500,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  modalTitle: {
    fontSize: TYPE.titleSize + 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },

  // Optimization Card
  optimizationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 12,
  },
  optimizationIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    backgroundColor: Palette.green500 + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optimizationContent: {
    flex: 1,
  },
  optimizationTitle: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  optimizationDesc: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  optimizationSaving: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  optimizationSavingText: {
    fontSize: TYPE.captionSize,
    color: Palette.green500,
    fontFamily: TYPE.labelFamily,
  },
  applyButton: {
    backgroundColor: Palette.green500,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  applyButtonText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.white,
  },

  // Job Detail
  jobDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 16,
  },
  jobDetailType: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobDetailInfo: {
    flex: 1,
  },
  jobDetailTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  jobDetailCustomer: {
    fontSize: TYPE.bodySize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  jobDetailSection: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  jobDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    gap: 12,
  },
  jobDetailRowContent: {
    flex: 1,
  },
  jobDetailLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
  },
  jobDetailValue: {
    fontSize: TYPE.bodySize,
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },
  jobActions: {
    gap: 12,
  },
  startJobButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.green500,
    paddingVertical: 16,
    borderRadius: RADIUS.md,
    gap: 8,
  },
  startJobText: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.white,
  },
  jobActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  rescheduleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: Palette.blue500,
    gap: 6,
  },
  rescheduleText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: Palette.blue500,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: Palette.red500,
    gap: 6,
  },
  cancelText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: Palette.red500,
  },
});
