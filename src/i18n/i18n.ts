import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import en from './locales/en.json';
import enUS from './locales/en-US.json';
import nl from './locales/nl.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import it from './locales/it.json';

// R74 US foundation: prefer the device's full locale tag (en-US) over the
// language-only code (en) so American users get "Estimate" / "Sales tax"
// instead of "Quote" / "VAT". Other regions still resolve to their bare
// language code; en-US is the only region-specific variant we ship.
const deviceTag = getLocales()[0]?.languageTag ?? 'en';
const deviceLanguage = getLocales()[0]?.languageCode ?? 'en';
const resolvedLng = deviceTag === 'en-US' ? 'en-US' : deviceLanguage;
const supportedLangs = ['en', 'en-US', 'nl', 'de', 'fr', 'es', 'it'];
const fallbackLng = 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    // en-US is an OVERRIDE locale: only keys whose US English diverges
    // from base en are present. i18next's `fallbackLng` resolves missing
    // keys to en automatically. Re-generate via scripts/generate-en-us.mjs.
    'en-US': { translation: enUS },
    nl: { translation: nl },
    de: { translation: de },
    fr: { translation: fr },
    es: { translation: es },
    it: { translation: it },
  },
  lng: supportedLangs.includes(resolvedLng) ? resolvedLng : fallbackLng,
  fallbackLng: {
    'en-US': ['en'],
    default: [fallbackLng],
  },
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export default i18n;
