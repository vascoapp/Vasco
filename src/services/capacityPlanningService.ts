/**
 * Predictive Capacity Planning Service
 *
 * Helps contractors:
 * - Anticipate when they have room for new work
 * - Avoid task-related overruns
 * - Know exactly when they have time
 * - Estimate how long jobs will take
 * - Understand what may cause delays
 */

import { useState, useEffect, useCallback } from 'react';
import {
  CapacitySlot,
  AvailabilityWindow,
  DurationEstimate,
  OverrunPrediction,
  DelayAnalysis,
  DelayFactor,
  CustomerQuoteResponse,
  CapacityAlert,
  CapacityPlanningConfig,
  JobOutcome,
  PredictionAccuracy,
  JobScope,
  DurationBreakdown,
  DurationRiskFactor,
  HistoricalComparison,
  JobProgressStatus,
  OverrunIndicator,
  OverrunMitigation,
  ProactiveAction,
  CapacityBlocker,
  ScheduledJobSummary,
  WeatherForecast,
} from '../types/capacity-planning';
import { getLastFetchedForecast, type DayForecast } from './weatherService';

// ============================================
// SERVICE CONFIGURATION
// ============================================

const DEFAULT_CONFIG: CapacityPlanningConfig = {
  defaultWorkdayHours: 8,
  workingDays: [1, 2, 3, 4, 5], // Mon-Fri

  defaultBufferPercent: 15,
  travelTimeBuffer: 30, // 30 min between jobs

  highUtilizationThreshold: 85,
  lowUtilizationThreshold: 50,
  overrunRiskThreshold: 80, // Alert if % time > % complete by this margin

  weatherCheckEnabled: true,
  outdoorJobWeatherCutoffs: {
    maxPrecipitation: 5, // mm
    maxWindSpeed: 40, // km/h
    minTemperature: 5, // °C
  },

  useHistoricalData: true,
  minHistoricalJobs: 5,
};

// ============================================
// MOCK DATA - Historical job performance
// ============================================

const HISTORICAL_JOB_DATA: Record<string, HistoricalComparison> = {
  'interior-painting': {
    similarJobsCount: 47,
    avgActualDuration: 14.2,
    avgEstimatedDuration: 12,
    accuracyRate: 76,
    commonOverrunCauses: ['Surface prep took longer', 'Additional coats needed', 'Customer change requests'],
  },
  'exterior-painting': {
    similarJobsCount: 23,
    avgActualDuration: 22.5,
    avgEstimatedDuration: 18,
    accuracyRate: 65,
    commonOverrunCauses: ['Weather delays', 'Scaffolding issues', 'Surface condition worse than expected'],
  },
  'wallpaper-installation': {
    similarJobsCount: 31,
    avgActualDuration: 8.5,
    avgEstimatedDuration: 8,
    accuracyRate: 82,
    commonOverrunCauses: ['Pattern matching complexity', 'Wall prep needed', 'Material defects'],
  },
  'carpentry-repair': {
    similarJobsCount: 18,
    avgActualDuration: 6.8,
    avgEstimatedDuration: 5,
    accuracyRate: 61,
    commonOverrunCauses: ['Hidden damage discovered', 'Material sourcing delays', 'Structural issues'],
  },
  'general-maintenance': {
    similarJobsCount: 89,
    avgActualDuration: 3.2,
    avgEstimatedDuration: 3,
    accuracyRate: 88,
    commonOverrunCauses: ['Scope creep', 'Parts not available', 'Access issues'],
  },
};

// Base duration estimates by job type and size (in hours)
const BASE_DURATIONS: Record<string, Record<string, number>> = {
  'interior-painting': { small: 6, medium: 14, large: 28 },
  'exterior-painting': { small: 10, medium: 20, large: 40 },
  'wallpaper-installation': { small: 4, medium: 8, large: 16 },
  'carpentry-repair': { small: 3, medium: 6, large: 12 },
  'general-maintenance': { small: 2, medium: 4, large: 8 },
  'plastering': { small: 4, medium: 10, large: 20 },
  'tiling': { small: 6, medium: 12, large: 24 },
  'flooring': { small: 4, medium: 10, large: 20 },
};

