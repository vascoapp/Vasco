// =============================================================================
// OPTIMAL SCHEDULER (R253) — daily route + sequence optimization
// =============================================================================
// Greedy nearest-neighbor over EU jobs. Distance is haversine on lat/lng when
// available; otherwise postcode-prefix proximity (works for all 10 supported
// countries — NL/DE/FR/ES/IT/UK/SE/NO/DK/FI). No Google/Mapbox API needed.
//
// Inputs:
//   - jobs with address.postcode (and optional lat/lng + customer windows)
//   - contractor home postcode (start of day)
//   - working hours per country (default 08:00-17:00, configurable)
//   - priority weighting (high jobs get pulled forward against pure distance)
//
// Output:
//   - ordered job sequence
//   - estimated arrival/departure times per job
//   - total drive distance (km) + drive time (min)
//   - warnings (overflow past working hours, missed customer windows, etc.)
// =============================================================================

import type { CountryCode } from '../data/countries';

export interface SchedulableJob {
  id: string;
  title?: string;
  postcode?: string;
  country?: CountryCode;
  lat?: number;
  lng?: number;
  estimatedHours: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  customerWindowStart?: string;          // ISO time "08:00"
  customerWindowEnd?: string;             // ISO time "17:00"
  fixedTime?: string;                      // when this job MUST be at a specific hour
}

export interface ScheduledStop {
  job: SchedulableJob;
  arrivalAt: string;                       // ISO time
  departureAt: string;                     // ISO time
  driveMinFromPrev: number;
  driveKmFromPrev: number;
  warnings: string[];
}

export interface OptimizedSchedule {
  date: string;                            // YYYY-MM-DD
  startPostcode: string;
  startCountry: CountryCode;
  stops: ScheduledStop[];
  totalDriveKm: number;
  totalDriveMin: number;
  totalWorkMin: number;
  endsAt: string;
  warnings: string[];
}

interface OptimizeOptions {
  date: string;
  startPostcode: string;
  startCountry: CountryCode;
  workdayStart?: string;                  // default '08:00'
  workdayEnd?: string;                     // default '17:00'
  avgSpeedKmh?: number;                    // default 50 (urban + highway mix)
  postcodeDistanceFallbackKm?: number;     // when no lat/lng AND no shared prefix
}

// Priority weights: lower = pulls earlier in route. Calibrated so 'urgent'
// beats a 5x-closer 'low' job (which matches contractor intuition).
const PRIORITY_WEIGHT: Record<NonNullable<SchedulableJob['priority']>, number> = {
  urgent: 0.15, high: 0.5, normal: 1.0, low: 1.5,
};

// ---------------------------------------------------------------------------
// Distance — haversine when coords; postcode-prefix fallback otherwise
// ---------------------------------------------------------------------------

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * Postcode prefix proximity for the 10 EU countries we support.
 *
 *   NL: "1234 AB"  → first 4 digits, ~city level
 *   DE: 5 digits    → first 2 digits = region, first 3 = city
 *   FR: 5 digits    → first 2 = département
 *   ES: 5 digits    → first 2 = province
 *   IT: 5 digits    → first 2 = province
 *   UK: alphanumeric "SW1A 1AA" → outward code is the first 2-4 chars
 *   SE: "123 45"    → first digit = region (Norrland 8-9, etc.)
 *   NO: 4 digits    → first 2 = county-ish
 *   DK: 4 digits    → first digit = region
 *   FI: 5 digits    → first 2 = postal area
 */
