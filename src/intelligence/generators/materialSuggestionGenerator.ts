// =============================================================================
// MATERIAL SUGGESTION GENERATOR
// =============================================================================
// Looks at job type + past jobs of same type to suggest commonly used materials
// not yet added. Highlights if a supplier has a price drop.
// =============================================================================

import type { ScoredInsight, GeneratorContext } from './types';
import { useAppState } from '../../state/AppState';
import { logPrediction } from '../calibration';
import { gt } from '../generatorTranslations';

export function useMaterialSuggestionInsight(ctx: GeneratorContext): ScoredInsight | null {
  const { jobs, jobMaterials, materials, priceObservations } = useAppState();

  // Need jobs with materials to make suggestions
  const jobsWithMaterials = jobs.filter(j => {
    const jm = jobMaterials[j.id];
    return jm && jm.length > 0;
  });

  if (jobsWithMaterials.length < 2) return null;

  // Count material frequency across all jobs
  const materialFrequency = new Map<string, number>();
  for (const job of jobsWithMaterials) {
    const jm = jobMaterials[job.id] ?? [];
    for (const m of jm) {
      materialFrequency.set(m.materialId, (materialFrequency.get(m.materialId) ?? 0) + 1);
    }
  }

  // Find most commonly used materials (used in >50% of jobs)
  const threshold = Math.max(2, Math.floor(jobsWithMaterials.length * 0.5));
  const commonMaterials = [...materialFrequency.entries()]
    .filter(([, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1]);

  if (commonMaterials.length === 0) return null;

  // Find the top common material
  const [topMaterialId, topCount] = commonMaterials[0];
  const topMaterial = materials.find(m => m.id === topMaterialId);
  if (!topMaterial) return null;

  // Check for price drops in observations
  const obs = priceObservations[topMaterialId] ?? [];
  let priceDropNote = '';
  if (obs.length >= 2) {
    const sortedObs = [...obs].sort((a, b) =>
      new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime()
    );
    const latest = sortedObs[0];
    const previous = sortedObs[1];
    if (latest.price < previous.price) {
      const dropPct = Math.round(((previous.price - latest.price) / previous.price) * 100);
      priceDropNote = ` Prijsdaling: -${dropPct}% bij ${latest.supplierName ?? 'leverancier'}.`;
    }
  }

  // Log prediction for calibration
  logPrediction({
    generatorId: 'material-suggestion',
    predictedAt: new Date().toISOString(),
    prediction: `Meest gebruikte materiaal: ${topMaterial.name} (in ${topCount}/${jobsWithMaterials.length} klussen)`,
    predictedValue: topCount,
  });

  const usagePct = Math.round((topCount / jobsWithMaterials.length) * 100);

  return {
    id: 'material-suggestion',
    generatorId: 'material-suggestion',
    category: 'operational',
    priority: priceDropNote ? 'high' : 'medium',
    title: `Veelgebruikt: ${topMaterial.name}`,
    message: `${topMaterial.name} wordt gebruikt in ${usagePct}% van je klussen.${priceDropNote || ' Vergeet dit materiaal niet toe te voegen.'}`,
    detail: `${topCount} van ${jobsWithMaterials.length} klussen bevatten dit materiaal. Categorie: ${topMaterial.category}.`,
    icon: 'cube',
    actionLabel: 'Voeg toe',
    source: gt('source_material', ctx.language),
    metric: { label: 'Gebruik', value: `${usagePct}%`, trend: 'neutral' },

    rootCauseTags: ['materials', 'efficiency'],
    rawScore: 0,
    reasoning: {
      observation: `${topMaterial.name} is het meest gebruikte materiaal`,
      evidence: `Voorkomt in ${topCount} van ${jobsWithMaterials.length} klussen (${usagePct}%)`,
      implication: priceDropNote
        ? `Er is een prijsdaling — bestel nu voor betere marges`
        : `Voeg dit materiaal vroeg toe om vertragingen te voorkomen`,
      suggestion: 'Voeg veelgebruikte materialen standaard toe aan nieuwe klussen',
    },
    dataPoints: jobsWithMaterials.length,
    confidence: Math.min(0.85, 0.5 + jobsWithMaterials.length * 0.05),
    freshness: 4,
  };
}
