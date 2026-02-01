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
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
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

type ViewType = 'day' | 'week' | 'list';

export function SmartScheduler() {
  const [viewType, setViewType] = useState<ViewType>('week');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showJobModal, setShowJobModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<ScheduledJob | null>(null);
  const [showOptimizations, setShowOptimizations] = useState(false);

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
      case 'job': return { color: Palette.blue, icon: 'construct-outline', label: 'Werk' };
      case 'quote_visit': return { color: Palette.purple, icon: 'document-text-outline', label: 'Offerte' };
      case 'follow_up': return { color: Palette.orange, icon: 'chatbubble-outline', label: 'Follow-up' };
      case 'personal': return { color: Palette.gray, icon: 'person-outline', label: 'Persoonlijk' };
      default: return { color: Palette.gray, icon: 'calendar-outline', label: type };
    }
  };

  const getPriorityStyle = (priority: ScheduledJob['priority']) => {
    switch (priority) {
      case 'urgent': return { color: Palette.red, label: 'Urgent' };
      case 'high': return { color: Palette.orange, label: 'Hoog' };
      case 'medium': return { color: Palette.blue, label: 'Middel' };
      case 'low': return { color: Palette.gray, label: 'Laag' };
    }
  };

  const getWeatherIcon = (condition: string) => {
    switch (condition) {
      case 'sunny': return { icon: 'sunny-outline', color: Palette.orange };
      case 'cloudy': return { icon: 'cloudy-outline', color: Palette.gray };
      case 'rainy': return { icon: 'rainy-outline', color: Palette.blue };
      case 'stormy': return { icon: 'thunderstorm-outline', color: Palette.purple };
      case 'snow': return { icon: 'snow-outline', color: Palette.blue };
      default: return { icon: 'partly-sunny-outline', color: Palette.gray };
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const openJob = (job: ScheduledJob) => {
    setSelectedJob(job);
    setShowJobModal(true);
  };

  const renderConflictBanner = () => {
    if (conflicts.length === 0) return null;

    return (
      <TouchableOpacity style={styles.conflictBanner}>
        <Ionicons name="warning-outline" size={20} color={Palette.red} />
        <Text style={styles.conflictText}>
          {conflicts.length} planning{conflicts.length > 1 ? 'conflicten' : 'conflict'} gedetecteerd
        </Text>
        <Ionicons name="chevron-forward" size={18} color={Palette.red} />
      </TouchableOpacity>
    );
  };

  const renderOptimizationsBanner = () => {
    if (optimizations.length === 0) return null;

    return (
      <TouchableOpacity
        style={styles.optimizationBanner}
        onPress={() => setShowOptimizations(true)}
      >
        <Ionicons name="bulb-outline" size={20} color={Palette.emerald} />
        <Text style={styles.optimizationText}>
          {optimizations.length} optimalisatie{optimizations.length > 1 ? 'suggesties' : 'suggestie'}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={Palette.emerald} />
      </TouchableOpacity>
    );
  };

  const renderWeatherAlert = () => {
    if (weatherAlerts.length === 0) return null;

    return (
      <View style={styles.weatherAlert}>
        <Ionicons name="rainy-outline" size={18} color={Palette.orange} />
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
      <TouchableOpacity
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
              <Ionicons name="rainy-outline" size={14} color={Palette.orange} />
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
      </TouchableOpacity>
    );
  };

  const renderDayColumn = (dateStr: string, schedule: DaySchedule) => {
    const isToday = dateStr === new Date().toISOString().split('T')[0];
    const isSelected = dateStr === selectedDate;
    const weatherStyle = getWeatherIcon(schedule.weatherOverview.condition);
    const dayOfWeek = new Date(dateStr).toLocaleDateString('nl-NL', { weekday: 'short' });
    const dayNum = new Date(dateStr).getDate();

    return (
      <View key={dateStr} style={[styles.dayColumn, isSelected && styles.dayColumnSelected]}>
        <TouchableOpacity
          style={[styles.dayHeader, isToday && styles.dayHeaderToday]}
          onPress={() => setSelectedDate(dateStr)}
        >
          <Text style={[styles.dayOfWeek, isToday && styles.dayTextToday]}>{dayOfWeek}</Text>
          <Text style={[styles.dayNumber, isToday && styles.dayTextToday]}>{dayNum}</Text>
          <View style={styles.dayWeather}>
            <Ionicons name={weatherStyle.icon as any} size={14} color={weatherStyle.color} />
          </View>
        </TouchableOpacity>

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
                  backgroundColor: schedule.utilization > 90 ? Palette.red : schedule.utilization > 70 ? Palette.orange : Palette.emerald,
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
        <TouchableOpacity onPress={() => {
          const prev = new Date(selectedDate);
          prev.setDate(prev.getDate() - 1);
          setSelectedDate(prev.toISOString().split('T')[0]);
        }}>
          <Ionicons name="chevron-back" size={24} color={SemanticColors.text} />
        </TouchableOpacity>
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
        <TouchableOpacity onPress={() => {
          const next = new Date(selectedDate);
          next.setDate(next.getDate() + 1);
          setSelectedDate(next.toISOString().split('T')[0]);
        }}>
          <Ionicons name="chevron-forward" size={24} color={SemanticColors.text} />
        </TouchableOpacity>
      </View>

      {/* Day Stats */}
      <View style={styles.dayStats}>
        <View style={styles.dayStat}>
          <Text style={styles.dayStatValue}>{daySchedule.jobs.length}</Text>
          <Text style={styles.dayStatLabel}>Afspraken</Text>
        </View>
        <View style={styles.dayStat}>
          <Text style={styles.dayStatValue}>{Math.round(daySchedule.totalWorkTime / 60)}u</Text>
          <Text style={styles.dayStatLabel}>Werktijd</Text>
        </View>
        <View style={styles.dayStat}>
          <Text style={styles.dayStatValue}>{daySchedule.totalTravelTime}m</Text>
          <Text style={styles.dayStatLabel}>Reistijd</Text>
        </View>
        <View style={styles.dayStat}>
          <Text style={[styles.dayStatValue, { color: daySchedule.utilization > 90 ? Palette.red : daySchedule.utilization > 70 ? Palette.orange : Palette.emerald }]}>
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
            <Text style={styles.emptyTitle}>Geen afspraken</Text>
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
          <TouchableOpacity onPress={() => setShowOptimizations(false)}>
            <Ionicons name="close" size={24} color={SemanticColors.text} />
          </TouchableOpacity>
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
                  color={Palette.emerald}
                />
              </View>
              <View style={styles.optimizationContent}>
                <Text style={styles.optimizationTitle}>{opt.title}</Text>
                <Text style={styles.optimizationDesc}>{opt.description}</Text>
                <View style={styles.optimizationSaving}>
                  <Ionicons name="time-outline" size={14} color={Palette.emerald} />
                  <Text style={styles.optimizationSavingText}>{opt.potentialSaving}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.applyButton}>
                <Text style={styles.applyButtonText}>Toepassen</Text>
              </TouchableOpacity>
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
          <TouchableOpacity onPress={() => setShowJobModal(false)}>
            <Ionicons name="close" size={24} color={SemanticColors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Afspraak details</Text>
          <TouchableOpacity>
            <Ionicons name="create-outline" size={24} color={Palette.blue} />
          </TouchableOpacity>
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
              <TouchableOpacity style={styles.startJobButton}>
                <Ionicons name="play-circle-outline" size={20} color="#fff" />
                <Text style={styles.startJobText}>Start werkzaamheden</Text>
              </TouchableOpacity>

              <View style={styles.jobActionRow}>
                <TouchableOpacity style={styles.rescheduleButton}>
                  <Ionicons name="calendar-outline" size={18} color={Palette.blue} />
                  <Text style={styles.rescheduleText}>Verplaatsen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    cancelJob(selectedJob.id);
                    setShowJobModal(false);
                  }}
                >
                  <Ionicons name="close-circle-outline" size={18} color={Palette.red} />
                  <Text style={styles.cancelText}>Annuleren</Text>
                </TouchableOpacity>
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
          <TouchableOpacity
            key={view}
            style={[styles.viewButton, viewType === view && styles.viewButtonActive]}
            onPress={() => setViewType(view)}
          >
            <Ionicons
              name={view === 'day' ? 'today-outline' : view === 'week' ? 'calendar-outline' : 'list-outline'}
              size={18}
              color={viewType === view ? Palette.blue : SemanticColors.textSecondary}
            />
            <Text style={[styles.viewButtonText, viewType === view && styles.viewButtonTextActive]}>
              {view === 'day' ? 'Dag' : view === 'week' ? 'Week' : 'Lijst'}
            </Text>
          </TouchableOpacity>
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
      <TouchableOpacity style={styles.addButton}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modals */}
      {renderOptimizationsModal()}
      {renderJobModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.background,
  },

  // View Selector
  viewSelector: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.card,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.border,
    gap: 8,
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  viewButtonActive: {
    backgroundColor: Palette.blue + '15',
  },
  viewButtonText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    fontWeight: '500',
  },
  viewButtonTextActive: {
    color: Palette.blue,
  },

  // Banners
  conflictBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.red + '15',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  conflictText: {
    flex: 1,
    fontSize: 13,
    color: Palette.red,
    fontWeight: '500',
  },
  optimizationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.emerald + '15',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  optimizationText: {
    flex: 1,
    fontSize: 13,
    color: Palette.emerald,
    fontWeight: '500',
  },
  weatherAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.orange + '15',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  weatherAlertText: {
    fontSize: 12,
    color: Palette.orange,
  },

  // Week View
  weekView: {
    flex: 1,
    padding: 8,
  },
  dayColumn: {
    width: 120,
    marginHorizontal: 4,
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  dayColumnSelected: {
    borderColor: Palette.blue,
  },
  dayHeader: {
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.border,
  },
  dayHeaderToday: {
    backgroundColor: Palette.blue,
  },
  dayOfWeek: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
  },
  dayNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  dayTextToday: {
    color: '#fff',
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
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  moreJobs: {
    fontSize: 11,
    color: Palette.blue,
    textAlign: 'center',
    marginTop: 4,
  },
  dayUtilization: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.border,
    gap: 6,
  },
  utilizationBar: {
    flex: 1,
    height: 4,
    backgroundColor: SemanticColors.border,
    borderRadius: 2,
  },
  utilizationFill: {
    height: '100%',
    borderRadius: 2,
  },
  utilizationText: {
    fontSize: 10,
    color: SemanticColors.textSecondary,
    width: 28,
    textAlign: 'right',
  },

  // Job Card
  jobCard: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.card,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: SemanticColors.border,
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
    fontSize: 11,
    color: SemanticColors.textSecondary,
    fontWeight: '500',
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  jobTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  jobCustomer: {
    fontSize: 13,
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
    fontSize: 11,
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
    backgroundColor: SemanticColors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.border,
  },
  dayViewTitle: {
    alignItems: 'center',
  },
  dayViewDate: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  dayViewWeather: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  dayViewTemp: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  notSuitableText: {
    fontSize: 11,
    color: Palette.orange,
  },
  dayStats: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.card,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.border,
  },
  dayStat: {
    flex: 1,
    alignItems: 'center',
  },
  dayStatValue: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  dayStatLabel: {
    fontSize: 11,
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
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.text,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
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
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: Palette.blue,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: SemanticColors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.border,
    backgroundColor: SemanticColors.card,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },

  // Optimization Card
  optimizationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: SemanticColors.border,
    gap: 12,
  },
  optimizationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Palette.emerald + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optimizationContent: {
    flex: 1,
  },
  optimizationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  optimizationDesc: {
    fontSize: 13,
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
    fontSize: 13,
    color: Palette.emerald,
    fontWeight: '500',
  },
  applyButton: {
    backgroundColor: Palette.emerald,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  applyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
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
    fontSize: 20,
    fontWeight: '600',
    color: SemanticColors.text,
  },
  jobDetailCustomer: {
    fontSize: 15,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  jobDetailSection: {
    backgroundColor: SemanticColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.border,
  },
  jobDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.border,
    gap: 12,
  },
  jobDetailRowContent: {
    flex: 1,
  },
  jobDetailLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  jobDetailValue: {
    fontSize: 15,
    color: SemanticColors.text,
    marginTop: 2,
  },
  jobActions: {
    gap: 12,
  },
  startJobButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.emerald,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  startJobText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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
    backgroundColor: SemanticColors.card,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.blue,
    gap: 6,
  },
  rescheduleText: {
    fontSize: 15,
    fontWeight: '600',
    color: Palette.blue,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.card,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.red,
    gap: 6,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: Palette.red,
  },
});