// Delay factor database
const COMMON_DELAY_FACTORS: DelayFactor[] = [
  {
    id: 'weather-rain',
    category: 'weather',
    name: 'Rain/Wet Weather',
    description: 'Precipitation preventing outdoor work or affecting material curing',
    probability: 35,
    impactHours: 8,
    likelyTiming: 'any',
    earlyWarningSignals: ['Weather forecast shows precipitation', 'High humidity levels'],
    monitoringRequired: true,
    preventable: false,
    preventionActions: ['Schedule outdoor work for dry periods', 'Have indoor backup tasks ready'],
  },
  {
    id: 'material-delay',
    category: 'material',
    name: 'Material Delivery Delay',
    description: 'Materials not arriving when expected',
    probability: 20,
    impactHours: 16,
    likelyTiming: 'before-start',
    earlyWarningSignals: ['Supplier communication gaps', 'Stock shortages reported', 'Long lead times'],
    monitoringRequired: true,
    preventable: true,
    preventionActions: ['Order materials 1 week early', 'Confirm delivery date 2 days before', 'Have backup supplier'],
    preventionCost: 0,
  },
  {
    id: 'surface-condition',
    category: 'technical',
    name: 'Surface Condition Issues',
    description: 'Underlying surface requires more prep than expected',
    probability: 40,
    impactHours: 4,
    likelyTiming: 'early',
    earlyWarningSignals: ['Age of property', 'Previous work quality unknown', 'No site visit done'],
    monitoringRequired: false,
    preventable: true,
    preventionActions: ['Conduct thorough site survey', 'Build prep buffer into estimate'],
    preventionCost: 50,
  },
  {
    id: 'customer-availability',
    category: 'customer',
    name: 'Customer Availability Issues',
    description: 'Customer not available for access or decisions',
    probability: 25,
    impactHours: 4,
    likelyTiming: 'any',
    earlyWarningSignals: ['Slow response to messages', 'Busy work schedule mentioned'],
    monitoringRequired: false,
    preventable: true,
    preventionActions: ['Confirm access arrangements in advance', 'Get key/code if possible'],
    preventionCost: 0,
  },
  {
    id: 'scope-creep',
    category: 'customer',
    name: 'Scope Creep',
    description: 'Customer requests additional work during job',
    probability: 45,
    impactHours: 6,
    likelyTiming: 'mid',
    earlyWarningSignals: ['Vague initial requirements', 'Customer mentioned "might also want..."'],
    monitoringRequired: false,
    preventable: true,
    preventionActions: ['Document scope clearly', 'Have change order process', 'Clarify what\'s included/excluded'],
    preventionCost: 0,
  },
  {
    id: 'permit-delay',
    category: 'permit',
    name: 'Permit Approval Delay',
    description: 'Required permits taking longer than expected',
    probability: 30,
    impactHours: 40,
    likelyTiming: 'before-start',
    earlyWarningSignals: ['Complex permit requirements', 'Council backlog reported'],
    monitoringRequired: true,
    preventable: false,
    preventionActions: ['Submit permits early', 'Follow up regularly', 'Have backup projects ready'],
  },
  {
    id: 'equipment-failure',
    category: 'resource',
    name: 'Equipment Failure',
    description: 'Tools or equipment breaking down',
    probability: 15,
    impactHours: 4,
    likelyTiming: 'any',
    earlyWarningSignals: ['Equipment age', 'Recent issues', 'High usage'],
    monitoringRequired: false,
    preventable: true,
    preventionActions: ['Regular equipment maintenance', 'Have backup tools', 'Check equipment before job'],
    preventionCost: 100,
  },
  {
    id: 'access-issues',
    category: 'external',
    name: 'Site Access Issues',
    description: 'Problems accessing the work site',
    probability: 20,
    impactHours: 2,
    likelyTiming: 'early',
    earlyWarningSignals: ['Shared building access', 'Parking restrictions', 'Security requirements'],
    monitoringRequired: false,
    preventable: true,
    preventionActions: ['Confirm access arrangements', 'Get parking permit', 'Arrange key handover'],
    preventionCost: 0,
  },
];

// ============================================
// MOCK SCHEDULED JOBS
// ============================================

const MOCK_SCHEDULED_JOBS: ScheduledJobSummary[] = [
  {
    jobId: 'job-001',
    jobTitle: 'Living Room Repaint',
    customerName: 'Jan de Vries',
    scheduledStart: '2024-02-06T09:00:00',
    scheduledEnd: '2024-02-06T17:00:00',
    estimatedHours: 8,
    address: 'Keizersgracht 123, Amsterdam',
    priority: 'normal',
    status: 'scheduled',
  },
  {
    jobId: 'job-002',
    jobTitle: 'Kitchen Cabinet Repair',
    customerName: 'Maria Bakker',
    scheduledStart: '2024-02-07T10:00:00',
    scheduledEnd: '2024-02-07T14:00:00',
    estimatedHours: 4,
    address: 'Prinsengracht 456, Amsterdam',
    priority: 'high',
    status: 'scheduled',
  },
  {
    jobId: 'job-003',
    jobTitle: 'Full Apartment Renovation',
    customerName: 'Property Management BV',
    scheduledStart: '2024-02-08T08:00:00',
    scheduledEnd: '2024-02-12T17:00:00',
    estimatedHours: 40,
    address: 'Herengracht 789, Amsterdam',
    priority: 'normal',
    status: 'scheduled',
    riskFactors: ['Large scope', 'Multiple trades coordination'],
  },
  {
    jobId: 'job-004',
    jobTitle: 'Emergency Leak Repair',
    customerName: 'Sophie van Dam',
    scheduledStart: '2024-02-13T08:00:00',
    scheduledEnd: '2024-02-13T12:00:00',
    estimatedHours: 4,
    address: 'Vijzelstraat 234, Amsterdam',
    priority: 'emergency',
    status: 'at-risk',
    riskFactors: ['Parts availability unknown'],
  },
];

// ============================================
// SERVICE IMPLEMENTATION
// ============================================

type CapacityListener = () => void;

class CapacityPlanningService {
  private static instance: CapacityPlanningService;
  private listeners: Set<CapacityListener> = new Set();

  private config: CapacityPlanningConfig = DEFAULT_CONFIG;
  // R30: was seeded with MOCK_SCHEDULED_JOBS — every contractor's capacity
  // forecast / cascading-delay generator showed fake jobs. Now starts empty;
  // real jobs flow in via setScheduledJobs() from the screen layer when
  // capacity-planning UI surfaces. Test setups call __seedMockData.
  private scheduledJobs: ScheduledJobSummary[] = [];
  private alerts: CapacityAlert[] = [];
  private jobOutcomes: JobOutcome[] = [];

  // Caches
  private capacityCache: Map<string, CapacitySlot[]> = new Map();
  private durationCache: Map<string, DurationEstimate> = new Map();

  private constructor() {
    // R30: dropped generateInitialAlerts() seed call — was injecting 3 fake
    // alerts ("Kitchen Cabinet Repair behind", "Rain expected Feb 8-9",
    // "Schedule Opening Feb 14") into every contractor's capacity-alert
    // pipeline regardless of their real schedule. Real alerts now flow
    // from analyzeCapacity() at runtime against real job data.
    // Test setups can re-seed via __seedMockData().
  }

  static getInstance(): CapacityPlanningService {
    if (!CapacityPlanningService.instance) {
      CapacityPlanningService.instance = new CapacityPlanningService();
    }
    return CapacityPlanningService.instance;
  }

  /** @internal Test-only mock seeder. */
  __seedMockData(): void {
    this.scheduledJobs = [...MOCK_SCHEDULED_JOBS];
    this.generateInitialAlerts();
    this.notify();
  }

