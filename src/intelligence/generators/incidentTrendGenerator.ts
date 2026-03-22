// =============================================================================
// INCIDENT TREND GENERATOR — Site Lead specific
// =============================================================================
// Detects anomalies in incident/near-miss reporting frequency.
// Uses z-score against rolling baseline to identify spikes.
// =============================================================================

import { useMemo } from 'react';
import type { ScoredInsight, GeneratorContext } from './types';
import { useIncidents, useDailyReports } from '../../services/siteLeadDataService';
import { logPrediction } from '../calibration';
import { gt } from '../generatorTranslations';

export function useIncidentTrendInsight(ctx: GeneratorContext): ScoredInsight | null {
  const { incidents } = useIncidents();
  const { reports } = useDailyReports();

  return useMemo(() => {
    // Need some data to analyze
    if (incidents.length === 0 && reports.length < 3) return null;

    const now = ctx.now;
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

    // Count incidents from incident reports
    const recentIncidents = incidents.filter(i => new Date(i.date) >= sevenDaysAgo);
    const monthIncidents = incidents.filter(i => new Date(i.date) >= thirtyDaysAgo);

    // Also count from daily reports
    const recentReports = reports.filter(r => new Date(r.date) >= sevenDaysAgo);
    const monthReports = reports.filter(r => new Date(r.date) >= thirtyDaysAgo);

    const recentIncidentCount = recentIncidents.length + recentReports.reduce((s, r) => s + r.safetyIncidents, 0);
    const monthIncidentCount = monthIncidents.length + monthReports.reduce((s, r) => s + r.safetyIncidents, 0);

    const recentNearMisses = recentIncidents.filter(i => i.type === 'near-miss').length
      + recentReports.reduce((s, r) => s + r.nearMisses, 0);

    // Calculate weekly baseline from monthly data
    const weeklyBaseline = monthReports.length > 0
      ? monthIncidentCount / Math.max(monthReports.length / 7, 1)
      : 0;

    // Z-score for anomaly detection
    const stdDev = Math.max(Math.sqrt(weeklyBaseline), 0.5);
    const zScore = weeklyBaseline > 0 ? (recentIncidentCount - weeklyBaseline) / stdDev : 0;

    // Only generate if there's a spike or if there are unresolved near-misses
    if (recentIncidentCount === 0 && recentNearMisses === 0) return null;

    logPrediction({
      generatorId: 'incident-trend',
      predictedAt: new Date().toISOString(),
      prediction: `${recentIncidentCount} incidenten deze week (z=${zScore.toFixed(1)})`,
      predictedValue: recentIncidentCount,
    });

    const isSpike = zScore > 1.5;
    const hasHighSeverity = recentIncidents.some(i => i.severity === 'hoog' || i.severity === 'kritiek');
    const priority = hasHighSeverity ? 'critical' : isSpike ? 'high' : recentIncidentCount > 0 ? 'medium' : 'low';

    let title: string;
    let message: string;

    if (isSpike) {
      title = `Incidentpiek: ${recentIncidentCount} deze week`;
      message = `Dit is ${zScore.toFixed(1)}x de standaarddeviatie boven je baseline van ${weeklyBaseline.toFixed(0)}/week. Onderzoek de oorzaak en plan een extra toolboxtalk.`;
    } else if (hasHighSeverity) {
      title = `Ernstig incident gemeld`;
      message = `${recentIncidentCount} incident(en) deze week waarvan minstens 1 hoge ernst. Direct onderzoek vereist.`;
    } else if (recentNearMisses > 0) {
      title = `${recentNearMisses} bijna-ongeluk${recentNearMisses > 1 ? 'ken' : ''} deze week`;
      message = `Bijna-ongelukken zijn vroege waarschuwingssignalen. Bespreek ze in de toolboxtalk om echte incidenten te voorkomen.`;
    } else {
      title = `${recentIncidentCount} incident(en) deze week`;
      message = `Houd de trends bij. Consistent rapporteren helpt patronen te herkennen.`;
    }

    return {
      id: `incident-trend-${Date.now()}`,
      generatorId: 'incident-trend',
      category: 'safety',
      priority,
      title,
      message,
      icon: 'warning',
      actionLabel: 'Incidenten',
      actionRoute: '/sitelead/incident-report',
      source: gt('source_safety', ctx.language),

      rootCauseTags: ['safety', 'incidents', 'trend'],
      rawScore: 0,
      reasoning: {
        observation: `${recentIncidentCount} incidenten + ${recentNearMisses} bijna-ongelukken deze week`,
        evidence: `Op basis van ${incidents.length} meldingen en ${reports.length} dagrapporten (z-score: ${zScore.toFixed(1)})`,
        implication: isSpike
          ? 'Significante piek boven baseline — verhoogd risico op ernstige incidenten'
          : 'Continue monitoring essentieel voor vroegtijdige detectie',
        suggestion: isSpike
          ? 'Plan direct een extra toolboxtalk en onderzoek de oorzaak'
          : 'Bespreek bijna-ongelukken in dagelijkse briefing',
      },
      dataPoints: incidents.length + reports.length,
      confidence: Math.min(0.4 + (incidents.length + reports.length) * 0.04, 0.92),
      freshness: 1,
      ...(incidents.length + reports.length < 5 ? { confidenceWarning: 'Weinig data — rapporteer consistent voor betere analyse' } : {}),
      action: {
        type: 'escalate_issue',
        label: gt('action_report_incident', ctx.language),
        params: { reason: 'incident_trend' },
        requiresApproval: false,
        estimatedImpact: gt('incident_report_impact', ctx.language),
      },
    };
  }, [incidents, reports]);
}
