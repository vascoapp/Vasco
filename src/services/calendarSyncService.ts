// =============================================================================
// CALENDAR SYNC SERVICE — Native device calendar integration
// =============================================================================
// Sync Vasco jobs to/from device calendar via expo-calendar.
// Stores calendar event ID mapping in AsyncStorage.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import i18n from '../i18n/i18n';
import type { Job } from '../domain/jobs';

// =============================================================================
// TYPES
// =============================================================================

export interface CalendarSyncSettings {
  enabled: boolean;
  calendarId: string | null;
  calendarTitle: string | null;
  lastSyncAt: string | null;
}

export interface CalendarEventMapping {
  jobId: string;
  calendarEventId: string;
  lastSyncedAt: string;
}

export interface ImportedCalendarEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  location?: string;
  notes?: string;
  isAllDay: boolean;
}

export interface DeviceCalendar {
  id: string;
  title: string;
  color: string;
  isPrimary: boolean;
  allowsModifications: boolean;
  source: string;
}

// =============================================================================
// STORAGE KEYS
// =============================================================================

const SETTINGS_KEY = '@vasco_calendar_sync_settings';
const MAPPINGS_KEY = '@vasco_calendar_event_mappings';

// =============================================================================
// SETTINGS PERSISTENCE
// =============================================================================

export async function getCalendarSyncSettings(): Promise<CalendarSyncSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { enabled: false, calendarId: null, calendarTitle: null, lastSyncAt: null };
}

export async function saveCalendarSyncSettings(settings: CalendarSyncSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => {});
}

// =============================================================================
// EVENT MAPPING PERSISTENCE
// =============================================================================

