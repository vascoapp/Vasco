// =============================================================================
// SMART SCHEDULER SERVICE
// =============================================================================
// AI-powered scheduling with travel optimization, weather awareness,
// customer preferences, and resource management
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';
import { jobCostTrackingService } from './jobCostTrackingService';
import { getLastFetchedForecast, type DayForecast } from './weatherService';
import i18n from '../i18n/i18n';
import { localDateKey } from '../utils/dateKey';

// ============================================
// TYPES
// ============================================

export type JobLifecycleStatus =
  | 'lead'
  | 'offerte'
  | 'geaccepteerd'
  | 'ingepland'
  | 'bezig'
  | 'gereed'
  | 'gefactureerd'
  | 'betaald'
  | 'geannuleerd';

export const LIFECYCLE_ORDER: JobLifecycleStatus[] = [
  'lead', 'offerte', 'geaccepteerd', 'ingepland', 'bezig', 'gereed', 'gefactureerd', 'betaald',
];

/**
 * Domain JobStatus (English) -> JobLifecycleStatus (Dutch). The two enums are
 * parallel but spelled differently, and screens were assigning one to the other
 * behind an `as any`. That made LIFECYCLE_ORDER.indexOf('in-progress') return
 * -1, which the job screen turned into a "Voortgang -14%" bar.
 */
const DOMAIN_STATUS_TO_LIFECYCLE: Record<string, JobLifecycleStatus> = {
  lead: 'lead',
  quoted: 'offerte',
  accepted: 'geaccepteerd',
  scheduled: 'ingepland',
  'in-progress': 'bezig',
  completed: 'gereed',
  invoiced: 'gefactureerd',
  paid: 'betaald',
  cancelled: 'geannuleerd',
};

/**
 * Inverse of DOMAIN_STATUS_TO_LIFECYCLE: Dutch lifecycle value -> the domain
 * JobStatus that AppState persists.
 *
 * Needed because the job-detail lifecycle CTA has to write through AppState
 * (`updateJobStatus`), which speaks the English domain enum, while the
 * stepper it drives speaks the Dutch lifecycle enum. Derived from the map
 * above rather than hand-written so the two cannot drift apart.
 */
export const LIFECYCLE_TO_DOMAIN_STATUS = Object.fromEntries(
  Object.entries(DOMAIN_STATUS_TO_LIFECYCLE).map(([domain, life]) => [life, domain]),
) as Record<JobLifecycleStatus, string>;

/**
 * Normalise any job status to a JobLifecycleStatus. Accepts either spelling —
 * parts of the codebase already persist the Dutch values — and returns
 * undefined for anything unrecognised so callers can decide, rather than
 * silently producing a -1 index.
 */
export function toLifecycleStatus(status: string | null | undefined): JobLifecycleStatus | undefined {
  if (!status) return undefined;
  if (LIFECYCLE_ORDER.includes(status as JobLifecycleStatus) || status === 'geannuleerd') {
    return status as JobLifecycleStatus;
  }
  return DOMAIN_STATUS_TO_LIFECYCLE[status];
}

export const LIFECYCLE_LABELS: Record<JobLifecycleStatus, string> = {
  lead: 'Lead',
  offerte: 'Offerte',
  geaccepteerd: 'Geaccepteerd',
  ingepland: 'Ingepland',
  bezig: 'Bezig',
  gereed: 'Gereed',
  gefactureerd: 'Gefactureerd',
  betaald: 'Betaald',
  geannuleerd: 'Geannuleerd',
};

export const LIFECYCLE_COLORS: Record<JobLifecycleStatus, string> = {
  lead: '#94A3B8',
  offerte: '#F59E0B',
  geaccepteerd: '#3B82F6',
  ingepland: '#8B5CF6',
  bezig: '#F97316',
  gereed: '#16A34A',
  gefactureerd: '#0EA5E9',
  betaald: '#059669',
  geannuleerd: '#DC2626',
};

export const LIFECYCLE_NEXT_ACTION: Record<JobLifecycleStatus, string | null> = {
  lead: 'Offerte maken',
  offerte: 'Markeer als geaccepteerd',
  geaccepteerd: 'Inplannen',
  ingepland: 'Start klus',
  bezig: 'Markeer als gereed',
  gereed: 'Factureer',
  gefactureerd: 'Markeer als betaald',
  betaald: null,
  geannuleerd: null,
};

export interface ScheduledJob {
  id: string;
  projectId: string;
  projectName: string;
  customerId: string;
  customerName: string;
  address: string;
  coordinates?: { lat: number; lng: number };
  startTime: string;
  endTime: string;
  duration: number; // minutes
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled';
  lifecycleStatus: JobLifecycleStatus;
  type: 'job' | 'quote_visit' | 'follow_up' | 'personal';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
  isOutdoor: boolean;
  weatherSensitive: boolean;
  assignedTo?: string;
  travelTime?: number;
  previousJobId?: string;
  // P2: Actual hours tracking
  actualHoursLogged?: number;
  estimatedHours?: number;
  // Quoted amount for daily earnings tracking
  quotedAmount?: number;
}