  subscribe(listener: CapacityListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  // ==========================================
  // CAPACITY & AVAILABILITY
  // ==========================================

  getCapacityForecast(startDate: string, days: number = 14): CapacitySlot[] {
    const cacheKey = `${startDate}-${days}`;
    if (this.capacityCache.has(cacheKey)) {
      return this.capacityCache.get(cacheKey)!;
    }

    const slots: CapacitySlot[] = [];
    const start = new Date(startDate);

    for (let i = 0; i < days; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);

      const slot = this.calculateDayCapacity(date);
      slots.push(slot);
    }

    this.capacityCache.set(cacheKey, slots);
    return slots;
  }

  private calculateDayCapacity(date: Date): CapacitySlot {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
    const dayNum = date.getDay() === 0 ? 7 : date.getDay(); // Convert to 1-7 (Mon-Sun)

    // Check if working day
    const isWorkingDay = this.config.workingDays.includes(dayNum);
    const totalHours = isWorkingDay ? this.config.defaultWorkdayHours : 0;

    // Get jobs for this day
    const dayJobs = this.scheduledJobs.filter((job) => {
      const jobDate = new Date(job.scheduledStart).toISOString().split('T')[0];
      return jobDate === dateStr;
    });

    const bookedHours = dayJobs.reduce((sum, job) => sum + job.estimatedHours, 0);
    const availableHours = Math.max(0, totalHours - bookedHours);
    const utilization = totalHours > 0 ? (bookedHours / totalHours) * 100 : 0;

    // Determine status
    let status: CapacitySlot['status'];
    if (!isWorkingDay) {
      status = 'unavailable';
    } else if (utilization >= 100) {
      status = 'busy';
    } else if (utilization >= 50) {
      status = 'partial';
    } else {
      status = 'available';
    }

    // Get weather risk
    const weather = this.getWeatherForecast(date);
    const weatherRisk = this.calculateWeatherRisk(weather);

    // Get blockers
    const blockers = this.getBlockersForDay(date);

    return {
      date: dateStr,
      dayOfWeek,
      totalHours,
      bookedHours,
      availableHours,
      status,
      utilization: Math.round(utilization),
      jobs: dayJobs,
      blockers,
      weatherRisk,
      weatherForecast: weather,
    };
  }

  private getWeatherForecast(date: Date): WeatherForecast {
    // R20: read from canonical weatherService (Open-Meteo, prefetched on
    // app open per R18) for today/tomorrow. Far-future dates fall through
    // to the deterministic seasonal mock (kept for forecast-horizon UX —
    // Open-Meteo only gives 3 days, capacity planning often runs 7-14d).
    const real = getLastFetchedForecast();
    if (real) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const target = new Date(date); target.setHours(0, 0, 0, 0);
      const dayDiff = Math.round((target.getTime() - today.getTime()) / 86400000);
      let day: DayForecast | null = null;
      if (dayDiff === 0) day = real.today;
      else if (dayDiff === 1) day = real.tomorrow;
      if (day) {
        const condition: WeatherForecast['condition'] = day.precipitationMm > 10
          ? 'heavy-rain'
          : day.precipitationMm > 5 ? 'rain'
            : day.precipitationMm > 1 ? 'cloudy' : 'clear';
        const suitable = day.precipitationMm <= 5 && day.tempMax >= 2;
        return {
          condition,
          temperature: Math.round(day.tempMax),
          precipitation: Math.round(day.precipitationMm),
          windSpeed: 15,
          suitableForOutdoor: suitable,
        };
      }
    }
    // Fallback for far-future dates (real forecast horizon is 3 days)
    const dayOfYear = Math.floor(
      (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
    );
    const randomSeed = dayOfYear % 7;

    const forecasts: WeatherForecast[] = [
      { condition: 'clear', temperature: 12, precipitation: 0, windSpeed: 10, suitableForOutdoor: true },
      { condition: 'cloudy', temperature: 10, precipitation: 0, windSpeed: 15, suitableForOutdoor: true },
      { condition: 'rain', temperature: 8, precipitation: 8, windSpeed: 20, suitableForOutdoor: false },
      { condition: 'cloudy', temperature: 11, precipitation: 2, windSpeed: 12, suitableForOutdoor: true },
      { condition: 'clear', temperature: 14, precipitation: 0, windSpeed: 8, suitableForOutdoor: true },
      { condition: 'heavy-rain', temperature: 7, precipitation: 15, windSpeed: 30, suitableForOutdoor: false },
      { condition: 'wind', temperature: 9, precipitation: 1, windSpeed: 45, suitableForOutdoor: false },
    ];

    return forecasts[randomSeed];
  }

  private calculateWeatherRisk(weather: WeatherForecast): CapacitySlot['weatherRisk'] {
    if (weather.precipitation > 10 || weather.windSpeed > 40) return 'high';
    if (weather.precipitation > 5 || weather.windSpeed > 30) return 'moderate';
    if (weather.precipitation > 0 || weather.windSpeed > 20) return 'low';
    return 'none';
  }

  private getBlockersForDay(_date: Date): CapacityBlocker[] {
    // In reality, would fetch from calendar/schedule
    return [];
  }

  // ==========================================
  // AVAILABILITY WINDOWS
  // ==========================================

