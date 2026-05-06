// =============================================================================
// SCHEDULE FRAGILITY SERVICE
// =============================================================================
// Analyzes schedule fragility, identifies critical path risks, and runs what-if scenarios
// Implements the Schedule Fragility Scoring feature (P2 - a16z E11 Predictive)
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { trackUserAction } from '../intelligence/intelligenceEngine';
import { registerSingletonReset } from './singletonReset';
import type {
  Activity,
  ActivityStatus,
  FragilityScore,
  FragilityLevel,
  FragilityFactors,
  FactorScore,
  ActivityRisk,
  FragilityAlert,
  AlertType,
  Scenario,
  ScenarioType,
  ScenarioResults,
  ImpactAnalysis,
  CriticalPath,
  CriticalPathActivity,
  FragilityRecommendation,
  ScheduleFragilityStats,
  FragilityThresholds,
  FragilityWeights,
} from '../types/schedule-fragility';
import {
  DEFAULT_FRAGILITY_THRESHOLDS,
  DEFAULT_FRAGILITY_WEIGHTS,
} from '../types/schedule-fragility';

// ============================================
// MOCK DATA
// ============================================

const MOCK_ACTIVITIES: Activity[] = [
  {
    id: 'act-1',
    projectId: 'proj-1',
    name: 'Site Preparation',
    plannedStartDate: '2025-01-06',
    plannedEndDate: '2025-01-17',
    actualStartDate: '2025-01-06',
    duration: 10,
    percentComplete: 100,
    status: 'completed',
    predecessors: [],
    successors: ['act-2', 'act-3'],
    dependencyType: 'finish-to-start',
    assignedResources: ['crew-1'],
    totalFloat: 0,
    freeFloat: 0,
    isCriticalPath: true,
    isMilestone: false,
    weatherSensitive: true,
    permitRequired: false,
  },
  {
    id: 'act-2',
    projectId: 'proj-1',
    name: 'Foundation Excavation',
    plannedStartDate: '2025-01-20',
    plannedEndDate: '2025-02-07',
    actualStartDate: '2025-01-20',
    duration: 15,
    percentComplete: 60,
    status: 'in-progress',
    predecessors: ['act-1'],
    successors: ['act-4'],
    dependencyType: 'finish-to-start',
    assignedResources: ['crew-1', 'equipment-1'],
    totalFloat: 0,
    freeFloat: 0,
    isCriticalPath: true,
    isMilestone: false,
    weatherSensitive: true,
    permitRequired: true,
    permitId: 'permit-1',
  },
  {
    id: 'act-3',
    projectId: 'proj-1',
    name: 'Utility Connections',
    plannedStartDate: '2025-01-20',
    plannedEndDate: '2025-01-31',
    duration: 10,
    percentComplete: 30,
    status: 'in-progress',
    predecessors: ['act-1'],
    successors: ['act-5'],
    dependencyType: 'finish-to-start',
    assignedResources: ['subcontractor-1'],
    totalFloat: 5,
    freeFloat: 3,
    isCriticalPath: false,
    isMilestone: false,
    weatherSensitive: false,
    permitRequired: true,
    permitId: 'permit-2',
  },
  {
    id: 'act-4',
    projectId: 'proj-1',
    name: 'Foundation Pour',
    plannedStartDate: '2025-02-10',
    plannedEndDate: '2025-02-21',
    duration: 10,
    percentComplete: 0,
    status: 'not-started',
    predecessors: ['act-2'],
    successors: ['act-5', 'act-6'],
    dependencyType: 'finish-to-start',
    assignedResources: ['crew-2', 'concrete-supplier'],
    totalFloat: 0,
    freeFloat: 0,
    isCriticalPath: true,
    isMilestone: false,
    weatherSensitive: true,
    permitRequired: false,
  },
  {
    id: 'act-5',
    projectId: 'proj-1',
    name: 'Structural Steel',
    plannedStartDate: '2025-02-24',
    plannedEndDate: '2025-03-21',
    duration: 20,
    percentComplete: 0,
    status: 'not-started',
    predecessors: ['act-3', 'act-4'],
    successors: ['act-7'],
    dependencyType: 'finish-to-start',
    assignedResources: ['steel-contractor'],
    totalFloat: 2,
    freeFloat: 0,
    isCriticalPath: false,
    isMilestone: false,
    weatherSensitive: false,
    permitRequired: false,
  },
  {
    id: 'act-6',
    projectId: 'proj-1',
    name: 'Project Milestone - Structure Complete',
    plannedStartDate: '2025-03-21',
    plannedEndDate: '2025-03-21',
    duration: 0,
    percentComplete: 0,
    status: 'not-started',
    predecessors: ['act-4'],
    successors: [],
    dependencyType: 'finish-to-start',
    assignedResources: [],
    totalFloat: 0,
    freeFloat: 0,
    isCriticalPath: true,
    isMilestone: true,
    weatherSensitive: false,
    permitRequired: false,
  },
];