export interface TimeSlot {
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
  jobs: ScheduledJob[];
  weatherSuitable: boolean;
  weatherForecast?: WeatherForecast;
}

export interface WeatherForecast {
  condition: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snow';
  temperature: number;
  precipitation: number;
  windSpeed: number;
  suitableForOutdoor: boolean;
}

export interface ScheduleConflict {
  id: string;
  type: 'overlap' | 'travel_time' | 'weather' | 'resource';
  severity: 'warning' | 'error';
  job1Id: string;
  job2Id?: string;
  description: string;
  suggestedResolution: string;
}

export interface ScheduleOptimization {
  id: string;
  type: 'travel' | 'grouping' | 'weather' | 'efficiency';
  title: string;
  description: string;
  potentialSaving: string;
  affectedJobs: string[];
  suggestedChanges: Array<{ jobId: string; newStartTime: string }>;
}

export interface CustomerPreference {
  customerId: string;
  preferredDays: number[]; // 0-6, Sunday-Saturday
  preferredTimeStart: string;
  preferredTimeEnd: string;
  noiseRestrictions?: boolean;
  parkingNotes?: string;
  accessInstructions?: string;
}

export interface TravelRoute {
  fromJobId: string;
  toJobId: string;
  distance: number; // km
  duration: number; // minutes
  trafficLevel: 'light' | 'moderate' | 'heavy';
}

export interface DaySchedule {
  date: string;
  jobs: ScheduledJob[];
  totalWorkTime: number;
  totalTravelTime: number;
  utilization: number;
  startLocation?: string;
  endLocation?: string;
  weatherOverview: WeatherForecast;
}

export interface ScheduleSuggestion {
  id: string;
  jobId: string;
  suggestedSlots: Array<{
    date: string;
    startTime: string;
    score: number;
    reasons: string[];
  }>;
}

// ============================================
// MOCK DATA
// ============================================

// Helper to get today's date string for dynamic mock data
function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

const MOCK_JOBS: ScheduledJob[] = [
  // Today's appointments (dynamic date)
  {
    id: 'job_today_1',
    projectId: 'proj_t1',
    projectName: 'CV-ketel onderhoud',
    customerId: 'cust_t1',
    customerName: 'Familie Smit',
    address: 'Herengracht 210, Amsterdam',
    startTime: `${getTodayStr()}T08:30:00`,
    endTime: `${getTodayStr()}T10:30:00`,
    duration: 120,
    status: 'scheduled',
    lifecycleStatus: 'ingepland',
    type: 'job',
    priority: 'high',
    isOutdoor: false,
    weatherSensitive: false,
    travelTime: 15,
    estimatedHours: 2,
    quotedAmount: 285,
  },
  {
    id: 'job_today_2',
    projectId: 'proj_t2',
    projectName: 'Lekkage badkamer',
    customerId: 'cust_t2',
    customerName: 'M. van der Berg',
    address: 'Bilderdijkstraat 44, Amsterdam',
    startTime: `${getTodayStr()}T11:00:00`,
    endTime: `${getTodayStr()}T13:00:00`,
    duration: 120,
    status: 'scheduled',
    lifecycleStatus: 'ingepland',
    type: 'job',
    priority: 'medium',
    isOutdoor: false,
    weatherSensitive: false,
    travelTime: 20,
    estimatedHours: 2,
    quotedAmount: 450,
  },
  {
    id: 'job_today_3',
    projectId: 'proj_t3',
    projectName: 'Offerte keukenrenovatie',
    customerId: 'cust_t3',
    customerName: 'Bakkerij Jansen',
    address: 'Prinsengracht 450, Amsterdam',
    startTime: `${getTodayStr()}T14:00:00`,
    endTime: `${getTodayStr()}T15:00:00`,
    duration: 60,
    status: 'scheduled',
    lifecycleStatus: 'offerte',
    type: 'quote_visit',
    priority: 'medium',
    isOutdoor: false,
    weatherSensitive: false,
    travelTime: 12,
    estimatedHours: 1,
    quotedAmount: 0,
  },
  // Future appointments
  {
    id: 'job_1',
    projectId: 'proj_1',
    projectName: 'Schilderwerk woonkamer',
    customerId: 'cust_1',
    customerName: 'Familie de Vries',
    address: 'Keizersgracht 125, Amsterdam',
    startTime: '2025-02-03T09:00:00',
    endTime: '2025-02-03T17:00:00',
    duration: 480,
    status: 'scheduled',
    lifecycleStatus: 'geaccepteerd',
    type: 'job',
    priority: 'medium',
    isOutdoor: false,
    weatherSensitive: false,
    estimatedHours: 8,
  },
  {
    id: 'job_2',
    projectId: 'proj_2',
    projectName: 'Offerte dakkapel',
    customerId: 'cust_2',
    customerName: 'Bakkerij Jansen',
    address: 'Prinsengracht 450, Amsterdam',
    startTime: '2025-02-03T08:00:00',
    endTime: '2025-02-03T09:00:00',
    duration: 60,
    status: 'scheduled',
    lifecycleStatus: 'lead',
    type: 'quote_visit',
    priority: 'high',
    isOutdoor: true,
    weatherSensitive: true,
    estimatedHours: 1,
  },
  {
    id: 'job_3',
    projectId: 'proj_3',
    projectName: 'Badkamerrenovatie',
    customerId: 'cust_3',
    customerName: 'Peter van den Berg',
    address: 'Vondelstraat 78, Amsterdam',
    startTime: '2025-02-04T08:00:00',
    endTime: '2025-02-04T17:00:00',
    duration: 540,
    status: 'scheduled',
    lifecycleStatus: 'bezig',
    type: 'job',
    priority: 'high',
    isOutdoor: false,
    weatherSensitive: false,
    estimatedHours: 9,
    actualHoursLogged: 6.5,
  },
  {
    id: 'job_4',
    projectId: 'proj_4',
    projectName: 'Buitenschilderwerk',
    customerId: 'cust_4',
    customerName: 'Sandra Bakker',
    address: 'Amstel 100, Amsterdam',
    startTime: '2025-02-05T09:00:00',
    endTime: '2025-02-05T16:00:00',
    duration: 420,
    status: 'scheduled',
    lifecycleStatus: 'gefactureerd',
    type: 'job',
    priority: 'medium',
    isOutdoor: true,
    weatherSensitive: true,
    estimatedHours: 7,
    actualHoursLogged: 8.5,
  },
];