  getNextAvailabilityWindows(
    requiredHours: number,
    jobType: string,
    isOutdoor: boolean = false,
    lookAheadDays: number = 30
  ): AvailabilityWindow[] {
    const today = new Date();
    const capacity = this.getCapacityForecast(today.toISOString().split('T')[0], lookAheadDays);

    const windows: AvailabilityWindow[] = [];
    let windowStart: CapacitySlot | null = null;
    let windowHours = 0;
    let windowDays: CapacitySlot[] = [];

    for (const slot of capacity) {
      // Skip if outdoor and weather is bad
      if (isOutdoor && (slot.weatherRisk === 'high' || slot.weatherRisk === 'moderate')) {
        // Close current window if open
        if (windowStart && windowHours >= requiredHours) {
          windows.push(this.createWindow(windowStart, windowDays, windowHours, requiredHours, jobType));
        }
        windowStart = null;
        windowHours = 0;
        windowDays = [];
        continue;
      }

      // Skip unavailable days
      if (slot.status === 'unavailable' || slot.status === 'busy') {
        if (windowStart && windowHours >= requiredHours) {
          windows.push(this.createWindow(windowStart, windowDays, windowHours, requiredHours, jobType));
        }
        windowStart = null;
        windowHours = 0;
        windowDays = [];
        continue;
      }

      // Start or extend window
      if (!windowStart) {
        windowStart = slot;
      }
      windowHours += slot.availableHours;
      windowDays.push(slot);

      // Check if we have enough hours
      if (windowHours >= requiredHours && !windows.some((w) => w.startDate === windowStart!.date)) {
        windows.push(this.createWindow(windowStart, windowDays, windowHours, requiredHours, jobType));
      }
    }

    // Close final window
    if (windowStart && windowHours >= requiredHours) {
      if (!windows.some((w) => w.startDate === windowStart!.date)) {
        windows.push(this.createWindow(windowStart, windowDays, windowHours, requiredHours, jobType));
      }
    }

    return windows.slice(0, 5); // Return top 5 windows
  }

  private createWindow(
    start: CapacitySlot,
    days: CapacitySlot[],
    totalHours: number,
    requiredHours: number,
    jobType: string
  ): AvailabilityWindow {
    const endDay = days[days.length - 1];

    // Calculate confidence based on various factors
    let confidence = 85;
    if (days.some((d) => d.weatherRisk !== 'none')) confidence -= 10;
    if (days.some((d) => d.jobs.some((j) => j.status === 'at-risk'))) confidence -= 15;
    if (totalHours < requiredHours * 1.2) confidence -= 10; // Tight fit

    // Get constraints
    const constraints = this.getWindowConstraints(days);

    // Check job type suitability
    const suitability = this.checkJobTypeSuitability(days, jobType);

    // Format display text
    const startDate = new Date(start.date);
    const endDate = new Date(endDay.date);
    const displayText =
      startDate.getTime() === endDate.getTime()
        ? `Available: ${startDate.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })}`
        : `Available: ${startDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}`;

    return {
      startDate: start.date,
      endDate: endDay.date,
      totalAvailableHours: totalHours,
      displayText,
      confidence: Math.max(30, confidence),
      constraints,
      suitableFor: suitability,
    };
  }

  private getWindowConstraints(days: CapacitySlot[]): AvailabilityWindow['constraints'] {
    const constraints: AvailabilityWindow['constraints'] = [];

    // Weather constraints
    const badWeatherDays = days.filter((d) => d.weatherRisk === 'moderate' || d.weatherRisk === 'high');
    if (badWeatherDays.length > 0) {
      constraints.push({
        type: 'weather',
        description: `${badWeatherDays.length} day(s) with weather risk`,
        severity: 'warning',
      });
    }

    // Existing job constraints
    const daysWithJobs = days.filter((d) => d.jobs.length > 0);
    if (daysWithJobs.length > 0) {
      constraints.push({
        type: 'existing-job',
        description: `${daysWithJobs.length} day(s) have other jobs scheduled`,
        severity: 'info',
      });
    }

    return constraints;
  }

  private checkJobTypeSuitability(
    days: CapacitySlot[],
    jobType: string
  ): AvailabilityWindow['suitableFor'] {
    const suitability: AvailabilityWindow['suitableFor'] = [];

    // Check for outdoor work suitability
    const goodWeatherDays = days.filter((d) => d.weatherRisk === 'none' || d.weatherRisk === 'low');
    const outdoorSuitability =
      goodWeatherDays.length >= days.length * 0.8 ? 'ideal' : goodWeatherDays.length >= days.length * 0.5 ? 'suitable' : 'not-recommended';

    suitability.push({
      jobType: 'exterior-painting',
      suitability: outdoorSuitability,
      reason:
        outdoorSuitability === 'ideal'
          ? 'Good weather forecast'
          : outdoorSuitability === 'suitable'
            ? 'Some weather risk'
            : 'Poor weather expected',
    });

    // Indoor work is usually suitable
    suitability.push({
      jobType: 'interior-painting',
      suitability: 'ideal',
      reason: 'Indoor work unaffected by weather',
    });

    suitability.push({
      jobType: jobType,
      suitability: 'suitable',
      reason: 'Sufficient time available',
    });

    return suitability;
  }

  // ==========================================
  // DURATION ESTIMATION
  // ==========================================

