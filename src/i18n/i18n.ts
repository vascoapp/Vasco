import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import en from './locales/en.json';
import nl from './locales/nl.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import it from './locales/it.json';

const deviceLanguage = getLocales()[0]?.languageCode ?? 'en';
const supportedLangs = ['en', 'nl', 'de', 'fr', 'es', 'it'];
const fallbackLng = 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    nl: { translation: nl },
    de: { translation: de },
    fr: { translation: fr },
    es: { translation: es },
    it: { translation: it },
  },
  lng: supportedLangs.includes(deviceLanguage) ? deviceLanguage : fallbackLng,
  fallbackLng,
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export default i18n;