// R51: dropped the MOCK_WEATHER seed — its dates (2025-02-03..2025-02-07)
// were perpetually in the past, so the lookup never matched and the neutral
// fallback below ran every time anyway. Keeping the literal misled future
// readers into thinking weather had a meaningful seed. Today/tomorrow comes
// from the canonical weatherService (Open-Meteo via getLastFetchedForecast);
// further-out dates fall through to a neutral suitable-for-outdoor default
// so the scheduler doesn't fabricate "rain expected" alerts.

// ============================================
// SERVICE CLASS
// ============================================

class SmartSchedulerService {
  private jobs: Map<string, ScheduledJob> = new Map();
  private customerPreferences: Map<string, CustomerPreference> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    // R30: dropped MOCK_JOBS seed (was injecting fixture jobs into every
    // contractor's smart scheduler on app open). Real jobs flow in via
    // useScheduler() hooks reading AppState OR via direct addJob() calls
    // from the screen-level UI. Test setups can re-seed via __seedMockData.
  }
  /** @internal Test-only mock seeder. */
  __seedMockData(): void {
    MOCK_JOBS.forEach((j) => this.jobs.set(j.id, j));
    this.notifyListeners();
  }

  // -----------------------------------------
  // Job Management
  // -----------------------------------------

  getJobs(filter?: { date?: string; status?: ScheduledJob['status'] }): ScheduledJob[] {
    let jobs = Array.from(this.jobs.values());
    if (filter?.date) {
      jobs = jobs.filter((j) => j.startTime.startsWith(filter.date!));
    }
    if (filter?.status) {
      jobs = jobs.filter((j) => j.status === filter.status);
    }
    return jobs.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  getJob(jobId: string): ScheduledJob | undefined {
    return this.jobs.get(jobId);
  }

  scheduleJob(job: Omit<ScheduledJob, 'id' | 'status'>): ScheduledJob {
    const newJob: ScheduledJob = {
      ...job,
      id: `job_${Date.now()}`,
      status: 'scheduled',
    };
    this.jobs.set(newJob.id, newJob);
    this.notifyListeners();
    trackUserAction('job_scheduled', { jobId: newJob.id, type: job.type });
    return newJob;
  }

  rescheduleJob(jobId: string, newStartTime: string, newEndTime: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.startTime = newStartTime;
      job.endTime = newEndTime;
      job.status = 'rescheduled';
      this.notifyListeners();
      trackUserAction('job_rescheduled', { jobId });
    }
  }

  cancelJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'cancelled';
      this.notifyListeners();
      trackUserAction('job_cancelled', { jobId });
    }
  }

  updateJobStatus(jobId: string, status: ScheduledJob['status']): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = status;
      this.notifyListeners();
      trackUserAction('job_status_updated', { jobId, status });
    }
  }

  // -----------------------------------------
  // Schedule Views
  // -----------------------------------------

  getDaySchedule(date: string): DaySchedule {
    const jobs = this.getJobs({ date });
    const weather = this.getWeatherForecast(date);

    let totalWorkTime = 0;
    let totalTravelTime = 0;

    jobs.forEach((job, index) => {
      totalWorkTime += job.duration;
      if (index > 0) {
        totalTravelTime += job.travelTime || 15;
      }
    });

    const availableTime = 9 * 60; // 9 hours in minutes
    const utilization = Math.round((totalWorkTime / availableTime) * 100);

    return {
      date,
      jobs,
      totalWorkTime,
      totalTravelTime,
      utilization: Math.min(utilization, 100),
      weatherOverview: weather,
    };
  }

  getWeekSchedule(startDate: string): DaySchedule[] {
    const schedules: DaySchedule[] = [];
    const start = new Date(startDate);

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      schedules.push(this.getDaySchedule(dateStr));
    }

    return schedules;
  }

  // -----------------------------------------
  // Weather Integration
  // -----------------------------------------

  getWeatherForecast(date: string): WeatherForecast {
    // R20: read from the canonical weatherService (Open-Meteo, prefetched
    // on app open per R18). Maps the today/tomorrow DayForecast into the
    // local WeatherForecast shape. Far-future dates fall through to the
    // historical MOCK_WEATHER seed (kept for backwards-compat with any
    // demo-mode consumer) or a neutral default.
    const real = getLastFetchedForecast();
    if (real) {
      const today = new Date().toISOString().slice(0, 10);
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      let day: DayForecast | null = null;
      if (date === today) day = real.today;
      else if (date === tomorrow) day = real.tomorrow;
      if (day) {
        const condition: WeatherForecast['condition'] = day.precipitationMm > 5
          ? 'rainy'
          : day.precipitationMm > 1 ? 'cloudy' : 'sunny';
        const suitable = day.precipitationMm <= 5 && day.tempMax >= 2;
        return {
          condition,
          temperature: Math.round(day.tempMax),
          precipitation: Math.round(day.precipitationMm * 10), // mm → 0-100ish
          windSpeed: 15,
          suitableForOutdoor: suitable,
        };
      }
    }
    // R51: neutral fallback for future dates beyond Open-Meteo's 3d horizon.
    // Marked suitableForOutdoor=true so we don't generate fake "Bad weather"
    // alerts for unknown days.
    return {
      condition: 'cloudy',
      temperature: 10,
      precipitation: 0,
      windSpeed: 15,
      suitableForOutdoor: true,
    };
  }

  getWeatherAlerts(): Array<{ jobId: string; date: string; issue: string }> {
    const alerts: Array<{ jobId: string; date: string; issue: string }> = [];
    const t = i18n.t.bind(i18n);

    this.jobs.forEach((job) => {
      if (job.weatherSensitive && job.status === 'scheduled') {
        const date = job.startTime.split('T')[0];
        const weather = this.getWeatherForecast(date);
        if (!weather.suitableForOutdoor) {
          alerts.push({
            jobId: job.id,
            date,
            // R20: was hardcoded NL `Ongeschikt weer verwacht (...)`.
            issue: t('weather.unsuitable', {
              defaultValue: 'Unsuitable weather expected ({{condition}}, {{precipitation}}% precipitation)',
              condition: t(`weather.cond.${weather.condition}`, { defaultValue: weather.condition }),
              precipitation: weather.precipitation,
            }),
          });
        }
      }
    });

    return alerts;
  }

  // -----------------------------------------
  // Conflict Detection
  // -----------------------------------------

  detectConflicts(): ScheduleConflict[] {
    const conflicts: ScheduleConflict[] = [];
    const jobs = this.getJobs({ status: 'scheduled' });

    // Check for overlaps
    for (let i = 0; i < jobs.length; i++) {
      for (let j = i + 1; j < jobs.length; j++) {
        const job1 = jobs[i];
        const job2 = jobs[j];

        const start1 = new Date(job1.startTime).getTime();
        const end1 = new Date(job1.endTime).getTime();
        const start2 = new Date(job2.startTime).getTime();
        const end2 = new Date(job2.endTime).getTime();

        if (start1 < end2 && start2 < end1) {
          conflicts.push({
            id: `conflict_${job1.id}_${job2.id}`,
            type: 'overlap',
            severity: 'error',
            job1Id: job1.id,
            job2Id: job2.id,
            description: `"${job1.projectName}" overlapt met "${job2.projectName}"`,
            suggestedResolution: 'Verplaats één van de afspraken',
          });
        }
      }
    }

    // Check weather conflicts
    const weatherAlerts = this.getWeatherAlerts();
    weatherAlerts.forEach((alert) => {
      conflicts.push({
        id: `weather_${alert.jobId}`,
        type: 'weather',
        severity: 'warning',
        job1Id: alert.jobId,
        description: alert.issue,
        suggestedResolution: 'Verplaats naar een dag met beter weer',
      });
    });

    return conflicts;
  }

  // -----------------------------------------
  // Schedule Optimization
  // -----------------------------------------

  getOptimizations(): ScheduleOptimization[] {
    const optimizations: ScheduleOptimization[] = [];
    const jobs = this.getJobs({ status: 'scheduled' });

    // Group nearby jobs suggestion
    const jobsByDate: Record<string, ScheduledJob[]> = {};
    jobs.forEach((job) => {
      const date = job.startTime.split('T')[0];
      if (!jobsByDate[date]) jobsByDate[date] = [];
      jobsByDate[date].push(job);
    });

    Object.entries(jobsByDate).forEach(([date, dayJobs]) => {
      if (dayJobs.length >= 2) {
        // Check if jobs could be reordered for better routing
        optimizations.push({
          id: `opt_travel_${date}`,
          type: 'travel',
          title: 'Optimaliseer reisroute',
          description: `Herorden ${dayJobs.length} afspraken op ${date} voor kortere reistijd`,
          potentialSaving: '25 min reistijd',
          affectedJobs: dayJobs.map((j) => j.id),
          suggestedChanges: [],
        });
      }
    });

    // Weather-based optimization
    const weatherAlerts = this.getWeatherAlerts();
    if (weatherAlerts.length > 0) {
      optimizations.push({
        id: 'opt_weather',
        type: 'weather',
        title: 'Verplaats buitenwerk',
        description: `${weatherAlerts.length} buitenklussen staan gepland op dagen met slecht weer`,
        potentialSaving: 'Voorkom vertraging',
        affectedJobs: weatherAlerts.map((a) => a.jobId),
        suggestedChanges: [],
      });
    }

    return optimizations;
  }

  suggestTimeSlots(params: {
    duration: number;
    isOutdoor: boolean;
    preferredDate?: string;
    customerId?: string;
  }): ScheduleSuggestion {
    const suggestions: ScheduleSuggestion['suggestedSlots'] = [];
    const startDate = params.preferredDate ? new Date(params.preferredDate) : new Date();

    for (let day = 0; day < 14; day++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + day);
      const dateStr = date.toISOString().split('T')[0];

      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      const weather = this.getWeatherForecast(dateStr);
      if (params.isOutdoor && !weather.suitableForOutdoor) continue;

      const dayJobs = this.getJobs({ date: dateStr });
      const busySlots = dayJobs.map((j) => ({
        start: new Date(j.startTime).getHours(),
        end: new Date(j.endTime).getHours(),
      }));

      // Find free slots
      const workStart = 8;
      const workEnd = 17;
      let currentHour = workStart;

      while (currentHour + params.duration / 60 <= workEnd) {
        const slotEnd = currentHour + params.duration / 60;
        const isFree = !busySlots.some(
          (busy) => currentHour < busy.end && slotEnd > busy.start
        );

        if (isFree) {
          let score = 70;
          const reasons: string[] = [];

          // Prefer morning slots
          if (currentHour < 10) {
            score += 10;
            reasons.push('Ochtendslot');
          }

          // Good weather bonus
          if (weather.suitableForOutdoor) {
            score += 10;
            reasons.push('Goed weer');
          }

          // Closer date is better
          score -= day;

          suggestions.push({
            date: dateStr,
            startTime: `${currentHour.toString().padStart(2, '0')}:00`,
            score: Math.max(0, Math.min(100, score)),
            reasons,
          });
        }

        currentHour++;
      }
    }

    return {
      id: `sug_${Date.now()}`,
      jobId: '',
      suggestedSlots: suggestions.sort((a, b) => b.score - a.score).slice(0, 5),
    };
  }

  // -----------------------------------------
  // Customer Preferences
  // -----------------------------------------

  setCustomerPreference(preference: CustomerPreference): void {
    this.customerPreferences.set(preference.customerId, preference);
    trackUserAction('customer_preference_set', { customerId: preference.customerId });
  }

  getCustomerPreference(customerId: string): CustomerPreference | undefined {
    return this.customerPreferences.get(customerId);
  }

  // -----------------------------------------
  // Job Lifecycle Pipeline (P1)
  // -----------------------------------------

  getSchedulerStatus(lifecycleStatus: JobLifecycleStatus): ScheduledJob['status'] {
    switch (lifecycleStatus) {
      case 'bezig': return 'in_progress';
      case 'gereed':
      case 'gefactureerd':
      case 'betaald': return 'completed';
      case 'geannuleerd': return 'cancelled';
      default: return 'scheduled';
    }
  }

  advanceLifecycle(jobId: string): JobLifecycleStatus | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    const currentIndex = LIFECYCLE_ORDER.indexOf(job.lifecycleStatus);
    if (currentIndex === -1 || currentIndex >= LIFECYCLE_ORDER.length - 1) return null;

    const nextStatus = LIFECYCLE_ORDER[currentIndex + 1];
    job.lifecycleStatus = nextStatus;
    job.status = this.getSchedulerStatus(nextStatus);
    this.notifyListeners();
    trackUserAction('lifecycle_advanced', { jobId, from: LIFECYCLE_ORDER[currentIndex], to: nextStatus });

    // Record job outcome for intelligence calibration when job reaches completion
    if (nextStatus === 'gereed' || nextStatus === 'betaald') {
      // Pull real cost data from jobCostTrackingService when available
      const variance = jobCostTrackingService.getJobCostVariance(job.id);
      const actualCost = variance ? variance.actualTotal : job.quotedAmount || 0;
      const estimatedCost = variance ? variance.estimatedTotal : job.quotedAmount || 0;
      const marginPercent = estimatedCost > 0
        ? ((estimatedCost - actualCost) / estimatedCost) * 100
        : 0;

      import('../intelligence/learningStorage').then(({ recordJobOutcome }) => {
        recordJobOutcome({
          jobId: job.id,
          jobType: job.projectName || 'Overig',
          estimatedHours: variance?.estimatedHours || job.estimatedHours || 0,
          actualHours: variance?.actualHours || job.actualHoursLogged || job.estimatedHours || 0,
          estimatedCost,
          actualCost,
          marginPercent,
          completedAt: new Date().toISOString(),
        }).catch(() => {});
      }).catch(() => {});

      // Feed price observations to supplier intelligence
      jobCostTrackingService.recordJobPriceObservations(job.id).catch(() => {});
    }

    return nextStatus;
  }

  getLifecycleCounts(): Record<JobLifecycleStatus, number> {
    const counts: Record<JobLifecycleStatus, number> = {
      lead: 0, offerte: 0, geaccepteerd: 0, ingepland: 0,
      bezig: 0, gereed: 0, gefactureerd: 0, betaald: 0, geannuleerd: 0,
    };
    this.jobs.forEach(job => {
      counts[job.lifecycleStatus]++;
    });
    return counts;
  }

  recordActualHours(jobId: string, hours: number): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.actualHoursLogged = (job.actualHoursLogged || 0) + hours;
      this.notifyListeners();
    }
  }

  // -----------------------------------------
  // Subscription
  // -----------------------------------------

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((l) => l());
  }
}