  estimateDuration(jobType: string, scope: JobScope): DurationEstimate {
    const cacheKey = `${jobType}-${scope.size}-${scope.complexity}`;
    if (this.durationCache.has(cacheKey)) {
      return this.durationCache.get(cacheKey)!;
    }

    // Get base duration
    const baseDurations = BASE_DURATIONS[jobType] || BASE_DURATIONS['general-maintenance'];
    let baseHours = baseDurations[scope.size] || baseDurations.medium;

    // Apply complexity multiplier
    const complexityMultiplier =
      scope.complexity === 'simple' ? 0.8 : scope.complexity === 'complex' ? 1.4 : 1.0;
    baseHours *= complexityMultiplier;

    // Apply outdoor factor (weather buffer)
    if (scope.isOutdoor) {
      baseHours *= 1.15; // 15% weather buffer
    }

    // Calculate breakdown
    const breakdown: DurationBreakdown = {
      preparation: Math.round(baseHours * 0.15 * 10) / 10,
      travelTime: 1, // 1 hour default
      coreWork: Math.round(baseHours * 0.7 * 10) / 10,
      cleanup: Math.round(baseHours * 0.1 * 10) / 10,
      buffer: Math.round(baseHours * (this.config.defaultBufferPercent / 100) * 10) / 10,
    };

    // Total with buffer
    const estimatedHours =
      breakdown.preparation + breakdown.travelTime + breakdown.coreWork + breakdown.cleanup + breakdown.buffer;

    // Calculate range
    const rangeMin = Math.round(estimatedHours * 0.85 * 10) / 10;
    const rangeMax = Math.round(estimatedHours * 1.3 * 10) / 10;

    // Get risk factors
    const riskFactors = this.getDurationRiskFactors(jobType, scope);

    // Get historical comparison
    const historical = HISTORICAL_JOB_DATA[jobType];

    // Calculate confidence
    let confidence = 75;
    if (historical && historical.similarJobsCount >= this.config.minHistoricalJobs) {
      confidence = Math.min(95, historical.accuracyRate);
    }
    if (scope.isOutdoor) confidence -= 10;
    if (scope.complexity === 'complex') confidence -= 10;
    if (scope.requiresPermit) confidence -= 5;

    // Generate reasoning
    const reasoning = this.generateDurationReasoning(jobType, scope, estimatedHours, historical);

    const estimate: DurationEstimate = {
      jobType,
      scope,
      estimatedHours: Math.round(estimatedHours * 10) / 10,
      rangeMin,
      rangeMax,
      confidence: Math.max(40, confidence),
      breakdown,
      riskFactors,
      historicalComparison: historical,
      reasoning,
    };

    this.durationCache.set(cacheKey, estimate);
    return estimate;
  }

  private getDurationRiskFactors(jobType: string, scope: JobScope): DurationRiskFactor[] {
    const factors: DurationRiskFactor[] = [];

    // Surface condition risk
    factors.push({
      factor: 'Surface condition worse than expected',
      impact: 'moderate',
      probability: 40,
      additionalHours: 3,
      mitigation: 'Conduct thorough site survey before starting',
    });

    // Scope creep risk
    factors.push({
      factor: 'Customer requests changes mid-job',
      impact: 'moderate',
      probability: 45,
      additionalHours: 4,
      mitigation: 'Document scope clearly and have change order process',
    });

    // Weather risk for outdoor
    if (scope.isOutdoor) {
      factors.push({
        factor: 'Weather delays',
        impact: 'significant',
        probability: 35,
        additionalHours: 8,
        mitigation: 'Monitor forecast and have indoor backup work',
      });
    }

    // Material risk for complex jobs
    if (scope.complexity === 'complex' || scope.materialLeadTime) {
      factors.push({
        factor: 'Material delivery delays',
        impact: 'significant',
        probability: 20,
        additionalHours: 16,
        mitigation: 'Order materials early and confirm delivery dates',
      });
    }

    // Permit risk
    if (scope.requiresPermit) {
      factors.push({
        factor: 'Permit approval delayed',
        impact: 'significant',
        probability: 30,
        additionalHours: 40,
        mitigation: 'Submit permits early and follow up regularly',
      });
    }

    return factors;
  }

  private generateDurationReasoning(
    jobType: string,
    scope: JobScope,
    hours: number,
    historical?: HistoricalComparison
  ): string {
    let reasoning = `Estimated ${hours} hours for ${scope.size} ${jobType.replace('-', ' ')} with ${scope.complexity} complexity.`;

    if (historical && historical.similarJobsCount >= 5) {
      reasoning += ` Based on ${historical.similarJobsCount} similar completed jobs (avg actual: ${historical.avgActualDuration}h, ${historical.accuracyRate}% on-time rate).`;
    }

    if (scope.isOutdoor) {
      reasoning += ' Includes 15% weather buffer for outdoor work.';
    }

    if (scope.requiresPermit) {
      reasoning += ' Note: Permit timeline not included in estimate.';
    }

    return reasoning;
  }

  // ==========================================
  // OVERRUN PREDICTION
  // ==========================================

  predictOverrun(
    jobId: string,
    hoursSpent: number,
    hoursEstimated: number,
    percentComplete: number,
    daysElapsed: number
  ): OverrunPrediction {
    // Calculate progress status
    const hoursRemaining = hoursEstimated - hoursSpent;
    const burnRate = daysElapsed > 0 ? hoursSpent / daysElapsed : 0;
    const daysRemaining = burnRate > 0 ? hoursRemaining / burnRate : 0;

    const projectedCompletion = new Date();
    projectedCompletion.setDate(projectedCompletion.getDate() + Math.ceil(daysRemaining));

    const originalCompletion = new Date();
    originalCompletion.setDate(
      originalCompletion.getDate() + Math.ceil((hoursEstimated - hoursSpent) / (hoursEstimated / 5))
    ); // Assume 5 day original

    // Calculate expected progress based on time spent
    const expectedProgress = (hoursSpent / hoursEstimated) * 100;
    const progressGap = expectedProgress - percentComplete;

    // Determine if at risk
    const isAtRisk = progressGap > 15 || (hoursSpent > hoursEstimated * 0.5 && percentComplete < 40);

    // Calculate overrun probability
    let overrunProbability = 0;
    if (progressGap > 30) overrunProbability = 85;
    else if (progressGap > 20) overrunProbability = 70;
    else if (progressGap > 10) overrunProbability = 50;
    else if (progressGap > 5) overrunProbability = 30;
    else overrunProbability = 15;

    // Predict overrun hours
    const projectedTotal = percentComplete > 0 ? hoursSpent / (percentComplete / 100) : hoursEstimated;
    const predictedOverrunHours = Math.max(0, projectedTotal - hoursEstimated);

    // Identify indicators
    const indicators = this.identifyOverrunIndicators(progressGap, hoursSpent, hoursEstimated, percentComplete);

    // Calculate impact
    const impact = this.calculateOverrunImpact(predictedOverrunHours, jobId);

    // Generate recommendations
    const recommendations = this.generateOverrunMitigations(predictedOverrunHours, indicators);

    const status: JobProgressStatus = {
      percentComplete,
      hoursSpent,
      hoursEstimated,
      hoursRemaining: Math.max(0, hoursRemaining),
      burnRate: Math.round(burnRate * 10) / 10,
      projectedCompletion: projectedCompletion.toISOString(),
      originalCompletion: originalCompletion.toISOString(),
      behindSchedule: isAtRisk,
      daysBehind: Math.max(0, Math.ceil(predictedOverrunHours / 8)),
    };

    return {
      jobId,
      currentStatus: status,
      isAtRisk,
      overrunProbability,
      predictedOverrunHours: Math.round(predictedOverrunHours * 10) / 10,
      indicators,
      impact,
      recommendations,
    };
  }

