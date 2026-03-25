// =============================================================================
// WEATHER SCHEDULE GENERATOR — wired to Open-Meteo real weather data
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { logPrediction } from '../calibration';
import { gt } from '../generatorTranslations';
import { getLastFetchedForecast } from '../../services/weatherService';
import i18n from '../../i18n/i18n';

export const weatherScheduleGenerator: InsightGenerator = {
  id: 'weather-schedule',
  screens: ['today'],
  roles: ['contractor'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    const hour = ctx.now.getHours();
    const t = i18n.t.bind(i18n);

    // Try real weather data first (populated by weatherService on app open)
    const forecast = getLastFetchedForecast();

    if (forecast) {
      // Use real data — check today and tomorrow
      const todayRain = forecast.today.rain;
      const tomorrowRain = forecast.tomorrow.rain;
      const tomorrowCold = forecast.tomorrow.tempMax < 2;
      const todayMm = forecast.today.precipitationMm;
      const tomorrowMm = forecast.tomorrow.precipitationMm;
      const tomorrowTemp = forecast.tomorrow.tempMax;

      // No weather warnings needed
      if (!todayRain && !tomorrowRain && !tomorrowCold) return null;

      // Log real prediction for calibration
      logPrediction({
        generatorId: 'weather-schedule',
        predictedAt: new Date().toISOString(),
        prediction: todayRain ? `Rain today: ${todayMm}mm` : `Rain tomorrow: ${tomorrowMm}mm`,
        predictedValue: todayRain ? todayMm : tomorrowMm,
      });

      // Build message based on actual conditions
      let title: string;
      let message: string;
      let detail: string;
      let priority: 'high' | 'medium' = 'medium';

      if (todayRain && todayMm > 5) {
        title = t('weather.heavyRainToday', { defaultValue: 'Heavy rain today' });
        message = t('weather.heavyRainTodayMsg', {
          defaultValue: '{{mm}}mm precipitation expected today. Move outdoor work indoors if possible.',
          mm: Math.round(todayMm),
        });
        detail = t('weather.heavyRainDetail', {
          defaultValue: 'Open-Meteo forecast: {{mm}}mm precipitation. Consider rescheduling outdoor tasks.',
          mm: Math.round(todayMm),
        });
        priority = 'high';
      } else if (todayRain) {
        title = t('weather.rainToday', { defaultValue: 'Rain expected today' });
        message = t('weather.rainTodayMsg', {
          defaultValue: '{{mm}}mm precipitation expected. Plan outdoor work for dry windows.',
          mm: Math.round(todayMm),
        });
        detail = t('weather.rainDetail', {
          defaultValue: 'Open-Meteo forecast: {{mm}}mm. Light rain may affect exterior work.',
          mm: Math.round(todayMm),
        });
      } else if (tomorrowCold) {
        title = t('weather.coldTomorrow', { defaultValue: 'Freezing temperatures tomorrow' });
        message = t('weather.coldTomorrowMsg', {
          defaultValue: 'Max {{temp}}°C tomorrow. Protect materials and plan for cold-weather procedures.',
          temp: Math.round(tomorrowTemp),
        });
        detail = t('weather.coldDetail', {
          defaultValue: 'Open-Meteo forecast: max {{temp}}°C. Concrete curing, paint application and sealant work affected.',
          temp: Math.round(tomorrowTemp),
        });
        priority = 'high';
      } else {
        title = t('weather.rainTomorrow', { defaultValue: 'Rain expected tomorrow' });
        message = t('weather.rainTomorrowMsg', {
          defaultValue: '{{mm}}mm precipitation expected tomorrow. Schedule outdoor work for today.',
          mm: Math.round(tomorrowMm),
        });
        detail = t('weather.rainTomorrowDetail', {
          defaultValue: 'Open-Meteo forecast: {{mm}}mm tomorrow. Prioritize exterior work today.',
          mm: Math.round(tomorrowMm),
        });
      }

      return {
        id: 'ctx-weather',
        generatorId: 'weather-schedule',
        category: 'weather',
        priority,
        title,
        message,
        detail,
        icon: tomorrowCold ? 'snow' : 'rainy',
        source: gt('source_weather', ctx.language),
        timestamp: `${String(hour).padStart(2, '0')}:15`,

        rootCauseTags: ['schedule', 'weather'],
        rawScore: 0,
        reasoning: {
          observation: todayRain
            ? t('weather.reasonObsToday', { defaultValue: 'Rain expected today ({{mm}}mm)', mm: Math.round(todayMm) })
            : tomorrowCold
              ? t('weather.reasonObsCold', { defaultValue: 'Freezing temperature tomorrow ({{temp}}°C)', temp: Math.round(tomorrowTemp) })
              : t('weather.reasonObsTomorrow', { defaultValue: 'Rain expected tomorrow ({{mm}}mm)', mm: Math.round(tomorrowMm) }),
          evidence: t('weather.reasonEvidence', { defaultValue: 'Open-Meteo weather forecast ({{country}})', country: forecast.country }),
          implication: t('weather.reasonImplication', { defaultValue: 'Outdoor work may be delayed or quality affected' }),
          suggestion: todayRain
            ? t('weather.reasonSugToday', { defaultValue: 'Move outdoor tasks indoors and plan indoor work' })
            : t('weather.reasonSugTomorrow', { defaultValue: 'Prioritize outdoor work today, plan indoor work for tomorrow' }),
        },
        dataPoints: 1,
        confidence: 0.85,
        freshness: 0.9,
      };
    }

    // Fallback: deterministic mock when no real data available
    const month = ctx.now.getMonth();
    const isWinter = month >= 10 || month <= 2;
    const dayOfMonth = ctx.now.getDate();
    const showRainWarning = isWinter || (dayOfMonth % 3 !== 0);

    if (!showRainWarning) return null;

    logPrediction({
      generatorId: 'weather-schedule',
      predictedAt: new Date().toISOString(),
      prediction: 'Rain expected (mock fallback)',
      predictedValue: 8,
    });

    return {
      id: 'ctx-weather',
      generatorId: 'weather-schedule',
      category: 'weather',
      priority: 'high',
      title: t('weather.rainToday', { defaultValue: 'Rain expected today' }),
      message: t('weather.genericRainMsg', { defaultValue: 'Rain expected this afternoon. Plan outdoor work for the morning if possible.' }),
      detail: t('weather.genericRainDetail', { defaultValue: 'Forecast predicts ~8mm precipitation. Consider rescheduling exterior work.' }),
      icon: 'rainy',
      source: gt('source_weather', ctx.language),
      timestamp: `${String(hour).padStart(2, '0')}:15`,

      rootCauseTags: ['schedule', 'weather'],
      rawScore: 0,
      reasoning: {
        observation: t('weather.reasonObsGeneric', { defaultValue: 'Rain expected this afternoon' }),
        evidence: t('weather.reasonEvidenceGeneric', { defaultValue: 'Weather forecast (connect weather API for real data)' }),
        implication: t('weather.reasonImplication', { defaultValue: 'Outdoor work may be delayed or quality affected' }),
        suggestion: t('weather.reasonSugToday', { defaultValue: 'Move outdoor tasks indoors and plan indoor work' }),
      },
      dataPoints: 1,
      confidence: 0.5, // Lower confidence for mock data
      freshness: 0.5,
    };
  },
};