export const smartSchedulerService = new SmartSchedulerService();

// ============================================
// REACT HOOKS
// ============================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppState } from '../state/AppState';

/**
 * Map an AppState domain Job -> the ScheduledJob shape the scheduler hooks
 * expose. AppState is the single source of truth for jobs; the service's own
 * Map is empty in the real app.
 *
 * Extracted because this mapping existed in three places (useDaySchedule,
 * useJobLifecyclePipeline, and now useScheduler) with slightly different
 * status tables — exactly the kind of drift that produced the lifecycle bugs.
 */
export function toScheduledJob(job: any, customers?: Array<{ id: string; name: string }>): ScheduledJob {
  const durationMin = (job.estimatedDuration ?? 2) * 60;
  const startTime = job.scheduledDate
    ? `${job.scheduledDate}T${job.scheduledStartTime ?? '08:00:00'}`
    : '';
  const endTime = job.scheduledDate
    ? (job.scheduledEndTime
        ? `${job.scheduledDate}T${job.scheduledEndTime}`
        : new Date(new Date(startTime).getTime() + durationMin * 60000).toISOString())
    : '';
  return {
    id: job.id,
    projectId: job.id,
    projectName: job.title,
    customerId: job.customerId ?? '',
    customerName: customers?.find((c) => c.id === job.customerId)?.name ?? '',
    address: job.address ? [job.address.street, job.address.city].filter(Boolean).join(', ') : '',
    startTime,
    endTime,
    duration: durationMin,
    status: job.status === 'in-progress' ? 'in_progress'
      : job.status === 'completed' ? 'completed'
      : job.status === 'cancelled' ? 'cancelled'
      : 'scheduled',
    lifecycleStatus: toLifecycleStatus(job.status) ?? 'ingepland',
    type: 'job',
    priority: job.priority === 'emergency' ? 'urgent'
      : job.priority === 'high' ? 'high'
      : job.priority === 'low' ? 'low'
      : 'medium',
    isOutdoor: false,
    weatherSensitive: false,
    actualHoursLogged: job.actualHours,
    estimatedHours: job.estimatedDuration ?? 2,
    quotedAmount: job.quotedAmount ?? job.agreedAmount ?? 0,
  };
}

