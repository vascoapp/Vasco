// =============================================================================
// WEATHER SCHEDULE GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';

export const weatherScheduleGenerator: InsightGenerator = {
  id: 'weather-schedule',
  screens: ['today'],
  roles: ['contractor'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    // Mock weather data — in production this would come from a weather API
    const hour = ctx.now.getHours();
    const month = ctx.now.getMonth();
    const isWinter = month >= 10 || month <= 2;
    const showRainWarning = isWinter || Math.random() > 0.5; // Simulate weather conditions

    if (!showRainWarning) return null;

    return {
      id: 'ctx-weather',
      generatorId: 'weather-schedule',
      category: 'weather',
      priority: 'high',
      title: 'Regen verwacht',
      message: 'Tussen 14:00-17:00 wordt regen verwacht. Plan buitenwerk indien mogelijk voor de ochtend.',
      detail: 'Buienradar voorspelt 8mm neerslag. Overweeg om buitenwerkzaamheden te verplaatsen.',
      icon: 'rainy',
      source: 'Weer',
      timestamp: `${String(hour).padStart(2, '0')}:15`,

      rawScore: 0,
      reasoning: {
        observation: 'Regen verwacht vanmiddag (14:00-17:00)',
        evidence: 'Op basis van Buienradar weersvoorspelling',
        implication: 'Buitenwerk kan vertraging oplopen of kwaliteitsproblemen veroorzaken',
        suggestion: 'Verplaats buitenwerk naar de ochtend en plan binnenwerk voor de middag',
      },
      dataPoints: 1,
      confidence: 0.7,
      freshness: 0.5,
    };
  },
};
