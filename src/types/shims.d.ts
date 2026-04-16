// Ambient module shims for optional native dependencies that are dynamically
// imported at runtime with a try/catch fallback. These packages are not
// installed by default to keep the bundle small; TypeScript still needs
// minimal typing so `await import('pkg')` compiles.

declare module 'expo-calendar' {
  export const EntityTypes: { EVENT: number; REMINDER: number };
  export const Frequency: { DAILY: string; WEEKLY: string; MONTHLY: string; YEARLY: string };
  export function requestCalendarPermissionsAsync(): Promise<{ status: string }>;
  export function getCalendarsAsync(entityType?: number): Promise<any[]>;
  export function getEventsAsync(calendarIds: string[], startDate: Date, endDate: Date): Promise<any[]>;
  export function getEventAsync(id: string): Promise<any>;
  export function createEventAsync(calendarId: string, event: any): Promise<string>;
  export function updateEventAsync(id: string, event: any): Promise<void>;
  export function deleteEventAsync(id: string, options?: any): Promise<void>;
  export function createCalendarAsync(details: any): Promise<string>;
  export function getDefaultCalendarAsync(): Promise<any>;
  export function getSourcesAsync(): Promise<any[]>;
  export function getSourceAsync(id: string): Promise<any>;
}
