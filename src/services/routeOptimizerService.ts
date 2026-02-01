// =============================================================================
// ROUTE OPTIMIZER SERVICE
// =============================================================================
// Intelligent route optimization for daily job scheduling
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';

// =============================================================================
// TYPES
// =============================================================================

export interface RouteJob {
  id: string;
  customerName: string;
  address: string;
  city: string;
  coordinates: { lat: number; lng: number };
  scheduledTime: string;
  duration: number; // minutes
  jobType: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'en_route' | 'arrived' | 'completed';
  notes?: string;
}

export interface OptimizedRoute {
  id: string;
  date: Date;
  assignedTo: string;
  assignedToName: string;
  jobs: RouteJob[];
  totalDistance: number; // km
  totalDuration: number; // minutes
  estimatedFuelCost: number;
  startTime: string;
  endTime: string;
  savings: RouteSavings;
}

export interface RouteSavings {
  distanceSaved: number;
  timeSaved: number;
  fuelSaved: number;
  originalDistance: number;
  optimizedDistance: number;
}

export interface RouteStats {
  routesToday: number;
  totalJobsToday: number;
  avgDistancePerRoute: number;
  totalSavingsThisMonth: number;
  avgTimeSavedPerRoute: number;
  completionRate: number;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const mockRoutes: OptimizedRoute[] = [
  {
    id: 'route-1', date: new Date(), assignedTo: 'tm-1', assignedToName: 'Jan de Vries',
    jobs: [
      { id: 'rj-1', customerName: 'Familie de Groot', address: 'Hoofdstraat 45', city: 'Amsterdam', coordinates: { lat: 52.3676, lng: 4.9041 }, scheduledTime: '08:00', duration: 60, jobType: 'cv_maintenance', priority: 'normal', status: 'completed' },
      { id: 'rj-2', customerName: 'Bakkerij Jansen', address: 'Winkelstraat 12', city: 'Amsterdam', coordinates: { lat: 52.3702, lng: 4.8952 }, scheduledTime: '09:30', duration: 90, jobType: 'airco_service', priority: 'high', status: 'arrived' },
      { id: 'rj-3', customerName: 'Peter Smit', address: 'Kerkweg 78', city: 'Amsterdam', coordinates: { lat: 52.3589, lng: 4.9012 }, scheduledTime: '11:30', duration: 45, jobType: 'inspection', priority: 'normal', status: 'pending' },
      { id: 'rj-4', customerName: 'Linda de Boer', address: 'Parkstraat 23', city: 'Amsterdam', coordinates: { lat: 52.3645, lng: 4.8875 }, scheduledTime: '13:00', duration: 120, jobType: 'installation', priority: 'normal', status: 'pending' },
    ],
    totalDistance: 18.5, totalDuration: 375, estimatedFuelCost: 8.50, startTime: '08:00', endTime: '16:15',
    savings: { distanceSaved: 12.3, timeSaved: 35, fuelSaved: 5.60, originalDistance: 30.8, optimizedDistance: 18.5 },
  },
];

// =============================================================================
// SERVICE CLASS
// =============================================================================

type RouteListener = () => void;

class RouteOptimizerService {
  private static instance: RouteOptimizerService;
  private listeners: Set<RouteListener> = new Set();
  private routes: OptimizedRoute[] = [...mockRoutes];

  static getInstance(): RouteOptimizerService {
    if (!RouteOptimizerService.instance) {
      RouteOptimizerService.instance = new RouteOptimizerService();
    }
    return RouteOptimizerService.instance;
  }