const MOCK_ALERTS: FragilityAlert[] = [
  {
    id: 'alert-1',
    projectId: 'proj-1',
    type: 'weather-risk',
    severity: 'warning',
    title: 'Weather Risk - Foundation Pour',
    message: 'Frost forecast for Feb 10-12 may affect Foundation Pour activity.',
    affectedActivityIds: ['act-4'],
    potentialDelayDays: 3,
    detectedAt: '2025-01-28T10:00:00Z',
    status: 'active',
    suggestedActions: [
      'Consider rescheduling to Feb 13 if frost persists',
      'Prepare cold weather concrete mix as contingency',
      'Monitor weather forecast daily',
    ],
  },
  {
    id: 'alert-2',
    projectId: 'proj-1',
    type: 'low-float',
    severity: 'danger',
    title: 'Critical: Zero Float on Critical Path',
    message: 'Multiple activities on critical path have zero float. Any delay will impact project completion.',
    affectedActivityIds: ['act-2', 'act-4', 'act-6'],
    potentialDelayDays: 0,
    detectedAt: '2025-01-28T10:00:00Z',
    status: 'active',
    suggestedActions: [
      'Review resource allocation for critical activities',
      'Identify opportunities to fast-track non-critical work',
      'Prepare contingency plans for critical activities',
    ],
  },
];

// ============================================
// SERVICE CLASS
// ============================================

type FragilityListener = () => void;

class ScheduleFragilityService {
  private static instance: ScheduleFragilityService;
  private listeners: Set<FragilityListener> = new Set();
  private activities: Map<string, Activity> = new Map();
  private alerts: Map<string, FragilityAlert> = new Map();
  private scenarios: Map<string, Scenario> = new Map();
  private fragilityCache: Map<string, FragilityScore> = new Map();
  private criticalPathCache: Map<string, CriticalPath> = new Map();
  private thresholds: FragilityThresholds = DEFAULT_FRAGILITY_THRESHOLDS;
  private weights: FragilityWeights = DEFAULT_FRAGILITY_WEIGHTS;

  constructor() {
    // R31: dropped MOCK_ACTIVITIES + MOCK_ALERTS seed (was injecting fixture
    // project activities + alerts into every contractor's schedule fragility
    // singleton on app open). Real activities flow in via setActivities()
    // from the project-screen layer when fragility analysis surfaces (today
    // mounted on COODashboard + WhatIfAnalysisModal — both enterprise/CFO
    // surfaces, R180 enterprise-skip applies). Test setups call __seedMockData.
  }

  static getInstance(): ScheduleFragilityService {
    if (!ScheduleFragilityService.instance) {
      ScheduleFragilityService.instance = new ScheduleFragilityService();
      registerSingletonReset(() => {
        const inst = ScheduleFragilityService.instance;
        inst.activities.clear();
        inst.alerts.clear();
        inst.scenarios.clear();
        inst.fragilityCache.clear();
        inst.criticalPathCache.clear();
        inst.thresholds = DEFAULT_FRAGILITY_THRESHOLDS;
        inst.weights = DEFAULT_FRAGILITY_WEIGHTS;
        inst.listeners.forEach((l) => l());
      });
    }
    return ScheduleFragilityService.instance;
  }

  /** @internal Test-only mock seeder. */
  __seedMockData(): void {
    MOCK_ACTIVITIES.forEach(a => this.activities.set(a.id, a));
    MOCK_ALERTS.forEach(a => this.alerts.set(a.id, a));
    const projectIds = [...new Set(MOCK_ACTIVITIES.map(a => a.projectId))];
    projectIds.forEach(projectId => {
      this.fragilityCache.set(projectId, this.calculateFragilityScore(projectId));
      this.criticalPathCache.set(projectId, this.calculateCriticalPath(projectId));
    });
  }

  subscribe(listener: FragilityListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(l => l());
  }

  // ----------------------------------------
  // FRAGILITY CALCULATION
  // ----------------------------------------

  /**
   * Calculates the overall fragility score for a project
   */
  calculateFragility(projectId: string): FragilityScore {
    const cached = this.fragilityCache.get(projectId);
    if (cached) return cached;

    const score = this.calculateFragilityScore(projectId);
    this.fragilityCache.set(projectId, score);
    return score;
  }