export function useScheduler() {
  // `jobs` comes from AppState, not smartSchedulerService.getJobs().
  //
  // The service's own Map is empty in the real app (R30 removed the MOCK_JOBS
  // seed; nothing repopulates it), so this hook used to hand every consumer an
  // empty array forever. That silently killed the registered
  // `cascading-delay` insight generator, which filters these jobs for
  // in-progress/scheduled work and could therefore never produce an insight.
  //
  // NOTE: the mutators below (scheduleJob/rescheduleJob/cancelJob/updateStatus)
  // and the conflicts/optimizations derivations still operate on the service's
  // empty Map. Their only consumer is src/components/contractor/SmartScheduler.tsx,
  // which is an ORPHAN (never mounted anywhere). Left as-is deliberately rather
  // than half-migrating a dead surface — see the memory notes.
  const { jobs: appJobs, customers } = useAppState();
  const jobs = useMemo<ScheduledJob[]>(
    () => appJobs.map((job) => toScheduledJob(job, customers)),
    [appJobs, customers],
  );

  const scheduleJob = useCallback((job: Omit<ScheduledJob, 'id' | 'status'>) => {
    return smartSchedulerService.scheduleJob(job);
  }, []);

  const rescheduleJob = useCallback((jobId: string, start: string, end: string) => {
    smartSchedulerService.rescheduleJob(jobId, start, end);
  }, []);

  const cancelJob = useCallback((jobId: string) => {
    smartSchedulerService.cancelJob(jobId);
  }, []);

  const updateStatus = useCallback((jobId: string, status: ScheduledJob['status']) => {
    smartSchedulerService.updateJobStatus(jobId, status);
  }, []);

  const conflicts = useMemo(() => smartSchedulerService.detectConflicts(), [jobs]);
  const optimizations = useMemo(() => smartSchedulerService.getOptimizations(), [jobs]);

  return {
    jobs,
    scheduleJob,
    rescheduleJob,
    cancelJob,
    updateStatus,
    conflicts,
    optimizations,
    suggestTimeSlots: smartSchedulerService.suggestTimeSlots.bind(smartSchedulerService),
  };
}

