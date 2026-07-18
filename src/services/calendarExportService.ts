// =============================================================================
// CALENDAR EXPORT SERVICE
// =============================================================================
// Generate iCal (.ics) events from scheduled jobs, share via native share sheet
// =============================================================================

import { formatMoney } from '../i18n/formatting';
import { Share } from 'react-native';
import i18n from '../i18n/i18n';
import type { Job } from '../domain/jobs';

// =============================================================================
// ICS GENERATION
// =============================================================================

function formatIcsDate(dateStr: string, time?: string): string {
  const d = new Date(dateStr);
  if (time) {
    const [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  }
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function escapeIcs(text: string): string {
  return text.replace(/[\\;,\n]/g, (match) => {
    if (match === '\n') return '\\n';
    return `\\${match}`;
  });
}

export function generateIcsEvent(job: Job): string {
  const now = new Date();
  const uid = `vasco-${job.id}@vascoapp.nl`;
  const stamp = formatIcsDate(now.toISOString());

  const startDate = job.scheduledDate ?? job.createdAt;
  const startTime = job.scheduledStartTime ?? '09:00';
  const endTime = job.scheduledEndTime ?? (() => {
    const duration = job.estimatedDuration ?? 120;
    const [h, m] = startTime.split(':').map(Number);
    const endMin = h * 60 + m + duration;
    return `${Math.floor(endMin / 60).toString().padStart(2, '0')}:${(endMin % 60).toString().padStart(2, '0')}`;
  })();

  const dtStart = formatIcsDate(startDate, startTime);
  const dtEnd = formatIcsDate(startDate, endTime);

  const location = job.address
    ? `${job.address.street}, ${job.address.postcode} ${job.address.city}`
    : '';

  const description = [
    job.description ?? '',
    job.trade ? `Vakgebied: ${job.trade}` : '',
    job.quotedAmount ? `Offerte: ${formatMoney(job.quotedAmount)}` : '',
    job.agreedAmount ? `Afgesproken: ${formatMoney(job.agreedAmount)}` : '',
  ].filter(Boolean).join('\\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vasco//VascoApp//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcs(job.title)}`,
    location ? `LOCATION:${escapeIcs(location)}` : '',
    description ? `DESCRIPTION:${escapeIcs(description)}` : '',
    `STATUS:CONFIRMED`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

export function generateIcsCalendar(jobs: Job[]): string {
  const now = new Date();
  const stamp = formatIcsDate(now.toISOString());

  const events = jobs.map(job => {
    const startDate = job.scheduledDate ?? job.createdAt;
    const startTime = job.scheduledStartTime ?? '09:00';
    const endTime = job.scheduledEndTime ?? (() => {
      const duration = job.estimatedDuration ?? 120;
      const [h, m] = startTime.split(':').map(Number);
      const endMin = h * 60 + m + duration;
      return `${Math.floor(endMin / 60).toString().padStart(2, '0')}:${(endMin % 60).toString().padStart(2, '0')}`;
    })();

    const location = job.address
      ? `${job.address.street}, ${job.address.postcode} ${job.address.city}`
      : '';

    return [
      'BEGIN:VEVENT',
      `UID:vasco-${job.id}@vascoapp.nl`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatIcsDate(startDate, startTime)}`,
      `DTEND:${formatIcsDate(startDate, endTime)}`,
      `SUMMARY:${escapeIcs(job.title)}`,
      location ? `LOCATION:${escapeIcs(location)}` : '',
      'STATUS:CONFIRMED',
      'END:VEVENT',
    ].filter(Boolean).join('\r\n');
  }).join('\r\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vasco//VascoApp//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    events,
    'END:VCALENDAR',
  ].join('\r\n');
}

// =============================================================================
// SHARE FUNCTIONS
// =============================================================================

export async function shareJobAsCalendarEvent(job: Job): Promise<void> {
  const ics = generateIcsEvent(job);
  await Share.share({
    message: ics,
    title: `Klus: ${job.title}`,
  });
}

export async function shareAllScheduledJobs(jobs: Job[]): Promise<void> {
  const scheduled = jobs.filter(j => ['scheduled', 'in-progress'].includes(j.status));
  if (scheduled.length === 0) {
    const { Alert } = require('react-native');
    Alert.alert(i18n.t('calendar.noScheduledJobs', 'No scheduled jobs'), i18n.t('calendar.scheduleFirst', 'Schedule some jobs first to export your calendar.'));
    return;
  }

  const ics = generateIcsCalendar(scheduled);
  try {
    await Share.share({
      message: ics,
      title: 'Vasco Planning Export',
    });
  } catch {
    // Web fallback: copy to clipboard
    const { Platform, Alert } = require('react-native');
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(ics);
        Alert.alert(i18n.t('calendar.copied', 'Copied'), i18n.t('calendar.copiedMessage', 'Calendar data copied to clipboard. Paste into a .ics file to import.'));
      } catch {
        Alert.alert(i18n.t('calendar.export', 'Export'), ics.substring(0, 500) + '...');
      }
    }
  }
}