  private calculateFragilityScore(projectId: string): FragilityScore {
    const activities = this.getProjectActivities(projectId);
    if (activities.length === 0) {
      throw new Error(`No activities found for project ${projectId}`);
    }

    const factors = this.calculateFactors(activities);
    const overallScore = this.computeOverallScore(factors);
    const fragility = this.scoreToFragilityLevel(overallScore);
    const criticalPath = this.calculateCriticalPath(projectId);
    const fragileActivities = this.identifyFragileActivities(activities);
    const alerts = this.getProjectAlerts(projectId);
    const recommendations = this.generateRecommendations(factors, fragileActivities);
    const whatIfScenarios = this.generateDefaultScenarios(projectId);

    return {
      projectId,
      projectName: `Project ${projectId}`,
      calculatedAt: new Date().toISOString(),
      overallScore,
      fragility,
      factors,
      criticalPathLength: criticalPath.totalDuration,
      criticalActivitiesCount: criticalPath.activities.length,
      fragileActivities,
      alerts,
      whatIfScenarios,
      recommendations,
    };
  }

  private calculateFactors(activities: Activity[]): FragilityFactors {
    return {
      criticalPathBuffer: this.calculateCriticalPathBufferFactor(activities),
      dependencyDensity: this.calculateDependencyDensityFactor(activities),
      resourceContention: this.calculateResourceContentionFactor(activities),
      weatherExposure: this.calculateWeatherExposureFactor(activities),
      permitRisk: this.calculatePermitRiskFactor(activities),
    };
  }

  private calculateCriticalPathBufferFactor(activities: Activity[]): FactorScore {
    const criticalActivities = activities.filter(a => a.isCriticalPath);
    const avgFloat = criticalActivities.length > 0
      ? criticalActivities.reduce((sum, a) => sum + a.totalFloat, 0) / criticalActivities.length
      : 0;

    // Lower float = higher fragility score
    const score = avgFloat <= 0 ? 100 :
                  avgFloat <= 2 ? 80 :
                  avgFloat <= 5 ? 50 :
                  avgFloat <= 10 ? 30 : 10;

    return {
      name: 'Critical Path Buffer',
      score,
      weight: this.weights.criticalPathBuffer,
      description: 'Available float/slack on critical path activities',
      status: score >= 70 ? 'danger' : score >= 40 ? 'warning' : 'good',
      details: `Average float: ${avgFloat.toFixed(1)} days`,
    };
  }

  private calculateDependencyDensityFactor(activities: Activity[]): FactorScore {
    const totalDependencies = activities.reduce((sum, a) => sum + a.predecessors.length, 0);
    const avgDependencies = activities.length > 0 ? totalDependencies / activities.length : 0;

    // More dependencies = higher fragility
    const score = avgDependencies >= 4 ? 90 :
                  avgDependencies >= 3 ? 70 :
                  avgDependencies >= 2 ? 40 :
                  avgDependencies >= 1 ? 20 : 10;

    return {
      name: 'Dependency Density',
      score,
      weight: this.weights.dependencyDensity,
      description: 'Interconnectedness of schedule activities',
      status: score >= 70 ? 'danger' : score >= 40 ? 'warning' : 'good',
      details: `Average dependencies per activity: ${avgDependencies.toFixed(1)}`,
    };
  }

  private calculateResourceContentionFactor(activities: Activity[]): FactorScore {
    // Count overlapping resource usage
    const inProgressActivities = activities.filter(a => a.status === 'in-progress' || a.status === 'not-started');
    const allResources = inProgressActivities.flatMap(a => a.assignedResources);
    const uniqueResources = new Set(allResources);
    const contentionRatio = uniqueResources.size > 0 ? allResources.length / uniqueResources.size : 1;

    const score = contentionRatio >= 2 ? 80 :
                  contentionRatio >= 1.5 ? 50 :
                  contentionRatio >= 1.2 ? 30 : 10;

    return {
      name: 'Resource Contention',
      score,
      weight: this.weights.resourceContention,
      description: 'Risk of resource conflicts and over-allocation',
      status: score >= 70 ? 'danger' : score >= 40 ? 'warning' : 'good',
      details: `Resource contention ratio: ${contentionRatio.toFixed(2)}`,
    };
  }

