// Cross-Project Risk Generator - Identifies systematic risks spanning multiple projects
import type { ScoredInsight, GeneratorContext } from './types';
import { mockProjects } from '../../data/mockProjects';
import { logPrediction } from '../calibration';

export function useCrossProjectRiskInsight(ctx: GeneratorContext): ScoredInsight | null {
  if (ctx.role !== 'director') return null;

  // Collect all risks with their categories
  const allRisks = mockProjects.flatMap(p =>
    p.risks.map(r => ({ ...r, projectName: p.name }))
  );

  if (allRisks.length < 2) return null;

  // Group by category to find systematic risks
  const categoryMap = new Map<string, typeof allRisks>();
  for (const risk of allRisks) {
    const existing = categoryMap.get(risk.category) || [];
    existing.push(risk);
    categoryMap.set(risk.category, existing);
  }

  // Find categories with risks in 2+ projects
  const crossProjectCategories = Array.from(categoryMap.entries())
    .filter(([_, risks]) => {
      const uniqueProjects = new Set(risks.map(r => r.projectName));
      return uniqueProjects.size >= 2;
    })
    .sort((a, b) => {
      const avgScoreA = a[1].reduce((s, r) => s + r.score, 0) / a[1].length;
      const avgScoreB = b[1].reduce((s, r) => s + r.score, 0) / b[1].length;
      return avgScoreB - avgScoreA;
    });

  if (crossProjectCategories.length === 0) return null;

  const [topCategory, topRisks] = crossProjectCategories[0];
  const uniqueProjects = new Set(topRisks.map(r => r.projectName));
  const avgScore = topRisks.reduce((s, r) => s + r.score, 0) / topRisks.length;
  const maxScore = Math.max(...topRisks.map(r => r.score));

  logPrediction({
    generatorId: 'cross-project-risk',
    predictedAt: new Date().toISOString(),
    prediction: `Systematisch risico: ${topCategory} in ${uniqueProjects.size} projecten, gem. score ${avgScore.toFixed(0)}`,
    predictedValue: avgScore,
  });

  return {
    id: 'cross-project-risk',
    generatorId: 'cross-project-risk',
    category: 'alert',
    priority: maxScore >= 15 ? 'high' : avgScore >= 10 ? 'medium' : 'low',
    title: `Systematisch risico: ${topCategory}`,
    message: `Risico-categorie "${topCategory}" komt voor in ${uniqueProjects.size} projecten. Gemiddelde risicoscore: ${avgScore.toFixed(0)}. Dit wijst op een structureel probleem.`,
    detail: `Projecten: ${Array.from(uniqueProjects).join(', ')}. ${topRisks.length} individuele risico's. Hoogste score: ${maxScore}. Cross-project risico's vereisen een portfolio-brede aanpak.`,
    icon: 'layers',
    actionLabel: 'Bekijk risico\'s',
    actionRoute: '/hub/risks',
    source: 'Cross-Project Analyse',
    metric: { label: 'Projecten', value: `${uniqueProjects.size}`, trend: maxScore >= 15 ? 'down' : 'neutral' },
    rootCauseTags: ['cross-project', 'systematic-risk'],
    rawScore: 0,
    reasoning: {
      observation: `Risico-categorie "${topCategory}" is actief in ${uniqueProjects.size} projecten`,
      evidence: `${topRisks.length} individuele risico's, gem. score ${avgScore.toFixed(0)}, max ${maxScore}`,
      implication: maxScore >= 15
        ? 'Systematisch risico met kritieke individuele items — vereist portfolio-brede mitigatie'
        : 'Terugkerend patroon dat aandacht verdient voordat het escaleert',
      suggestion: maxScore >= 15
        ? 'Stel een task force samen voor deze risico-categorie en ontwikkel een portfolio-breed mitigatieplan'
        : 'Bespreek dit patroon in de volgende directie-vergadering en deel best practices tussen projectteams',
    },
    dataPoints: allRisks.length,
    confidence: 0.82,
    freshness: 6,
  };
}
