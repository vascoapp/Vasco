// =============================================================================
// CALENDAR SYNC — Google Calendar + universal .ics export (R245)
// =============================================================================
// Two paths:
//
// 1. ICS EXPORT (always available, no auth) — generate a .ics file for any
//    job and let the contractor share it / save to their default calendar.
//    Apple Calendar, Outlook, and any other compliant client open .ics natively.
//
// 2. GOOGLE CALENDAR OAUTH (when configured) — push job events directly into
//    the contractor's Google Calendar via Calendar API v3. Requires
//    GOOGLE_CALENDAR_CLIENT_ID + a valid OAuth flow (Expo AuthSession handles
//    this; this file is the post-token write path).
//
// Apple/Outlook beyond .ics export need EventKit / Microsoft Graph respectively
// — both can layer on later without changing this surface.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@vasco_google_calendar_config';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export interface CalendarConfig {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  calendarId: string;          // 'primary' or specific id
  email: string;
  connectedAt: string;
}

export interface JobCalendarEvent {
  id: string;
  title: string;
  description?: string;
  startsAt: string;            // ISO8601
  endsAt: string;
  location?: string;
  customerEmail?: string;
}

// ---------------------------------------------------------------------------
// 1. .ICS EXPORT — universal, no auth
// ---------------------------------------------------------------------------

/** Generate an RFC 5545 .ics blob for a single job event. */
export function generateIcs(event: JobCalendarEvent): string {
  const dtstart = toIcsDate(event.startsAt);
  const dtend = toIcsDate(event.endsAt);
  const uid = `${event.id}@vascobuild.com`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vasco//Job Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    event.description ? `DESCRIPTION:${escapeIcs(event.description)}` : '',
    event.location ? `LOCATION:${escapeIcs(event.location)}` : '',
    event.customerEmail ? `ATTENDEE;CN=${event.customerEmail}:mailto:${event.customerEmail}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.filter(Boolean).join('\r\n');
}

function toIcsDate(iso: string): string {
  // 2026-04-26T14:30:00.000Z → 20260426T143000Z
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// ---------------------------------------------------------------------------
// 2. GOOGLE CALENDAR — OAuth-protected
// ---------------------------------------------------------------------------

async function getConfig(): Promise<CalendarConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveCalendarConfig(config: CalendarConfig): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function clearCalendarConfig(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function isCalendarConnected(): Promise<boolean> {
  const config = await getConfig();
  return !!config?.accessToken;
}

/**
 * Push a job event to Google Calendar. Returns the Google event ID for
 * later updates/deletions. Returns null on any failure (caller can fall
 * back to .ics share).
 */
export async function pushJobToGoogleCalendar(event: JobCalendarEvent): Promise<string | null> {
  const config = await getConfig();
  if (!config) return null;
  if (Date.now() > config.expiresAt - 30_000) {
    // Token expiring; caller should refresh via OAuth before this fires.
    // Best-effort attempt with the stale token; Google may still accept.
  }

  try {
    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(config.calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: event.title,
          description: event.description,
          location: event.location,
          start: { dateTime: event.startsAt },
          end: { dateTime: event.endsAt },
          attendees: event.customerEmail ? [{ email: event.customerEmail }] : undefined,
          extendedProperties: { private: { vasco_job_id: event.id } },
        }),
      },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.id ?? null;
  } catch {
    return null;
  }
}

export async function deleteFromGoogleCalendar(googleEventId: string): Promise<boolean> {
  const config = await getConfig();
  if (!config) return false;
  try {
    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(config.calendarId)}/events/${googleEventId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${config.accessToken}` },
      },
    );
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

/**
 * Pull busy slots from Google Calendar's freeBusy API for a given range.
 * Used to surface conflict warnings before scheduling a job.
 */
export async function getBusySlots(rangeStart: string, rangeEnd: string): Promise<Array<{ start: string; end: string }>> {
  const config = await getConfig();
  if (!config) return [];
  try {
    const res = await fetch(`${GOOGLE_CALENDAR_API}/freeBusy`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: rangeStart,
        timeMax: rangeEnd,
        items: [{ id: config.calendarId }],
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.calendars?.[config.calendarId]?.busy ?? []).map((b: any) => ({
      start: String(b.start),
      end: String(b.end),
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// 3. UNIFIED — push if Google connected, fall back to .ics for share
// ---------------------------------------------------------------------------

export async function syncJobToCalendar(event: JobCalendarEvent): Promise<{
  pushed: boolean;
  googleEventId?: string;
  icsContent: string;
}> {
  const ics = generateIcs(event);
  const connected = await isCalendarConnected();
  if (!connected) return { pushed: false, icsContent: ics };
  const googleEventId = await pushJobToGoogleCalendar(event);
  return {
    pushed: !!googleEventId,
    googleEventId: googleEventId ?? undefined,
    icsContent: ics,
  };
}