  private calculateWeatherExposureFactor(activities: Activity[]): FactorScore {
    const upcomingActivities = activities.filter(a =>
      a.status !== 'completed' && a.weatherSensitive
    );
    const criticalWeatherSensitive = upcomingActivities.filter(a => a.isCriticalPath);

    const score = criticalWeatherSensitive.length >= 3 ? 90 :
                  criticalWeatherSensitive.length >= 2 ? 70 :
                  criticalWeatherSensitive.length >= 1 ? 50 :
                  upcomingActivities.length >= 2 ? 30 : 10;

    return {
      name: 'Weather Exposure',
      score,
      weight: this.weights.weatherExposure,
      description: 'Exposure to weather-related delays',
      status: score >= 70 ? 'danger' : score >= 40 ? 'warning' : 'good',
      details: `${criticalWeatherSensitive.length} critical activities are weather-sensitive`,
    };
  }

  private calculatePermitRiskFactor(activities: Activity[]): FactorScore {
    const activitiesNeedingPermit = activities.filter(a => a.permitRequired && a.status !== 'completed');
    const criticalPermitActivities = activitiesNeedingPermit.filter(a => a.isCriticalPath);

    const score = criticalPermitActivities.length >= 2 ? 80 :
                  criticalPermitActivities.length >= 1 ? 60 :
                  activitiesNeedingPermit.length >= 2 ? 40 : 10;

    return {
      name: 'Permit Risk',
      score,
      weight: this.weights.permitRisk,
      description: 'Risk from pending permits and approvals',
      status: score >= 70 ? 'danger' : score >= 40 ? 'warning' : 'good',
      details: `${activitiesNeedingPermit.length} activities awaiting permits`,
    };
  }

  private computeOverallScore(factors: FragilityFactors): number {
    const factorArray = Object.values(factors) as FactorScore[];
    const weightedSum = factorArray.reduce((sum, f) => sum + f.score * f.weight, 0);
    const totalWeight = factorArray.reduce((sum, f) => sum + f.weight, 0);
    return Math.round(weightedSum / totalWeight);
  }

  private scoreToFragilityLevel(score: number): FragilityLevel {
    if (score <= this.thresholds.lowMax) return 'low';
    if (score <= this.thresholds.moderateMax) return 'moderate';
    if (score <= this.thresholds.highMax) return 'high';
    return 'critical';
  }

  // ----------------------------------------
  // CRITICAL PATH
  // ----------------------------------------

  /**
   * Identifies the critical path for a project
   */
  identifyCriticalPath(projectId: string): CriticalPath {
    const cached = this.criticalPathCache.get(projectId);
    if (cached) return cached;

    const path = this.calculateCriticalPath(projectId);
    this.criticalPathCache.set(projectId, path);
    return path;
  }

  private calculateCriticalPath(projectId: string): CriticalPath {
    const activities = this.getProjectActivities(projectId);
    const criticalActivities = activities.filter(a => a.isCriticalPath);

    // Sort by start date
    criticalActivities.sort((a, b) =>
      new Date(a.plannedStartDate).getTime() - new Date(b.plannedStartDate).getTime()
    );

    const pathActivities: CriticalPathActivity[] = criticalActivities.map((a, index) => ({
      activityId: a.id,
      activityName: a.name,
      startDate: a.plannedStartDate,
      endDate: a.plannedEndDate,
      duration: a.duration,
      percentComplete: a.percentComplete,
      position: index + 1,
      totalFloat: a.totalFloat,
      predecessorId: a.predecessors[0],
      successorId: a.successors[0],
    }));

    const firstActivity = pathActivities[0];
    const lastActivity = pathActivities[pathActivities.length - 1];

    const totalDuration = criticalActivities.reduce((sum, a) => sum + a.duration, 0);
    const activitiesWithZeroFloat = activities.filter(a => a.totalFloat === 0).length;
    const nearCriticalActivities = activities.filter(a => a.totalFloat > 0 && a.totalFloat <= 5).map(a => a.id);

    const avgFloat = activities.length > 0
      ? activities.reduce((sum, a) => sum + a.totalFloat, 0) / activities.length
      : 0;

    // Identify bottlenecks
    const bottlenecks = criticalActivities
      .filter(a => a.successors.length > 1 || a.predecessors.length > 1)
      .map(a => ({
        activityId: a.id,
        activityName: a.name,
        reason: a.successors.length > 1 ? 'Multiple successors depend on this activity' : 'Multiple predecessors',
        severity: 'high' as const,
      }));

    return {
      projectId,
      calculatedAt: new Date().toISOString(),
      totalDuration,
      startDate: firstActivity?.startDate || '',
      endDate: lastActivity?.endDate || '',
      activities: pathActivities,
      longestChain: criticalActivities.map(a => a.id),
      bottlenecks,
      averageFloat: avgFloat,
      activitiesWithZeroFloat,
      nearCriticalActivities,
    };
  }