  private identifyOverrunIndicators(
    progressGap: number,
    hoursSpent: number,
    hoursEstimated: number,
    percentComplete: number
  ): OverrunIndicator[] {
    const indicators: OverrunIndicator[] = [];

    // Pace indicator
    if (progressGap > 10) {
      indicators.push({
        type: 'pace',
        severity: progressGap > 25 ? 'high' : progressGap > 15 ? 'medium' : 'low',
        description: `Work pace is ${Math.round(progressGap)}% behind expected progress`,
        detectedAt: new Date().toISOString(),
        trend: 'worsening',
      });
    }

    // Check for potential scope creep (high hours but low progress)
    if (hoursSpent > hoursEstimated * 0.4 && percentComplete < 30) {
      indicators.push({
        type: 'scope-creep',
        severity: 'medium',
        description: 'Progress suggests job may be larger than initially scoped',
        detectedAt: new Date().toISOString(),
        trend: 'stable',
      });
    }

    // Complexity indicator
    if (hoursSpent > hoursEstimated * 0.5 && percentComplete < 35) {
      indicators.push({
        type: 'complexity',
        severity: 'medium',
        description: 'Job complexity may be higher than estimated',
        detectedAt: new Date().toISOString(),
        trend: 'stable',
      });
    }

    return indicators;
  }

  private calculateOverrunImpact(overrunHours: number, jobId: string): OverrunPrediction['impact'] {
    const delayDays = Math.ceil(overrunHours / 8);
    const laborCostPerHour = 45; // GBP

    // Check if this affects next job
    const jobIndex = this.scheduledJobs.findIndex((j) => j.jobId === jobId);
    const nextJob = jobIndex >= 0 && jobIndex < this.scheduledJobs.length - 1 ? this.scheduledJobs[jobIndex + 1] : null;

    return {
      delayDays,
      affectsNextJob: nextJob !== null && delayDays > 0,
      nextJobId: nextJob?.jobId,
      additionalLaborCost: Math.round(overrunHours * laborCostPerHour),
      additionalMaterialCost: 0,
      penaltyCost: delayDays > 2 ? 200 : 0, // Example penalty
      totalCostImpact: Math.round(overrunHours * laborCostPerHour) + (delayDays > 2 ? 200 : 0),
      customerSatisfactionRisk: delayDays > 3 ? 'high' : delayDays > 1 ? 'medium' : 'low',
      requiresCustomerNotification: delayDays > 1,
    };
  }

  private generateOverrunMitigations(overrunHours: number, _indicators: OverrunIndicator[]): OverrunMitigation[] {
    const mitigations: OverrunMitigation[] = [];

    if (overrunHours > 8) {
      mitigations.push({
        action: 'Add additional resource',
        priority: 'immediate',
        expectedRecovery: Math.min(overrunHours * 0.5, 8),
        cost: 400,
        feasibility: 'medium',
        steps: [
          'Identify available skilled helper',
          'Coordinate task division',
          'Ensure tools and materials for two workers',
        ],
      });
    }

    if (overrunHours > 4) {
      mitigations.push({
        action: 'Extend working hours',
        priority: 'soon',
        expectedRecovery: Math.min(overrunHours * 0.3, 4),
        cost: 150,
        feasibility: 'high',
        steps: [
          'Confirm customer availability for extended hours',
          'Plan overtime work',
          'Ensure adequate lighting if needed',
        ],
      });
    }

    mitigations.push({
      action: 'Notify customer and adjust timeline',
      priority: overrunHours > 8 ? 'immediate' : 'soon',
      expectedRecovery: 0,
      cost: 0,
      feasibility: 'high',
      steps: [
        'Call customer to explain situation',
        'Provide new realistic completion date',
        'Offer goodwill gesture if significant delay',
      ],
    });

    return mitigations;
  }

  // ==========================================
  // DELAY ANALYSIS
  // ==========================================

  analyzeDelayRisks(jobType: string, scope: JobScope, startDate: string): DelayAnalysis {
    // Filter relevant delay factors
    const relevantFactors = COMMON_DELAY_FACTORS.filter((factor) => {
      // Weather only relevant for outdoor
      if (factor.category === 'weather' && !scope.isOutdoor) return false;
      // Permit only if requires permit
      if (factor.category === 'permit' && !scope.requiresPermit) return false;
      return true;
    });

    // Adjust probabilities based on job specifics
    const adjustedFactors = relevantFactors.map((factor) => ({
      ...factor,
      probability: this.adjustDelayProbability(factor, scope),
    }));

    // Group by category
    const factorsByCategory: Record<string, DelayFactor[]> = {};
    adjustedFactors.forEach((factor) => {
      if (!factorsByCategory[factor.category]) {
        factorsByCategory[factor.category] = [];
      }
      factorsByCategory[factor.category].push(factor);
    });

    // Identify top risks
    const topRisks = [...adjustedFactors].sort((a, b) => b.probability * b.impactHours - a.probability * a.impactHours).slice(0, 5);

    // Calculate overall risk
    const weightedRisk = topRisks.reduce((sum, f) => sum + f.probability * f.impactHours, 0) / 100;
    const overallDelayRisk: DelayAnalysis['overallDelayRisk'] =
      weightedRisk > 20 ? 'critical' : weightedRisk > 10 ? 'high' : weightedRisk > 5 ? 'moderate' : 'low';

    // Calculate delays
    const mostLikelyDelay = topRisks.filter((f) => f.probability > 50).reduce((sum, f) => sum + f.impactHours * 0.5, 0);
    const worstCaseDelay = adjustedFactors.reduce((sum, f) => sum + f.impactHours, 0);

    // Generate proactive actions
    const proactiveActions = this.generateProactiveActions(topRisks);

    return {
      jobId: '', // Will be set when associated with actual job
      overallDelayRisk,
      mostLikelyDelay: Math.round(mostLikelyDelay),
      worstCaseDelay,
      factorsByCategory,
      topRisks,
      proactiveActions,
    };
  }

