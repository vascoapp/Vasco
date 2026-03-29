// Time Tracker - Clock in/out with live timer
import { useState, useEffect, useCallback } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../i18n/formatting';
import type { Job, TimeEntry } from '../../types/contractor';
import { MOCK_JOBS } from '../../data/mockContractor';
import { intelligence } from '../../intelligence/intelligenceEngine';

// Helper to create context for intelligence tracking
const createTrackingContext = () => ({
  platform: 'ios' as const,
  appVersion: '1.0.0',
  dayOfWeek: new Date().getDay(),
  hourOfDay: new Date().getHours(),
  isWeekend: new Date().getDay() === 0 || new Date().getDay() === 6,
  season: 'winter' as const,
});

interface TimeTrackerProps {
  activeEntry?: TimeEntry;
  onClockIn: (jobId?: string, notes?: string) => void;
  onClockOut: (entryId: string, breakMinutes?: number) => void;
  onClose: () => void;
}

export function TimeTracker({
  activeEntry,
  onClockIn,
  onClockOut,
  onClose,
}: TimeTrackerProps) {
  const { t } = useTranslation();
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(activeEntry?.jobId);
  const [notes, setNotes] = useState('');
  const [breakMinutes, setBreakMinutes] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Calculate elapsed time for active entry
  useEffect(() => {
    if (activeEntry && activeEntry.status === 'active') {
      const startTime = new Date(`${activeEntry.date}T${activeEntry.startTime}`);
      const updateElapsed = () => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        setElapsedSeconds(elapsed);
      };
      updateElapsed();
      const interval = setInterval(updateElapsed, 1000);
      return () => clearInterval(interval);
    }
  }, [activeEntry]);

  const formatTime = useCallback((totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const formatTimeShort = (date: string, time: string) => {
    return time;
  };

  const handleClockIn = () => {
    if (!selectedJobId) {
      Alert.alert(t('timeTracker.selectJob', 'Select Job'), t('timeTracker.selectJobMessage', 'Please select a job to track time against.'));
      return;
    }

    // Track clock in for intelligence
    const job = MOCK_JOBS.find(j => j.id === selectedJobId);
    intelligence.trackEvent({
      eventType: 'clock_in',
      userId: 'current-user',
      sessionId: 'current',
      context: createTrackingContext(),
      payload: {
        jobId: selectedJobId,
        jobTitle: job?.title,
        notes,
        clockInTime: new Date().toISOString(),
      },
      entities: job ? [
        { id: job.id, type: 'project', name: job.title, confidence: 1.0 },
      ] : [],
    });

    onClockIn(selectedJobId, notes);
  };

  const handleClockOut = () => {
    if (!activeEntry) return;

    const trackClockOut = (breakMins: number) => {
      // Track clock out for intelligence
      const job = activeEntry.jobId ? MOCK_JOBS.find(j => j.id === activeEntry.jobId) : undefined;
      intelligence.trackEvent({
        eventType: 'clock_out',
        userId: 'current-user',
        sessionId: 'current',
        context: createTrackingContext(),
        payload: {
          entryId: activeEntry.id,
          jobId: activeEntry.jobId,
          jobTitle: job?.title,
          clockOutTime: new Date().toISOString(),
          totalSeconds: elapsedSeconds,
          breakMinutes: breakMins,
          workMinutes: Math.floor(elapsedSeconds / 60) - breakMins,
          estimatedEarnings: ((elapsedSeconds / 3600) - (breakMins / 60)) * 55,
        },
        entities: job ? [
          { id: job.id, type: 'project', name: job.title, confidence: 1.0 },
        ] : [],
      });

      onClockOut(activeEntry.id, breakMins);
    };

    Alert.alert(
      t('timeTracker.clockOut', 'Clock Out'),
      t('timeTracker.breakQuestion', 'Did you take any breaks?'),
      [
        {
          text: t('timeTracker.noBreak', 'No Break'),
          onPress: () => trackClockOut(0),
        },
        {
          text: t('timeTracker.fifteenMin', '15 min'),
          onPress: () => trackClockOut(15),
        },
        {
          text: t('timeTracker.thirtyMin', '30 min'),
          onPress: () => trackClockOut(30),
        },
        {
          text: t('timeTracker.oneHour', '1 hour'),
          onPress: () => trackClockOut(60),
        },
      ]
    );
  };

  const activeJobs = MOCK_JOBS.filter(
    (j) => j.status === 'in-progress' || j.status === 'scheduled'
  );

  const activeJob = activeEntry?.jobId
    ? MOCK_JOBS.find((j) => j.id === activeEntry.jobId)
    : undefined;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Time Tracker</Text>
        <View style={{ width: 32 }} />
      </View>

      {activeEntry && activeEntry.status === 'active' ? (
        // Active Timer View
        <View style={styles.activeView}>
          {/* Timer Display */}
          <View style={styles.timerContainer}>
            <View style={styles.timerPulse} />
            <Text style={styles.timerDisplay}>{formatTime(elapsedSeconds)}</Text>
            <Text style={styles.timerLabel}>Time Elapsed</Text>
          </View>

          {/* Active Job Info */}
          {activeJob && (
            <View style={styles.activeJobCard}>
              <View style={styles.activeJobHeader}>
                <Ionicons name="briefcase" size={18} color={SemanticColors.actionPrimary} />
                <Text style={styles.activeJobTitle}>{activeJob.title}</Text>
              </View>
              <Text style={styles.activeJobLocation}>
                {activeJob.address.street}, {activeJob.address.city}
              </Text>
            </View>
          )}

          {/* Session Info */}
          <View style={styles.sessionInfo}>
            <View style={styles.sessionRow}>
              <Ionicons name="time-outline" size={16} color={SemanticColors.textSecondary} />
              <Text style={styles.sessionText}>
                Started at {formatTimeShort(activeEntry.date, activeEntry.startTime)}
              </Text>
            </View>
            {activeEntry.clockInLocation && (
              <View style={styles.sessionRow}>
                <Ionicons name="location-outline" size={16} color={SemanticColors.textSecondary} />
                <Text style={styles.sessionText}>Location recorded</Text>
              </View>
            )}
          </View>

          {/* Break Timer */}
          <View style={styles.breakSection}>
            <Text style={styles.breakLabel}>Add Break Time</Text>
            <View style={styles.breakOptions}>
              {[0, 15, 30, 45, 60].map((mins) => (
                <Pressable
                  key={mins}
                  style={[styles.breakOption, breakMinutes === mins && styles.breakOptionActive]}
                  onPress={() => setBreakMinutes(mins)}
                >
                  <Text
                    style={[
                      styles.breakOptionText,
                      breakMinutes === mins && styles.breakOptionTextActive,
                    ]}
                  >
                    {mins === 0 ? 'None' : `${mins}m`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Clock Out Button */}
          <Pressable style={styles.clockOutButton} onPress={handleClockOut}>
            <Ionicons name="stop-circle" size={28} color={Palette.white} />
            <Text style={styles.clockOutButtonText}>Clock Out</Text>
          </Pressable>

          {/* Estimated Earnings */}
          <View style={styles.earningsCard}>
            <Text style={styles.earningsLabel}>Estimated Earnings</Text>
            <Text style={styles.earningsValue}>
              {formatCurrency(((elapsedSeconds / 3600) - (breakMinutes / 60)) * 55)}
            </Text>
            <Text style={styles.earningsRate}>@ {formatCurrency(55)}/hour</Text>
          </View>
        </View>
      ) : (
        // Clock In View
        <View style={styles.clockInView}>
          {/* Illustration */}
          <View style={styles.illustration}>
            <View style={styles.clockIcon}>
              <Ionicons name="time" size={64} color={SemanticColors.actionPrimary} />
            </View>
            <Text style={styles.illustrationText}>Ready to start working?</Text>
          </View>

          {/* Job Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Job</Text>
            <View style={styles.jobList}>
              {activeJobs.length > 0 ? (
                activeJobs.map((job) => (
                  <Pressable
                    key={job.id}
                    style={[
                      styles.jobOption,
                      selectedJobId === job.id && styles.jobOptionActive,
                    ]}
                    onPress={() => setSelectedJobId(job.id)}
                  >
                    <View style={styles.jobOptionContent}>
                      <Text style={styles.jobOptionTitle}>{job.title}</Text>
                      <Text style={styles.jobOptionLocation}>
                        {job.address.street}
                      </Text>
                    </View>
                    {selectedJobId === job.id && (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color={SemanticColors.actionPrimary}
                      />
                    )}
                  </Pressable>
                ))
              ) : (
                <View style={styles.noJobs}>
                  <Text style={styles.noJobsText}>No active jobs</Text>
                </View>
              )}
            </View>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="What will you be working on?"
              placeholderTextColor={SemanticColors.textTertiary}
              multiline
            />
          </View>

          {/* Clock In Button */}
          <Pressable
            style={[styles.clockInButton, !selectedJobId && styles.clockInButtonDisabled]}
            onPress={handleClockIn}
            disabled={!selectedJobId}
          >
            <Ionicons name="play-circle" size={28} color={Palette.white} />
            <Text style={styles.clockInButtonText}>Clock In</Text>
          </Pressable>

          {/* Info */}
          <View style={styles.infoRow}>
            <Ionicons name="information-circle" size={16} color={SemanticColors.textTertiary} />
            <Text style={styles.infoText}>
              Your location will be recorded when you clock in
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// Compact Time Tracker Widget for Dashboard
export function TimeTrackerWidget({
  activeEntry,
  onPress,
}: {
  activeEntry?: TimeEntry;
  onPress: () => void;
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (activeEntry && activeEntry.status === 'active') {
      const startTime = new Date(`${activeEntry.date}T${activeEntry.startTime}`);
      const updateElapsed = () => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        setElapsedSeconds(elapsed);
      };
      updateElapsed();
      const interval = setInterval(updateElapsed, 1000);
      return () => clearInterval(interval);
    }
  }, [activeEntry]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (activeEntry && activeEntry.status === 'active') {
    return (
      <Pressable style={styles.widgetActive} onPress={onPress}>
        <View style={styles.widgetPulse} />
        <View style={styles.widgetContent}>
          <Text style={styles.widgetLabel}>Currently Working</Text>
          <Text style={styles.widgetTime}>{formatTime(elapsedSeconds)}</Text>
        </View>
        <Ionicons name="stop-circle" size={32} color={SemanticColors.feedbackError} />
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.widgetInactive} onPress={onPress}>
      <Ionicons name="play-circle" size={32} color={SemanticColors.feedbackSuccess} />
      <View style={styles.widgetContent}>
        <Text style={styles.widgetLabelInactive}>Start Tracking</Text>
        <Text style={styles.widgetSubtext}>Clock in to a job</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={SemanticColors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    paddingTop: Spacing.xl,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
  },
  activeView: {
    flex: 1,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  timerContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  timerPulse: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  timerDisplay: {
    color: SemanticColors.textPrimary,
    fontSize: 56,
    fontFamily: TYPE.sectionFamily,
    fontVariant: ['tabular-nums'],
  },
  timerLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.bodySize - 1,
    marginTop: 8,
  },
  activeJobCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 6,
  },
  activeJobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeJobTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
  },
  activeJobLocation: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
    marginLeft: 26,
  },
  sessionInfo: {
    gap: Spacing.xs,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
  },
  breakSection: {
    gap: Spacing.sm,
  },
  breakLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
  },
  breakOptions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  breakOption: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  breakOptionActive: {
    backgroundColor: SemanticColors.actionPrimary + '20',
    borderColor: SemanticColors.actionPrimary,
  },
  breakOptionText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
  },
  breakOptionTextActive: {
    color: SemanticColors.actionPrimary,
  },
  clockOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: SemanticColors.feedbackError,
    paddingVertical: 18,
    borderRadius: RADIUS.md,
  },
  clockOutButtonText: {
    color: Palette.white,
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
  },
  earningsCard: {
    backgroundColor: SemanticColors.actionPrimary + '15',
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  earningsLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
  },
  earningsValue: {
    color: SemanticColors.actionPrimary,
    fontSize: TYPE.displaySize,
    fontFamily: TYPE.sectionFamily,
  },
  earningsRate: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize,
  },
  clockInView: {
    flex: 1,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  illustration: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  clockIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: SemanticColors.actionPrimary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  illustrationText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.titleSize,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
  },
  jobList: {
    gap: Spacing.xs,
  },
  jobOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  jobOptionActive: {
    borderColor: SemanticColors.actionPrimary,
    backgroundColor: SemanticColors.actionPrimary + '10',
  },
  jobOptionContent: {
    flex: 1,
  },
  jobOptionTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
  },
  jobOptionLocation: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
  },
  noJobs: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  noJobsText: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.bodySize - 1,
  },
  notesInput: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize - 1,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  clockInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: SemanticColors.feedbackSuccess,
    paddingVertical: 18,
    borderRadius: RADIUS.md,
  },
  clockInButtonDisabled: {
    backgroundColor: SemanticColors.textDisabled,
  },
  clockInButtonText: {
    color: Palette.white,
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  infoText: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.labelSize,
  },
  // Widget styles
  widgetActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.feedbackSuccessBg,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackSuccessBorder,
    gap: Spacing.sm,
  },
  widgetPulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: SemanticColors.feedbackSuccess,
  },
  widgetContent: {
    flex: 1,
  },
  widgetLabel: {
    color: SemanticColors.feedbackSuccess,
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
  },
  widgetTime: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    fontVariant: ['tabular-nums'],
  },
  widgetInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  widgetLabelInactive: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
  },
  widgetSubtext: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
  },
});