function postcodePrefixDistanceKm(a: string, b: string, country: CountryCode, fallback: number): number {
  if (!a || !b) return fallback;
  const ap = a.replace(/\s/g, '').toUpperCase();
  const bp = b.replace(/\s/g, '').toUpperCase();
  if (ap === bp) return 0.5;

  // Country-specific "tight prefix" length — shared prefix at this depth
  // means same neighborhood; beyond, distance grows roughly linearly.
  const tightDepth: Record<CountryCode, number> = {
    NL: 4, DE: 3, FR: 3, ES: 3, IT: 3, UK: 4, SE: 3, NO: 3, DK: 3, FI: 3,
    // US ZIP-5: first 3 digits = sectional center. Per ZIP table, 3 is a
    // reasonable "tight" depth for neighborhood-level proximity heuristic.
    US: 3,
  };
  const depth = tightDepth[country] ?? 3;

  let shared = 0;
  for (let i = 0; i < Math.min(ap.length, bp.length); i += 1) {
    if (ap[i] === bp[i]) shared += 1;
    else break;
  }
  if (shared >= depth) return 2 + (depth - shared) * 1; // very close
  if (shared >= 2) return 8 + (depth - shared) * 5;     // same region/dept
  if (shared >= 1) return 35 + (depth - shared) * 15;    // same broad area
  return fallback;                                       // unrelated postcodes
}

function distanceKm(
  from: { lat?: number; lng?: number; postcode?: string; country: CountryCode },
  to: { lat?: number; lng?: number; postcode?: string; country: CountryCode },
  fallbackKm: number,
): number {
  if (typeof from.lat === 'number' && typeof from.lng === 'number'
      && typeof to.lat === 'number' && typeof to.lng === 'number') {
    return haversineKm({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng });
  }
  if (from.postcode && to.postcode && from.country === to.country) {
    return postcodePrefixDistanceKm(from.postcode, to.postcode, from.country, fallbackKm);
  }
  return fallbackKm;
}

// ---------------------------------------------------------------------------
// Time math
// ---------------------------------------------------------------------------

function parseHm(hm: string): { h: number; m: number } {
  const [h, m] = hm.split(':').map((s) => parseInt(s, 10));
  return { h: h || 0, m: m || 0 };
}

function addMinutes(date: string, hm: string, minutes: number): string {
  const { h, m } = parseHm(hm);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60);
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

function diffMinutes(start: string, end: string): number {
  const a = parseHm(start);
  const b = parseHm(end);
  return (b.h * 60 + b.m) - (a.h * 60 + a.m);
}

// ---------------------------------------------------------------------------
// Greedy nearest-neighbor with priority weighting + customer windows
// ---------------------------------------------------------------------------

