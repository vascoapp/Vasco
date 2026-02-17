// =============================================================================
// SMART SCHEDULER SERVICE
// =============================================================================
// AI-powered scheduling with travel optimization, weather awareness,
// customer preferences, and resource management
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';
import { jobCostTrackingService } from './jobCostTrackingService';

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
  bezig: '#E35205',
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

const MOCK_WEATHER: Record<string, WeatherForecast> = {
  '2025-02-03': { condition: 'cloudy', temperature: 8, precipitation: 10, windSpeed: 15, suitableForOutdoor: true },
  '2025-02-04': { condition: 'rainy', temperature: 6, precipitation: 80, windSpeed: 25, suitableForOutdoor: false },
  '2025-02-05': { condition: 'sunny', temperature: 10, precipitation: 5, windSpeed: 10, suitableForOutdoor: true },
  '2025-02-06': { condition: 'cloudy', temperature: 9, precipitation: 20, windSpeed: 12, suitableForOutdoor: true },
  '2025-02-07': { condition: 'rainy', temperature: 5, precipitation: 70, windSpeed: 30, suitableForOutdoor: false },
};

// ============================================
// SERVICE CLASS
// ============================================

class SmartSchedulerService {
  private jobs: Map<string, ScheduledJob> = new Map();
  private customerPreferences: Map<string, CustomerPreference> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    MOCK_JOBS.forEach((j) => this.jobs.set(j.id, j));
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
    return MOCK_WEATHER[date] || {
      condition: 'cloudy',
      temperature: 10,
      precipitation: 30,
      windSpeed: 15,
      suitableForOutdoor: true,
    };
  }

  getWeatherAlerts(): Array<{ jobId: string; date: string; issue: string }> {
    const alerts: Array<{ jobId: string; date: string; issue: string }> = [];

    this.jobs.forEach((job) => {
      if (job.weatherSensitive && job.status === 'scheduled') {
        const date = job.startTime.split('T')[0];
        const weather = this.getWeatherForecast(date);
        if (!weather.suitableForOutdoor) {
          alerts.push({
            jobId: job.id,
            date,
            issue: `Ongeschikt weer verwacht (${weather.condition}, ${weather.precipitation}% neerslag)`,
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

export function useScheduler() {
  const [jobs, setJobs] = useState<ScheduledJob[]>(() => smartSchedulerService.getJobs());

  useEffect(() => {
    const unsubscribe = smartSchedulerService.subscribe(() => {
      setJobs(smartSchedulerService.getJobs());
    });
    return unsubscribe;
  }, []);

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
  const [schedule, setSchedule] = useState<DaySchedule>(() =>
    smartSchedulerService.getDaySchedule(date)
  );

  useEffect(() => {
    setSchedule(smartSchedulerService.getDaySchedule(date));
    const unsubscribe = smartSchedulerService.subscribe(() => {
      setSchedule(smartSchedulerService.getDaySchedule(date));
    });
    return unsubscribe;
  }, [date]);

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
  const [jobs, setJobs] = useState<ScheduledJob[]>(() => smartSchedulerService.getJobs());
  const [counts, setCounts] = useState(() => smartSchedulerService.getLifecycleCounts());

  useEffect(() => {
    const unsubscribe = smartSchedulerService.subscribe(() => {
      setJobs(smartSchedulerService.getJobs());
      setCounts(smartSchedulerService.getLifecycleCounts());
    });
    return unsubscribe;
  }, []);

  const advance = useCallback((jobId: string) => {
    return smartSchedulerService.advanceLifecycle(jobId);
  }, []);

  const recordHours = useCallback((jobId: string, hours: number) => {
    smartSchedulerService.recordActualHours(jobId, hours);
  }, []);

  return { jobs, counts, advance, recordHours };
}
