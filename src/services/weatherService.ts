// =============================================================================
// WEATHER SERVICE — Real weather data from Open-Meteo (free, no API key)
// =============================================================================
// Fetches 3-day forecast, caches in AsyncStorage for 6 hours.
// Used by weatherScheduleGenerator to provide real rain/temperature warnings.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DayForecast {
  rain: boolean;       // true if precipitation > 1mm
  precipitationMm: number;
  tempMax: number;     // Celsius
}

export interface WeatherForecast {
  today: DayForecast;
  tomorrow: DayForecast;
  fetchedAt: string;
  country: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_KEY = '@vasco_weather_cache';
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Default coordinates per country (capital/major city) */
const COUNTRY_COORDS: Record<string, { lat: number; lon: number }> = {
  NL: { lat: 52.37, lon: 4.89 },    // Amsterdam
  DE: { lat: 52.52, lon: 13.41 },   // Berlin
  FR: { lat: 48.86, lon: 2.35 },    // Paris
  ES: { lat: 40.42, lon: -3.70 },   // Madrid
  IT: { lat: 41.90, lon: 12.50 },   // Rome
  UK: { lat: 51.51, lon: -0.13 },   // London
};

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

async function getCachedForecast(country: string): Promise<WeatherForecast | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: WeatherForecast = JSON.parse(raw);
    // Check if cache is still valid (same country + within 6 hours)
    if (cached.country !== country) return null;
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    if (age > CACHE_DURATION_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

async function setCachedForecast(forecast: WeatherForecast): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(forecast));
  } catch {
    // Cache write is best-effort
  }
}

// ---------------------------------------------------------------------------
// API fetch
// ---------------------------------------------------------------------------

async function fetchFromOpenMeteo(country: string): Promise<WeatherForecast> {
  const coords = COUNTRY_COORDS[country] || COUNTRY_COORDS.NL;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=precipitation_sum,temperature_2m_max&timezone=auto&forecast_days=3`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json();
  const daily = data.daily;

  if (!daily || !daily.precipitation_sum || !daily.temperature_2m_max) {
    throw new Error('Invalid weather API response');
  }

  const makeDayForecast = (index: number): DayForecast => ({
    rain: (daily.precipitation_sum[index] ?? 0) > 1,
    precipitationMm: daily.precipitation_sum[index] ?? 0,
    tempMax: daily.temperature_2m_max[index] ?? 15,
  });

  const forecast: WeatherForecast = {
    today: makeDayForecast(0),
    tomorrow: makeDayForecast(1),
    fetchedAt: new Date().toISOString(),
    country,
  };

  await setCachedForecast(forecast);
  _lastForecast = forecast;
  return forecast;
}

// ---------------------------------------------------------------------------
// Module-level cache for synchronous access (used by generators)
// ---------------------------------------------------------------------------

let _lastForecast: WeatherForecast | null = null;

/**
 * Synchronous getter for the last fetched forecast.
 * Returns null if no forecast has been fetched yet in this session.
 * Generators that run synchronously can use this after app startup fetches weather.
 */
export function getLastFetchedForecast(): WeatherForecast | null {
  return _lastForecast;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get 2-day weather forecast for the given country.
 * Returns cached data if available (< 6 hours old), otherwise fetches fresh.
 * Falls back to a safe default if the API is unreachable.
 */
export async function getWeatherForecast(country: string = 'NL'): Promise<WeatherForecast> {
  const normalizedCountry = country.toUpperCase();

  // Try cache first
  const cached = await getCachedForecast(normalizedCountry);
  if (cached) {
    _lastForecast = cached;
    return cached;
  }

  // Fetch fresh data
  try {
    return await fetchFromOpenMeteo(normalizedCountry);
  } catch {
    // Fallback: assume mild weather so we don't block the app
    return {
      today: { rain: false, precipitationMm: 0, tempMax: 15 },
      tomorrow: { rain: false, precipitationMm: 0, tempMax: 15 },
      fetchedAt: new Date().toISOString(),
      country: normalizedCountry,
    };
  }
}

/**
 * Returns true if tomorrow's weather warrants a warning:
 * - Rain > 5mm
 * - Temperature < 2 degrees C
 */
export async function shouldWarnAboutWeather(country: string = 'NL'): Promise<boolean> {
  const forecast = await getWeatherForecast(country);
  return forecast.tomorrow.precipitationMm > 5 || forecast.tomorrow.tempMax < 2;
}