export function optimizeSchedule(
  jobs: SchedulableJob[],
  options: OptimizeOptions,
): OptimizedSchedule {
  const workdayStart = options.workdayStart ?? '08:00';
  const workdayEnd = options.workdayEnd ?? '17:00';
  const avgSpeed = options.avgSpeedKmh ?? 50;
  const fallbackKm = options.postcodeDistanceFallbackKm ?? 25;
  const warnings: string[] = [];

  // Pin fixed-time jobs: they must start at exactly fixedTime
  const fixed = jobs.filter((j) => !!j.fixedTime).sort((a, b) => (a.fixedTime ?? '').localeCompare(b.fixedTime ?? ''));
  let flexible = jobs.filter((j) => !j.fixedTime);

  let current: { lat?: number; lng?: number; postcode?: string; country: CountryCode } = {
    postcode: options.startPostcode, country: options.startCountry,
  };
  let clock = workdayStart;
  const stops: ScheduledStop[] = [];
  let totalKm = 0;
  let totalDrive = 0;
  let totalWork = 0;

  // Process in order: insert fixed jobs at their target time, fill flexible
  // greedily between them.
  const fixedQueue = [...fixed];

  while (flexible.length > 0 || fixedQueue.length > 0) {
    // Check if the next fixed job is due
    const nextFixed = fixedQueue[0];
    const nextFixedTime = nextFixed?.fixedTime;

    // Pick best flexible candidate by (distance × priority weight, ascending)
    let bestIdx = -1;
    let bestScore = Infinity;
    for (let i = 0; i < flexible.length; i += 1) {
      const j = flexible[i];
      const km = distanceKm(current, { lat: j.lat, lng: j.lng, postcode: j.postcode, country: j.country ?? options.startCountry }, fallbackKm);
      const w = PRIORITY_WEIGHT[j.priority ?? 'normal'];
      const score = km * w;
      if (score < bestScore) { bestScore = score; bestIdx = i; }
    }
    const nextFlex = bestIdx >= 0 ? flexible[bestIdx] : null;

    // Decide which one comes next
    let pickFixed = false;
    if (nextFixed && nextFlex) {
      // If the fixed time is within reach before this flex finishes, take fixed
      const driveToFixedKm = distanceKm(current, { lat: nextFixed.lat, lng: nextFixed.lng, postcode: nextFixed.postcode, country: nextFixed.country ?? options.startCountry }, fallbackKm);
      const driveToFixedMin = Math.round((driveToFixedKm / avgSpeed) * 60);
      const earliestArrivalAtFixed = addMinutes(options.date, clock, driveToFixedMin);
      if (earliestArrivalAtFixed > (nextFixedTime ?? '99:99')) {
        warnings.push(`Late for fixed job ${nextFixed.id} at ${nextFixedTime} (best arrival ${earliestArrivalAtFixed})`);
      }
      pickFixed = (nextFixedTime ?? '00:00') <= addMinutes(options.date, clock, 90);
    } else if (nextFixed) {
      pickFixed = true;
    }

    const job = pickFixed ? nextFixed! : nextFlex;
    if (!job) break;

    // Drive
    const km = distanceKm(current, { lat: job.lat, lng: job.lng, postcode: job.postcode, country: job.country ?? options.startCountry }, fallbackKm);
    const driveMin = Math.max(1, Math.round((km / avgSpeed) * 60));

    // Wait if fixed-time job is in future
    let arrival = addMinutes(options.date, clock, driveMin);
    const stopWarnings: string[] = [];
    if (job.fixedTime && job.fixedTime > arrival) {
      arrival = job.fixedTime;
    } else if (job.fixedTime && job.fixedTime < arrival) {
      stopWarnings.push(`Arrived ${diffMinutes(job.fixedTime, arrival)}min late`);
    }
    if (job.customerWindowStart && arrival < job.customerWindowStart) {
      arrival = job.customerWindowStart;
    }
    if (job.customerWindowEnd && arrival > job.customerWindowEnd) {
      stopWarnings.push(`Outside customer window (${job.customerWindowStart}-${job.customerWindowEnd})`);
    }

    const workMin = Math.max(15, Math.round(job.estimatedHours * 60));
    const departure = addMinutes(options.date, arrival, workMin);

    if (departure > workdayEnd) {
      stopWarnings.push(`Finishes ${diffMinutes(workdayEnd, departure)}min past workday`);
    }

    stops.push({
      job, arrivalAt: arrival, departureAt: departure,
      driveMinFromPrev: driveMin, driveKmFromPrev: Math.round(km * 10) / 10,
      warnings: stopWarnings,
    });

    totalKm += km;
    totalDrive += driveMin;
    totalWork += workMin;
    clock = departure;
    current = { lat: job.lat, lng: job.lng, postcode: job.postcode, country: job.country ?? options.startCountry };

    if (pickFixed) fixedQueue.shift();
    else if (bestIdx >= 0) flexible.splice(bestIdx, 1);
  }

  if (clock > workdayEnd) {
    warnings.push(`Day ends ${diffMinutes(workdayEnd, clock)}min late — consider deferring lowest-priority jobs.`);
  }

  return {
    date: options.date,
    startPostcode: options.startPostcode,
    startCountry: options.startCountry,
    stops,
    totalDriveKm: Math.round(totalKm * 10) / 10,
    totalDriveMin: totalDrive,
    totalWorkMin: totalWork,
    endsAt: clock,
    warnings,
  };
}

export const __internal = {
  haversineKm,
  postcodePrefixDistanceKm,
  distanceKm,
};