async function getMappings(): Promise<CalendarEventMapping[]> {
  try {
    const raw = await AsyncStorage.getItem(MAPPINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

async function saveMappings(mappings: CalendarEventMapping[]): Promise<void> {
  await AsyncStorage.setItem(MAPPINGS_KEY, JSON.stringify(mappings)).catch(() => {});
}

async function getEventIdForJob(jobId: string): Promise<string | null> {
  const mappings = await getMappings();
  return mappings.find(m => m.jobId === jobId)?.calendarEventId ?? null;
}

async function setEventIdForJob(jobId: string, calendarEventId: string): Promise<void> {
  const mappings = await getMappings();
  const idx = mappings.findIndex(m => m.jobId === jobId);
  const entry: CalendarEventMapping = { jobId, calendarEventId, lastSyncedAt: new Date().toISOString() };
  if (idx >= 0) {
    mappings[idx] = entry;
  } else {
    mappings.push(entry);
  }
  await saveMappings(mappings);
}

async function removeEventMapping(jobId: string): Promise<void> {
  const mappings = await getMappings();
  await saveMappings(mappings.filter(m => m.jobId !== jobId));
}

// =============================================================================
// CALENDAR PERMISSIONS
// =============================================================================

async function requestCalendarPermissions(): Promise<boolean> {
  try {
    const Calendar = await import('expo-calendar');
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
  } catch {
    // expo-calendar not available (web, or not installed)
    return false;
  }
}

// =============================================================================
// GET AVAILABLE CALENDARS
// =============================================================================

export async function getDeviceCalendars(): Promise<DeviceCalendar[]> {
  const hasPermission = await requestCalendarPermissions();
  if (!hasPermission) return [];

  try {
    const Calendar = await import('expo-calendar');
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    return calendars
      .filter((c: any) => c.allowsModifications !== false)
      .map((c: any) => ({
        id: c.id,
        title: c.title || 'Unnamed',
        color: c.color || '#E35205',
        isPrimary: c.isPrimary ?? false,
        allowsModifications: c.allowsModifications ?? true,
        source: c.source?.name || '',
      }));
  } catch {
    return [];
  }
}

// =============================================================================
// SYNC JOB TO CALENDAR
// =============================================================================

export async function syncJobToCalendar(job: Job): Promise<boolean> {
  const settings = await getCalendarSyncSettings();
  if (!settings.enabled || !settings.calendarId) return false;

  const hasPermission = await requestCalendarPermissions();
  if (!hasPermission) return false;

  if (!job.scheduledDate) return false;

  try {
    const Calendar = await import('expo-calendar');

    const startTime = job.scheduledStartTime || '09:00';
    const endTime = job.scheduledEndTime || (() => {
      const duration = job.estimatedDuration || 120;
      const [h, m] = startTime.split(':').map(Number);
      const endMin = h * 60 + m + duration;
      return `${Math.floor(endMin / 60).toString().padStart(2, '0')}:${(endMin % 60).toString().padStart(2, '0')}`;
    })();

    const startDate = new Date(`${job.scheduledDate}T${startTime}:00`);
    const endDate = new Date(`${job.scheduledDate}T${endTime}:00`);

    const location = job.address
      ? `${job.address.street}, ${job.address.postcode} ${job.address.city}`
      : undefined;

    const notes = [
      job.description || '',
      job.trade ? `Trade: ${job.trade}` : '',
      job.quotedAmount ? `Quote: \u20AC${job.quotedAmount.toLocaleString()}` : '',
    ].filter(Boolean).join('\n');

    const eventDetails: any = {
      title: `Vasco: ${job.title}`,
      startDate,
      endDate,
      location,
      notes,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    // Check if we already have a mapping for this job
    const existingEventId = await getEventIdForJob(job.id);

    if (existingEventId) {
      // Update existing event
      try {
        await Calendar.updateEventAsync(existingEventId, eventDetails);
        await setEventIdForJob(job.id, existingEventId);
        return true;
      } catch {
        // Event may have been deleted by user — create new one
      }
    }

    // Create new event
    const eventId = await Calendar.createEventAsync(settings.calendarId, eventDetails);
    await setEventIdForJob(job.id, eventId);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// REMOVE JOB FROM CALENDAR
// =============================================================================

export async function removeJobFromCalendar(jobId: string): Promise<boolean> {
  const existingEventId = await getEventIdForJob(jobId);
  if (!existingEventId) return false;

  try {
    const Calendar = await import('expo-calendar');
    await Calendar.deleteEventAsync(existingEventId);
    await removeEventMapping(jobId);
    return true;
  } catch {
    // Event may already be deleted
    await removeEventMapping(jobId);
    return false;
  }
}

// =============================================================================
// IMPORT CALENDAR EVENTS
// =============================================================================

export async function importCalendarEvents(
  startDate: Date,
  endDate: Date,
): Promise<ImportedCalendarEvent[]> {
  const hasPermission = await requestCalendarPermissions();
  if (!hasPermission) return [];

  try {
    const Calendar = await import('expo-calendar');
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const calendarIds = calendars.map((c: any) => c.id);

    if (calendarIds.length === 0) return [];

    const events = await Calendar.getEventsAsync(calendarIds, startDate, endDate);
    return events.map((e: any) => ({
      id: e.id,
      title: e.title || '',
      startDate: new Date(e.startDate).toISOString(),
      endDate: new Date(e.endDate).toISOString(),
      location: e.location || undefined,
      notes: e.notes || undefined,
      isAllDay: e.allDay ?? false,
    }));
  } catch {
    return [];
  }
}

// =============================================================================
// SYNC ALL JOBS — Batch sync for "Sync now" button
// =============================================================================

export async function syncAllJobsToCalendar(jobs: Job[]): Promise<{ synced: number; failed: number }> {
  const settings = await getCalendarSyncSettings();
  if (!settings.enabled || !settings.calendarId) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  const scheduledJobs = jobs.filter(j =>
    j.scheduledDate && ['scheduled', 'in-progress', 'accepted'].includes(j.status)
  );

  for (const job of scheduledJobs) {
    const ok = await syncJobToCalendar(job);
    if (ok) synced++;
    else failed++;
  }

  // Update last sync timestamp
  await saveCalendarSyncSettings({
    ...settings,
    lastSyncAt: new Date().toISOString(),
  });

  return { synced, failed };
}

// =============================================================================
// RECURRING JOB CALENDAR SUPPORT
// =============================================================================

export async function syncRecurringJobToCalendar(
  job: Job,
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly',
): Promise<boolean> {
  const settings = await getCalendarSyncSettings();
  if (!settings.enabled || !settings.calendarId) return false;

  const hasPermission = await requestCalendarPermissions();
  if (!hasPermission) return false;

  if (!job.scheduledDate) return false;

  try {
    const Calendar = await import('expo-calendar');

    const startTime = job.scheduledStartTime || '09:00';
    const endTime = job.scheduledEndTime || '17:00';
    const startDate = new Date(`${job.scheduledDate}T${startTime}:00`);
    const endDate = new Date(`${job.scheduledDate}T${endTime}:00`);

    const recurrenceRule: any = {};
    switch (frequency) {
      case 'weekly':
        recurrenceRule.frequency = Calendar.Frequency.WEEKLY;
        recurrenceRule.interval = 1;
        break;
      case 'biweekly':
        recurrenceRule.frequency = Calendar.Frequency.WEEKLY;
        recurrenceRule.interval = 2;
        break;
      case 'monthly':
        recurrenceRule.frequency = Calendar.Frequency.MONTHLY;
        recurrenceRule.interval = 1;
        break;
      case 'quarterly':
        recurrenceRule.frequency = Calendar.Frequency.MONTHLY;
        recurrenceRule.interval = 3;
        break;
      case 'yearly':
        recurrenceRule.frequency = Calendar.Frequency.YEARLY;
        recurrenceRule.interval = 1;
        break;
    }

    const location = job.address
      ? `${job.address.street}, ${job.address.postcode} ${job.address.city}`
      : undefined;

    const eventId = await Calendar.createEventAsync(settings.calendarId, {
      title: `Vasco: ${job.title}`,
      startDate,
      endDate,
      location,
      notes: `Recurring: ${frequency}`,
      recurrenceRule,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    await setEventIdForJob(job.id, eventId);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// REACT HOOK
// =============================================================================

export function useCalendarSync() {
  const [settings, setSettings] = useState<CalendarSyncSettings>({
    enabled: false, calendarId: null, calendarTitle: null, lastSyncAt: null,
  });
  const [calendars, setCalendars] = useState<DeviceCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    Promise.all([
      getCalendarSyncSettings(),
      getDeviceCalendars(),
    ]).then(([s, c]) => {
      setSettings(s);
      setCalendars(c);
    }).finally(() => setLoading(false));
  }, []);

  const updateSettings = useCallback(async (updates: Partial<CalendarSyncSettings>) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    await saveCalendarSyncSettings(next);
  }, [settings]);

  const syncAll = useCallback(async (jobs: Job[]) => {
    setSyncing(true);
    try {
      const result = await syncAllJobsToCalendar(jobs);
      const updated = await getCalendarSyncSettings();
      setSettings(updated);
      return result;
    } finally {
      setSyncing(false);
    }
  }, []);

  return { settings, calendars, loading, syncing, updateSettings, syncAll };
}
