/**
 * The web privacy policy / terms, in the app's language.
 *
 * Both exist in all six languages (user, 2026-09-30). The web page also falls
 * back to the browser's language, but the app knows better — a German
 * contractor on an English phone reads the app in German.
 */
const DEFAULTS = {
  terms: 'https://vascobuild.com/terms',
  privacy: 'https://vascobuild.com/privacy',
} as const;

export function legalUrl(kind: 'terms' | 'privacy', language?: string): string {
  const base = (kind === 'terms' ? process.env.EXPO_PUBLIC_TERMS_URL : process.env.EXPO_PUBLIC_PRIVACY_URL) ?? DEFAULTS[kind];
  const lang = String(language ?? '').slice(0, 2).toLowerCase();
  if (!/^(en|nl|de|fr|es|it)$/.test(lang)) return base;
  return `${base}${base.includes('?') ? '&' : '?'}lang=${lang}`;
}