  // ----------------------------------------
  // ACTIVITY RISK ANALYSIS
  // ----------------------------------------

  private identifyFragileActivities(activities: Activity[]): ActivityRisk[] {
    return activities
      .map(activity => this.assessActivityRisk(activity, activities))
      .filter(risk => risk.riskScore >= 40)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5);
  }

  private assessActivityRisk(activity: Activity, allActivities: Activity[]): ActivityRisk {
    const riskFactors: ActivityRisk['riskFactors'] = [];
    let totalRisk = 0;

    // Factor 1: Zero or low float
    if (activity.totalFloat === 0) {
      riskFactors.push({
        factor: 'Zero Float',
        contribution: 30,
        description: 'No schedule flexibility - any delay impacts project',
      });
      totalRisk += 30;
    } else if (activity.totalFloat <= 3) {
      riskFactors.push({
        factor: 'Low Float',
        contribution: 15,
        description: 'Limited schedule flexibility',
      });
      totalRisk += 15;
    }

    // Factor 2: Critical path
    if (activity.isCriticalPath) {
      riskFactors.push({
        factor: 'Critical Path',
        contribution: 25,
        description: 'Activity is on critical path',
      });
      totalRisk += 25;
    }

    // Factor 3: Weather sensitive
    if (activity.weatherSensitive) {
      riskFactors.push({
        factor: 'Weather Sensitive',
        contribution: 15,
        description: 'Activity vulnerable to weather delays',
      });
      totalRisk += 15;
    }

    // Factor 4: Permit required
    if (activity.permitRequired) {
      riskFactors.push({
        factor: 'Permit Required',
        contribution: 10,
        description: 'Depends on permit approval',
      });
      totalRisk += 10;
    }

    // Factor 5: Many successors (high impact if delayed)
    if (activity.successors.length >= 2) {
      riskFactors.push({
        factor: 'High Impact',
        contribution: 15,
        description: `${activity.successors.length} activities depend on this`,
      });
      totalRisk += 15;
    }

    // Calculate delay impact
    const affectedActivities = this.countAffectedActivities(activity.id, allActivities);

    const riskLevel = totalRisk >= 70 ? 'critical' :
                      totalRisk >= 50 ? 'high' :
                      totalRisk >= 30 ? 'medium' : 'low';

    return {
      activityId: activity.id,
      activityName: activity.name,
      riskScore: Math.min(100, totalRisk),
      riskLevel,
      riskFactors,
      delayImpact: {
        projectDelayDays: activity.isCriticalPath ? activity.duration : 0,
        affectedActivities,
        costImpact: activity.isCriticalPath ? activity.duration * 5000 : undefined,
      },
      totalFloat: activity.totalFloat,
      daysRemaining: this.calculateDaysRemaining(activity),
      percentComplete: activity.percentComplete,
      mitigations: this.suggestMitigations(activity, riskFactors),
    };
  }

  private countAffectedActivities(activityId: string, allActivities: Activity[]): number {
    const visited = new Set<string>();
    const queue = [activityId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const activity = allActivities.find(a => a.id === current);
      if (activity) {
        activity.successors.forEach(s => queue.push(s));
      }
    }

    return visited.size - 1; // Exclude the original activity
  }

  private calculateDaysRemaining(activity: Activity): number {
    const endDate = new Date(activity.plannedEndDate);
    const today = new Date();
    return Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  }

  private suggestMitigations(activity: Activity, riskFactors: ActivityRisk['riskFactors']): string[] {
    const mitigations: string[] = [];

    if (riskFactors.some(f => f.factor === 'Zero Float' || f.factor === 'Low Float')) {
      mitigations.push('Consider adding buffer time if possible');
      mitigations.push('Fast-track predecessor activities');
    }

    if (riskFactors.some(f => f.factor === 'Weather Sensitive')) {
      mitigations.push('Monitor weather forecast and prepare contingencies');
      mitigations.push('Consider weather protection measures');
    }

    if (riskFactors.some(f => f.factor === 'Permit Required')) {
      mitigations.push('Follow up on permit status');
      mitigations.push('Prepare alternative work if permit is delayed');
    }

    if (riskFactors.some(f => f.factor === 'High Impact')) {
      mitigations.push('Prioritize resources for this activity');
      mitigations.push('Increase monitoring frequency');
    }

    return mitigations;
  }

  // ----------------------------------------
  // WHAT-IF ANALYSIS
  // ----------------------------------------

  /**
   * Runs a what-if analysis scenario
   */
  runWhatIfAnalysis(projectId: string, scenario: Scenario): ImpactAnalysis {
    const activities = this.getProjectActivities(projectId);
    const criticalPath = this.identifyCriticalPath(projectId);

    let projectDelayDays = 0;
    const affectedActivities: ScenarioResults['affectedActivities'] = [];
    const milestonesAffected: ImpactAnalysis['milestonesAffected'] = [];

    // Analyze based on scenario type
    switch (scenario.type) {
      case 'activity-delay': {
        const delayDays = Number(scenario.parameters.find(p => p.name === 'delayDays')?.value) || 0;
        const activityIds = scenario.parameters.find(p => p.name === 'activities')?.value as string[] || [];

        activityIds.forEach(activityId => {
          const activity = activities.find(a => a.id === activityId);
          if (activity) {
            const impactDays = activity.isCriticalPath ? delayDays : Math.max(0, delayDays - activity.totalFloat);
            if (impactDays > projectDelayDays) {
              projectDelayDays = impactDays;
            }

            const newEndDate = new Date(activity.plannedEndDate);
            newEndDate.setDate(newEndDate.getDate() + delayDays);

            affectedActivities.push({
              activityId: activity.id,
              activityName: activity.name,
              originalEndDate: activity.plannedEndDate,
              newEndDate: newEndDate.toISOString().split('T')[0],
              delayDays,
            });

            // Check milestone impact
            if (activity.isMilestone || activity.successors.some(s => {
              const successor = activities.find(a => a.id === s);
              return successor?.isMilestone;
            })) {
              const milestone = activities.find(a => a.isMilestone && a.predecessors.includes(activityId));
              if (milestone) {
                const newMilestoneDate = new Date(milestone.plannedEndDate);
                newMilestoneDate.setDate(newMilestoneDate.getDate() + impactDays);
                milestonesAffected.push({
                  milestoneId: milestone.id,
                  milestoneName: milestone.name,
                  originalDate: milestone.plannedEndDate,
                  newDate: newMilestoneDate.toISOString().split('T')[0],
                  delayDays: impactDays,
                });
              }
            }
          }
        });
        break;
      }

      case 'weather-disruption': {
        const disruptionDays = Number(scenario.parameters.find(p => p.name === 'disruptionDays')?.value) || 0;
        const weatherSensitiveActivities = activities.filter(a => a.weatherSensitive && a.status !== 'completed');

        weatherSensitiveActivities.forEach(activity => {
          const impactDays = activity.isCriticalPath ? disruptionDays : Math.max(0, disruptionDays - activity.totalFloat);
          if (impactDays > projectDelayDays) {
            projectDelayDays = impactDays;
          }

          const newEndDate = new Date(activity.plannedEndDate);
          newEndDate.setDate(newEndDate.getDate() + disruptionDays);

          affectedActivities.push({
            activityId: activity.id,
            activityName: activity.name,
            originalEndDate: activity.plannedEndDate,
            newEndDate: newEndDate.toISOString().split('T')[0],
            delayDays: disruptionDays,
          });
        });
        break;
      }
    }

    // Calculate new completion date
    const lastActivity = criticalPath.activities[criticalPath.activities.length - 1];
    const originalCompletionDate = lastActivity?.endDate || '';
    const newCompletionDate = new Date(originalCompletionDate);
    newCompletionDate.setDate(newCompletionDate.getDate() + projectDelayDays);

    const analysis: ImpactAnalysis = {
      projectDelayDays,
      originalCompletionDate,
      newCompletionDate: newCompletionDate.toISOString().split('T')[0],
      criticalPathChange: projectDelayDays > 0,
      estimatedCostImpact: projectDelayDays * 5000,
      currency: 'GBP',
      milestonesAffected,
      overallRisk: projectDelayDays >= 10 ? 'critical' :
                   projectDelayDays >= 5 ? 'high' :
                   projectDelayDays >= 2 ? 'medium' : 'low',
      confidenceLevel: 75,
      mitigationOptions: [
        {
          description: 'Add additional resources to critical activities',
          costToImplement: projectDelayDays * 2000,
          timeRecovery: Math.ceil(projectDelayDays * 0.6),
          feasibility: 'high',
        },
        {
          description: 'Authorize overtime work',
          costToImplement: projectDelayDays * 1500,
          timeRecovery: Math.ceil(projectDelayDays * 0.4),
          feasibility: 'high',
        },
        {
          description: 'Fast-track parallel activities',
          costToImplement: projectDelayDays * 1000,
          timeRecovery: Math.ceil(projectDelayDays * 0.3),
          feasibility: 'medium',
        },
      ],
    };

    // Store scenario results
    scenario.results = {
      impactAnalysis: analysis,
      affectedActivities,
      recommendations: analysis.mitigationOptions.map(m => m.description),
      runAt: new Date().toISOString(),
    };
    scenario.lastRunAt = new Date().toISOString();
    this.scenarios.set(scenario.id, scenario);

    trackUserAction('what_if_analysis_run', { projectId, scenarioType: scenario.type, delayDays: projectDelayDays });
    this.notify();

    return analysis;
  }

  private generateDefaultScenarios(projectId: string): Scenario[] {
    return [
      {
        id: `scenario-${projectId}-1`,
        name: 'Critical Activity Delay',
        description: 'What if a critical path activity is delayed by 5 days?',
        type: 'activity-delay',
        parameters: [
          { name: 'activities', type: 'activities', value: [], description: 'Select activities to delay' },
          { name: 'delayDays', type: 'number', value: 5, unit: 'days', description: 'Number of days delayed' },
        ],
        createdAt: new Date().toISOString(),
        createdBy: 'system',
      },
      {
        id: `scenario-${projectId}-2`,
        name: 'Weather Disruption',
        description: 'What if weather causes 3 days of work stoppage?',
        type: 'weather-disruption',
        parameters: [
          { name: 'disruptionDays', type: 'number', value: 3, unit: 'days', description: 'Days of disruption' },
        ],
        createdAt: new Date().toISOString(),
        createdBy: 'system',
      },
    ];
  }

  // ----------------------------------------
  // RECOMMENDATIONS
  // ----------------------------------------

  private generateRecommendations(factors: FragilityFactors, fragileActivities: ActivityRisk[]): FragilityRecommendation[] {
    const recommendations: FragilityRecommendation[] = [];

    // Recommend based on critical path buffer
    if (factors.criticalPathBuffer.score >= 70) {
      recommendations.push({
        id: 'rec-buffer',
        priority: 'high',
        category: 'buffer-increase',
        title: 'Increase Critical Path Buffer',
        description: 'Add buffer time to activities on the critical path to reduce schedule fragility.',
        rationale: 'Current critical path has minimal float, making the schedule vulnerable to any delay.',
        expectedBenefit: {
          fragilityReduction: 15,
          floatIncrease: 3,
        },
        implementationSteps: [
          'Identify activities that can be fast-tracked',
          'Review resource allocation for efficiency gains',
          'Consider adding explicit buffer activities',
        ],
      });
    }

    // Recommend based on dependency density
    if (factors.dependencyDensity.score >= 60) {
      recommendations.push({
        id: 'rec-dependencies',
        priority: 'medium',
        category: 'dependency-optimization',
        title: 'Optimize Activity Dependencies',
        description: 'Review and simplify activity dependencies where possible.',
        rationale: 'High dependency density increases the risk of cascading delays.',
        expectedBenefit: {
          fragilityReduction: 10,
        },
        implementationSteps: [
          'Review all Finish-to-Start dependencies',
          'Identify opportunities for parallel work',
          'Remove unnecessary dependencies',
        ],
      });
    }

    // Recommend for high-risk activities
    const criticalActivities = fragileActivities.filter(a => a.riskLevel === 'critical' || a.riskLevel === 'high');
    if (criticalActivities.length > 0) {
      recommendations.push({
        id: 'rec-risk',
        priority: 'critical',
        category: 'risk-mitigation',
        title: 'Mitigate High-Risk Activities',
        description: `Focus attention on ${criticalActivities.length} high-risk activities identified in the schedule.`,
        rationale: 'These activities have the highest potential to impact project completion.',
        expectedBenefit: {
          fragilityReduction: 20,
        },
        relatedActivityIds: criticalActivities.map(a => a.activityId),
        implementationSteps: criticalActivities.flatMap(a => a.mitigations),
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  // ----------------------------------------
  // ALERTS
  // ----------------------------------------

  /**
   * Gets fragility alerts for a project
   */
  getFragilityAlerts(projectId: string): FragilityAlert[] {
    return Array.from(this.alerts.values())
      .filter(a => a.projectId === projectId && a.status === 'active')
      .sort((a, b) => {
        const severityOrder = { critical: 0, danger: 1, warning: 2, info: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
  }

  private getProjectAlerts(projectId: string): FragilityAlert[] {
    return this.getFragilityAlerts(projectId);
  }

  /**
   * Acknowledges an alert
   */
  acknowledgeAlert(alertId: string, userId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.status = 'acknowledged';
      alert.acknowledgedBy = userId;
      alert.acknowledgedAt = new Date().toISOString();
      this.notify();
    }
  }

  // ----------------------------------------
  // ACCESSORS
  // ----------------------------------------

  private getProjectActivities(projectId: string): Activity[] {
    return Array.from(this.activities.values()).filter(a => a.projectId === projectId);
  }

  /**
   * Gets all activities for a project
   */
  getActivities(projectId: string): Activity[] {
    return this.getProjectActivities(projectId);
  }

  /**
   * Gets statistics across all projects
   */
  getStats(): ScheduleFragilityStats {
    const projectIds = [...new Set(Array.from(this.activities.values()).map(a => a.projectId))];
    const fragilityScores = projectIds.map(id => this.calculateFragility(id));

    const distribution = { low: 0, moderate: 0, high: 0, critical: 0 };
    fragilityScores.forEach(s => distribution[s.fragility]++);

    const avgScore = fragilityScores.length > 0
      ? fragilityScores.reduce((sum, s) => sum + s.overallScore, 0) / fragilityScores.length
      : 0;

    const allAlerts = Array.from(this.alerts.values()).filter(a => a.status === 'active');
    const alertsByType: Record<AlertType, number> = {
      'low-float': 0,
      'delay-propagation': 0,
      'resource-conflict': 0,
      'weather-risk': 0,
      'permit-delay': 0,
      'critical-path-change': 0,
      'milestone-at-risk': 0,
      'dependency-chain': 0,
    };
    allAlerts.forEach(a => alertsByType[a.type]++);

    return {
      totalProjects: projectIds.length,
      averageFragilityScore: Math.round(avgScore),
      fragilityDistribution: distribution,
      mostFragileProjects: fragilityScores
        .sort((a, b) => b.overallScore - a.overallScore)
        .slice(0, 5)
        .map(s => ({
          projectId: s.projectId,
          projectName: s.projectName,
          fragilityScore: s.overallScore,
          fragilityLevel: s.fragility,
        })),
      totalActiveAlerts: allAlerts.length,
      criticalAlerts: allAlerts.filter(a => a.severity === 'critical').length,
      alertsByType,
      fragilityTrend: 'stable',
      trendPercentage: 0,
    };
  }
}

export const scheduleFragilityService = ScheduleFragilityService.getInstance();

// ============================================
// REACT HOOKS
// ============================================

export function useFragilityScore(projectId: string) {
  const [data, setData] = useState<FragilityScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    try {
      setData(scheduleFragilityService.calculateFragility(projectId));
    } catch (e) {
      // Project may not exist yet
      setData(null);
    }
    setLoading(false);
    return scheduleFragilityService.subscribe(() => {
      try {
        setData(scheduleFragilityService.calculateFragility(projectId));
      } catch (e) {
        setData(null);
      }
    });
  }, [projectId]);

  return { data, loading };
}

export function useCriticalPath(projectId: string) {
  const [data, setData] = useState<CriticalPath | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    try {
      setData(scheduleFragilityService.identifyCriticalPath(projectId));
    } catch (e) {
      setData(null);
    }
    setLoading(false);
    return scheduleFragilityService.subscribe(() => {
      try {
        setData(scheduleFragilityService.identifyCriticalPath(projectId));
      } catch (e) {
        setData(null);
      }
    });
  }, [projectId]);

  return { data, loading };
}

export function useFragilityAlerts(projectId: string) {
  const [data, setData] = useState<FragilityAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(scheduleFragilityService.getFragilityAlerts(projectId));
    setLoading(false);
    return scheduleFragilityService.subscribe(() => {
      setData(scheduleFragilityService.getFragilityAlerts(projectId));
    });
  }, [projectId]);

  const acknowledge = useCallback((alertId: string, userId: string) => {
    scheduleFragilityService.acknowledgeAlert(alertId, userId);
  }, []);

  return { data, loading, acknowledge };
}

export function useWhatIfAnalysis(projectId: string) {
  const runAnalysis = useCallback((scenario: Scenario) => {
    return scheduleFragilityService.runWhatIfAnalysis(projectId, scenario);
  }, [projectId]);

  return { runAnalysis };
}

export function useScheduleFragilityStats() {
  const [data, setData] = useState<ScheduleFragilityStats>(scheduleFragilityService.getStats());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setData(scheduleFragilityService.getStats());
    setLoading(false);
    return scheduleFragilityService.subscribe(() => {
      setData(scheduleFragilityService.getStats());
    });
  }, []);

  return { data, loading };
}