export function useDaySchedule(date: string) {
  const { jobs: appJobs, customers } = useAppState();

  const schedule = useMemo<DaySchedule>(() => {
    // Filter AppState jobs for the given date
    const dayJobs = appJobs.filter((j) => {
      if (j.scheduledDate === date) return true;
      // Also include in-progress jobs for today
      // localDateKey, not toISOString(): the UTC day differs from the local
      // day between midnight and the UTC offset, which made this in-progress
      // passthrough compare against yesterday. See werk.tsx todayKey().
      if (date === localDateKey(new Date()) && j.status === 'in-progress') return true;
      return false;
    });

    // Map real jobs → ScheduledJob shape
    const mapped: ScheduledJob[] = dayJobs.map((job) => {
      const customer = customers.find((c) => c.id === job.customerId);
      const startTime = job.scheduledStartTime
        ? `${date}T${job.scheduledStartTime}`
        : `${date}T08:00:00`;
      const durationMin = (job.estimatedDuration ?? 2) * 60;
      const startMs = new Date(startTime).getTime();
      const endTime = job.scheduledEndTime
        ? `${date}T${job.scheduledEndTime}`
        : new Date(startMs + durationMin * 60000).toISOString();

      const statusMap: Record<string, ScheduledJob['status']> = {
        'in-progress': 'in_progress',
        completed: 'completed',
        cancelled: 'cancelled',
      };

      const lifecycleMap: Record<string, JobLifecycleStatus> = {
        lead: 'lead',
        quoted: 'offerte',
        accepted: 'geaccepteerd',
        scheduled: 'ingepland',
        'in-progress': 'bezig',
        completed: 'gereed',
        invoiced: 'gefactureerd',
        paid: 'betaald',
        cancelled: 'geannuleerd',
      };

      return {
        id: job.id,
        projectId: job.id,
        projectName: job.title,
        customerId: job.customerId ?? '',
        customerName: customer?.name ?? '',
        address: job.address
          ? [job.address.street, job.address.city].filter(Boolean).join(', ')
          : '',
        startTime,
        endTime,
        duration: durationMin,
        status: statusMap[job.status] ?? 'scheduled',
        lifecycleStatus: lifecycleMap[job.status] ?? 'ingepland',
        type: 'job',
        priority: job.priority === 'emergency' ? 'urgent'
          : job.priority === 'high' ? 'high'
          : job.priority === 'low' ? 'low'
          : 'medium',
        isOutdoor: false,
        weatherSensitive: false,
        estimatedHours: job.estimatedDuration ?? 2,
        quotedAmount: job.quotedAmount ?? job.agreedAmount ?? 0,
      };
    });

    // Sort by start time
    mapped.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    let totalWorkTime = 0;
    let totalTravelTime = 0;
    mapped.forEach((job, index) => {
      totalWorkTime += job.duration;
      if (index > 0) totalTravelTime += job.travelTime || 15;
    });

    const availableTime = 9 * 60;
    const utilization = Math.round((totalWorkTime / availableTime) * 100);

    return {
      date,
      jobs: mapped,
      totalWorkTime,
      totalTravelTime,
      utilization: Math.min(utilization, 100),
      weatherOverview: smartSchedulerService.getWeatherForecast(date),
    };
  }, [date, appJobs, customers]);

  return schedule;
}

