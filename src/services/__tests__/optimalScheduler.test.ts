/**
 * @jest-environment node
 */

import { optimizeSchedule, __internal } from '../optimalSchedulerService';

describe('haversine + postcode distance', () => {
  test('haversine — Amsterdam to Rotterdam ~57km', () => {
    const km = __internal.haversineKm({ lat: 52.37, lng: 4.90 }, { lat: 51.92, lng: 4.48 });
    expect(km).toBeGreaterThan(50);
    expect(km).toBeLessThan(70);
  });

  test('NL postcode prefix proximity — same 4-digit area = very close', () => {
    const km = __internal.postcodePrefixDistanceKm('1012AB', '1012CD', 'NL', 25);
    expect(km).toBeLessThan(5);
  });

  test('NL postcode — different cities (10xx vs 30xx) = unrelated', () => {
    const km = __internal.postcodePrefixDistanceKm('1012AB', '3012XY', 'NL', 25);
    expect(km).toBeGreaterThan(20);
  });

  test('DE postcode — same 5-digit (10115 vs 10115) = adjacent', () => {
    const km = __internal.postcodePrefixDistanceKm('10115', '10115', 'DE', 25);
    expect(km).toBeLessThan(2);
  });

  test('cross-country falls back to fallbackKm', () => {
    const km = __internal.distanceKm(
      { postcode: '1012', country: 'NL' },
      { postcode: '10115', country: 'DE' },
      99,
    );
    expect(km).toBe(99);
  });
});

describe('optimizeSchedule', () => {
  const date = '2026-04-28';
  const baseOpts = { date, startPostcode: '1012AB', startCountry: 'NL' as const };

  test('empty list → empty schedule', () => {
    const s = optimizeSchedule([], baseOpts);
    expect(s.stops).toHaveLength(0);
    expect(s.totalDriveKm).toBe(0);
  });

  test('single job → arrives + works + departs in order', () => {
    const s = optimizeSchedule([
      { id: 'j1', postcode: '1012CD', country: 'NL', estimatedHours: 2 },
    ], baseOpts);
    expect(s.stops).toHaveLength(1);
    expect(s.stops[0].arrivalAt > '08:00').toBe(true);
    expect(s.stops[0].departureAt > s.stops[0].arrivalAt).toBe(true);
  });

  test('greedy nearest-neighbor — picks nearer job first', () => {
    const s = optimizeSchedule([
      { id: 'far', postcode: '9999AB', country: 'NL', estimatedHours: 1 },
      { id: 'near', postcode: '1013ZZ', country: 'NL', estimatedHours: 1 },
    ], baseOpts);
    expect(s.stops[0].job.id).toBe('near');
    expect(s.stops[1].job.id).toBe('far');
  });

  test('priority weighting — urgent pulled forward', () => {
    const s = optimizeSchedule([
      { id: 'low-near', postcode: '1013ZZ', country: 'NL', estimatedHours: 1, priority: 'low' },
      { id: 'urgent-mid', postcode: '1100AA', country: 'NL', estimatedHours: 1, priority: 'urgent' },
    ], baseOpts);
    expect(s.stops[0].job.id).toBe('urgent-mid');
  });

  test('fixedTime job slots in at exact hour', () => {
    const s = optimizeSchedule([
      { id: 'flex', postcode: '1013AA', country: 'NL', estimatedHours: 1 },
      { id: 'fixed', postcode: '1014AA', country: 'NL', estimatedHours: 1, fixedTime: '11:00' },
    ], baseOpts);
    const fixedStop = s.stops.find((st) => st.job.id === 'fixed');
    expect(fixedStop?.arrivalAt).toBe('11:00');
  });

  test('warns when day ends past workday cutoff', () => {
    const s = optimizeSchedule([
      { id: 'a', postcode: '1013AA', country: 'NL', estimatedHours: 4 },
      { id: 'b', postcode: '1014AA', country: 'NL', estimatedHours: 4 },
      { id: 'c', postcode: '1015AA', country: 'NL', estimatedHours: 4 },
    ], baseOpts);
    expect(s.warnings.some((w) => w.includes('late'))).toBe(true);
  });

  test('uses lat/lng when available (haversine path)', () => {
    const s = optimizeSchedule([
      { id: 'with-coords', lat: 52.37, lng: 4.90, country: 'NL', estimatedHours: 1 },
    ], baseOpts);
    expect(s.stops).toHaveLength(1);
    expect(s.totalDriveKm).toBeGreaterThanOrEqual(0);
  });

  test('total drive time correlates with route length', () => {
    const s = optimizeSchedule([
      { id: 'a', postcode: '1013AA', country: 'NL', estimatedHours: 1 },
      { id: 'b', postcode: '1014AA', country: 'NL', estimatedHours: 1 },
    ], baseOpts);
    expect(s.totalDriveMin).toBeGreaterThan(0);
    expect(s.totalWorkMin).toBeGreaterThanOrEqual(120);
  });

  test('respects customer arrival window', () => {
    const s = optimizeSchedule([
      { id: 'window', postcode: '1013AA', country: 'NL', estimatedHours: 1, customerWindowStart: '14:00' },
    ], baseOpts);
    expect(s.stops[0].arrivalAt >= '14:00').toBe(true);
  });
});
