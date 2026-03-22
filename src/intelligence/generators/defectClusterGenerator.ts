// =============================================================================
// DEFECT CLUSTER GENERATOR — Site Lead specific
// =============================================================================
// Detects patterns in defects: clustering by trade, location, or severity.
// Helps site leads take targeted corrective action.
// =============================================================================

import { useMemo } from 'react';
import type { ScoredInsight, GeneratorContext } from './types';
import { useDefects } from '../../services/siteLeadDataService';
import { logPrediction } from '../calibration';
import { gt } from '../generatorTranslations';

export function useDefectClusterInsight(ctx: GeneratorContext): ScoredInsight | null {
  const { defects } = useDefects();

  return useMemo(() => {
    const openDefects = defects.filter(d => d.status === 'open');
    if (openDefects.length < 2) return null;

    // Cluster by trade
    const byTrade: Record<string, number> = {};
    for (const d of openDefects) {
      byTrade[d.trade] = (byTrade[d.trade] || 0) + 1;
    }

    // Cluster by location (first word as zone)
    const byZone: Record<string, number> = {};
    for (const d of openDefects) {
      const zone = d.location.split(/[\s\-–,]/)[0] || 'Onbekend';
      byZone[zone] = (byZone[zone] || 0) + 1;
    }

    // Find dominant cluster
    const tradeEntries = Object.entries(byTrade).sort((a, b) => b[1] - a[1]);
    const zoneEntries = Object.entries(byZone).sort((a, b) => b[1] - a[1]);
    const topTrade = tradeEntries[0];
    const topZone = zoneEntries[0];

    // Severity distribution
    const highSeverity = openDefects.filter(d => d.severity === 'hoog').length;
    const totalOpen = openDefects.length;

    // Calculate age of oldest open defect
    const oldestAge = Math.max(...openDefects.map(d =>
      Math.ceil((ctx.now.getTime() - new Date(d.date).getTime()) / 86400000)
    ));

    logPrediction({
      generatorId: 'defect-cluster',
      predictedAt: new Date().toISOString(),
      prediction: `${totalOpen} open gebreken, ${highSeverity} hoog`,
      predictedValue: totalOpen,
    });

    const priority = highSeverity >= 2 || oldestAge > 14 ? 'high' : totalOpen >= 4 ? 'medium' : 'low';

    // Determine most actionable insight
    let title: string;
    let message: string;
    let observation: string;
    let suggestion: string;

    const tradeConcentration = topTrade && topTrade[1] >= totalOpen * 0.5 && topTrade[1] >= 2;
    const zoneConcentration = topZone && topZone[1] >= totalOpen * 0.5 && topZone[1] >= 2;

    if (tradeConcentration) {
      title = `${topTrade[1]}/${totalOpen} gebreken bij ${topTrade[0]}`;
      message = `Meer dan de helft van openstaande gebreken zit bij ${topTrade[0]}. Dit wijst op een structureel probleem — overweeg een gerichte kwaliteitscontrole.`;
      observation = `${topTrade[1]} van ${totalOpen} gebreken geconcentreerd bij ${topTrade[0]}`;
      suggestion = `Plan een gerichte QC-ronde voor ${topTrade[0]} en bespreek het met de uitvoerder`;
    } else if (zoneConcentration) {
      title = `${topZone[1]} gebreken in zone ${topZone[0]}`;
      message = `Zone ${topZone[0]} heeft ${topZone[1]} openstaande gebreken. Geconcentreerde problemen suggereren een lokaal kwaliteitsprobleem.`;
      observation = `${topZone[1]} gebreken geconcentreerd in zone ${topZone[0]}`;
      suggestion = `Inspecteer zone ${topZone[0]} grondig en identificeer de gemeenschappelijke oorzaak`;
    } else if (oldestAge > 14) {
      title = `Gebrek al ${oldestAge} dagen open`;
      message = `${totalOpen} openstaande gebreken, waarvan het oudste al ${oldestAge} dagen loopt. Langlopende gebreken worden duurder om op te lossen.`;
      observation = `Oudste open gebrek is ${oldestAge} dagen oud`;
      suggestion = 'Prioriteer de langstlopende gebreken — vertraagde reparatie vergroot het risico';
    } else {
      title = `${totalOpen} openstaande gebreken`;
      message = `${highSeverity > 0 ? `Waarvan ${highSeverity} met hoge ernst. ` : ''}Houd het overzicht en sluit gebreken tijdig af.`;
      observation = `${totalOpen} open gebreken, ${highSeverity} hoog`;
      suggestion = 'Werk de gebrekenlijst systematisch af, begin met hoge ernst';
    }

    return {
      id: `defect-cluster-${Date.now()}`,
      generatorId: 'defect-cluster',
      category: 'quality',
      priority,
      title,
      message,
      icon: 'construct',
      actionLabel: 'Gebreken',
      actionRoute: '/sitelead/close-defect',
      source: gt('source_quality', ctx.language),

      rootCauseTags: ['quality', 'defects', 'cluster'],
      rawScore: 0,
      reasoning: {
        observation,
        evidence: `Op basis van ${defects.length} geregistreerde gebreken (${totalOpen} open)`,
        implication: highSeverity > 0
          ? `${highSeverity} hoge-ernst gebreken verhogen opleverings­risico en herstelkosten`
          : 'Openstaande gebreken vertragen oplevering en verlagen klanttevredenheid',
        suggestion,
      },
      dataPoints: defects.length,
      confidence: Math.min(0.5 + defects.length * 0.05, 0.93),
      freshness: 1,
      ...(defects.length < 5 ? { confidenceWarning: 'Weinig gebreken geregistreerd — patronen worden duidelijker met meer data' } : {}),
      action: {
        type: 'close_defect',
        label: gt('action_handle_defects', ctx.language),
        params: { openCount: totalOpen },
        requiresApproval: false,
        estimatedImpact: `${totalOpen} ${gt('defect_close_impact', ctx.language)}`,
      },
    };
  }, [defects]);
}