  subscribe(listener: RouteListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void { this.listeners.forEach(l => l()); }

  getTodaysRoutes(): OptimizedRoute[] {
    const today = new Date().toDateString();
    return this.routes.filter(r => r.date.toDateString() === today);
  }

  getRoute(id: string): OptimizedRoute | undefined { return this.routes.find(r => r.id === id); }

  optimizeRoute(jobs: Omit<RouteJob, 'status'>[], assignedTo: string, assignedToName: string): OptimizedRoute {
    // Simulate optimization by sorting by coordinates (simple nearest-neighbor)
    const optimizedJobs = [...jobs].sort((a, b) => a.coordinates.lat - b.coordinates.lat);

    const originalDistance = this.calculateTotalDistance(jobs.map(j => j.coordinates));
    const optimizedDistance = this.calculateTotalDistance(optimizedJobs.map(j => j.coordinates));
    const distanceSaved = originalDistance - optimizedDistance;

    const route: OptimizedRoute = {
      id: `route-${Date.now()}`, date: new Date(), assignedTo, assignedToName,
      jobs: optimizedJobs.map((j, i) => ({ ...j, status: 'pending' as const, scheduledTime: this.calculateScheduledTime(i, optimizedJobs) })),
      totalDistance: optimizedDistance, totalDuration: optimizedJobs.reduce((sum, j) => sum + j.duration, 0) + (optimizedJobs.length - 1) * 15,
      estimatedFuelCost: optimizedDistance * 0.45, startTime: '08:00', endTime: this.calculateEndTime(optimizedJobs),
      savings: { distanceSaved, timeSaved: Math.round(distanceSaved * 2), fuelSaved: distanceSaved * 0.45, originalDistance, optimizedDistance },
    };

    this.routes.push(route);
    trackUserAction('route_optimized', { jobCount: jobs.length, distanceSaved, timeSaved: route.savings.timeSaved });
    this.notify();
    return route;
  }

  private calculateTotalDistance(coordinates: { lat: number; lng: number }[]): number {
    let total = 0;
    for (let i = 1; i < coordinates.length; i++) {
      const dx = (coordinates[i].lat - coordinates[i-1].lat) * 111;
      const dy = (coordinates[i].lng - coordinates[i-1].lng) * 111 * Math.cos(coordinates[i].lat * Math.PI / 180);
      total += Math.sqrt(dx * dx + dy * dy);
    }
    return Math.round(total * 10) / 10;
  }

  private calculateScheduledTime(index: number, jobs: Omit<RouteJob, 'status'>[]): string {
    let minutes = 8 * 60; // Start at 08:00
    for (let i = 0; i < index; i++) {
      minutes += jobs[i].duration + 15; // 15 min travel between jobs
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  private calculateEndTime(jobs: Omit<RouteJob, 'status'>[]): string {
    let minutes = 8 * 60;
    jobs.forEach((j, i) => { minutes += j.duration + (i < jobs.length - 1 ? 15 : 0); });
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  updateJobStatus(routeId: string, jobId: string, status: RouteJob['status']): void {
    const route = this.routes.find(r => r.id === routeId);
    if (route) {
      const job = route.jobs.find(j => j.id === jobId);
      if (job) {
        job.status = status;
        trackUserAction('route_job_status_updated', { routeId, jobId, status });
        this.notify();
      }
    }
  }

  getStats(): RouteStats {
    const today = new Date().toDateString();
    const todayRoutes = this.routes.filter(r => r.date.toDateString() === today);
    const monthRoutes = this.routes.filter(r => r.date.getMonth() === new Date().getMonth());

    return {
      routesToday: todayRoutes.length,
      totalJobsToday: todayRoutes.reduce((sum, r) => sum + r.jobs.length, 0),
      avgDistancePerRoute: Math.round(monthRoutes.reduce((sum, r) => sum + r.totalDistance, 0) / monthRoutes.length),
      totalSavingsThisMonth: Math.round(monthRoutes.reduce((sum, r) => sum + r.savings.fuelSaved, 0)),
      avgTimeSavedPerRoute: Math.round(monthRoutes.reduce((sum, r) => sum + r.savings.timeSaved, 0) / monthRoutes.length),
      completionRate: 87,
    };
  }
}

export const routeOptimizerService = RouteOptimizerService.getInstance();

// =============================================================================
// REACT HOOKS
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

export function useTodaysRoutes() {
  const [routes, setRoutes] = useState<OptimizedRoute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setRoutes(routeOptimizerService.getTodaysRoutes());
    setLoading(false);
    return routeOptimizerService.subscribe(() => setRoutes(routeOptimizerService.getTodaysRoutes()));
  }, []);

  const optimize = useCallback((jobs: Omit<RouteJob, 'status'>[], assignedTo: string, name: string) =>
    routeOptimizerService.optimizeRoute(jobs, assignedTo, name), []);
  const updateJobStatus = useCallback((rId: string, jId: string, status: RouteJob['status']) =>
    routeOptimizerService.updateJobStatus(rId, jId, status), []);

  return { routes, loading, optimize, updateJobStatus };
}

export function useRouteStats() {
  const [stats, setStats] = useState<RouteStats>(routeOptimizerService.getStats());
  useEffect(() => routeOptimizerService.subscribe(() => setStats(routeOptimizerService.getStats())), []);
  return stats;
}
