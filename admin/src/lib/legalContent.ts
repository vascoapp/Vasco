import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

export type LegalSlug =
  | "privacy-policy"
  | "terms-of-service"
  | "cookie-policy"
  | "acceptable-use-policy"
  | "data-processing-agreement"
  | "eula"
  | "gdpr-data-subject-request-process";

const TITLES: Record<LegalSlug, string> = {
  "privacy-policy": "Privacy Policy",
  "terms-of-service": "Terms of Service",
  "cookie-policy": "Cookie Policy",
  "acceptable-use-policy": "Acceptable Use Policy",
  "data-processing-agreement": "Data Processing Agreement",
  eula: "End User Licence Agreement",
  "gdpr-data-subject-request-process": "GDPR Data Subject Request Process",
};

/**
 * Privacy + terms exist in all six app languages (user, 2026-09-30); the
 * other documents are English only. A translation lives at
 * `content/legal/<lang>/<slug>.md`; English stays at the root and is the
 * version that prevails. Guard: src/__tests__/legalTextsInEveryLanguage.test.ts.
 */
export const LEGAL_LANGS = ["en", "nl", "de", "fr", "es", "it"] as const;
export type LegalLang = (typeof LEGAL_LANGS)[number];

const LOCAL_TITLES: Partial<Record<LegalLang, Partial<Record<LegalSlug, string>>>> = {
  nl: { "privacy-policy": "Privacybeleid", "terms-of-service": "Gebruiksvoorwaarden" },
  de: { "privacy-policy": "Datenschutzerklärung", "terms-of-service": "Nutzungsbedingungen" },
  fr: { "privacy-policy": "Politique de confidentialité", "terms-of-service": "Conditions d'utilisation" },
  es: { "privacy-policy": "Política de privacidad", "terms-of-service": "Condiciones del servicio" },
  it: { "privacy-policy": "Informativa sulla privacy", "terms-of-service": "Termini di servizio" },
};

/** "de", "de-DE", "DE" → "de"; anything else → null. */
export function asLegalLang(value: unknown): LegalLang | null {
  const two = String(value ?? "").trim().slice(0, 2).toLowerCase();
  return (LEGAL_LANGS as readonly string[]).includes(two) ? (two as LegalLang) : null;
}

/** `?lang=` first, then the browser's Accept-Language, then English. */
export function pickLegalLang(query: unknown, acceptLanguage: string | null): LegalLang {
  const asked = asLegalLang(query);
  if (asked) return asked;
  for (const part of (acceptLanguage ?? "").split(",")) {
    const lang = asLegalLang(part.split(";")[0]);
    if (lang) return lang;
  }
  return "en";
}

function legalFile(slug: LegalSlug, lang: LegalLang): string {
  return lang === "en"
    ? path.join(process.cwd(), "content", "legal", `${slug}.md`)
    : path.join(process.cwd(), "content", "legal", lang, `${slug}.md`);
}

/** The languages this document actually exists in. */
export function legalLanguages(slug: LegalSlug): LegalLang[] {
  return LEGAL_LANGS.filter((lang) => existsSync(legalFile(slug, lang)));
}

export function legalTitle(slug: LegalSlug, lang: LegalLang = "en"): string {
  return LOCAL_TITLES[lang]?.[slug] ?? TITLES[slug];
}

/** The document in `lang` when it exists, else English — with the language used. */
export async function renderLegalPage(
  slug: LegalSlug,
  lang: LegalLang = "en",
): Promise<{ html: string; lang: LegalLang }> {
  const used: LegalLang = existsSync(legalFile(slug, lang)) ? lang : "en";
  const markdown = await readFile(legalFile(slug, used), "utf8");
  return { html: marked.parse(markdown, { async: false }) as string, lang: used };
}