  private adjustDelayProbability(factor: DelayFactor, scope: JobScope): number {
    let probability = factor.probability;

    // Adjust based on complexity
    if (scope.complexity === 'complex' && factor.category === 'technical') {
      probability *= 1.3;
    }

    // Adjust for outdoor work
    if (scope.isOutdoor && factor.category === 'weather') {
      probability *= 1.2;
    }

    // Cap at 95
    return Math.min(95, Math.round(probability));
  }

  private generateProactiveActions(topRisks: DelayFactor[]): ProactiveAction[] {
    const actions: ProactiveAction[] = [];

    topRisks.forEach((risk) => {
      if (risk.preventable && risk.preventionActions) {
        actions.push({
          action: risk.preventionActions[0],
          targetFactor: risk.name,
          timing: risk.likelyTiming === 'before-start' ? 'before-start' : 'now',
          effort: risk.preventionCost && risk.preventionCost > 100 ? 'moderate' : 'minimal',
          effectiveness: 70,
          description: `Reduces ${risk.name.toLowerCase()} risk by ~70%`,
        });
      }
    });

    return actions.slice(0, 5);
  }

  // ==========================================
  // CUSTOMER QUOTE RESPONSE
  // ==========================================

  generateCustomerQuoteResponse(
    jobType: string,
    scope: JobScope,
    preferredStartDate?: string
  ): CustomerQuoteResponse {
    // Get duration estimate
    const duration = this.estimateDuration(jobType, scope);

    // Get availability windows
    const windows = this.getNextAvailabilityWindows(duration.estimatedHours, jobType, scope.isOutdoor);

    // Get delay analysis
    const delays = this.analyzeDelayRisks(jobType, scope, windows[0]?.startDate || new Date().toISOString());

    // Determine earliest and recommended start
    const earliestStart = windows[0]?.startDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Find recommended window (best weather, confidence)
    const recommendedWindow = windows.find((w) => w.confidence >= 80) || windows[0];
    const recommendedStart = recommendedWindow?.startDate || earliestStart;

    // Calculate completion dates
    const durationDays = Math.ceil(duration.estimatedHours / 8);
    const completionDate = new Date(recommendedStart);
    completionDate.setDate(completionDate.getDate() + durationDays);

    // Format duration string
    const durationStr =
      duration.rangeMin === duration.rangeMax
        ? `${Math.ceil(duration.rangeMin / 8)} days`
        : `${Math.ceil(duration.rangeMin / 8)}-${Math.ceil(duration.rangeMax / 8)} days`;

    // Prepare risk communications
    const knownRisks = delays.topRisks.slice(0, 3).map((risk) => ({
      risk: risk.name,
      likelihood: (risk.probability > 50 ? 'likely' : risk.probability > 25 ? 'possible' : 'unlikely') as 'unlikely' | 'possible' | 'likely',
      customerMessage: `${risk.name} could add ${Math.ceil(risk.impactHours / 8)} day(s) to the timeline`,
      contingencyBuiltIn: true,
    }));

    // Determine confidence level
    const confidenceLevel: CustomerQuoteResponse['confidenceLevel'] =
      duration.confidence >= 80 ? 'high' : duration.confidence >= 60 ? 'medium' : 'low';

    const confidenceExplanation =
      confidenceLevel === 'high'
        ? `Based on ${duration.historicalComparison?.similarJobsCount || 'many'} similar completed jobs`
        : confidenceLevel === 'medium'
          ? 'Estimate based on typical job patterns'
          : 'Complex job - timeline may vary';

    return {
      earliestStart,
      recommendedStart,
      estimatedDuration: durationStr,
      estimatedCompletion: completionDate.toISOString().split('T')[0],
      confidenceLevel,
      confidenceExplanation,
      knownRisks,
      rushAvailable: true,
      rushPremium: 25, // 25% rush fee
    };
  }

  // ==========================================
  // ALERTS
  // ==========================================

