// =============================================================================
// PORTFOLIO IRR GENERATOR
// =============================================================================
// Tracks portfolio IRR vs target. Highlights underperforming projects and
// compares appraisal metrics across the portfolio.
// =============================================================================

import type { ScoredInsight, GeneratorContext } from './types';
import { mockAppraisals } from '../../data/mockProjects';
import { logPrediction } from '../calibration';
import { gt } from '../generatorTranslations';

const TARGET_IRR = 0.15; // 15% minimum target IRR

export function usePortfolioIRRInsight(ctx: GeneratorContext): ScoredInsight | null {
  if (ctx.role !== 'cfo' && ctx.role !== 'director') return null;

  const appraisals = Object.values(mockAppraisals);
  if (appraisals.length === 0) return null;

  // Calculate portfolio metrics
  const avgIRR = appraisals.reduce((sum, a) => sum + a.irr, 0) / appraisals.length;
  const totalGDV = appraisals.reduce((sum, a) => sum + a.gdv, 0);
  const totalCost = appraisals.reduce((sum, a) => sum + a.totalDevelopmentCost, 0);
  const totalProfit = totalGDV - totalCost;
  const portfolioMargin = totalGDV > 0 ? totalProfit / totalGDV : 0;

  // Find underperforming projects (below target IRR)
  const underperformers = appraisals.filter(a => a.irr < TARGET_IRR);
  const topPerformer = [...appraisals].sort((a, b) => b.irr - a.irr)[0];

  logPrediction({
    generatorId: 'portfolio-irr',
    predictedAt: new Date().toISOString(),
    prediction: `Portfolio IRR: ${(avgIRR * 100).toFixed(1)}%, ${underperformers.length} onder target van ${(TARGET_IRR * 100)}%`,
    predictedValue: avgIRR,
  });

  const isAboveTarget = avgIRR >= TARGET_IRR;
  const formatPct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const formatM = (v: number) => `£${(v / 1_000_000).toFixed(0)}M`;

  return {
    id: 'portfolio-irr',
    generatorId: 'portfolio-irr',
    category: 'financial',
    priority: underperformers.length >= 2 ? 'high' : isAboveTarget ? 'low' : 'medium',
    title: isAboveTarget ? 'Portfolio IRR boven target' : `Portfolio IRR onder target`,
    message: `Gemiddelde IRR: ${formatPct(avgIRR)} (target: ${formatPct(TARGET_IRR)}). ${underperformers.length > 0 ? `${underperformers.length} project${underperformers.length > 1 ? 'en' : ''} onder target.` : 'Alle projecten boven target.'} Portfolio winstmarge: ${formatPct(portfolioMargin)}.`,
    detail: `Totale GDV: ${formatM(totalGDV)}. Totale kosten: ${formatM(totalCost)}. Beste project: ${formatPct(topPerformer.irr)} IRR. ${underperformers.length > 0 ? `Laagste: ${formatPct(underperformers[0].irr)}.` : ''}`,
    icon: 'trending-up',
    actionLabel: 'Bekijk taxatie',
    actionRoute: '/hub/appraisal',
    source: gt('source_portfolio_irr', ctx.language),
    metric: { label: 'Gem. IRR', value: formatPct(avgIRR), trend: isAboveTarget ? 'up' : 'down' },
    rootCauseTags: ['irr', 'portfolio-returns'],
    rawScore: 0,
    reasoning: {
      observation: `Portfolio gemiddelde IRR is ${formatPct(avgIRR)}`,
      evidence: `${appraisals.length} projecten geanalyseerd, totale GDV ${formatM(totalGDV)}`,
      implication: isAboveTarget
        ? 'Portfolio presteert boven target — behoud huidige strategie'
        : `${underperformers.length} project${underperformers.length > 1 ? 'en drukken' : ' drukt'} het portfoliorendement`,
      suggestion: underperformers.length > 0
        ? 'Analyseer kostenstructuur van onderperformers — overweeg scope-optimalisatie'
        : 'Focus op het behouden van marges bij stijgende bouwkosten',
    },
    dataPoints: appraisals.length,
    confidence: 0.9,
    freshness: 6,
  };
}
