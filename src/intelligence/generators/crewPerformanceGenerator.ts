// =============================================================================
// CREW PERFORMANCE GENERATOR — Site Lead specific
// =============================================================================
// Analyzes daily report data to detect crew productivity trends,
// workforce gaps, and scheduling anomalies.
// =============================================================================

import { useMemo } from 'react';
import type { ScoredInsight, GeneratorContext } from './types';
import { useDailyReports } from '../../services/siteLeadDataService';
import { logPrediction } from '../calibration';
import { gt } from '../generatorTranslations';

export function useCrewPerformanceInsight(ctx: GeneratorContext): ScoredInsight | null {
  const { reports } = useDailyReports();

  return useMemo(() => {
    if (reports.length < 2) return null;

    // Sort by date descending
    const sorted = [...reports].sort((a, b) => b.date.localeCompare(a.date));
    const recent = sorted.slice(0, 7); // last 7 reports

    // Calculate average workforce utilization
    const utilRates = recent
      .filter(r => r.workersPlanned > 0)
      .map(r => r.workersPresent / r.workersPlanned);
    if (utilRates.length === 0) return null;

    const avgUtil = utilRates.reduce((s, v) => s + v, 0) / utilRates.length;
    const avgUtilPct = Math.round(avgUtil * 100);

    // Calculate average progress across zones
    const progressRates = recent.flatMap(r =>
      r.progressEntries.filter(e => e.percent > 0).map(e => e.percent)
    );
    const avgProgress = progressRates.length > 0
      ? Math.round(progressRates.reduce((s, v) => s + v, 0) / progressRates.length)
      : 0;

    // Detect anomaly: low utilization or declining trend
    const recentUtil = utilRates.slice(0, 3);
    const olderUtil = utilRates.slice(3);
    const recentAvg = recentUtil.length > 0 ? recentUtil.reduce((s, v) => s + v, 0) / recentUtil.length : avgUtil;
    const olderAvg = olderUtil.length > 0 ? olderUtil.reduce((s, v) => s + v, 0) / olderUtil.length : avgUtil;
    const declining = olderAvg > 0 && recentAvg < olderAvg * 0.85;

    // Only generate insight if there's something actionable
    if (avgUtilPct >= 90 && !declining && avgProgress >= 60) return null;

    logPrediction({
      generatorId: 'crew-performance',
      predictedAt: new Date().toISOString(),
      prediction: `Bezetting ${avgUtilPct}%, voortgang ${avgProgress}%`,
      predictedValue: avgUtilPct,
    });

    const priority = avgUtilPct < 70 || declining ? 'high' : avgUtilPct < 85 ? 'medium' : 'low';

    let title: string;
    let message: string;
    let observation: string;
    let implication: string;
    let suggestion: string;

    if (declining) {
      title = `Bezettingsgraad daalt: ${avgUtilPct}%`;
      message = `De afgelopen dagen is de bezetting gedaald van ${Math.round(olderAvg * 100)}% naar ${Math.round(recentAvg * 100)}%. Dit kan projectvertraging veroorzaken.`;
      observation = `Bezettingsgraad daalt van ${Math.round(olderAvg * 100)}% naar ${Math.round(recentAvg * 100)}%`;
      implication = 'Dalende bezetting leidt tot vertragingen en hogere kosten per werkdag';
      suggestion = 'Plan extra personeel in of herverdeel taken over beschikbare ploegen';
    } else if (avgUtilPct < 70) {
      title = `Lage bezetting: ${avgUtilPct}%`;
      message = `Gemiddeld ${avgUtilPct}% bezetting over de laatste ${recent.length} dagen. Controleer beschikbaarheid en planning.`;
      observation = `Bezettingsgraad gemiddeld ${avgUtilPct}% (onder de 70% norm)`;
      implication = 'Onderbezetting vertraagt mijlpalen en verhoogt indirecte kosten';
      suggestion = 'Controleer ziekteverzuim en beschikbaarheid. Overweeg tijdelijk personeel';
    } else {
      title = `Voortgang ${avgProgress}% bij ${avgUtilPct}% bezetting`;
      message = `De productiviteit per werker kan hoger. Gemiddelde zonevoortgang is ${avgProgress}%.`;
      observation = `Voortgang ${avgProgress}% met ${avgUtilPct}% bezetting`;
      implication = 'Productiviteit onder verwachting kan duiden op blokkades of materiaalvertraging';
      suggestion = 'Bespreek blokkades in de dagelijkse briefing';
    }

    return {
      id: `crew-performance-${Date.now()}`,
      generatorId: 'crew-performance',
      category: 'operations',
      priority,
      title,
      message,
      icon: 'people',
      actionLabel: 'Dagrapport',
      actionRoute: '/sitelead/daily-report',
      source: gt('source_crew', ctx.language),

      rootCauseTags: ['crew', 'productivity', 'workforce'],
      rawScore: 0,
      reasoning: {
        observation,
        evidence: `Op basis van ${reports.length} dagrapporten`,
        implication,
        suggestion,
      },
      dataPoints: reports.length,
      confidence: Math.min(0.5 + reports.length * 0.05, 0.95),
      freshness: 1,
      ...(reports.length < 5 ? { confidenceWarning: 'Weinig dagrapporten — nauwkeurigheid verbetert met meer data' } : {}),
      action: {
        type: 'submit_report',
        label: gt('action_submit_report', ctx.language),
        params: { reason: 'crew_performance' },
        requiresApproval: false,
        estimatedImpact: gt('crew_report_impact', ctx.language),
      },
    };
  }, [reports]);
}