  getAlerts(status?: CapacityAlert['status']): CapacityAlert[] {
    if (status) {
      return this.alerts.filter((a) => a.status === status);
    }
    return this.alerts;
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledgedAt = new Date().toISOString();
      alert.status = 'acknowledged';
      this.notify();
    }
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.resolvedAt = new Date().toISOString();
      alert.status = 'resolved';
      this.notify();
    }
  }

  private generateInitialAlerts(): void {
    this.alerts = [
      {
        id: 'alert-001',
        type: 'job-at-risk',
        severity: 'warning',
        title: 'Job Running Behind',
        message: 'Kitchen Cabinet Repair (Maria Bakker) is 20% behind expected progress',
        jobId: 'job-002',
        suggestedActions: ['Review remaining scope', 'Consider extending hours', 'Update customer on timeline'],
        actionRequired: true,
        createdAt: new Date().toISOString(),
        status: 'active',
      },
      {
        id: 'alert-002',
        type: 'weather-impact',
        severity: 'info',
        title: 'Weather Alert',
        message: 'Rain expected Feb 8-9. Consider rescheduling outdoor work.',
        date: '2024-02-08',
        suggestedActions: ['Check scheduled outdoor jobs', 'Prepare indoor backup tasks'],
        actionRequired: false,
        createdAt: new Date().toISOString(),
        status: 'active',
      },
      {
        id: 'alert-003',
        type: 'availability-gap',
        severity: 'info',
        title: 'Schedule Opening',
        message: 'You have 6 hours available on Feb 14. Good time to schedule a small job.',
        date: '2024-02-14',
        suggestedActions: ['Review quote backlog', 'Follow up with pending customers'],
        actionRequired: false,
        createdAt: new Date().toISOString(),
        status: 'active',
      },
    ];
  }

  // ==========================================
  // LEARNING & FEEDBACK
  // ==========================================

  recordJobOutcome(outcome: JobOutcome): void {
    this.jobOutcomes.push(outcome);

    // Clear caches to incorporate new data
    this.durationCache.clear();

    this.notify();
  }

  getPredictionAccuracy(period: PredictionAccuracy['period'] = 'month'): PredictionAccuracy {
    // In reality, would calculate from actual job outcomes
    // For now, return mock data
    return {
      period,
      totalJobs: 24,
      onTimeCompletions: 18,
      onTimeRate: 75,
      avgEstimateError: 2.3,
      avgEstimateErrorPercent: 12,
      accuracyByJobType: {
        'interior-painting': 82,
        'exterior-painting': 65,
        'general-maintenance': 88,
      },
      mostCommonDelays: [
        { cause: 'Surface prep took longer', count: 8, avgHours: 3 },
        { cause: 'Weather delays', count: 5, avgHours: 8 },
        { cause: 'Customer change requests', count: 4, avgHours: 4 },
      ],
      trend: 'improving',
    };
  }

  // ==========================================
  // CONFIGURATION
  // ==========================================

  updateConfig(updates: Partial<CapacityPlanningConfig>): void {
    this.config = { ...this.config, ...updates };
    this.capacityCache.clear();
    this.durationCache.clear();
    this.notify();
  }

  getConfig(): CapacityPlanningConfig {
    return { ...this.config };
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const capacityPlanningService = CapacityPlanningService.getInstance();

// ============================================
// REACT HOOKS
// ============================================

export function useCapacityForecast(startDate?: string, days: number = 14) {
  const [data, setData] = useState<CapacitySlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const start = startDate || new Date().toISOString().split('T')[0];
    setData(capacityPlanningService.getCapacityForecast(start, days));
    setLoading(false);

    return capacityPlanningService.subscribe(() => {
      setData(capacityPlanningService.getCapacityForecast(start, days));
    });
  }, [startDate, days]);

  const refresh = useCallback(() => {
    const start = startDate || new Date().toISOString().split('T')[0];
    setData(capacityPlanningService.getCapacityForecast(start, days));
  }, [startDate, days]);

  return { data, loading, refresh };
}

export function useAvailabilityWindows(
  requiredHours: number,
  jobType: string,
  isOutdoor: boolean = false
) {
  const [data, setData] = useState<AvailabilityWindow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData(capacityPlanningService.getNextAvailabilityWindows(requiredHours, jobType, isOutdoor));
    setLoading(false);

    return capacityPlanningService.subscribe(() => {
      setData(capacityPlanningService.getNextAvailabilityWindows(requiredHours, jobType, isOutdoor));
    });
  }, [requiredHours, jobType, isOutdoor]);

  return { data, loading };
}

export function useDurationEstimate(jobType: string, scope: JobScope) {
  const [data, setData] = useState<DurationEstimate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData(capacityPlanningService.estimateDuration(jobType, scope));
    setLoading(false);
  }, [jobType, scope]);

  return { data, loading };
}

export function useOverrunPrediction(
  jobId: string,
  hoursSpent: number,
  hoursEstimated: number,
  percentComplete: number,
  daysElapsed: number
) {
  const [data, setData] = useState<OverrunPrediction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData(
      capacityPlanningService.predictOverrun(jobId, hoursSpent, hoursEstimated, percentComplete, daysElapsed)
    );
    setLoading(false);
  }, [jobId, hoursSpent, hoursEstimated, percentComplete, daysElapsed]);

  return { data, loading };
}

export function useDelayAnalysis(jobType: string, scope: JobScope, startDate: string) {
  const [data, setData] = useState<DelayAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData(capacityPlanningService.analyzeDelayRisks(jobType, scope, startDate));
    setLoading(false);
  }, [jobType, scope, startDate]);

  return { data, loading };
}

export function useCapacityAlerts(status?: CapacityAlert['status']) {
  const [data, setData] = useState<CapacityAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData(capacityPlanningService.getAlerts(status));
    setLoading(false);

    return capacityPlanningService.subscribe(() => {
      setData(capacityPlanningService.getAlerts(status));
    });
  }, [status]);

  const acknowledge = useCallback((alertId: string) => {
    capacityPlanningService.acknowledgeAlert(alertId);
  }, []);

  const resolve = useCallback((alertId: string) => {
    capacityPlanningService.resolveAlert(alertId);
  }, []);

  return { data, loading, acknowledge, resolve };
}

export function useCustomerQuoteResponse(
  jobType: string,
  scope: JobScope,
  preferredStartDate?: string
) {
  const [data, setData] = useState<CustomerQuoteResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData(capacityPlanningService.generateCustomerQuoteResponse(jobType, scope, preferredStartDate));
    setLoading(false);
  }, [jobType, scope, preferredStartDate]);

  return { data, loading };
}

export function usePredictionAccuracy(period: PredictionAccuracy['period'] = 'month') {
  const [data, setData] = useState<PredictionAccuracy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData(capacityPlanningService.getPredictionAccuracy(period));
    setLoading(false);

    return capacityPlanningService.subscribe(() => {
      setData(capacityPlanningService.getPredictionAccuracy(period));
    });
  }, [period]);

  return { data, loading };
}