export function useWeekSchedule(startDate: string) {
  const [schedule, setSchedule] = useState<DaySchedule[]>(() =>
    smartSchedulerService.getWeekSchedule(startDate)
  );

  useEffect(() => {
    setSchedule(smartSchedulerService.getWeekSchedule(startDate));
    const unsubscribe = smartSchedulerService.subscribe(() => {
      setSchedule(smartSchedulerService.getWeekSchedule(startDate));
    });
    return unsubscribe;
  }, [startDate]);

  return schedule;
}

export function useWeatherAlerts() {
  return useMemo(() => smartSchedulerService.getWeatherAlerts(), []);
}

export function useJobLifecyclePipeline() {
  const { jobs: appJobs, updateJob, updateJobStatus } = useAppState();

  // Build lifecycle counts from real AppState jobs
  const counts = useMemo(() => {
    const c: Record<JobLifecycleStatus, number> = {
      lead: 0, offerte: 0, geaccepteerd: 0, ingepland: 0,
      bezig: 0, gereed: 0, gefactureerd: 0, betaald: 0, geannuleerd: 0,
    };
    const statusToLifecycle: Record<string, JobLifecycleStatus> = {
      lead: 'lead',
      quoted: 'offerte',
      accepted: 'geaccepteerd',
      scheduled: 'ingepland',
      'in-progress': 'bezig',
      completed: 'gereed',
      invoiced: 'gefactureerd',
      paid: 'betaald',
      cancelled: 'geannuleerd',
    };
    appJobs.forEach((job) => {
      const lifecycle = statusToLifecycle[job.status];
      if (lifecycle) c[lifecycle]++;
    });
    return c;
  }, [appJobs]);

  // Map AppState jobs → ScheduledJob[] for consumers that need the array
  const jobs = useMemo<ScheduledJob[]>(() =>
    appJobs.map((job) => ({
      id: job.id,
      projectId: job.id,
      projectName: job.title,
      customerId: job.customerId ?? '',
      customerName: '',
      address: job.address ? [job.address.street, job.address.city].filter(Boolean).join(', ') : '',
      startTime: job.scheduledDate ? `${job.scheduledDate}T${job.scheduledStartTime ?? '08:00:00'}` : '',
      endTime: job.scheduledDate ? `${job.scheduledDate}T${job.scheduledEndTime ?? '17:00:00'}` : '',
      duration: (job.estimatedDuration ?? 2) * 60,
      status: job.status === 'in-progress' ? 'in_progress' as const
        : job.status === 'completed' ? 'completed' as const
        : job.status === 'cancelled' ? 'cancelled' as const
        : 'scheduled' as const,
      lifecycleStatus: ({
        lead: 'lead', quoted: 'offerte', accepted: 'geaccepteerd', scheduled: 'ingepland',
        'in-progress': 'bezig', completed: 'gereed', invoiced: 'gefactureerd', paid: 'betaald', cancelled: 'geannuleerd',
      } as Record<string, JobLifecycleStatus>)[job.status] ?? 'ingepland',
      type: 'job' as const,
      priority: job.priority === 'emergency' ? 'urgent' as const : job.priority as 'low' | 'medium' | 'high',
      isOutdoor: false,
      weatherSensitive: false,
      estimatedHours: job.estimatedDuration ?? 2,
      quotedAmount: job.quotedAmount ?? job.agreedAmount ?? 0,
    })),
    [appJobs],
  );

  // Both of these used to delegate to smartSchedulerService, which keeps its
  // OWN `jobs` Map. That Map is empty in the real app (R30 removed the
  // MOCK_JOBS seed and nothing repopulates it), so `this.jobs.get(jobId)`
  // always missed:
  //   - advanceLifecycle() returned null  -> the job-detail lifecycle CTA was
  //     a silent no-op (see afc3752)
  //   - recordActualHours() fell through the `if (job)` guard -> every hour a
  //     contractor clocked on job completion was SILENTLY DISCARDED
  // AppState is the real store, and this hook already reads it, so both now
  // write through it.

  const advance = useCallback((jobId: string) => {
    const job = appJobs.find((j) => j.id === jobId);
    if (!job) return null;
    const current = toLifecycleStatus(job.status);
    if (!current) return null;
    const idx = LIFECYCLE_ORDER.indexOf(current);
    if (idx === -1 || idx >= LIFECYCLE_ORDER.length - 1) return null;
    const next = LIFECYCLE_ORDER[idx + 1];
    const nextDomain = LIFECYCLE_TO_DOMAIN_STATUS[next];
    if (!nextDomain) return null;
    updateJobStatus(jobId, nextDomain as any);
    return next;
  }, [appJobs, updateJobStatus]);

  const recordHours = useCallback((jobId: string, hours: number) => {
    const job = appJobs.find((j) => j.id === jobId);
    if (!job) return;
    // Accumulate, matching the old service semantics (`actualHoursLogged + hours`).
    const total = Math.round(((job.actualHours ?? 0) + hours) * 100) / 100;
    updateJob(jobId, { actualHours: total });
  }, [appJobs, updateJob]);

  return { jobs, counts, advance, recordHours };
}
