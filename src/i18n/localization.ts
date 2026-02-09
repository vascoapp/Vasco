import { CountryCode, LanguageCode, LocalizedText } from '../domain/complianceKnowledge';

export const defaultCountryLanguage: Record<CountryCode, LanguageCode> = {
  UK: 'en',
  NL: 'nl',
  DE: 'de',
  FR: 'fr',
  ES: 'es',
  IT: 'it',
};

const normalizeLanguageCode = (locale?: string): LanguageCode | null => {
  if (!locale) {
    return null;
  }
  const normalized = locale.toLowerCase().replace('_', '-').split('-')[0];
  switch (normalized) {
    case 'en':
    case 'nl':
    case 'de':
    case 'fr':
    case 'es':
    case 'it':
      return normalized;
    default:
      return null;
  }
};

export const getDeviceLocale = (): string | undefined => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
};

export const getPreferredLanguages = (options?: {
  userLanguage?: LanguageCode;
  deviceLocale?: string;
  country?: CountryCode;
}): LanguageCode[] => {
  const preferred: LanguageCode[] = [];
  if (options?.userLanguage) {
    preferred.push(options.userLanguage);
  }
  const deviceLanguage = normalizeLanguageCode(options?.deviceLocale);
  if (deviceLanguage && !preferred.includes(deviceLanguage)) {
    preferred.push(deviceLanguage);
  }
  if (options?.country) {
    const countryDefault = defaultCountryLanguage[options.country];
    if (!preferred.includes(countryDefault)) {
      preferred.push(countryDefault);
    }
  }
  if (!preferred.includes('en')) {
    preferred.push('en');
  }
  return preferred;
};

export const resolveLocalizedText = (
  fallback: string,
  localizations: LocalizedText | undefined,
  preferredLanguages: LanguageCode[],
): string => {
  if (!localizations) {
    return fallback;
  }
  for (const language of preferredLanguages) {
    const candidate = localizations[language];
    if (candidate) {
      return candidate;
    }
  }
  return fallback;
};
